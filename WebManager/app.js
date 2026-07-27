/**
 * SmartMarketBot - Web Manager Logic
 * Pure Canvas Implementation for Topological Graph Management
 */

// State
const PIXEL_TO_METER = 0.006; // 1px = 0.6cm -> 50px grid = 0.3 meter (30cm)
let nodes = [];
let edges = [];
let shapes = []; // Contains obstacles/shelves: { id, type: 'rect'|'circle', x, y, w, h, r, color }
let mapImage = null;
let currentTool = 'select';
let selectedNodeId = null;
let selectedShapeId = null;

// Unsaved items temporary ID counter (negative to distinguish from database IDs)
let tempIdCounter = -1;
function getNextTempId() {
    return tempIdCounter--;
}

// Live Robot State
let robotLiveX = null;
let robotLiveY = null;
let robotLiveStatus = 'OFFLINE';
let lastKnownMode = null;
let lastKnownWpStatus = null;

// View transform
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let isDraggingMap = false;
let startDrag = { x: 0, y: 0 };

// Canvas Setup
const wrapper = document.getElementById('mapWrapper');
const bgCanvas = document.getElementById('bgCanvas');
const graphCanvas = document.getElementById('graphCanvas');
const bgCtx = bgCanvas.getContext('2d');
const ctx = graphCanvas.getContext('2d');

function resizeCanvas() {
    bgCanvas.width = wrapper.clientWidth;
    bgCanvas.height = wrapper.clientHeight;
    graphCanvas.width = wrapper.clientWidth;
    graphCanvas.height = wrapper.clientHeight;
    draw();
}
window.addEventListener('resize', resizeCanvas);
setTimeout(resizeCanvas, 100);

// Image Upload Handling
document.getElementById('mapUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            mapImage = img;
            // Fit map to screen
            const scaleX = graphCanvas.width / img.width;
            const scaleY = graphCanvas.height / img.height;
            scale = Math.min(scaleX, scaleY) * 0.9;
            offsetX = (graphCanvas.width - img.width * scale) / 2;
            offsetY = (graphCanvas.height - img.height * scale) / 2;
            draw();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// Tools Selection
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTool = btn.dataset.tool;
        
        if (currentTool === 'select') {
            graphCanvas.style.cursor = 'default';
        } else if (currentTool === 'node') {
            graphCanvas.style.cursor = 'crosshair';
            selectedNodeId = null;
            selectedShapeId = null;
            hideProperties();
        } else {
            graphCanvas.style.cursor = 'crosshair';
            selectedNodeId = null;
            selectedShapeId = null;
            hideProperties();
        }
        draw();
    });
});

// Canvas Interaction Logic
let tempEdgeStartNode = null;
let tempShapeStart = null;
let isDraggingShape = false;

graphCanvas.addEventListener('mousedown', (e) => {
    const rect = graphCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Convert screen coordinates to world coordinates
    const worldX = (mouseX - offsetX) / scale;
    const worldY = (mouseY - offsetY) / scale;

    if (isRouteMode) {
        const clickedNode = findNodeAt(worldX, worldY);
        if (clickedNode) {
            if (!routeSelectedNodes.includes(clickedNode.id)) {
                routeSelectedNodes.push(clickedNode.id);
                updateRouteSelectedNodesUI();
                draw();
            }
        }
        return;
    }

    if (currentTool === 'select') {
        const clickedNode = findNodeAt(worldX, worldY);
        const clickedShape = findShapeAt(worldX, worldY);
        
        if (clickedNode) {
            selectedNodeId = clickedNode.id;
            selectedShapeId = null;
            showProperties(clickedNode, 'node');
        } else if (clickedShape) {
            selectedShapeId = clickedShape.id;
            selectedNodeId = null;
            showProperties(clickedShape, 'shape');
            isDraggingShape = true;
            startDrag = { x: worldX, y: worldY };
        } else {
            selectedNodeId = null;
            selectedShapeId = null;
            hideProperties();
            isDraggingMap = true;
            startDrag = { x: mouseX - offsetX, y: mouseY - offsetY };
        }
    } 
    else if (currentTool === 'node') {
        const newNode = {
            id: getNextTempId(),
            name: `Node ${nodes.length + 1}`,
            type: 'WAYPOINT',
            x: worldX,
            y: worldY
        };
        nodes.push(newNode);
        selectedNodeId = newNode.id;
        showProperties(newNode);
        currentTool = 'select'; // auto switch back to select
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-tool="select"]').classList.add('active');
    }
    else if (currentTool === 'edge') {
        const clickedNode = findNodeAt(worldX, worldY);
        if (clickedNode) {
            if (!tempEdgeStartNode) {
                tempEdgeStartNode = clickedNode;
            } else {
                if (tempEdgeStartNode.id !== clickedNode.id) {
                    // Create edge
                    const dist = Math.hypot(clickedNode.x - tempEdgeStartNode.x, clickedNode.y - tempEdgeStartNode.y);
                    edges.push({
                        id: getNextTempId(),
                        from: tempEdgeStartNode.id,
                        to: clickedNode.id,
                        distance: (dist * PIXEL_TO_METER).toFixed(2)
                    });
                }
                tempEdgeStartNode = null;
            }
        }
    }
    else if (currentTool === 'erase') {
        const clickedNode = findNodeAt(worldX, worldY);
        const clickedShape = findShapeAt(worldX, worldY);
        if (clickedNode) {
            nodes = nodes.filter(n => n.id !== clickedNode.id);
            edges = edges.filter(e => e.from !== clickedNode.id && e.to !== clickedNode.id);
            hideProperties();
        } else if (clickedShape) {
            shapes = shapes.filter(s => s.id !== clickedShape.id);
        }
    }
    else if (currentTool === 'rect' || currentTool === 'circle') {
        tempShapeStart = { x: worldX, y: worldY };
    }
    
    draw();
});

graphCanvas.addEventListener('mousemove', (e) => {
    const rect = graphCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldX = (mouseX - offsetX) / scale;
    const worldY = (mouseY - offsetY) / scale;

    if (isDraggingMap && currentTool === 'select' && !isDraggingShape) {
        offsetX = (mouseX) - startDrag.x;
        offsetY = (mouseY) - startDrag.y;
        draw();
    } else if (isDraggingShape && currentTool === 'select' && selectedShapeId) {
        const shape = shapes.find(s => s.id === selectedShapeId);
        if (shape) {
            const dx = worldX - startDrag.x;
            const dy = worldY - startDrag.y;
            shape.x += dx;
            shape.y += dy;
            startDrag = { x: worldX, y: worldY };
            draw();
        }
    } else if (tempShapeStart && (currentTool === 'rect' || currentTool === 'circle')) {
        draw();
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2 / scale;
        
        if (currentTool === 'rect') {
            const w = worldX - tempShapeStart.x;
            const h = worldY - tempShapeStart.y;
            ctx.fillRect(tempShapeStart.x, tempShapeStart.y, w, h);
            ctx.strokeRect(tempShapeStart.x, tempShapeStart.y, w, h);
        } else if (currentTool === 'circle') {
            const r = Math.hypot(worldX - tempShapeStart.x, worldY - tempShapeStart.y);
            ctx.beginPath();
            ctx.arc(tempShapeStart.x, tempShapeStart.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    }
});

graphCanvas.addEventListener('mouseup', (e) => {
    if (tempShapeStart && (currentTool === 'rect' || currentTool === 'circle')) {
        const rect = graphCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = (mouseX - offsetX) / scale;
        const worldY = (mouseY - offsetY) / scale;

        if (currentTool === 'rect') {
            shapes.push({
                id: getNextTempId(),
                type: 'rect',
                name: 'Kệ Hàng ' + (shapes.length + 1),
                object_type: 'PRODUCT_SHELF',
                x: tempShapeStart.x,
                y: tempShapeStart.y,
                w: worldX - tempShapeStart.x,
                h: worldY - tempShapeStart.y,
                color: 'rgba(239, 68, 68, 0.5)' // Red for obstacle/shelf
            });
        } else if (currentTool === 'circle') {
            const r = Math.hypot(worldX - tempShapeStart.x, worldY - tempShapeStart.y);
            shapes.push({
                id: getNextTempId(),
                type: 'circle',
                name: 'Vật thể ' + (shapes.length + 1),
                object_type: 'OBSTACLE',
                x: tempShapeStart.x,
                y: tempShapeStart.y,
                r: r,
                color: 'rgba(234, 179, 8, 0.5)' // Yellow for columns/misc
            });
        }
        tempShapeStart = null;
        draw();
    }
    isDraggingMap = false;
    isDraggingShape = false;
});

// Zoom controls
graphCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    if (e.deltaY < 0) scale *= zoomFactor;
    else scale /= zoomFactor;
    draw();
});

document.getElementById('btnZoomIn').onclick = () => { scale *= 1.2; draw(); };
document.getElementById('btnZoomOut').onclick = () => { scale /= 1.2; draw(); };
document.getElementById('btnResetView').onclick = () => {
    if(!mapImage) return;
    const scaleX = graphCanvas.width / mapImage.width;
    const scaleY = graphCanvas.height / mapImage.height;
    scale = Math.min(scaleX, scaleY) * 0.9;
    offsetX = (graphCanvas.width - mapImage.width * scale) / 2;
    offsetY = (graphCanvas.height - mapImage.height * scale) / 2;
    draw();
};

// Find Node Utility
function findNodeAt(x, y) {
    const hitRadius = 15 / scale;
    for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (Math.hypot(n.x - x, n.y - y) <= hitRadius) {
            return n;
        }
    }
    return null;
}

function findShapeAt(x, y) {
    for (let i = shapes.length - 1; i >= 0; i--) {
        const s = shapes[i];
        if (s.type === 'rect') {
            const minX = Math.min(s.x, s.x + s.w);
            const maxX = Math.max(s.x, s.x + s.w);
            const minY = Math.min(s.y, s.y + s.h);
            const maxY = Math.max(s.y, s.y + s.h);
            if (x >= minX && x <= maxX && y >= minY && y <= maxY) return s;
        } else if (s.type === 'circle') {
            if (Math.hypot(s.x - x, s.y - y) <= s.r) return s;
        }
    }
    return null;
}

// Draw Routine
function draw() {
    // Clear
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    ctx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);

    bgCtx.save();
    ctx.save();

    bgCtx.translate(offsetX, offsetY);
    bgCtx.scale(scale, scale);
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Draw Map
    if (mapImage) {
        bgCtx.drawImage(mapImage, 0, 0);
    } else {
        // Grid pattern đẹp (ROS Light theme) — vẽ trên toàn bộ viewport
        // Mỗi 50px = 1m (resolution 0.05m)
        const gridSize = 50;
        const minX = -offsetX / scale;
        const minY = -offsetY / scale;
        const maxX = (graphCanvas.width - offsetX) / scale;
        const maxY = (graphCanvas.height - offsetY) / scale;
        // Light theme background
        bgCtx.fillStyle = '#f8fafc';
        bgCtx.fillRect(minX, minY, maxX - minX, maxY - minY);

        // Minor grid (10cm) mỗi 10px
        bgCtx.strokeStyle = '#e2e8f0';
        bgCtx.lineWidth = 0.5 / scale;
        bgCtx.beginPath();
        for (let x = Math.floor(minX / 10) * 10; x <= maxX; x += 10) {
            bgCtx.moveTo(x, minY); bgCtx.lineTo(x, maxY);
        }
        for (let y = Math.floor(minY / 10) * 10; y <= maxY; y += 10) {
            bgCtx.moveTo(minX, y); bgCtx.lineTo(maxX, y);
        }
        bgCtx.stroke();

        // Major grid (1m) mỗi 50px
        bgCtx.strokeStyle = '#cbd5e1';
        bgCtx.lineWidth = 1 / scale;
        bgCtx.beginPath();
        for (let x = Math.floor(minX / 50) * 50; x <= maxX; x += 50) {
            bgCtx.moveTo(x, minY); bgCtx.lineTo(x, maxY);
        }
        for (let y = Math.floor(minY / 50) * 50; y <= maxY; y += 50) {
            bgCtx.moveTo(minX, y); bgCtx.lineTo(maxX, y);
        }
        bgCtx.stroke();

        // Origin marker (0,0)
        bgCtx.strokeStyle = '#94a3b8';
        bgCtx.lineWidth = 1.5 / scale;
        bgCtx.beginPath();
        bgCtx.arc(0, 0, 8 / scale, 0, Math.PI * 2);
        bgCtx.stroke();
        bgCtx.fillStyle = '#94a3b8';
        bgCtx.font = `${11/scale}px Inter`;
        bgCtx.textAlign = 'left';
        bgCtx.textBaseline = 'top';
        bgCtx.fillText('Origin (0,0)', 12 / scale, 12 / scale);
    }

    // ========== SLAM Realtime Overlay (render occupancyGrid nếu có data) ==========
    if (showSlamGridLayer && occupancyGrid && occupancyGrid.data && occupancyGrid.data.length > 0) {
        const og = occupancyGrid;
        const ogRes = og.RESOLUTION || 0.05;
        const cellPx = 1.0 / (PIXEL_TO_METER * ogRes);   // pixel per cell (ở scale=1)
        const occCol = Math.round(og.COLS / 2);
        const occRow = Math.round(og.ROWS / 2);
        const L_OCC = og.L_OCC || 1.8;
        const L_FREE = og.L_THRESH_FREE || -0.5;
        const localScale = scale * PIXEL_TO_METER;  // 1 data-cell = 1 cellPx * localScale pixel

        bgCtx.save();
        bgCtx.fillStyle = 'rgba(248, 250, 252, 0.85)';
        // Convert (col, row) → (world x, y) theo ROS convention
        // x = (col - ORIGIN_COL) * RESOLUTION
        // y = (row - ORIGIN_ROW) * RESOLUTION
        // ROS y tăng lên = bắc, canvas y tăng xuống. Cần flip Y.
        const visibleCells = Math.min(og.data.length, 50000);  // giới hạn tối đa
        const step = Math.max(1, Math.floor(og.data.length / visibleCells));
        for (let i = 0; i < og.data.length; i += step) {
            const lo = og.data[i];
            const col = i % og.COLS;
            const row = Math.floor(i / og.COLS);
            const worldX = (col - occCol) * ogRes;
            const worldY = -(row - occRow) * ogRes;  // flip Y
            const pxX = worldX / PIXEL_TO_METER;
            const pxY = worldY / PIXEL_TO_METER;
            const cs = cellPx * scale;
            if (lo >= L_OCC * 0.85) {
                bgCtx.fillStyle = 'rgba(10, 10, 10, 0.9)';
                bgCtx.fillRect(pxX, pxY, cellPx, cellPx);
            } else if (lo < L_FREE) {
                // Free — không vẽ (để background grid hiện)
            } else {
                bgCtx.fillStyle = 'rgba(127, 140, 141, 0.4)';
                bgCtx.fillRect(pxX, pxY, cellPx, cellPx);
            }
        }
        bgCtx.restore();
    }

    // Draw Edges
    edges.forEach(edge => {
        const n1 = nodes.find(n => n.id === edge.from);
        const n2 = nodes.find(n => n.id === edge.to);
        if(!n1 || !n2) return;
        
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.lineTo(n2.x, n2.y);
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
        ctx.lineWidth = 4 / scale;
        ctx.stroke();

        // Edge distance label
        const midX = (n1.x + n2.x)/2;
        const midY = (n1.y + n2.y)/2;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(midX - 15/scale, midY - 10/scale, 30/scale, 20/scale);
        ctx.fillStyle = '#60a5fa';
        ctx.font = `${12/scale}px Inter`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${edge.distance}m`, midX, midY);
    });

    // Draw active preview route or routeSelectedNodes in editing mode
    let nodesToDrawRoute = [];
    if (isRouteMode && routeSelectedNodes.length > 0) {
        nodesToDrawRoute = routeSelectedNodes.map(id => nodes.find(n => n.id === id)).filter(Boolean);
    } else if (activePreviewRoute && activePreviewRoute.waypoints && activePreviewRoute.waypoints.length > 0) {
        nodesToDrawRoute = activePreviewRoute.waypoints.map(wp => nodes.find(n => n.id === wp.nodeId)).filter(Boolean);
    }

    if (nodesToDrawRoute.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(nodesToDrawRoute[0].x, nodesToDrawRoute[0].y);
        for (let i = 1; i < nodesToDrawRoute.length; i++) {
            ctx.lineTo(nodesToDrawRoute[i].x, nodesToDrawRoute[i].y);
        }
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.9)'; // Amber orange color
        ctx.lineWidth = 6 / scale;
        ctx.setLineDash([8 / scale, 6 / scale]); // Dashed line
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash
        ctx.restore();

        // Draw directional arrows
        for (let i = 0; i < nodesToDrawRoute.length - 1; i++) {
            const p1 = nodesToDrawRoute[i];
            const p2 = nodesToDrawRoute[i + 1];
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            
            ctx.save();
            ctx.translate(midX, midY);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(-6 / scale, -4 / scale);
            ctx.lineTo(6 / scale, 0);
            ctx.lineTo(-6 / scale, 4 / scale);
            ctx.closePath();
            ctx.fillStyle = '#f59e0b';
            ctx.fill();
            ctx.restore();
        }
    }

    // Draw Shapes
    shapes.forEach(shape => {
        const isSelected = selectedShapeId === shape.id;
        ctx.fillStyle = shape.color;
        ctx.strokeStyle = isSelected ? '#ffffff' : '#000000';
        ctx.lineWidth = (isSelected ? 3 : 1) / scale;
        
        ctx.beginPath();
        let textX = shape.x;
        let textY = shape.y;

        if (shape.type === 'rect') {
            ctx.rect(shape.x, shape.y, shape.w, shape.h);
            textX = shape.x + shape.w / 2;
            textY = shape.y + shape.h / 2;
        } else if (shape.type === 'circle') {
            ctx.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.stroke();

        // Shape Name Label
        if (shape.name) {
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.font = `600 ${12/scale}px Inter`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(shape.name, textX, textY);
        }
    });

    // Draw Nodes
    nodes.forEach(node => {
        const isSelected = selectedNodeId === node.id;
        let color = '#94a3b8'; // default WAYPOINT
        if(node.type === 'GATE') color = '#22c55e';
        if(node.type === 'SHELF_FRONT') color = '#eab308';
        if(node.type === 'DOCK_CHARGING') color = '#3b82f6';

        ctx.beginPath();
        ctx.arc(node.x, node.y, (isSelected ? 10 : 8) / scale, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = (isSelected ? 4 : 2) / scale;
        ctx.strokeStyle = isSelected ? '#ffffff' : '#0f172a';
        ctx.stroke();

        // Node Name Label
        ctx.fillStyle = 'white';
        ctx.font = `bold ${14/scale}px Inter`;
        ctx.textAlign = 'center';
        ctx.fillText(node.name, node.x, node.y - 15/scale);
    });

    // Draw Live Robot from API
    if (robotLiveX !== null && robotLiveY !== null) {
        const px = robotLiveX / PIXEL_TO_METER;
        const py = robotLiveY / PIXEL_TO_METER;
        
        ctx.beginPath();
        ctx.arc(px, py, 15/scale, 0, Math.PI*2);
        ctx.fillStyle = robotLiveStatus === 'NAVIGATING' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)';
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(px, py, 6/scale, 0, Math.PI*2);
        ctx.fillStyle = robotLiveStatus === 'NAVIGATING' ? '#3b82f6' : '#10b981';
        ctx.fill();
        
        // Label
        ctx.fillStyle = 'white';
        ctx.font = `bold ${11/scale}px Inter`;
        ctx.textAlign = 'center';
        ctx.fillText("ROBOT", px, py - 20/scale);

        // Draw Live 360° LiDAR Scan Cloud around Robot (RViz-style)
        if (showLidarScanCloud && window.liveLidarScanPoints && window.liveLidarScanPoints.length > 0) {
            // Vẽ tia (ray) từ robot → điểm (gradient alpha theo khoảng cách)
            const maxR = 6.0; // 6m
            ctx.lineWidth = 1.0 / scale;
            window.liveLidarScanPoints.forEach(pt => {
                const distM = Math.hypot(pt.x, pt.y);
                const lx = px + (pt.x / PIXEL_TO_METER);
                const ly = py + (pt.y / PIXEL_TO_METER);
                const alpha = Math.max(0.15, 1.0 - (distM / maxR));
                if (alpha < 0.1) return; // bỏ điểm quá xa
                // Ray
                ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.5})`;
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(lx, ly);
                ctx.stroke();
                // Hit point
                ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
                const r = Math.max(2.0, 4.0 * (1 - distM / maxR)) / scale;
                ctx.fillRect(lx - r/2, ly - r/2, r, r);
            });
        }
    }

    bgCtx.restore();
    ctx.restore();

    // ===== Update Map Stats overlay (góc trên-trái) =====
    updateMapStatsOverlay();
}

// ===== Map Stats Overlay update =====
let _mapStatsCache = { occ: -1, free: -1, grid: '' };
function updateMapStatsOverlay() {
    const og = (typeof window !== 'undefined' && window.occupancyGrid) || (typeof occupancyGrid !== 'undefined' ? occupancyGrid : null);
    if (!og || !og.data) return;
    const res = og.RESOLUTION || 0.05;
    const grid = `${og.COLS} × ${og.ROWS}`;
    const elRes = document.getElementById('mapStatRes');
    const elGrid = document.getElementById('mapStatGrid');
    const elOcc = document.getElementById('mapStatOcc');
    const elFree = document.getElementById('mapStatFree');
    if (elRes) elRes.textContent = (res * 100).toFixed(1) + 'cm';
    if (elGrid) elGrid.textContent = grid;
    // % occupied/free (đếm mỗi 2 frame để tránh lag)
    if (_mapStatsCache.grid !== grid) {
        _mapStatsCache.grid = grid;
        const L_OCC = og.L_OCC || 1.8;
        const L_FREE = og.L_THRESH_FREE || -0.5;
        let occ = 0, free = 0;
        for (let i = 0; i < og.data.length; i++) {
            const lo = og.data[i];
            if (lo >= L_OCC * 0.85) occ++;
            else if (lo < L_FREE) free++;
        }
        const total = og.data.length;
        _mapStatsCache.occ = (occ / total * 100).toFixed(1);
        _mapStatsCache.free = (free / total * 100).toFixed(1);
    }
    if (elOcc) elOcc.textContent = _mapStatsCache.occ + '%';
    if (elFree) elFree.textContent = _mapStatsCache.free + '%';
}

// ===== Mouse coordinate indicator (drag để xem tọa độ) =====
const mapCoordIndicator = document.getElementById('mapCoordIndicator');
if (mapCoordIndicator) {
    const wrapper = document.getElementById('mapWrapper');
    if (wrapper) {
        wrapper.addEventListener('mousemove', (e) => {
            const rect = wrapper.getBoundingClientRect();
            const canvasX = (e.clientX - rect.left);
            const canvasY = (e.clientY - rect.top);
            // Convert sang world coordinates theo biến offsetX, scale
            const worldX = ((canvasX - offsetX) / scale) * PIXEL_TO_METER;
            const worldY = ((canvasY - offsetY) / scale) * PIXEL_TO_METER;
            const elX = document.getElementById('mapCoordX');
            const elY = document.getElementById('mapCoordY');
            if (elX) elX.textContent = worldX.toFixed(2) + 'm';
            if (elY) elY.textContent = worldY.toFixed(2) + 'm';
        });
    }
}

// Properties Panel Logic
const propPanel = document.getElementById('propertiesPanel');
const propPanelTitle = document.getElementById('propPanelTitle');
const propNameLabel = document.getElementById('propNameLabel');
const propTypeLabel = document.getElementById('propTypeLabel');
const propName = document.getElementById('propName');
const propType = document.getElementById('propType');

function showProperties(obj, mode) {
    propPanel.classList.remove('hidden');
    propName.value = obj.name || '';
    
    // Setup select options dynamically based on mode (node or shape)
    propType.innerHTML = '';
    if (mode === 'node') {
        propPanelTitle.textContent = "Thuộc tính Node";
        propNameLabel.textContent = "Tên Node";
        propTypeLabel.textContent = "Loại Node";
        
        const opts = [
            { value: 'WAYPOINT', text: 'WAYPOINT (Điểm rẽ)' },
            { value: 'SHELF_FRONT', text: 'SHELF_FRONT (Mặt kệ)' },
            { value: 'DOCK_CHARGING', text: 'DOCK_CHARGING (Trạm sạc)' },
            { value: 'GATE', text: 'GATE (Cổng vào)' }
        ];
        opts.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.value;
            opt.textContent = o.text;
            if (obj.type === o.value) opt.selected = true;
            propType.appendChild(opt);
        });
    } else if (mode === 'shape') {
        propPanelTitle.textContent = "Ngữ Nghĩa Quầy Kệ";
        propNameLabel.textContent = "Tên Quầy/Vật thể";
        propTypeLabel.textContent = "Phân Loại";
        
        const opts = [
            { value: 'PRODUCT_SHELF', text: 'Kệ Hàng (Sản phẩm)' },
            { value: 'PROMOTION_ZONE', text: 'Khu Khuyến Mãi' },
            { value: 'OBSTACLE', text: 'Vật Cản Cố Định' }
        ];
        opts.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.value;
            opt.textContent = o.text;
            if (obj.object_type === o.value) opt.selected = true;
            propType.appendChild(opt);
        });
    }
}

function hideProperties() {
    propPanel.classList.add('hidden');
}

propName.addEventListener('input', (e) => {
    if(selectedNodeId) {
        const n = nodes.find(n => n.id === selectedNodeId);
        if(n) { n.name = e.target.value; draw(); }
    } else if (selectedShapeId) {
        const s = shapes.find(s => s.id === selectedShapeId);
        if(s) { s.name = e.target.value; draw(); }
    }
});

propType.addEventListener('input', (e) => {
    if(selectedNodeId) {
        const n = nodes.find(n => n.id === selectedNodeId);
        if(n) { n.type = e.target.value; draw(); }
    } else if (selectedShapeId) {
        const s = shapes.find(s => s.id === selectedShapeId);
        if(s) { s.object_type = e.target.value; draw(); }
    }
});

let BASE_URL = localStorage.getItem('smb_backend_url') || 'https://interiorly-pinnatisect-adalyn.ngrok-free.dev';
let ROBOT_IP = localStorage.getItem('smb_robot_ip') || '192.168.4.1';

document.getElementById('btnSaveMap').addEventListener('click', async () => {
    // Chuyển đổi dữ liệu từ Web Manager sang định dạng DTO của Backend
    // Vấn đề 1: ID trên Web đang dùng Date.now() quá lớn so với kiểu int32 của Backend. Phải map lại thành số từ 1, 2, 3...
    // Vấn đề 2: Tọa độ x, y phải nhân với PIXEL_TO_METER để ra số thực (mét).
    const beNodes = nodes.map(n => {
        // Nếu ID âm hoặc null -> truyền nguyên bản để BE biết là nút mới cần sinh ID
        // Nếu ID dương -> truyền đúng ID của DB để BE biết là nút đã có
        return {
            nodeId: n.id,
            nodeName: n.name || `Node ${n.id}`,
            xCoord: parseFloat(n.x * PIXEL_TO_METER) || 0.0,
            yCoord: parseFloat(n.y * PIXEL_TO_METER) || 0.0,
            nodeType: n.type || 'WAYPOINT',
            isBlocked: false
        };
    });

    const beEdges = edges.map(e => ({
        edgeId: null, // Để database tự sinh khóa
        fromNodeId: e.from,
        toNodeId: e.to,
        distance: parseFloat(e.distance) || 0.0,
        isBidirectional: true
    }));

    // Lọc cực gắt:
    // 1. Bỏ các cạnh nối chính nó (from === to) -> Gây ra lỗi Key (3, 3) khi add vào Dictionary 2 chiều ở C#
    // 2. Bỏ các cạnh trùng lặp (duplicate)
    const seenEdges = new Set();
    const beEdgesFiltered = [];
    beEdges.forEach(e => {
        if (e.fromNodeId === e.toNodeId) return; // Bỏ self-loop
        
        // Chuẩn hoá key để check duplicate (vd: 3-4 và 4-3 là 1)
        const key1 = `${e.fromNodeId}-${e.toNodeId}`;
        const key2 = `${e.toNodeId}-${e.fromNodeId}`;
        
        if (!seenEdges.has(key1) && !seenEdges.has(key2)) {
            seenEdges.add(key1);
            beEdgesFiltered.push(e);
        }
    });

    const beSemanticObjects = shapes.map(s => {
        const rX = parseFloat(s.x * PIXEL_TO_METER) || 0.0;
        const rY = parseFloat(s.y * PIXEL_TO_METER) || 0.0;
        const rW = parseFloat((s.w || (s.r * 2)) * PIXEL_TO_METER) || 0.1;
        const rH = parseFloat((s.h || (s.r * 2)) * PIXEL_TO_METER) || 0.1;
        return {
            objectId: s.id > 0 ? s.id : null, // Nếu đã có id dương từ DB thì truyền, ngược lại null
            objectType: s.object_type || 'OBSTACLE',
            xMin: rX,
            yMin: rY,
            xMax: rX + rW,
            yMax: rY + rH,
            label: s.name || 'Object',
            confidence: 1.0,
            detectedAt: new Date().toISOString(),
            imageUrl: ""
        };
    });

    const w = mapImage ? mapImage.width : graphCanvas.width;
    const h = mapImage ? mapImage.height : graphCanvas.height;
    
    const data = {
        floorId: 1,
        mapName: "Bản đồ Web Manager",
        widthMeters: parseFloat((w * PIXEL_TO_METER).toFixed(2)),
        heightMeters: parseFloat((h * PIXEL_TO_METER).toFixed(2)),
        mapData: JSON.stringify({ version: "1.0", nodes, edges, shapes }),
        nodes: beNodes,
        edges: beEdgesFiltered,
        semanticObjects: beSemanticObjects
    };

    try {
        const overlay = document.getElementById('loadingOverlay');
        const text = document.getElementById('loadingText');
        overlay.classList.replace('hidden', 'flex');
        text.textContent = 'Đang đồng bộ lên Server...';
        
        const res = await fetch(`${BASE_URL}/api/v1/maps/sync`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': '69420'
            },
            body: JSON.stringify(data)
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Mã lỗi ${res.status}: ${errText}`);
        }

        setTimeout(() => {
            overlay.classList.replace('flex', 'hidden');
            alert('Lưu dữ liệu lên Server thành công!');
            if (window.setTab) window.setTab('route');
        }, 800);
    } catch (err) {
        console.error(err);
        document.getElementById('loadingOverlay').classList.replace('flex', 'hidden');
        alert('Lỗi khi lưu lên Server: ' + err.message);
    }
});

document.getElementById('btnLoadMapFromServer').addEventListener('click', async () => {
    try {
        const overlay = document.getElementById('loadingOverlay');
        const text = document.getElementById('loadingText');
        overlay.classList.replace('hidden', 'flex');
        text.textContent = 'Đang tải Map từ Server...';

        const res = await fetch(`${BASE_URL}/api/v1/maps/latest?floorId=1`, {
            method: 'GET',
            headers: { 
                'Accept': 'application/json',
                'ngrok-skip-browser-warning': '69420'
            }
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`API Error ${res.status}: ${errText}`);
        }

        const data = await res.json();
        
        // Convert Backend DTOs back to Web Manager Javascript Objects
        if (data.nodes && Array.isArray(data.nodes)) {
            nodes = data.nodes.map(n => ({
                id: n.nodeId,
                name: n.nodeName,
                type: n.nodeType,
                x: n.xCoord / PIXEL_TO_METER,
                y: n.yCoord / PIXEL_TO_METER
            }));
        }
        
        if (data.edges && Array.isArray(data.edges)) {
            edges = data.edges.map(e => ({
                id: e.edgeId,
                from: e.fromNodeId,
                to: e.toNodeId,
                distance: e.distance
            }));
        }
        
        if (data.semanticObjects && Array.isArray(data.semanticObjects)) {
            shapes = data.semanticObjects.map(s => {
                const w = (s.xMax - s.xMin) / PIXEL_TO_METER;
                const h = (s.yMax - s.yMin) / PIXEL_TO_METER;
                return {
                    id: s.objectId,
                    type: 'rect', // Mặc định vẽ hình chữ nhật
                    object_type: s.objectType,
                    name: s.label,
                    x: s.xMin / PIXEL_TO_METER,
                    y: s.yMin / PIXEL_TO_METER,
                    w: w,
                    h: h,
                    color: 'rgba(234, 179, 8, 0.4)'
                };
            });
        }
        
        selectedNodeId = null;
        selectedShapeId = null;
        
        // Reset các biến Start/End để tránh giữ ID tạm thời cũ
        navStartNodeId = null;
        navEndNodeId = null;
        document.getElementById('lblStartNode').textContent = "Chưa chọn";
        document.getElementById('lblStartNode').removeAttribute('title');
        document.getElementById('lblEndNode').textContent = "Chưa chọn";
        document.getElementById('lblEndNode').removeAttribute('title');
        
        hideProperties();
        loadFixedRoutes();
        draw();

        setTimeout(() => {
            overlay.classList.replace('flex', 'hidden');
            alert('Đã tải và đồng bộ Map mới nhất từ Server! Vui lòng CHỌN LẠI điểm Start và End trên bản đồ mới tải về.');
        }, 800);
    } catch (err) {
        console.error(err);
        document.getElementById('loadingOverlay').classList.replace('flex', 'hidden');
        alert('Lỗi khi tải từ Server: ' + err.message + '\n\nCó thể Backend chưa bật hoặc chưa có API này.');
    }
});

// JSON Export/Import Logic
document.getElementById('btnExportJson').addEventListener('click', () => {
    const data = {
        version: "1.0",
        nodes,
        edges,
        shapes
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smartmarket_map.json';
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById('btnImportJson').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (data.nodes) nodes = data.nodes;
            if (data.edges) edges = data.edges;
            if (data.shapes) shapes = data.shapes;
            selectedNodeId = null;
            selectedShapeId = null;
            hideProperties();
            draw();
            alert("Đã tải dữ liệu Map thành công!");
        } catch (err) {
            alert("File JSON không hợp lệ.");
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
});

// --- NAVIGATION SYSTEM ---
let navStartNodeId = null;
let navEndNodeId = null;

document.getElementById('btnSetStart').addEventListener('click', () => {
    if (!selectedNodeId) return alert('Vui lòng CHỌN 1 NODE bằng công cụ "Chọn" trước!');
    const n = nodes.find(x => x.id === selectedNodeId);
    if (!n) return;
    navStartNodeId = n.id;
    document.getElementById('lblStartNode').textContent = n.name || `Node ${n.id}`;
    document.getElementById('lblStartNode').title = `ID: ${n.id}`;
});

document.getElementById('btnSetEnd').addEventListener('click', () => {
    if (!selectedNodeId) return alert('Vui lòng CHỌN 1 NODE bằng công cụ "Chọn" trước!');
    const n = nodes.find(x => x.id === selectedNodeId);
    if (!n) return;
    navEndNodeId = n.id;
    document.getElementById('lblEndNode').textContent = n.name || `Node ${n.id}`;
    document.getElementById('lblEndNode').title = `ID: ${n.id}`;
});

// Helper function to fetch route from BE
async function fetchRoute(startId, endId) {
    const res = await fetch(`${BASE_URL}/api/Navigation/route`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify({
            startNodeId: parseInt(startId),
            endNodeId: parseInt(endId)
        })
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Lỗi tính toán Route từ Node ${startId} đến Node ${endId} (${res.status}): ${errText}`);
    }
    return await res.json();
}

document.getElementById('btnSimulate').addEventListener('click', async () => {
    if (!navStartNodeId || !navEndNodeId) {
        return alert('Vui lòng thiết lập đủ Điểm Start và Điểm End trước khi gửi lệnh!');
    }
    
    // Kiểm tra nếu các Node đang dùng ID tạm âm chưa được lưu lên Server
    if (parseInt(navStartNodeId) < 0 || parseInt(navEndNodeId) < 0) {
        return alert('⚠️ Dữ liệu chưa đồng bộ!\n\nCác Node/Đường nối mới vẽ chưa được lưu lên Server. Vui lòng bấm nút "Lưu lên Server" và sau đó bấm "Tải từ Server" để cập nhật ID chuẩn từ database trước khi chạy!');
    }
    
    const robotCode = document.getElementById('inpRobotCode').value.trim() || 'RB001';
    const btn = document.getElementById('btnSimulate');
    const oldHtml = btn.innerHTML;
    
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin mr-2"></i> Đang Gửi...';
    btn.disabled = true;

    try {
        let routeData = null;
        let waypoints = [];

        // 1. Tự động định vị Robot: Tìm Node gần vị trí hiện tại của Robot nhất
        let closestNodeId = null;
        if (robotLiveX !== null && robotLiveY !== null && nodes.length > 0) {
            let minDist = Infinity;
            nodes.forEach(n => {
                const rx = n.x * PIXEL_TO_METER;
                const ry = n.y * PIXEL_TO_METER;
                const dx = rx - robotLiveX;
                const dy = ry - robotLiveY;
                const dist = Math.hypot(dx, dy);
                if (dist < minDist) {
                    minDist = dist;
                    closestNodeId = n.id;
                }
            });
            console.log(`[Định vị] Robot đang ở vị trí (${robotLiveX.toFixed(2)}m, ${robotLiveY.toFixed(2)}m), gần Node ${closestNodeId} nhất (khoảng cách ${minDist.toFixed(2)}m).`);
        }

        // 2. Tính lộ trình ghép
        // Nếu robot ở xa Node bắt đầu (closestNodeId khác navStartNodeId) -> Tính đường gom từ robot tới StartNode trước
        if (closestNodeId !== null && parseInt(closestNodeId) !== parseInt(navStartNodeId)) {
            console.log(`[Lộ trình] Đang ghép tuyến đường gom từ vị trí Robot (Node ${closestNodeId}) -> Điểm bắt đầu (Node ${navStartNodeId})...`);
            try {
                const routeToStart = await fetchRoute(closestNodeId, navStartNodeId);
                if (routeToStart && routeToStart.nodes && routeToStart.nodes.length > 0) {
                    waypoints = routeToStart.nodes.map(n => ({
                        x: parseFloat(n.x),
                        y: parseFloat(n.y),
                        nodeId: parseInt(n.nodeId)
                    }));
                }
            } catch (e) {
                console.warn("[Lộ trình] Không tìm được đường gom từ Robot tới Node bắt đầu, robot sẽ tự chạy từ Điểm bắt đầu.", e);
            }
        }

        // 3. Tính lộ trình chính từ Điểm bắt đầu tới Điểm đích
        const mainRoute = await fetchRoute(navStartNodeId, navEndNodeId);
        if (mainRoute && mainRoute.nodes && mainRoute.nodes.length > 0) {
            const mainWaypoints = mainRoute.nodes.map(n => ({
                x: parseFloat(n.x),
                y: parseFloat(n.y),
                nodeId: parseInt(n.nodeId)
            }));

            // Ghép 2 lộ trình, tránh trùng lặp điểm nối ở giữa
            if (waypoints.length > 0 && mainWaypoints.length > 0 && waypoints[waypoints.length - 1].nodeId === mainWaypoints[0].nodeId) {
                waypoints = waypoints.concat(mainWaypoints.slice(1));
            } else {
                waypoints = waypoints.concat(mainWaypoints);
            }
        } else {
            throw new Error("Không tìm thấy đường đi khả thi giữa Điểm Start và Điểm End.");
        }

        routeData = {
            totalDistance: 0.0,
            nodes: waypoints.map(wp => ({
                nodeId: wp.nodeId,
                x: wp.x,
                y: wp.y
            }))
        };

        const navigatePayload = JSON.stringify({ waypoints });

        if (isRobotWsConnected) {
            // --- CHẾ ĐỘ WS TRỰC TIẾP (OFFLINE) ---
            sendRobotCommand(null, 'navigate', navigatePayload);
            console.log("Sent navigate payload directly via WebSocket:", navigatePayload);
        } 
        else {
            // --- CHẾ ĐỘ MQTT (ONLINE) ---
            // Bắn lệnh qua API command trung gian của BE để gửi gói JSON Waypoints đầy đủ
            const payload = {
                robotCode: robotCode,
                command: "navigate",
                payload: navigatePayload
            };
            
            console.log("Sending Navigate Command via Backend MQTT:", payload);

            const resNavigate = await fetch(`${BASE_URL}/api/Robots/command`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': '69420'
                },
                body: JSON.stringify(payload)
            });

            if (!resNavigate.ok) {
                const errText = await resNavigate.text();
                throw new Error(`Lỗi Gửi Navigate qua MQTT Backend (${resNavigate.status}): ${errText}`);
            }
        }

        btn.innerHTML = '<i data-lucide="check" class="w-4 h-4 mr-2"></i> Đã ra lệnh Robot!';
        btn.classList.replace('bg-blue-600', 'bg-emerald-600');
        
        // Cập nhật giao diện danh sách các Node sẽ đi qua
        const list = document.getElementById('routeList');
        if (routeData && routeData.nodes && Array.isArray(routeData.nodes) && routeData.nodes.length > 0) {
            let html = '';
            routeData.nodes.forEach((rNode, idx) => {
                const nodeId = rNode.nodeId;
                const n = nodes.find(x => parseInt(x.id) === parseInt(nodeId));
                const nName = n ? (n.name || `Node ${nodeId}`) : `Node ID: ${nodeId}`;
                const isLast = idx === routeData.nodes.length - 1;
                
                let colorClass = "bg-slate-600";
                let statusText = "Chờ xử lý";
                let pulseClass = "";
                
                if (idx === 0) {
                    colorClass = "bg-emerald-500";
                    statusText = "Bắt đầu";
                } else if (idx === 1) {
                    colorClass = "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]";
                    statusText = "Đang tới...";
                    pulseClass = "animate-pulse";
                } else if (isLast) {
                    statusText = "Đích đến";
                }

                html += `
                <div class="relative ${isLast ? '' : 'mb-4'}">
                    <div class="absolute -left-[21px] top-1 w-3 h-3 ${colorClass} rounded-full border-2 border-slate-900 ${pulseClass}"></div>
                    <div class="text-sm font-semibold text-white">${nName}</div>
                    <div class="text-xs ${idx === 0 ? 'text-emerald-400' : (idx === 1 ? 'text-blue-400' : 'text-slate-400')}">${statusText}</div>
                </div>`;
            });
            list.innerHTML = html;
        } else {
            list.innerHTML = `<div class="text-sm text-slate-400 font-medium italic">Không tìm thấy đường đi khả thi.</div>`;
        }
    } catch (err) {
        console.error("Navigation Error:", err);
        alert('Lỗi khi Navigate: ' + err.message);
    } finally {
        setTimeout(() => {
            btn.innerHTML = oldHtml;
            btn.classList.replace('bg-emerald-600', 'bg-blue-600');
            btn.disabled = false;
            lucide.createIcons();
        }, 2000);
        lucide.createIcons();
    }
});

// --- LIVE TRACKING ---
async function pollRobotLivePose() {
    try {
        const robotCode = document.getElementById('inpRobotCode')?.value.trim() || 'RB001';
        
        // 1. Lấy Toạ Độ (Pose)
        const resPose = await fetch(`${BASE_URL}/api/Robots/${robotCode}/pose`, {
            headers: { 'ngrok-skip-browser-warning': '69420' }
        });
        
        if (resPose.ok) {
            const data = await resPose.json();
            robotLiveX = data.x;
            robotLiveY = data.y;
            
            document.getElementById('robotX').textContent = data.x.toFixed(2) + 'm';
            document.getElementById('robotY').textContent = data.y.toFixed(2) + 'm';
        }

        // 2. Lấy Trạng Thái (Status)
        const resStatus = await fetch(`${BASE_URL}/api/Robots`, {
            headers: { 'ngrok-skip-browser-warning': '69420' }
        });
        
        if (resStatus.ok) {
            const robots = await resStatus.json();
            const r = robots.find(x => x.robotCode === robotCode);
            if (r) {
                robotLiveStatus = r.status || 'UNKNOWN';
                const statusEl = document.getElementById('robotStatus') || document.getElementById('robotStatusBadge');
                if (statusEl) {
                    if (statusEl.id === 'robotStatusBadge') {
                        statusEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span> ${robotLiveStatus}`;
                    } else {
                        statusEl.textContent = robotLiveStatus;
                    }
                }

                // --- TỰ ĐỘNG PHÁT HIỆN IP CỦA ROBOT (AUTO IP DISCOVERY) ---
                if (r.ipAddress && r.ipAddress !== ROBOT_IP && r.ipAddress !== "0.0.0.0" && r.ipAddress.trim() !== "") {
                    console.log(`[AutoIP] Phát hiện IP mới từ Backend: ${r.ipAddress} (IP cũ: ${ROBOT_IP})`);
                    ROBOT_IP = r.ipAddress;
                    localStorage.setItem('smb_robot_ip', r.ipAddress);
                    
                    // Kích hoạt kết nối lại WebSocket đến IP mới
                    if (robotWs) {
                        robotWs.close();
                    } else {
                        connectRobotWs();
                    }
                }
            }
        }
        
        draw(); // Cập nhật lại canvas với vị trí mới của robot
    } catch (err) {
        // Silent fail (không in log liên tục nếu Backend chưa bật)
    }
    
    // Polling mỗi 1 giây
    setTimeout(pollRobotLivePose, 1000);
}

// ============================================================
// ★ LIVE RENDER LOOP (requestAnimationFrame)
// Vẽ lại mỗi 16ms (60fps) khi SLAM đang chạy — giúp map update
// mượt như RViz realtime, không bị giật khi robot di chuyển.
// Không tốn CPU khi SLAM tắt vì sẽ skip draw() sau dirty-check.
// ============================================================
let _liveRenderEnabled = false;
let _lastRenderMs = 0;
function liveRenderLoop() {
    if (_liveRenderEnabled && SlamEngine.isInitialized) {
        const nowMs = performance.now();
        // Throttle ~33fps (30ms) để tránh chiếm dụng CPU quá mức
        if (nowMs - _lastRenderMs >= 33) {
            _lastRenderMs = nowMs;
            if (typeof draw === 'function') draw();
        }
    }
    requestAnimationFrame(liveRenderLoop);
}
requestAnimationFrame(liveRenderLoop);

// Bật/tắt live render từ UI
window.setLiveRender = function(enabled) {
    _liveRenderEnabled = !!enabled;
    console.log(`[LIVE-RENDER] ${enabled ? 'BẬT' : 'TẮT'} render mượt 30fps`);
};
// Mặc định BẬT
window.setLiveRender(true);

// Kích hoạt Live Tracking sau khi load trang
setTimeout(pollRobotLivePose, 2000);

// --- SPEED CONTROL & MOTOR TEST COMBINED (DIRECT WS + MQTT FALLBACK) ---
let robotWs = null;
let isRobotWsConnected = false;

function connectRobotWs() {
    if (robotWs) return;
    try {
        robotWs = new WebSocket(`ws://${ROBOT_IP}:81`);
        
        robotWs.onopen = () => {
            isRobotWsConnected = true;
            console.log('[RobotWS] Connected to robot WebSocket (port 81) directly.');
            updateWsStatusBadge(true);
            try {
                robotWs.send(JSON.stringify({ t: 'layoutGet' }));
                robotWs.send(JSON.stringify({ t: 'motorLayoutGet' }));
            } catch (err) {
                console.error('[RobotWS] Failed to query layouts on connect:', err);
            }
        };
        
        robotWs.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.t === 'layout') {
                    for (let i = 0; i < 4; i++) {
                        const su = document.getElementById('cfgUs' + i);
                        const se = document.getElementById('cfgEnc' + i);
                        if (su && data.us && data.us[i] !== undefined) su.value = String(data.us[i]);
                        if (se && data.enc && data.enc[i] !== undefined) se.value = String(data.enc[i]);
                    }
                    const s = document.getElementById('cfgLidF');
                    if (s && data.lidF !== undefined) s.value = String(data.lidF);
                    appendSerialLog('[WS-Direct] Đã đồng bộ cấu hình cảm biến từ Robot.');
                    return;
                }
                if (data.t === 'layoutErr') {
                    appendSerialLog('[WS-Direct] Lỗi cấu hình cảm biến: ' + (data.msg || 'không hợp lệ'));
                    alert('Lỗi cấu hình cảm biến: ' + (data.msg || 'không hợp lệ'));
                    return;
                }
                if (data.t === 'motLayout') {
                    for (let i = 0; i < 4; i++) {
                        const sm = document.getElementById('cfgMot' + i);
                        const si = document.getElementById('cfgInv' + i);
                        if (sm && data.mapMot && data.mapMot[i] !== undefined) sm.value = String(data.mapMot[i]);
                        if (si && data.motInv && data.motInv[i] !== undefined) si.checked = !!data.motInv[i];
                    }
                    const swm = document.getElementById('cfgWheelMode');
                    if (swm && data.wheelMode !== undefined) swm.value = String(data.wheelMode);
                    
                    appendSerialLog('[WS-Direct] Đã đồng bộ cấu hình động cơ từ Robot.');
                    return;
                }
                if (data.t === 'motLayoutErr') {
                    appendSerialLog('[WS-Direct] Lỗi cấu hình động cơ: ' + (data.msg || 'không hợp lệ'));
                    alert('Lỗi cấu hình động cơ: ' + (data.msg || 'không hợp lệ'));
                    return;
                }
                if (data.t === 'cfg') {
                    document.getElementById('cfgAlignThreshold').value = data.align;
                    document.getElementById('cfgRotateSpeedMin').value = data.minRot;
                    document.getElementById('cfgUsStopCm').value = data.stop;
                    document.getElementById('cfgUsOaDetectCm').value = data.detect;
                    document.getElementById('cfgUsPathClearCm').value = data.clear;
                    document.getElementById('cfgUsPathClearStreak').value = data.streak;
                    document.getElementById('cfgYawKp').value = data.kp;
                    document.getElementById('cfgYawKi').value = data.ki;
                    document.getElementById('cfgYawKd').value = data.kd;
                    appendSerialLog('[WS-Direct] Đã đồng bộ cấu hình tự hành từ Robot.');
                    return;
                }
                
                if (data.t === 'scan' || data.pts) {
                    const scanPts = (data.pts || []).map(pt => {
                        const deg = Array.isArray(pt) ? pt[0] : pt.a;
                        const distMm = Array.isArray(pt) ? pt[1] : pt.d;
                        const rad = (deg * Math.PI) / 180;
                        const distM = distMm / 1000.0;
                        return {
                            x: distM * Math.cos(rad),
                            y: distM * Math.sin(rad)
                        };
                    });
                    if (window.setLiveLidarPoints) {
                        window.setLiveLidarPoints(scanPts);
                    }
                    return;
                }

                // ====== AUTO SCAN MAP EVENTS (từ ESP32 broadcast) ======
                if (data.t === 'scan_progress') {
                    if (typeof window.onAutoScanProgress === 'function') {
                        window.onAutoScanProgress(
                            parseFloat(data.pct) || 0,
                            parseFloat(data.dist) || 0,
                            parseInt(data.durMs, 10) || 0,
                            parseInt(data.fsm, 10) || 0
                        );
                    }
                    return;
                }
                if (data.t === 'scan_complete') {
                    if (typeof window.onAutoScanComplete === 'function') {
                        window.onAutoScanComplete(
                            parseFloat(data.pct) || 0,
                            parseFloat(data.dist) || 0,
                            parseInt(data.durMs, 10) || 0
                        );
                    }
                    return;
                }

                if (data.type === 'lidar_log' || data.type === 'slam_log' || (data.t && data.t.includes('lidar'))) {
                    appendLidarLog(data.message || data.msg || data.text || '');
                } else if (data.type === 'log') {
                    const txt = data.message || '';
                    if (txt.includes('[LiDAR') || txt.includes('[YDLIDAR')) {
                        appendLidarLog(txt);
                    } else {
                        appendSerialLog(`[WS-Direct] ${txt}`);
                    }
                } else if (data.msg) {
                    const txt = typeof data.msg === 'string' ? data.msg : JSON.stringify(data.msg);
                    if (txt.includes('[LiDAR') || txt.includes('[YDLIDAR')) {
                        appendLidarLog(txt);
                    } else {
                        appendSerialLog(`[WS-Direct] ${txt}`);
                    }
                } else {
                    applyLiveTelemetry(data);
                }
            } catch (e) {
                const txt = String(event.data || '');
                if (txt.includes('[LiDAR') || txt.includes('[YDLIDAR')) {
                    appendLidarLog(txt);
                } else {
                    appendSerialLog(`[WS-Direct] ${txt}`);
                }
            }
        };
        
        robotWs.onclose = () => {
            robotWs = null;
            isRobotWsConnected = false;
            console.warn('[RobotWS] Robot WebSocket closed. Retrying in 3s...');
            updateWsStatusBadge(false);
            setTimeout(connectRobotWs, 3000);
        };
        
        robotWs.onerror = () => {
            // will trigger onclose
        };
    } catch (e) {
        console.warn('[RobotWS] Failed to open WebSocket:', e);
    }
}

function updateWsStatusBadge(connected) {
    const badge = document.getElementById('wsStatusBadge');
    if (!badge) return;
    if (connected) {
        badge.className = "flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-sm";
        badge.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></span><span class="text-slate-300">Robot: Kết nối trực tiếp (WS)</span>';
    } else {
        badge.className = "flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/40 border border-slate-800 text-sm";
        badge.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span><span class="text-slate-500">Robot: Chế độ MQTT (Từ xa)</span>';
    }
}

// Start attempting connection
connectRobotWs();

async function sendMqttCommand(command, value) {
    const robotCode = document.getElementById('inpRobotCode')?.value.trim() || 'RB001';
    try {
        const res = await fetch(`${BASE_URL}/api/Robots/command`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': '69420'
            },
            body: JSON.stringify({
                robotCode: robotCode,
                command: command,
                payload: String(value)
            })
        });
        if (!res.ok) {
            console.error(`Failed to send command ${command}: ${res.statusText}`);
        }
    } catch (err) {
        console.error(`Error sending command ${command}:`, err);
    }
}

function sendRobotCommand(command, wsType, value) {
    if (isRobotWsConnected && robotWs && robotWs.readyState === WebSocket.OPEN) {
        try {
            if (wsType === 'joy') {
                const sVal = Math.round((parseInt(value, 10) - 50) / 50 * 100);
                robotWs.send(JSON.stringify({ t: 'joy', x: 0, y: 0, s: sVal }));
            } else if (wsType === 'test_motor') {
                robotWs.send(JSON.stringify({ t: 'test_motor', payload: value }));
            } else if (wsType === 'mode') {
                robotWs.send(JSON.stringify({ t: 'mode', m: parseInt(value, 10) }));
            } else if (wsType === 'mode_auto_explore') {
                robotWs.send(JSON.stringify({ t: 'mode_auto_explore' }));
                console.log('[RobotWS] ▶ Sent mode_auto_explore to ESP32');
                appendSerialLog('[AUTO-SCAN] → ESP32: mode_auto_explore');
            } else if (wsType === 'scan_stop') {
                robotWs.send(JSON.stringify({ t: 'scan_stop' }));
                console.log('[RobotWS] ⏹ Sent scan_stop to ESP32');
            } else if (wsType === 'estop') {
                robotWs.send(JSON.stringify({ t: 'estop' }));
            } else if (wsType === 'odomReset') {
                robotWs.send(JSON.stringify({ t: 'odomReset' }));
            } else if (wsType === 'navigate') {
                robotWs.send(JSON.stringify({ t: 'navigate', payload: value }));
            } else {
                robotWs.send(JSON.stringify({ t: wsType, v: parseInt(value, 10) }));
            }
        } catch (e) {
            console.error('[RobotWS] Error sending command over WS:', e);
            sendMqttCommand(command, value);
        }
    } else {
        sendMqttCommand(command, value);
    }
}

// Helper to wire up sliders with both real-time WS (on input) and debounced MQTT (on change)
function wireSlider(sliderId, valId, command, wsType) {
    const slider = document.getElementById(sliderId);
    const valDisplay = document.getElementById(valId);
    if (!slider || !valDisplay) return;

    slider.addEventListener('input', (e) => {
        valDisplay.textContent = e.target.value + '%';
        if (isRobotWsConnected) {
            sendRobotCommand(command, wsType, e.target.value);
        }
    });

    slider.addEventListener('change', (e) => {
        valDisplay.textContent = e.target.value + '%';
        if (!isRobotWsConnected) {
            sendRobotCommand(command, wsType, e.target.value);
        }
    });
}

// Wire up the 6 sliders
wireSlider('spdSlider', 'spdVal', 'set_speed_manual', 'spd');
wireSlider('strSlider', 'strVal', 'set_strafe', 'joy');
wireSlider('rotSlider', 'rotVal', 'set_speed_rotate', 'spdRotate');
wireSlider('spdAutoSlider', 'spdAutoVal', 'set_speed_auto', 'spdAuto');
wireSlider('spdSwerveSlider', 'spdSwerveVal', 'set_speed_swerve', 'spdSwerve');
wireSlider('spdWaypointSlider', 'spdWaypointVal', 'set_speed_waypoint', 'spdWaypoint');
wireSlider('spdLineSlider', 'spdLineVal', 'set_speed_line', 'spdLine');
wireSlider('yawScaleSlider', 'yawScaleVal', 'set_yaw_scale', 'yawScale');

// Snap-to-90° slider — gửi giá trị tolerance (degrees) qua WS
(() => {
    const slider = document.getElementById('snap90Slider');
    const valEl  = document.getElementById('snap90Val');
    if (!slider || !valEl) return;
    slider.addEventListener('input', () => {
        valEl.textContent = slider.value + '°';
    });
    slider.addEventListener('change', () => {
        const deg = parseInt(slider.value, 10);
        // Gửi WS tới ESP32: {t: 'snap90', deg: deg}
        if (isRobotWsConnected && robotWs && robotWs.readyState === WebSocket.OPEN) {
            robotWs.send(JSON.stringify({ t: 'snap90', deg }));
            appendSerialLog(`[Snap-to-90] Đã set tolerance = ${deg}°`);
        }
    });
})();



// Settings modal tab switcher
window.switchSettingsTab = function(tabId) {
    const tabs = ['connection', 'sensors', 'motors', 'speed', 'auto'];
    tabs.forEach(t => {
        const content = document.getElementById('tabContent' + t.charAt(0).toUpperCase() + t.slice(1));
        const btn = document.getElementById('tabBtn' + t.charAt(0).toUpperCase() + t.slice(1));
        if (content) {
            if (t === tabId) {
                content.classList.remove('hidden');
            } else {
                content.classList.add('hidden');
            }
        }
        if (btn) {
            if (t === tabId) {
                btn.className = "flex-1 py-2 text-blue-400 border-b-2 border-blue-500 focus:outline-none";
            } else {
                btn.className = "flex-1 py-2 text-slate-400 hover:text-white border-b-2 border-transparent focus:outline-none";
            }
        }
    });
};

// Normalize SignalR remote telemetry properties to align with WS direct telemetry
function normalizeSignalRTelemetry(telemetry) {
    return {
        lf: telemetry.lidarFront,
        lb: telemetry.lidarRear,
        lfOn: telemetry.lidarFront !== null && telemetry.lidarFront !== undefined && telemetry.lidarFront < 800,
        lbOn: telemetry.lidarRear !== null && telemetry.lidarRear !== undefined && telemetry.lidarRear < 800,
        usLF: telemetry.usLF,
        usLR: telemetry.usLR,
        usRF: telemetry.usRF,
        usRR: telemetry.usRR,
        rFL: telemetry.rpmFL,
        rFR: telemetry.rpmFR,
        rRL: telemetry.rpmRL,
        rRR: telemetry.rpmRR,
        HeadingRad: telemetry.headingRad,
        batPct: telemetry.battery,
        batV: telemetry.battery !== null && telemetry.battery !== undefined ? (11.0 + (telemetry.battery / 100) * 1.6) : undefined,
        chip: undefined,
        cpuMHz: undefined,
        heap: undefined,
        tempC: undefined,
        mode: telemetry.mode,
        wpSt: telemetry.navState,
        usOn: [
            telemetry.usLF !== null && telemetry.usLF !== undefined && telemetry.usLF < 250,
            telemetry.usLR !== null && telemetry.usLR !== undefined && telemetry.usLR < 250,
            telemetry.usRF !== null && telemetry.usRF !== undefined && telemetry.usRF < 250,
            telemetry.usRR !== null && telemetry.usRR !== undefined && telemetry.usRR < 250
        ],
        encOn: [
            telemetry.rpmFL !== null && telemetry.rpmFL !== undefined && telemetry.rpmFL > 0,
            telemetry.rpmRL !== null && telemetry.rpmRL !== undefined && telemetry.rpmRL > 0,
            telemetry.rpmFR !== null && telemetry.rpmFR !== undefined && telemetry.rpmFR > 0,
            telemetry.rpmRR !== null && telemetry.rpmRR !== undefined && telemetry.rpmRR > 0
        ]
    };
}

// Render telemetry to the detailed sensors panel DOM and the main Live Monitor
function applyLiveTelemetry(d) {
    const lfOn = d.lfOn !== undefined ? !!d.lfOn : true;
    const lbOn = d.lbOn !== undefined ? !!d.lbOn : true;
    
    const valLidarF = document.getElementById('valLidarF');
    const valLidarB = document.getElementById('valLidarB');
    
    if (valLidarF) {
        valLidarF.textContent = lfOn && d.lf !== undefined && d.lf >= 0 ? d.lf + ' cm' : '-- cm';
        valLidarF.className = lfOn ? 'font-mono text-blue-400 font-bold' : 'font-mono text-slate-500 font-bold';
    }
    if (valLidarB) {
        valLidarB.textContent = lbOn && d.lb !== undefined && d.lb >= 0 ? d.lb + ' cm' : '-- cm';
        valLidarB.className = lbOn ? 'font-mono text-blue-400 font-bold' : 'font-mono text-slate-500 font-bold';
    }
    
    const usOn = Array.isArray(d.usOn) ? d.usOn : null;
    const updateUs = (id, val, active) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = active && val !== undefined && val >= 0 ? val + ' cm' : '-- cm';
            el.className = active ? 'text-emerald-400 font-bold' : 'text-slate-500 font-bold';
        }
    };
    updateUs('valUsLF', d.usLF, usOn ? !!usOn[0] : true);
    updateUs('valUsLR', d.usLR, usOn ? !!usOn[1] : true);
    updateUs('valUsRF', d.usRF, usOn ? !!usOn[2] : true);
    updateUs('valUsRR', d.usRR, usOn ? !!usOn[3] : true);
    
    const encOn = Array.isArray(d.encOn) ? d.encOn : null;
    const updateRpm = (id, val, active) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = active && val !== undefined ? Math.round(val) + ' RPM' : 'OFF';
            el.className = active ? 'text-indigo-400 font-bold' : 'text-slate-500 font-bold';
        }
    };
    updateRpm('valRpmFL', d.rFL, encOn ? !!encOn[0] : true);
    updateRpm('valRpmRL', d.rRL, encOn ? !!encOn[1] : true);
    updateRpm('valRpmFR', d.rFR, encOn ? !!encOn[2] : true);
    updateRpm('valRpmRR', d.rRR, encOn ? !!encOn[3] : true);
    
    // Cập nhật tốc độ Encoder Trái (GPIO 35) & Phải (GPIO 36) lên ô Giám Sát Trực Tiếp
    const encLeftEl = document.getElementById('robotEncLeft');
    const encRightEl = document.getElementById('robotEncRight');
    if (encLeftEl) {
        const rpmL = (d.rFL !== undefined) ? Math.round(d.rFL) : ((d.rRL !== undefined) ? Math.round(d.rRL) : 0);
        const mpsL = (rpmL * (Math.PI * 0.065) / 60);
        encLeftEl.textContent = `${rpmL} RPM (${mpsL.toFixed(2)}m/s)`;
    }
    if (encRightEl) {
        const rpmR = (d.rFR !== undefined) ? Math.round(d.rFR) : ((d.rRR !== undefined) ? Math.round(d.rRR) : 0);
        const mpsR = (rpmR * (Math.PI * 0.065) / 60);
        encRightEl.textContent = `${rpmR} RPM (${mpsR.toFixed(2)}m/s)`;
    }
    
    const valImuHeading = document.getElementById('valImuHeading');
    if (valImuHeading && d.HeadingRad !== undefined) {
        const headingDeg = Math.round(d.HeadingRad * 180 / Math.PI);
        valImuHeading.textContent = headingDeg + '°';
    }
    
    const valWheelMode = document.getElementById('valWheelMode');
    if (valWheelMode && d.wheelMode !== undefined) {
        valWheelMode.textContent = d.wheelMode === 1 ? 'BÁNH THƯỜNG (4WD)' : 'MECANUM (ĐA HƯỚNG)';
        valWheelMode.className = d.wheelMode === 1 
            ? 'font-bold text-emerald-400 font-mono' 
            : 'font-bold text-sky-400 font-mono';
    }
    
    const valSysBat = document.getElementById('valSysBat');
    if (valSysBat) {
        if (d.batPct !== undefined && d.batPct >= 0 && d.batV !== undefined && d.batV >= 0) {
            valSysBat.textContent = d.batV.toFixed(1) + 'V (' + d.batPct + '%)';
        } else {
            valSysBat.textContent = '-- V';
        }
    }
    
    if (d.chip !== undefined) {
        const valSysChip = document.getElementById('valSysChip');
        if (valSysChip) valSysChip.textContent = d.chip;
    }
    if (d.cpuMHz !== undefined) {
        const valSysCpu = document.getElementById('valSysCpu');
        if (valSysCpu) valSysCpu.textContent = d.cpuMHz + ' MHz';
    }
    if (d.heap !== undefined) {
        const valSysHeap = document.getElementById('valSysHeap');
        if (valSysHeap) valSysHeap.textContent = (d.heap / 1024).toFixed(1) + ' KB';
    }
    if (d.tempC !== undefined) {
        const valSysTemp = document.getElementById('valSysTemp');
        if (valSysTemp) {
            valSysTemp.textContent = d.tempC >= 0 ? d.tempC.toFixed(1) + ' °C' : '-- °C';
            valSysTemp.className = d.tempC >= 80 ? 'text-rose-500 font-bold' : (d.tempC >= 70 ? 'text-amber-500 font-bold' : 'text-slate-300 font-bold');
        }
    }

    // --- Update main Live Monitor dashboard elements ---
    
    // Update Coordinates
    const robotXEl = document.getElementById('robotX');
    const robotYEl = document.getElementById('robotY');
    if (robotXEl && d.xCoord !== undefined && d.xCoord !== null) {
        robotXEl.textContent = d.xCoord.toFixed(2) + 'm';
        robotLiveX = d.xCoord;
    }
    if (robotYEl && d.yCoord !== undefined && d.yCoord !== null) {
        robotYEl.textContent = d.yCoord.toFixed(2) + 'm';
        robotLiveY = d.yCoord;
    }

    // Update active robot code display
    const currentRobotCode = document.getElementById('inpRobotCode')?.value.trim() || 'RB001';
    const monitorRobotCode = document.getElementById('monitorRobotCode');
    if (monitorRobotCode && monitorRobotCode.textContent.trim() !== currentRobotCode) {
        monitorRobotCode.textContent = currentRobotCode;
    }

    // Update Heading
    const robotHeading = document.getElementById('robotHeading');
    if (robotHeading && d.HeadingRad !== undefined) {
        let headingDeg = Math.round(d.HeadingRad * 180 / Math.PI) % 360;
        if (headingDeg < 0) headingDeg += 360;
        
        let dirStr = '';
        if (headingDeg >= 337.5 || headingDeg < 22.5) dirStr = 'Bắc (N)';
        else if (headingDeg >= 22.5 && headingDeg < 67.5) dirStr = 'Đông Bắc (NE)';
        else if (headingDeg >= 67.5 && headingDeg < 112.5) dirStr = 'Đông (E)';
        else if (headingDeg >= 112.5 && headingDeg < 157.5) dirStr = 'Đông Nam (SE)';
        else if (headingDeg >= 157.5 && headingDeg < 202.5) dirStr = 'Nam (S)';
        else if (headingDeg >= 202.5 && headingDeg < 247.5) dirStr = 'Tây Nam (SW)';
        else if (headingDeg >= 247.5 && headingDeg < 292.5) dirStr = 'Tây (W)';
        else if (headingDeg >= 292.5 && headingDeg < 337.5) dirStr = 'Tây Bắc (NW)';
        
        robotHeading.textContent = `${headingDeg}° (${dirStr})`;
    }

    // Update Battery
    const robotBattery = document.getElementById('robotBattery');
    const batIcon = document.getElementById('robotBatIcon');
    if (robotBattery && d.batPct !== undefined && d.batPct >= 0) {
        let batText = `${d.batPct}%`;
        if (d.batV !== undefined && d.batV > 0) {
            batText += ` (${d.batV.toFixed(1)}V)`;
        }
        robotBattery.textContent = batText;
        
        if (batIcon) {
            batIcon.className = 'w-3.5 h-3.5';
            if (d.batPct >= 80) {
                batIcon.className += ' text-emerald-400';
            } else if (d.batPct >= 50) {
                batIcon.className += ' text-blue-400';
            } else if (d.batPct >= 20) {
                batIcon.className += ' text-amber-500';
            } else {
                batIcon.className += ' text-rose-500 animate-pulse';
            }
        }
    }

    // Update Mode & Highlight Buttons
    const robotModeBadge = document.getElementById('robotModeBadge');
    if (robotModeBadge && d.mode !== undefined) {
        let modeStr = '';
        let badgeClass = 'px-2 py-0.5 rounded text-[10px] font-bold border uppercase ';
        
        let modeVal = -1;
        const rawMode = String(d.mode).toLowerCase().trim();
        if (rawMode === '0' || rawMode === 'manual' || rawMode === 'lái tay') modeVal = 0;
        else if (rawMode === '1' || rawMode === 'auto' || rawMode === 'tự hành') modeVal = 1;
        else if (rawMode === '2' || rawMode === 'waypoint') modeVal = 2;
        else if (rawMode === '3' || rawMode === 'line' || rawMode === 'dò line') modeVal = 3;
        
        if (modeVal === 0) {
            modeStr = 'LÁI TAY';
            badgeClass += 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        } else if (modeVal === 1) {
            modeStr = 'TỰ HÀNH';
            badgeClass += 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        } else if (modeVal === 2) {
            modeStr = 'WAYPOINT';
            badgeClass += 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        } else if (modeVal === 3) {
            modeStr = 'DÒ LINE';
            badgeClass += 'bg-purple-500/10 text-purple-400 border-purple-500/20';
        } else {
            modeStr = String(d.mode).toUpperCase();
            badgeClass += 'bg-slate-800 text-slate-400 border-slate-700';
        }
        
        robotModeBadge.textContent = modeStr;
        robotModeBadge.className = badgeClass;
        
        // Highlight active mode selector button
        const btnManual = document.getElementById('btnModeManual');
        const btnAuto = document.getElementById('btnModeAuto');
        const btnWaypoint = document.getElementById('btnModeWaypoint');
        const btnLine = document.getElementById('btnModeLine');
        if (btnManual && btnAuto && btnWaypoint) {
            btnManual.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30";
            btnAuto.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30";
            btnWaypoint.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30";
            if (btnLine) btnLine.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30";
            
            if (modeVal === 0) {
                btnManual.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-emerald-500 text-slate-950 font-extrabold shadow-[0_0_10px_rgba(16,185,129,0.3)]";
            } else if (modeVal === 1) {
                btnAuto.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-amber-500 text-slate-950 font-extrabold shadow-[0_0_10px_rgba(245,158,11,0.3)]";
            } else if (modeVal === 2) {
                btnWaypoint.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-blue-500 text-slate-950 font-extrabold shadow-[0_0_10px_rgba(59,130,246,0.3)]";
            } else if (modeVal === 3) {
                if (btnLine) btnLine.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-purple-500 text-slate-950 font-extrabold shadow-[0_0_10px_rgba(168,85,247,0.3)]";
            }
        }
        

        lastKnownMode = modeStr;
    }

    // Update FSM Status
    const robotStatusBadge = document.getElementById('robotStatusBadge');
    if (robotStatusBadge && d.wpSt !== undefined) {
        const wpStatusStr = String(d.wpSt).toLowerCase().trim();
        let displayStatus = String(d.wpSt).toUpperCase();
        let badgeClass = 'px-2 py-0.5 rounded text-[10px] font-bold border uppercase flex items-center gap-1 ';
        let dotColor = 'bg-slate-400';
        
        if (wpStatusStr === 'idle') {
            displayStatus = 'CHỜ';
            badgeClass += 'bg-slate-800 text-slate-400 border-slate-700';
            dotColor = 'bg-slate-500';
        } else if (wpStatusStr === 'route_set') {
            displayStatus = 'LÊN LỘ TRÌNH';
            badgeClass += 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
            dotColor = 'bg-indigo-400';
        } else if (wpStatusStr === 'navigating') {
            displayStatus = 'ĐANG CHẠY';
            badgeClass += 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            dotColor = 'bg-blue-400 animate-pulse';
        } else if (wpStatusStr === 'oa_active') {
            displayStatus = 'NÉ VẬT CẢN (OA)';
            badgeClass += 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            dotColor = 'bg-amber-400 animate-pulse';
        } else if (wpStatusStr === 'done') {
            displayStatus = 'HOÀN THÀNH';
            badgeClass += 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            dotColor = 'bg-emerald-400';
        } else if (wpStatusStr === 'cancelled') {
            displayStatus = 'ĐÃ HỦY';
            badgeClass += 'bg-slate-700/50 text-slate-400 border-slate-600/30';
            dotColor = 'bg-slate-400';
        } else if (wpStatusStr === 'aborted') {
            displayStatus = 'BỊ HỦY (ABORT)';
            badgeClass += 'bg-rose-500/10 text-rose-400 border-rose-500/20';
            dotColor = 'bg-rose-400 animate-pulse';
        } else if (wpStatusStr === 'reroute_needed') {
            displayStatus = 'KẸT - CẦN TÍNH LẠI';
            badgeClass += 'bg-rose-500/10 text-rose-400 border-rose-500/20';
            dotColor = 'bg-rose-400 animate-pulse';
        } else {
            badgeClass += 'bg-slate-800 text-slate-400 border-slate-700';
            dotColor = 'bg-slate-400';
        }
        
        robotStatusBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${dotColor}"></span> ${displayStatus}`;
        robotStatusBadge.className = badgeClass;
        

        lastKnownWpStatus = wpStatusStr;
    }
}

// --- SETTINGS MODAL INTERACTION ---
const settingsModal = document.getElementById('settingsModal');
const btnSettings = document.getElementById('btnSettings');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const btnCancelSettings = document.getElementById('btnCancelSettings');
const btnSaveSettings = document.getElementById('btnSaveSettings');
const cfgBackendUrl = document.getElementById('cfgBackendUrl');
const cfgRobotIp = document.getElementById('cfgRobotIp');

if (btnSettings && settingsModal) {
    btnSettings.addEventListener('click', () => {
        cfgBackendUrl.value = BASE_URL;
        cfgRobotIp.value = ROBOT_IP;
        settingsModal.classList.replace('hidden', 'flex');

        // [P1-5 FIX] Gửi query layout/cfg mỗi 500ms × 6 lần (3 giây) thay vì chỉ 1 lần.
        // Robot vừa restart / WS vừa reconnect có thể chưa sẵn sàng nhận.
        // Nếu response đến sớm thì handler sẽ populate form, các lần sau gửi trùng
        // nhưng Robot sẽ reply với giá trị hiện tại — idempotent, an toàn.
        if (isRobotWsConnected && robotWs && robotWs.readyState === WebSocket.OPEN) {
            let attempts = 0;
            const queryTimer = setInterval(() => {
                attempts++;
                if (attempts > 6 || !isRobotWsConnected ||
                    !robotWs || robotWs.readyState !== WebSocket.OPEN) {
                    clearInterval(queryTimer);
                    return;
                }
                try {
                    robotWs.send(JSON.stringify({ t: 'layoutGet' }));
                    robotWs.send(JSON.stringify({ t: 'motorLayoutGet' }));
                    robotWs.send(JSON.stringify({ t: 'cfgGet' }));
                } catch (err) {
                    console.error('[RobotWS] Failed to query layouts on modal open:', err);
                }
            }, 500);
        }
    });

    const hideSettings = () => {
        settingsModal.classList.replace('flex', 'hidden');
    };

    btnCloseSettings.addEventListener('click', hideSettings);
    btnCancelSettings.addEventListener('click', hideSettings);

    btnSaveSettings.addEventListener('click', () => {
        const newUrl = cfgBackendUrl.value.trim();
        const newIp = cfgRobotIp.value.trim();
        const oldUrl = localStorage.getItem('smb_backend_url') || '';
        const oldIp = localStorage.getItem('smb_robot_ip') || '';

        if (newUrl && newUrl !== oldUrl) {
            BASE_URL = newUrl;
            localStorage.setItem('smb_backend_url', newUrl);
        }
        
        let ipChanged = false;
        if (newIp && newIp !== oldIp) {
            ROBOT_IP = newIp;
            localStorage.setItem('smb_robot_ip', newIp);
            ipChanged = true;
        }

        if (ipChanged) {
            if (robotWs) {
                robotWs.close();
            } else {
                connectRobotWs();
            }
        }
        
        if (!ipChanged && isRobotWsConnected && robotWs && robotWs.readyState === WebSocket.OPEN) {
            const us = [];
            const enc = [];
            const mapMot = [];
            const motInv = [];
            
            for (let i = 0; i < 4; i++) {
                us.push(parseInt(document.getElementById('cfgUs' + i).value, 10));
                enc.push(parseInt(document.getElementById('cfgEnc' + i).value, 10));
                mapMot.push(parseInt(document.getElementById('cfgMot' + i).value, 10));
                motInv.push(document.getElementById('cfgInv' + i).checked ? 1 : 0);
            }
            const lidF = parseInt(document.getElementById('cfgLidF').value, 10);
            
            const isPerm4 = (arr) => {
                if (arr.length !== 4) return false;
                const s = new Set(arr);
                return s.size === 4 && arr.every(v => v >= 0 && v <= 3);
            };
            
            if (!isPerm4(us)) {
                alert('Lỗi cấu hình cảm biến siêu âm: 4 góc phải chọn đủ Cổng từ 0 đến 3, không được chọn trùng lặp!');
                return;
            }
            if (!isPerm4(enc)) {
                alert('Lỗi cấu hình Encoder: 4 bánh phải chọn đủ Kênh từ 0 đến 3, không được chọn trùng lặp!');
                return;
            }
            if (!isPerm4(mapMot)) {
                alert('Lỗi cấu hình TB6612: 4 bánh phải chọn đủ Kênh từ 0 đến 3, không được chọn trùng lặp!');
                return;
            }
            
            const cfgAlign = parseFloat(document.getElementById('cfgAlignThreshold').value);
            const cfgMinRot = parseInt(document.getElementById('cfgRotateSpeedMin').value, 10);
            const cfgStop = parseInt(document.getElementById('cfgUsStopCm').value, 10);
            const cfgDetect = parseInt(document.getElementById('cfgUsOaDetectCm').value, 10);
            const cfgClear = parseInt(document.getElementById('cfgUsPathClearCm').value, 10);
            const cfgStreak = parseInt(document.getElementById('cfgUsPathClearStreak').value, 10);
            const cfgKp = parseFloat(document.getElementById('cfgYawKp').value);
            const cfgKi = parseFloat(document.getElementById('cfgYawKi').value);
            const cfgKd = parseFloat(document.getElementById('cfgYawKd').value);
            
            try {
                const wheelMode = parseInt(document.getElementById('cfgWheelMode').value, 10);
                robotWs.send(JSON.stringify({ t: 'layout', us, enc, lidF }));
                robotWs.send(JSON.stringify({ t: 'motLayout', mapMot, motInv, wheelMode }));
                robotWs.send(JSON.stringify({
                    t: 'cfg',
                    align: cfgAlign,
                    minRot: cfgMinRot,
                    stop: cfgStop,
                    detect: cfgDetect,
                    clear: cfgClear,
                    streak: cfgStreak,
                    kp: cfgKp,
                    ki: cfgKi,
                    kd: cfgKd
                }));
                appendSerialLog('[WS-Direct] Đang gửi cấu hình Sensor, Motor & Tự Hành mới xuống Robot...');
            } catch (err) {
                appendSerialLog('[WS-Direct] Lỗi gửi cấu hình: ' + err.message);
                alert('Không thể gửi cấu hình xuống Robot: ' + err.message);
                return;
            }
        }
        
        hideSettings();
        alert('Cấu hình đã lưu thành công! Đang kết nối thử lại...');
        
        if (signalrConnection) {
            signalrConnection.stop().then(() => connectSignalR());
        }
    });
}

// --- SERIAL LOGS CONSOLE LOGIC ---
let autoScrollLogs = true;

function appendSerialLog(message) {
    const container = document.getElementById('serialLogsContainer');
    if (!container) return;

    const initMsg = container.querySelector('.italic');
    if (initMsg) {
        container.innerHTML = '';
    }

    const logLine = document.createElement('div');
    logLine.className = 'border-b border-slate-900/10 pb-0.5 whitespace-pre-wrap';

    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });

    let colorClass = 'text-slate-300';
    if (message.includes('[ERROR]') || message.includes('Lỗi') || message.includes('fail') || message.includes('FAIL')) {
        colorClass = 'text-rose-400 font-semibold';
    } else if (message.includes('[WARNING]') || message.includes('Cảnh báo') || message.includes('WARNING')) {
        colorClass = 'text-amber-400';
    } else if (message.includes('[INFO]') || message.includes('[BOOT]') || message.includes('===') || message.includes('booting')) {
        colorClass = 'text-blue-400';
    } else if (message.includes('[WS-Direct]')) {
        colorClass = 'text-teal-400';
    } else if (message.includes('[BE-MQTT]')) {
        colorClass = 'text-indigo-400';
    } else if (message.includes('success') || message.includes('SUCCESS') || message.includes('OK')) {
        colorClass = 'text-emerald-400';
    }

    logLine.innerHTML = `<span class="text-slate-500 select-none mr-2">[${timeStr}]</span><span class="${colorClass}">${escapeHtml(message)}</span>`;
    container.appendChild(logLine);

    while (container.childNodes.length > 200) {
        container.removeChild(container.firstChild);
    }

    if (autoScrollLogs) {
        container.scrollTop = container.scrollHeight;
    }

}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

document.getElementById('btnClearLogs')?.addEventListener('click', () => {
    const container = document.getElementById('serialLogsContainer');
    if (container) {
        container.innerHTML = '<div class="text-slate-500 italic">[Hệ thống] Đã xóa log. Đang đợi dữ liệu mới...</div>';
    }
});

document.getElementById('btnToggleAutoScroll')?.addEventListener('click', (e) => {
    autoScrollLogs = !autoScrollLogs;
    e.target.textContent = `Tự động cuộn: ${autoScrollLogs ? 'BẬT' : 'TẮT'}`;
    if (autoScrollLogs) {
        e.target.className = "text-[10px] bg-blue-600/20 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded transition-all";
        const container = document.getElementById('serialLogsContainer');
        if (container) container.scrollTop = container.scrollHeight;
    } else {
        e.target.className = "text-[10px] bg-slate-700 text-slate-400 border border-slate-600 px-2 py-0.5 rounded transition-all";
    }
});

// --- SIGNALR CONNECTION FOR REMOTE MONITORING ---
let signalrConnection = null;

function connectSignalR() {
    if (typeof signalR === 'undefined') {
        console.warn('[SignalR] Library not loaded. Remote logs disabled.');
        return;
    }
    
    let hubUrl = `${BASE_URL}/hubs/robot`;
    
    signalrConnection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl)
        .withAutomaticReconnect()
        .build();

    signalrConnection.on("robotLog", (robotCode, message) => {
        const currentRobotCode = document.getElementById('inpRobotCode')?.value.trim() || 'RB001';
        if (robotCode === currentRobotCode) {
            appendSerialLog(`[BE-MQTT] ${message}`);
        }
    });

    signalrConnection.on("telemetry", (telemetry) => {
        const currentRobotCode = document.getElementById('inpRobotCode')?.value.trim() || 'RB001';
        if (telemetry.robotCode === currentRobotCode) {
            robotLiveX = telemetry.xCoord;
            robotLiveY = telemetry.yCoord;
            if (telemetry.xCoord !== null) document.getElementById('robotX').textContent = telemetry.xCoord.toFixed(2) + 'm';
            if (telemetry.yCoord !== null) document.getElementById('robotY').textContent = telemetry.yCoord.toFixed(2) + 'm';
            
            // Cập nhật bảng chi tiết cảm biến
            applyLiveTelemetry(normalizeSignalRTelemetry(telemetry));
            
            draw();
        }
    });

    signalrConnection.start()
        .then(() => {
            console.log('[SignalR] Connected to Backend successfully.');
            const robotCode = document.getElementById('inpRobotCode')?.value.trim() || 'RB001';
            signalrConnection.invoke("JoinRobotGroup", robotCode)
                .catch(err => console.error('[SignalR] Join Group failed:', err));
        })
        .catch(err => {
            console.warn('[SignalR] Connection failed, retrying in 5s...', err);
            setTimeout(connectSignalR, 5000);
        });
}

// Start SignalR
setTimeout(connectSignalR, 1000);

// --- MANUAL DRIVE CONTROL LOGIC ---
let activeDirections = {
    forward: false,
    backward: false,
    turnLeft: false,
    turnRight: false,
    strafeLeft: false,
    strafeRight: false,
    diagFL: false,
    diagFR: false,
    diagBL: false,
    diagBR: false
};

function getDriveValues() {
    let x = 0; // turn
    let y = 0; // forward/backward
    let s = 0; // strafe

    if (activeDirections.forward) y = 100;
    if (activeDirections.backward) y = -100;
    if (activeDirections.turnLeft) x = -100;
    if (activeDirections.turnRight) x = 100;
    if (activeDirections.strafeLeft) s = -100;
    if (activeDirections.strafeRight) s = 100;

    // Diagonal overrides
    if (activeDirections.diagFL) { y = 100; s = -100; }
    if (activeDirections.diagFR) { y = 100; s = 100; }
    if (activeDirections.diagBL) { y = -100; s = -100; }
    if (activeDirections.diagBR) { y = -100; s = 100; }

    return { x, y, s };
}

let lastSentDrive = { x: 0, y: 0, s: 0 };

function sendDriveCommand() {
    if (!isRobotWsConnected || !robotWs || robotWs.readyState !== WebSocket.OPEN) {
        return; // Only support direct WebSocket driving
    }

    let { x, y, s } = getDriveValues();

    // Lấy giá trị từ 2 thanh Slider: Lái tay (spdSlider) và Xoay hướng (rotSlider)
    const spdVal = Math.max(1, parseInt(document.getElementById('spdSlider')?.value || '30', 10));
    const rotVal = parseInt(document.getElementById('rotSlider')?.value || '30', 10);

    // Tính toán khuếch đại lực xoay hướng độc lập với tốc độ đi thẳng
    // Nếu spdSlider = 30% (đi thẳng chậm) và rotSlider = 70% (xoay góc dũng mãnh):
    // Lực xoay x được nhân tỷ lệ (70 / 30) = 2.333 giúp bánh xe xoay góc bốc 70% mà không bị khựng!
    let scaledX = x;
    if (x !== 0) {
        const ratio = rotVal / spdVal;
        scaledX = Math.round(x * ratio);
        scaledX = Math.max(-250, Math.min(250, scaledX));
    }
    
    // Only send if values changed to avoid network flooding
    if (scaledX === lastSentDrive.x && y === lastSentDrive.y && s === lastSentDrive.s) {
        return;
    }

    lastSentDrive = { x: scaledX, y, s };
    try {
        robotWs.send(JSON.stringify({ t: 'joy', x: scaledX, y: y, s: s }));
    } catch (e) {
        console.error('[RobotWS] Error sending drive command:', e);
    }
}

// Button controls helper
function bindDriveButton(buttonId, directionKey) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    const startDrive = (e) => {
        e.preventDefault();
        if (!isRobotWsConnected) {
            alert('Lái tay yêu cầu kết nối WebSocket trực tiếp đến Robot (WS Direct)! Vui lòng kết nối vào Wi-Fi của Robot.');
            return;
        }
        activeDirections[directionKey] = true;
        btn.classList.replace('bg-slate-800', 'bg-blue-600');
        btn.classList.add('text-white');
        sendDriveCommand();
    };

    const stopDrive = (e) => {
        e.preventDefault();
        activeDirections[directionKey] = false;
        btn.classList.replace('bg-blue-600', 'bg-slate-800');
        btn.classList.remove('text-white');
        sendDriveCommand();
    };

    // Mouse events
    btn.addEventListener('mousedown', startDrive);
    btn.addEventListener('mouseup', stopDrive);
    btn.addEventListener('mouseleave', stopDrive);
    
    // Touch events
    btn.addEventListener('touchstart', startDrive, { passive: false });
    btn.addEventListener('touchend', stopDrive, { passive: false });
}

// Bind all direction and diagonal buttons
bindDriveButton('btnDriveForward', 'forward');
bindDriveButton('btnDriveBackward', 'backward');
bindDriveButton('btnDriveTurnLeft', 'turnLeft');
bindDriveButton('btnDriveTurnRight', 'turnRight');
bindDriveButton('btnDriveStrafeLeft', 'strafeLeft');
bindDriveButton('btnDriveStrafeRight', 'strafeRight');
bindDriveButton('btnDriveDiagFL', 'diagFL');
bindDriveButton('btnDriveDiagFR', 'diagFR');
bindDriveButton('btnDriveDiagBL', 'diagBL');
bindDriveButton('btnDriveDiagBR', 'diagBR');

// Stop Button
const btnDriveStop = document.getElementById('btnDriveStop');
if (btnDriveStop) {
    btnDriveStop.addEventListener('click', () => {
        // Reset all states
        for (let key in activeDirections) {
            activeDirections[key] = false;
            // Remove active classes
            const btnId = 'btnDrive' + key.charAt(0).toUpperCase() + key.slice(1);
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.classList.replace('bg-blue-600', 'bg-slate-800');
                btn.classList.remove('text-white');
            }
        }
        sendDriveCommand();
    });
}

// Keyboard controls
window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
        return;
    }

    let handled = false;
    switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
            activeDirections.forward = true;
            document.getElementById('btnDriveForward')?.classList.replace('bg-slate-800', 'bg-blue-600');
            document.getElementById('btnDriveForward')?.classList.add('text-white');
            handled = true;
            break;
        case 's':
        case 'arrowdown':
            activeDirections.backward = true;
            document.getElementById('btnDriveBackward')?.classList.replace('bg-slate-800', 'bg-blue-600');
            document.getElementById('btnDriveBackward')?.classList.add('text-white');
            handled = true;
            break;
        case 'a':
        case 'arrowleft':
            activeDirections.turnLeft = true;
            document.getElementById('btnDriveTurnLeft')?.classList.replace('bg-slate-800', 'bg-blue-600');
            document.getElementById('btnDriveTurnLeft')?.classList.add('text-white');
            handled = true;
            break;
        case 'd':
        case 'arrowright':
            activeDirections.turnRight = true;
            document.getElementById('btnDriveTurnRight')?.classList.replace('bg-slate-800', 'bg-blue-600');
            document.getElementById('btnDriveTurnRight')?.classList.add('text-white');
            handled = true;
            break;
        case 'q':
            activeDirections.strafeLeft = true;
            document.getElementById('btnDriveStrafeLeft')?.classList.replace('bg-slate-800', 'bg-blue-600');
            document.getElementById('btnDriveStrafeLeft')?.classList.add('text-white');
            handled = true;
            break;
        case 'e':
            activeDirections.strafeRight = true;
            document.getElementById('btnDriveStrafeRight')?.classList.replace('bg-slate-800', 'bg-blue-600');
            document.getElementById('btnDriveStrafeRight')?.classList.add('text-white');
            handled = true;
            break;
        case ' ': // Space bar for STOP
            for (let key in activeDirections) {
                activeDirections[key] = false;
                const btnId = 'btnDrive' + key.charAt(0).toUpperCase() + key.slice(1);
                const btn = document.getElementById(btnId);
                if (btn) {
                    btn.classList.replace('bg-blue-600', 'bg-slate-800');
                    btn.classList.remove('text-white');
                }
            }
            handled = true;
            break;
    }

    if (handled) {
        e.preventDefault();
        sendDriveCommand();
    }
});

window.addEventListener('keyup', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
        return;
    }

    let handled = false;
    switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
            activeDirections.forward = false;
            document.getElementById('btnDriveForward')?.classList.replace('bg-blue-600', 'bg-slate-800');
            document.getElementById('btnDriveForward')?.classList.remove('text-white');
            handled = true;
            break;
        case 's':
        case 'arrowdown':
            activeDirections.backward = false;
            document.getElementById('btnDriveBackward')?.classList.replace('bg-blue-600', 'bg-slate-800');
            document.getElementById('btnDriveBackward')?.classList.remove('text-white');
            handled = true;
            break;
        case 'a':
        case 'arrowleft':
            activeDirections.turnLeft = false;
            document.getElementById('btnDriveTurnLeft')?.classList.replace('bg-blue-600', 'bg-slate-800');
            document.getElementById('btnDriveTurnLeft')?.classList.remove('text-white');
            handled = true;
            break;
        case 'd':
        case 'arrowright':
            activeDirections.turnRight = false;
            document.getElementById('btnDriveTurnRight')?.classList.replace('bg-blue-600', 'bg-slate-800');
            document.getElementById('btnDriveTurnRight')?.classList.remove('text-white');
            handled = true;
            break;
        case 'q':
            activeDirections.strafeLeft = false;
            document.getElementById('btnDriveStrafeLeft')?.classList.replace('bg-blue-600', 'bg-slate-800');
            document.getElementById('btnDriveStrafeLeft')?.classList.remove('text-white');
            handled = true;
            break;
        case 'e':
            activeDirections.strafeRight = false;
            document.getElementById('btnDriveStrafeRight')?.classList.replace('bg-blue-600', 'bg-slate-800');
            document.getElementById('btnDriveStrafeRight')?.classList.remove('text-white');
            handled = true;
            break;
    }

    if (handled) {
        e.preventDefault();
        sendDriveCommand();
    }
});

// --- OVERRIDE CONTROLS (MODE & ESTOP) ---
window.changeRobotMode = function(modeVal) {
    console.log(`[ModeControl] Yêu cầu chuyển chế độ: ${modeVal}`);
    
    // Tạm thời highlight nút vừa bấm để phản hồi tức thì cho người dùng
    const btnManual = document.getElementById('btnModeManual');
    const btnAutoExplore = document.getElementById('btnModeAutoExplore');
    const btnWaypoint = document.getElementById('btnModeWaypoint');
    const btnLine = document.getElementById('btnModeLine');
    if (btnManual && btnAutoExplore && btnWaypoint) {
        btnManual.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30";
        btnAutoExplore.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-transparent text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20";
        btnWaypoint.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30";
        if (btnLine) btnLine.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30";

        if (modeVal === 0) {
            btnManual.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-slate-700 text-emerald-400 border border-emerald-500/30 animate-pulse";
        } else if (modeVal === 1) {
            btnAutoExplore.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-slate-700 text-amber-400 border border-amber-500/30 animate-pulse";
        } else if (modeVal === 2) {
            btnWaypoint.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-slate-700 text-blue-400 border border-blue-500/30 animate-pulse";
        } else if (modeVal === 3) {
            if (btnLine) btnLine.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-slate-700 text-purple-400 border border-purple-500/30 animate-pulse";
        }
    }

    sendRobotCommand('set_mode', 'mode', modeVal);
};

// ============================================================
// AUTO SCAN MAP — Modal + WS events + Auto-save to BE
// ============================================================
let autoScanState = {
    active: false,
    sessionId: null,
    floorId: 1,
    mapName: 'Auto-scanned Map',
    autoSave: true,
    lastPct: 0,
    lastDist: 0,
    startMs: 0,
    lastMapDataUrl: null
};

window.openAutoScanModal = function() {
    const modal = document.getElementById('autoScanModal');
    if (modal) modal.classList.replace('hidden', 'flex');
};

window.closeAutoScanModal = function() {
    const modal = document.getElementById('autoScanModal');
    if (modal) modal.classList.replace('flex', 'hidden');
};

window.startAutoScan = function() {
    autoScanState.floorId = parseInt(document.getElementById('autoScanFloorId').value, 10) || 1;
    autoScanState.mapName = document.getElementById('autoScanMapName').value || 'Auto-scanned Map';
    autoScanState.autoSave = document.getElementById('autoScanAutoSave').checked;
    autoScanState.startMs = Date.now();
    autoScanState.lastPct = 0;
    autoScanState.lastDist = 0;
    autoScanState.active = true;
    autoScanState.sessionId = Date.now().toString(36);

    // UI: show progress, hide start button
    document.getElementById('autoScanProgressBox').classList.remove('hidden');
    document.getElementById('btnAutoScanStart').classList.add('hidden');
    document.getElementById('btnAutoScanStop').classList.remove('hidden');
    document.getElementById('autoScanResult').classList.add('hidden');

    // Gửi lệnh sang ESP32
    sendRobotCommand('mode_auto_explore', 'scan', 'start');
    appendSerialLog('[AUTO-SCAN] ▶ Bắt đầu quét Map tự động...');
};

window.stopAutoScan = function() {
    autoScanState.active = false;
    sendRobotCommand('scan_stop', 'scan', 'stop');
    document.getElementById('btnAutoScanStop').classList.add('hidden');
    document.getElementById('btnAutoScanStart').classList.remove('hidden');
    appendSerialLog('[AUTO-SCAN] ⏹ Đã gửi lệnh dừng quét');
};

window.onAutoScanProgress = function(pct, dist, durMs, fsm) {
    if (!autoScanState.active) return;
    autoScanState.lastPct = pct;
    autoScanState.lastDist = dist;

    const fsmNames = ['CRUISE', 'SPIN_DETECT', 'AVOID_US', 'DONE'];
    document.getElementById('autoScanState').textContent = fsmNames[fsm] || `STATE_${fsm}`;
    document.getElementById('autoScanPct').textContent = pct.toFixed(1) + '%';
    document.getElementById('autoScanBar').style.width = pct + '%';
    document.getElementById('autoScanDist').textContent = dist.toFixed(2) + 'm';
    const sec = Math.floor(durMs / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    document.getElementById('autoScanDur').textContent = `${m}:${s.toString().padStart(2, '0')}`;
};

window.onAutoScanComplete = function(pct, dist, durMs) {
    autoScanState.active = false;
    document.getElementById('btnAutoScanStop').classList.add('hidden');
    document.getElementById('btnAutoScanStart').classList.remove('hidden');
    document.getElementById('autoScanPct').textContent = pct.toFixed(1) + '%';
    document.getElementById('autoScanBar').style.width = pct + '%';

    const resultEl = document.getElementById('autoScanResult');
    resultEl.classList.remove('hidden');
    resultEl.className = 'text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-lg p-3';
    resultEl.innerHTML = `✅ Quét hoàn thành! Coverage: <strong>${pct.toFixed(1)}%</strong>, Quãng đường: <strong>${dist.toFixed(2)}m</strong>, Thời gian: <strong>${(durMs/1000).toFixed(0)}s</strong>`;

    appendSerialLog(`[AUTO-SCAN] ✅ Quét xong — coverage ${pct.toFixed(1)}%, ${dist.toFixed(2)}m`);

    if (autoScanState.autoSave) {
        // Lưu map hiện tại xuống BE
        saveScannedMapToBE();
    }
};

async function saveScannedMapToBE() {
    try {
        appendSerialLog('[AUTO-SCAN] 💾 Đang lưu map xuống Server...');
        const pngBlob = await renderOccupancyGridAsPng();
        if (!pngBlob) {
            appendSerialLog('[AUTO-SCAN] ⚠ Không có dữ liệu map để lưu');
            return;
        }

        const formData = new FormData();
        formData.append('file', pngBlob, 'autoscan.png');

        const params = new URLSearchParams({
            floorId: autoScanState.floorId,
            mapName: autoScanState.mapName,
            sessionId: autoScanState.sessionId,
            coveragePct: autoScanState.lastPct,
            distM: autoScanState.lastDist
        });
        const url = `${BASE_URL}/api/v1/maps/save-slam?${params.toString()}`;
        const res = await fetch(url, {
            method: 'POST',
            body: formData,
            headers: { 'ngrok-skip-browser-warning': '69420' }
        });

        if (res.ok) {
            const data = await res.json();
            const mapId = data.mapId || data.MapId;
            appendSerialLog(`[AUTO-SCAN] ✅ Map đã lưu! MapId=${mapId}`);
            const resultEl = document.getElementById('autoScanResult');
            resultEl.className = 'text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-lg p-3';
            resultEl.innerHTML += `<br>💾 Đã lưu map xuống Server — MapId: <strong>${mapId}</strong>. Bạn có thể mở "Map Editor" để tạo nodes/edges cho waypoint.`;
        } else {
            const err = await res.text();
            appendSerialLog(`[AUTO-SCAN] ❌ Lỗi lưu map: ${res.status} ${err}`);
        }
    } catch (e) {
        appendSerialLog(`[AUTO-SCAN] ❌ Exception khi lưu map: ${e.message}`);
    }
}

/**
 * Render occupancyGrid hiện tại ra PNG blob với median filter và chuẩn màu ROS2 Light.
 * Lấy dữ liệu từ window.occupancyGrid (đã có sẵn trong app.js).
 *
 * @param {Object} opts
 * @param {number} opts.medianRadius  Bán kính median filter (1=3x3, 2=5x5). Default 1.
 * @param {number} opts.smoothing     Làm mịn (0..1). Default 0.6.
 * @param {boolean} opts.mirrorVertical  Lật ảnh theo trục Y (WebManager ROS convention).
 */
async function renderOccupancyGridAsPng(opts = {}) {
    try {
        const og = (typeof window !== 'undefined' && window.occupancyGrid) || (typeof occupancyGrid !== 'undefined' ? occupancyGrid : null);
        if (!og || !og.data || og.data.length === 0) return null;

        const medianRadius = (opts.medianRadius !== undefined) ? opts.medianRadius : 1;
        const smoothing    = (opts.smoothing    !== undefined) ? opts.smoothing    : 0.6;
        const mirrorVertical = (opts.mirrorVertical !== undefined) ? opts.mirrorVertical : true;

        const W = og.COLS, H = og.ROWS;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(W, H);
        const pixels = imgData.data;
        const L_THRESH_FREE = og.L_THRESH_FREE || -0.5;
        const L_OCC = og.L_OCC || 1.8;

        // ===== Step 1: classify 3 states (occupied, free, unknown) =====
        // -1 = free, 0 = unknown, 1 = occupied, 2 = filtered (sẽ dùng median)
        const classified = new Int8Array(W * H);
        for (let i = 0; i < og.data.length; i++) {
            const lo = og.data[i];
            if (lo >= L_OCC * 0.85) classified[i] = 1;       // occupied
            else if (lo < L_THRESH_FREE) classified[i] = -1; // free
            else classified[i] = 0;                          // unknown
        }

        // ===== Step 2: median filter (mode of 3x3 neighborhood) =====
        if (medianRadius >= 1) {
            const filtered = new Int8Array(W * H);
            const r = medianRadius;
            for (let row = 0; row < H; row++) {
                for (let col = 0; col < W; col++) {
                    // Count: occupied / free / unknown
                    let cOcc = 0, cFree = 0, cUnk = 0;
                    for (let dy = -r; dy <= r; dy++) {
                        const y2 = row + dy;
                        if (y2 < 0 || y2 >= H) continue;
                        for (let dx = -r; dx <= r; dx++) {
                            const x2 = col + dx;
                            if (x2 < 0 || x2 >= W) continue;
                            const v = classified[y2 * W + x2];
                            if (v === 1) cOcc++;
                            else if (v === -1) cFree++;
                            else cUnk++;
                        }
                    }
                    // Mode (chiếm đa số)
                    if (cOcc > cFree && cOcc > cUnk) filtered[row * W + col] = 1;
                    else if (cFree > cOcc && cFree > cUnk) filtered[row * W + col] = -1;
                    else filtered[row * W + col] = 0;
                }
            }
            for (let i = 0; i < W * H; i++) classified[i] = filtered[i];
        }

        // ===== Step 3: render to pixels with ROS2 Light theme =====
        const occupiedColor = [10, 10, 10];         // tường: #0a0a0a
        const freeColor     = [240, 242, 245];      // sàn:  #f0f2f5
        const unknownColor  = [127, 140, 141];      // unknown: #7f8c8d
        const gridColor     = [220, 220, 225];      // grid lines (1px mỗi 10 ô)

        for (let row = 0; row < H; row++) {
            for (let col = 0; col < W; col++) {
                const idx = row * W + col;
                const v = classified[idx];
                let r, g, b;
                // Add grid lines mỗi 10 cell (1m nếu resolution = 0.05m)
                const isGrid = (row % 10 === 0 || col % 10 === 0);
                if (v === 1) {
                    r = occupiedColor[0]; g = occupiedColor[1]; b = occupiedColor[2];
                } else if (v === -1) {
                    r = freeColor[0]; g = freeColor[1]; b = freeColor[2];
                } else {
                    r = unknownColor[0]; g = unknownColor[1]; b = unknownColor[2];
                }
                if (isGrid && v !== 1) {
                    // Blend grid color
                    const alpha = (v === -1) ? 0.3 : 0.15;
                    r = Math.round(r * (1 - alpha) + gridColor[0] * alpha);
                    g = Math.round(g * (1 - alpha) + gridColor[1] * alpha);
                    b = Math.round(b * (1 - alpha) + gridColor[2] * alpha);
                }
                // Mirror Y (ROS convention: y tăng lên = bắc, nhưng canvas y tăng xuống)
                let canvasRow = row;
                if (mirrorVertical) canvasRow = H - 1 - row;
                const base = (canvasRow * W + col) * 4;
                pixels[base]   = r;
                pixels[base+1] = g;
                pixels[base+2] = b;
                pixels[base+3] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);

        return new Promise((resolve) => {
            canvas.toBlob((blob) => resolve(blob), 'image/png');
        });
    } catch (e) {
        console.error('[renderOccupancyGridAsPng] error:', e);
        return null;
    }
}

// Gắn sự kiện click cho các nút chế độ điều khiển
document.getElementById('btnModeManual')?.addEventListener('click', () => changeRobotMode(0));
document.getElementById('btnModeAutoExplore')?.addEventListener('click', () => openAutoScanModal());
document.getElementById('btnModeWaypoint')?.addEventListener('click', () => changeRobotMode(2));
document.getElementById('btnModeLine')?.addEventListener('click', () => changeRobotMode(3));

document.getElementById('btnEstop')?.addEventListener('click', () => {
    console.warn('[Control] KÍCH HOẠT ESTOP!');
    sendRobotCommand('estop', 'estop', 1);
    appendSerialLog('[Hệ thống] ⚠️ ĐÃ KÍCH HOẠT DỪNG KHẨN CẤP (ESTOP)!');
});

document.getElementById('btnResetOdom')?.addEventListener('click', () => {
    console.log('[Control] Resetting Odometry');
    sendRobotCommand('odom_reset', 'odomReset', 1);
    appendSerialLog('[Hệ thống] 🔄 Đã gửi lệnh Reset Odometry.');
});

// ============================================================================
// FIXED ROUTE MANAGEMENT WORKFLOW
// ============================================================================
let isRouteMode = false;
let routeSelectedNodes = [];
let editingRouteId = null;
let fixedRoutesList = [];
let activePreviewRoute = null;

// Load fixed routes on start
setTimeout(loadFixedRoutes, 1000);

async function loadFixedRoutes() {
    const listEl = document.getElementById('fixedRouteList');
    if (!listEl) return;

    try {
        const res = await fetch(`${BASE_URL}/api/v1/routes?mapId=1`, {
            method: 'GET',
            headers: { 
                'Accept': 'application/json',
                'ngrok-skip-browser-warning': '69420'
            }
        });

        if (!res.ok) throw new Error(`API Error ${res.status}`);
        
        fixedRoutesList = await res.json();
        renderFixedRoutesList();
    } catch (e) {
        console.error('[FixedRoutes] Lỗi load lộ trình cố định:', e);
        listEl.innerHTML = `<div class="text-rose-400 italic">Không thể tải lộ trình từ server: ${e.message}</div>`;
    }
}

function renderFixedRoutesList() {
    const listEl = document.getElementById('fixedRouteList');
    if (!listEl) return;

    if (fixedRoutesList.length === 0) {
        listEl.innerHTML = '<div class="text-slate-500 italic">Chưa có lộ trình nào được tạo.</div>';
        document.getElementById('btnRunFixedRoute').disabled = true;
        return;
    }

    listEl.innerHTML = '';
    fixedRoutesList.forEach(route => {
        const isSelected = activePreviewRoute && activePreviewRoute.robotRouteId === route.robotRouteId;
        const item = document.createElement('div');
        item.className = `flex justify-between items-center p-2 rounded border border-slate-700/50 hover:bg-slate-800/60 transition-all ${isSelected ? 'bg-indigo-950/40 border-indigo-500/50' : 'bg-slate-900/30'}`;
        
        let badgeColor = 'bg-slate-800 text-slate-400 border-slate-700';
        if (route.routeType === 'Ad') badgeColor = 'bg-rose-950 text-rose-400 border-rose-800/40';
        if (route.routeType === 'Patrol') badgeColor = 'bg-blue-950 text-blue-400 border-blue-800/40';
        if (route.routeType === 'Guide') badgeColor = 'bg-emerald-950 text-emerald-400 border-emerald-800/40';
        if (route.routeType === 'Custom') badgeColor = 'bg-amber-950 text-amber-400 border-amber-800/40';

        item.innerHTML = `
            <div class="flex flex-col flex-1 min-w-0 mr-2 cursor-pointer text-left" onclick="selectFixedRouteForPreview(${route.robotRouteId})">
                <div class="flex items-center gap-1.5">
                    <span class="font-semibold text-slate-200 truncate ${isSelected ? 'text-indigo-300' : ''}">${route.routeName}</span>
                    <span class="px-1 py-0.5 rounded text-[8px] border font-bold uppercase ${badgeColor}">${route.routeType}</span>
                </div>
                <div class="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <span>${route.waypointCount} điểm</span>
                    ${route.zoneName ? `<span>•</span> <span class="truncate">${route.zoneName}</span>` : ''}
                </div>
            </div>
            <div class="flex items-center gap-1 route-item-actions">
                <button onclick="editFixedRoute(${route.robotRouteId})" class="p-1 hover:bg-slate-700 text-slate-400 hover:text-white rounded" title="Chỉnh sửa">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"></path></svg>
                </button>
                <button onclick="deleteFixedRoute(${route.robotRouteId})" class="p-1 hover:bg-rose-900/60 text-rose-400 rounded" title="Xóa">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
        `;
        listEl.appendChild(item);
    });
}

window.selectFixedRouteForPreview = async function(routeId) {
    try {
        const res = await fetch(`${BASE_URL}/api/v1/routes/${routeId}`, {
            method: 'GET',
            headers: { 
                'Accept': 'application/json',
                'ngrok-skip-browser-warning': '69420'
            }
        });

        if (!res.ok) throw new Error(`API Error ${res.status}`);
        
        activePreviewRoute = await res.json();
        document.getElementById('btnRunFixedRoute').disabled = false;
        
        renderFixedRoutesList();
        draw();

        // Populate Right Sidebar waypoints list
        const routeListEl = document.getElementById('routeList');
        if (routeListEl && activePreviewRoute.waypoints) {
            routeListEl.innerHTML = '';
            activePreviewRoute.waypoints.forEach((wp, index) => {
                const nodeItem = document.createElement('div');
                nodeItem.className = 'relative flex items-center gap-3 text-xs';
                nodeItem.innerHTML = `
                    <div class="z-10 w-5 h-5 rounded-full bg-indigo-900 border-2 border-indigo-500 flex items-center justify-center font-mono font-bold text-[9px] text-indigo-300">
                        ${index + 1}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="font-medium text-slate-200 truncate text-left">${wp.nodeName || `Điểm ${wp.nodeId}`}</div>
                        <div class="text-[10px] text-slate-400 font-mono text-left">(${wp.xCoord.toFixed(2)}m, ${wp.yCoord.toFixed(2)}m)</div>
                    </div>
                `;
                routeListEl.appendChild(nodeItem);
            });
        }
    } catch (e) {
        console.error('[FixedRoutes] Lỗi tải chi tiết lộ trình:', e);
        alert('Lỗi tải chi tiết lộ trình: ' + e.message);
    }
};

window.editFixedRoute = async function(routeId) {
    try {
        // Tải map từ server trước (nếu chưa có) để đảm bảo `nodes` có đầy đủ nodeId thực tế,
        // tránh lỗi Route_InvalidNodeIds khi edit các route cũ có nodeId không còn tồn tại.
        if (nodes.length === 0) {
            try {
                const r = await fetch(`${BASE_URL}/api/v1/maps/latest?floorId=1`, {
                    headers: { 'Accept': 'application/json', 'ngrok-skip-browser-warning': '69420' }
                });
                if (r.ok) {
                    const data = await r.json();
                    if (Array.isArray(data.nodes)) {
                        nodes = data.nodes.map(n => ({
                            id: n.nodeId, name: n.nodeName, type: n.nodeType,
                            x: n.xCoord / PIXEL_TO_METER, y: n.yCoord / PIXEL_TO_METER
                        }));
                    }
                }
            } catch (loadErr) {
                console.warn('[editFixedRoute] Không tải được map từ server, tiếp tục với nodes rỗng.', loadErr);
            }
        }

        const res = await fetch(`${BASE_URL}/api/v1/routes/${routeId}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'ngrok-skip-browser-warning': '69420'
            }
        });

        if (!res.ok) throw new Error(`API Error ${res.status}`);

        const route = await res.json();

        isRouteMode = true;
        editingRouteId = route.robotRouteId;

        document.getElementById('routeFormTitle').textContent = "Cập nhật Lộ trình";
        document.getElementById('routeFormName').value = route.routeName;
        document.getElementById('routeFormType').value = route.routeType;
        document.getElementById('routeFormZone').value = route.zoneId || "";

        const rawIds = (route.waypoints || []).map(wp => wp.nodeId);
        routeSelectedNodes = rawIds;

        // Nếu `nodes` đã có dữ liệu, lọc bỏ các NodeId không còn trên bản đồ (stale)
        if (nodes.length > 0) {
            const validSet = new Set(nodes.map(n => n.id));
            const stale = rawIds.filter(id => !validSet.has(id));
            if (stale.length > 0) {
                console.warn(`[editFixedRoute] Lọc ${stale.length} NodeId lỗi khỏi route ${routeId}:`, stale);
                routeSelectedNodes = rawIds.filter(id => validSet.has(id));
                alert(`Lộ trình này có ${stale.length} NodeId đã không còn trên bản đồ (đã bị xoá/trước đó lưu thủ công). Hệ thống sẽ tự động loại bỏ trước khi lưu.`);
            }
        }

        updateRouteSelectedNodesUI();

        document.getElementById('routeEditForm').classList.remove('hidden');
        document.getElementById('btnCreateRouteMode').classList.add('hidden');

        selectedNodeId = null;
        selectedShapeId = null;
        hideProperties();

        draw();
    } catch (e) {
        console.error('[FixedRoutes] Lỗi sửa lộ trình:', e);
        alert('Lỗi tải lộ trình chỉnh sửa: ' + e.message);
    }
};

window.deleteFixedRoute = async function(routeId) {
    if (!confirm('Bạn có chắc chắn muốn xóa lộ trình cố định này không?')) return;

    try {
        const res = await fetch(`${BASE_URL}/api/v1/routes/${routeId}`, {
            method: 'DELETE',
            headers: { 
                'Accept': 'application/json',
                'ngrok-skip-browser-warning': '69420'
            }
        });

        if (!res.ok) throw new Error(`API Error ${res.status}`);
        
        alert('Xóa lộ trình thành công!');
        if (activePreviewRoute && activePreviewRoute.robotRouteId === routeId) {
            activePreviewRoute = null;
            document.getElementById('btnRunFixedRoute').disabled = true;
            document.getElementById('routeList').innerHTML = '<div class="text-xs text-slate-400 italic">Chưa có lộ trình di chuyển.</div>';
        }
        
        loadFixedRoutes();
        draw();
    } catch (e) {
        console.error('[FixedRoutes] Lỗi xóa lộ trình:', e);
        alert('Lỗi khi xóa lộ trình: ' + e.message);
    }
};

function updateRouteSelectedNodesUI() {
    const container = document.getElementById('routeFormSelectedNodes');
    if (!container) return;

    if (routeSelectedNodes.length === 0) {
        container.innerHTML = '<div class="text-slate-500 italic">Chưa chọn nút nào...</div>';
        return;
    }

    container.innerHTML = '';
    routeSelectedNodes.forEach((nodeId, index) => {
        const node = nodes.find(n => n.id === nodeId);
        const name = node ? node.name : `Node ${nodeId}`;
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center bg-slate-900 p-1.5 rounded border border-slate-800 text-[10px] mt-1';
        item.innerHTML = `
            <span class="truncate text-slate-300 font-semibold">${index + 1}. ${name}</span>
            <button onclick="removeNodeFromRouteList(${nodeId})" class="text-rose-500 hover:text-rose-400 ml-1 font-bold">X</button>
        `;
        container.appendChild(item);
    });
}

window.removeNodeFromRouteList = function(nodeId) {
    routeSelectedNodes = routeSelectedNodes.filter(id => id !== nodeId);
    updateRouteSelectedNodesUI();
    draw();
};

// Event Listeners for Route Form
document.getElementById('btnCreateRouteMode')?.addEventListener('click', () => {
    isRouteMode = true;
    editingRouteId = null;
    routeSelectedNodes = [];
    
    document.getElementById('routeFormTitle').textContent = "Tạo Lộ trình Mới";
    document.getElementById('routeFormName').value = "";
    document.getElementById('routeFormType').value = "Patrol";
    document.getElementById('routeFormZone').value = "";
    
    updateRouteSelectedNodesUI();
    
    document.getElementById('routeEditForm').classList.remove('hidden');
    document.getElementById('btnCreateRouteMode').classList.add('hidden');
    
    selectedNodeId = null;
    selectedShapeId = null;
    hideProperties();
    draw();
});

document.getElementById('btnCancelRoute')?.addEventListener('click', () => {
    isRouteMode = false;
    editingRouteId = null;
    routeSelectedNodes = [];
    
    document.getElementById('routeEditForm').classList.add('hidden');
    document.getElementById('btnCreateRouteMode').classList.remove('hidden');
    draw();
});

document.getElementById('btnSaveRoute')?.addEventListener('click', async () => {
    const name = document.getElementById('routeFormName').value.trim();
    if (!name) return alert('Vui lòng nhập tên lộ trình!');

    // Nếu chưa load map mà route lại có nodeId → cảnh báo buộc load trước khi lưu
    if (nodes.length === 0) {
        return alert('Bạn chưa tải Map từ Server. Vui lòng bấm "Tải Map từ Server" trước khi tạo/sửa lộ trình để đảm bảo các NodeId khớp với DB!');
    }

    // Lọc bỏ NodeId không tồn tại trong `nodes` hiện tại (phòng trường hợp edit
    // route đã lưu từ trước khi các node bị xóa, hoặc route được tạo thủ công trong console)
    const validNodeIdsOnMap = new Set(nodes.map(n => n.id));
    const staleIds = routeSelectedNodes.filter(id => !validNodeIdsOnMap.has(id));
    if (staleIds.length > 0) {
        const proceed = confirm(
            `Có ${staleIds.length} NodeId không còn tồn tại trên bản đồ hiện tại:\n` +
            `[${staleIds.join(', ')}]\n\n` +
            `Có thể do:\n` +
            `• Map đã được đồng bộ lại (các node này đã bị xóa).\n` +
            `• Route cũ được tạo từ phiên làm việc trước.\n\n` +
            `Bấm OK để tự động loại bỏ các NodeId lỗi và lưu lộ trình.\n` +
            `Bấm Cancel để hủy và chọn lại node trên bản đồ.`
        );
        if (!proceed) return;
        routeSelectedNodes = routeSelectedNodes.filter(id => validNodeIdsOnMap.has(id));
        updateRouteSelectedNodesUI();
        draw();
        alert(`Đã loại bỏ ${staleIds.length} NodeId lỗi. Còn lại ${routeSelectedNodes.length} node hợp lệ.`);
    }

    if (routeSelectedNodes.length === 0) {
        return alert('Sau khi lọc, lộ trình không còn node hợp lệ nào. Vui lòng chọn lại node trên bản đồ!');
    }

    const type = document.getElementById('routeFormType').value;
    const zoneVal = document.getElementById('routeFormZone').value;
    const zoneId = zoneVal ? parseInt(zoneVal) : null;
    
    const bodyData = {
        routeName: name,
        routeType: type,
        description: "Lộ trình được cấu hình từ Web Manager",
        zoneId: zoneId,
        nodeIds: routeSelectedNodes
    };

    try {
        let res;
        if (editingRouteId !== null) {
            // Update
            res = await fetch(`${BASE_URL}/api/v1/routes/${editingRouteId}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'ngrok-skip-browser-warning': '69420'
                },
                body: JSON.stringify(bodyData)
            });
        } else {
            // Create
            res = await fetch(`${BASE_URL}/api/v1/routes`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'ngrok-skip-browser-warning': '69420'
                },
                body: JSON.stringify({
                    mapId: 1,
                    robotId: 1, // Default robot
                    ...bodyData
                })
            });
        }

        if (!res.ok) {
            const errText = await res.json();
            throw new Error(errText.message || `Lỗi ${res.status}`);
        }

        alert(editingRouteId !== null ? 'Cập nhật lộ trình thành công!' : 'Tạo lộ trình mới thành công!');
        
        // Hide form and reload list
        document.getElementById('routeEditForm').classList.add('hidden');
        document.getElementById('btnCreateRouteMode').classList.remove('hidden');
        isRouteMode = false;
        editingRouteId = null;
        routeSelectedNodes = [];
        
        loadFixedRoutes();
        draw();
        if (window.setTab) window.setTab('run');
    } catch (e) {
        console.error('[FixedRoutes] Lỗi lưu lộ trình:', e);
        alert('Lỗi lưu lộ trình: ' + e.message);
    }
});

// Run fixed route button click handler
document.getElementById('btnRunFixedRoute')?.addEventListener('click', async () => {
    if (!activePreviewRoute || !activePreviewRoute.waypoints || activePreviewRoute.waypoints.length === 0) {
        return alert('Vui lòng chọn lộ trình trước khi gửi lệnh!');
    }

    const robotCode = document.getElementById('inpRobotCode').value.trim() || 'RB001';
    const btn = document.getElementById('btnRunFixedRoute');
    const oldHtml = btn.innerHTML;
    
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin mr-2"></i> Đang Gửi...';
    btn.disabled = true;

    try {
        const waypoints = activePreviewRoute.waypoints.map(wp => ({
            x: parseFloat(wp.xCoord),
            y: parseFloat(wp.yCoord),
            nodeId: parseInt(wp.nodeId)
        }));

        const navigatePayload = JSON.stringify({ waypoints });
        
        if (isRobotWsConnected) {
            sendRobotCommand(null, 'navigate', navigatePayload);
            appendSerialLog(`[Hệ thống] 🚀 Đã gửi lộ trình "${activePreviewRoute.routeName}" (${waypoints.length} điểm) trực tiếp qua WebSocket.`);
        } else {
            const payload = {
                robotCode: robotCode,
                command: 'navigate',
                payload: navigatePayload
            };
            
            const res = await fetch(`${BASE_URL}/api/robots/command`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': '69420'
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                throw new Error(`Mã lỗi ${res.status}`);
            }

            appendSerialLog(`[Hệ thống] 🚀 Đã gửi lộ trình "${activePreviewRoute.routeName}" (${waypoints.length} điểm) từ xa qua MQTT.`);
        }
        
        alert(`Đã ra lệnh cho robot chạy lộ trình cố định "${activePreviewRoute.routeName}" thành công!`);
    } catch (e) {
        console.error('[FixedRouteRun] Lỗi phát lệnh:', e);
        alert('Lỗi phát lệnh chạy lộ trình: ' + e.message);
    } finally {
        btn.innerHTML = oldHtml;
        btn.disabled = false;
    }
});

// ============================================================================
// LIDAR & SERIAL MONITOR LOG HANDLERS
// ============================================================================
let isSerialAutoScroll = true;
let isLidarAutoScroll = true;

window.appendSerialLog = function(msg) {
    const container = document.getElementById('serialLogsContainer');
    if (!container) return;
    const time = new Date().toLocaleTimeString();
    const div = document.createElement('div');
    div.textContent = `[${time}] ${msg}`;
    container.appendChild(div);
    if (isSerialAutoScroll) {
        container.scrollTop = container.scrollHeight;
    }
};

window.appendLidarLog = function(msg) {
    const container = document.getElementById('lidarLogsContainer');
    if (!container) return;
    const time = new Date().toLocaleTimeString();
    const div = document.createElement('div');
    div.textContent = `[${time}] ${msg}`;
    container.appendChild(div);
    if (isLidarAutoScroll) {
        container.scrollTop = container.scrollHeight;
    }
};

// Clear & Auto-scroll buttons
document.getElementById('btnClearLogs')?.addEventListener('click', () => {
    const container = document.getElementById('serialLogsContainer');
    if (container) container.innerHTML = '<div class="text-slate-500 italic">[Hệ thống] Đã xóa log Robot.</div>';
});

document.getElementById('btnToggleAutoScroll')?.addEventListener('click', () => {
    isSerialAutoScroll = !isSerialAutoScroll;
    const btn = document.getElementById('btnToggleAutoScroll');
    if (btn) btn.textContent = `Cuộn: ${isSerialAutoScroll ? 'BẬT' : 'TẮT'}`;
});

document.getElementById('btnClearLidarLogs')?.addEventListener('click', () => {
    const container = document.getElementById('lidarLogsContainer');
    if (container) container.innerHTML = '<div class="text-slate-500 italic">[LiDAR] Đã xóa log LiDAR.</div>';
});

document.getElementById('btnToggleLidarAutoScroll')?.addEventListener('click', () => {
    isLidarAutoScroll = !isLidarAutoScroll;
    const btn = document.getElementById('btnToggleLidarAutoScroll');
    if (btn) btn.textContent = `Cuộn: ${isLidarAutoScroll ? 'BẬT' : 'TẮT'}`;
});

// ============================================================================
// LIDAR SCAN & SLAM LAYER TOGGLE CONTROLS
// ============================================================================
let showLidarScanCloud = true;
let showSlamGridLayer = true;

document.getElementById('btnToggleLidarScan')?.addEventListener('click', () => {
    showLidarScanCloud = !showLidarScanCloud;
    const btn = document.getElementById('btnToggleLidarScan');
    if (btn) {
        if (showLidarScanCloud) {
            btn.className = "px-2.5 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-xs font-semibold hover:bg-rose-500 hover:text-white transition-all flex items-center gap-1.5";
        } else {
            btn.className = "px-2.5 py-1 bg-slate-800 text-slate-500 border border-slate-700 rounded text-xs font-semibold transition-all flex items-center gap-1.5";
        }
    }
    draw();
});

document.getElementById('btnToggleSlamGrid')?.addEventListener('click', () => {
    showSlamGridLayer = !showSlamGridLayer;
    const btn = document.getElementById('btnToggleSlamGrid');
    if (btn) {
        if (showSlamGridLayer) {
            btn.className = "px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-xs font-semibold hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-1.5";
        } else {
            btn.className = "px-2.5 py-1 bg-slate-800 text-slate-500 border border-slate-700 rounded text-xs font-semibold transition-all flex items-center gap-1.5";
        }
    }
    draw();
});

document.getElementById('btnToggleSlamTheme')?.addEventListener('click', () => {
    occupancyGrid.theme = (occupancyGrid.theme === 'ros') ? 'rviz' : 'ros';
    const btn = document.getElementById('btnToggleSlamTheme');
    if (btn) {
        if (occupancyGrid.theme === 'rviz') {
            btn.innerHTML = '<i data-lucide="palette" class="w-4 h-4"></i> Theme: RViz Dark';
            btn.className = "px-2.5 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded text-xs font-semibold hover:bg-purple-500 hover:text-white transition-all flex items-center gap-1.5";
        } else {
            btn.innerHTML = '<i data-lucide="palette" class="w-4 h-4"></i> Theme: ROS Light';
            btn.className = "px-2.5 py-1 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded text-xs font-semibold hover:bg-cyan-500 hover:text-white transition-all flex items-center gap-1.5";
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    occupancyGrid.dirty = true;
    draw();
});

// ============================================================
// NÚT XOAY MAP (Rotate Map 90°): 0° → 90° → 180° → 270° → 0°
// Mỗi lần click xoay occupancyGrid + scan points 90° (CW).
// Dùng khi map hiển thị bị ngược hoặc xoay so với thực tế.
// ============================================================
let mapRotationDeg = 0;  // 0, 90, 180, 270
document.getElementById('btnRotateMap')?.addEventListener('click', () => {
    mapRotationDeg = (mapRotationDeg + 90) % 360;
    const btn = document.getElementById('btnRotateMap');
    if (btn) {
        btn.innerHTML = `<i data-lucide="rotate-cw" class="w-4 h-4"></i> Map: ${mapRotationDeg}°`;
        btn.title = `Xoay bản đồ thêm 90°. Click tiếp: 90° → 180° → 270° → 0°`;
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (occupancyGrid) occupancyGrid.dirty = true;
    draw();
});

// ============================================================
// NÚT LẬT MAP (Flip Map): trái↔phải (horizontal) + trên↔dưới (vertical)
// 3 mode: 0=normal, 1=flip horizontal (trái/phải), 2=flip vertical (trên/dưới)
// ============================================================
let mapFlipMode = 0;  // 0=normal, 1=flipX, 2=flipY
document.getElementById('btnFlipMap')?.addEventListener('click', () => {
    mapFlipMode = (mapFlipMode + 1) % 3;
    const btn = document.getElementById('btnFlipMap');
    if (btn) {
        const labels = ['', '↔ Lật ngang', '↕ Lật dọc'];
        btn.innerHTML = `<i data-lucide="flip-horizontal-2" class="w-4 h-4"></i> ${labels[mapFlipMode]}`;
        btn.title = 'Lật bản đồ: normal → ngang → dọc → normal';
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (occupancyGrid) occupancyGrid.dirty = true;
    draw();
});

// ============================================================
// NÚT LIVE RENDER: Bật/Tắt render mượt 30fps (real-time SLAM update)
// Mặc định BẬT. Khi TẮT → chỉ redraw khi có event (tiết kiệm CPU)
// ============================================================
document.getElementById('btnLiveRender')?.addEventListener('click', () => {
    const btn = document.getElementById('btnLiveRender');
    if (typeof window.setLiveRender === 'function') {
        // Đảo trạng thái hiện tại (đọc từ innerHTML)
        const isLive = btn?.innerHTML.includes('Live');
        window.setLiveRender(!isLive);
        if (btn) {
            if (!isLive) {
                btn.innerHTML = '<i data-lucide="zap" class="w-4 h-4"></i> Live';
                btn.className = "px-2.5 py-1 bg-green-500/20 text-green-300 border border-green-500/30 rounded text-xs font-semibold hover:bg-green-500 hover:text-white transition-all flex items-center gap-1.5";
            } else {
                btn.innerHTML = '<i data-lucide="zap-off" class="w-4 h-4"></i> Off';
                btn.className = "px-2.5 py-1 bg-slate-800 text-slate-500 border border-slate-700 rounded text-xs font-semibold transition-all flex items-center gap-1.5";
            }
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
});
let isCanvasFullscreen = false;
document.getElementById('btnResetView')?.addEventListener('click', () => {
    const centerSection = document.querySelector('section.flex-1');
    const btn = document.getElementById('btnResetView');
    if (!centerSection) return;

    isCanvasFullscreen = !isCanvasFullscreen;

    if (isCanvasFullscreen) {
        centerSection.classList.add('fixed', 'inset-0', 'z-50', 'w-screen', 'h-screen', 'p-2', 'bg-slate-950');
        if (btn) {
            btn.innerHTML = '<i data-lucide="minimize" class="w-4 h-4"></i>';
            btn.title = "Thu nhỏ lại giao diện ban đầu";
        }
    } else {
        centerSection.classList.remove('fixed', 'inset-0', 'z-50', 'w-screen', 'h-screen', 'p-2', 'bg-slate-950');
        if (btn) {
            btn.innerHTML = '<i data-lucide="maximize" class="w-4 h-4"></i>';
            btn.title = "Phóng to toàn màn hình bản đồ";
        }
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
    setTimeout(() => {
        const mapWrapper = document.getElementById('mapWrapper');
        if (mapWrapper && graphCanvas && bgCanvas) {
            graphCanvas.width = mapWrapper.clientWidth;
            graphCanvas.height = mapWrapper.clientHeight;
            bgCanvas.width = mapWrapper.clientWidth;
            bgCanvas.height = mapWrapper.clientHeight;
            draw();
        }
    }, 100);
});

document.getElementById('btnCaptureSlamMap')?.addEventListener('click', async () => {
    // Ưu tiên render occupancyGrid (đã qua median filter + ROS Light theme) thay vì
    // chụp graphCanvas (đám mây điểm thô — nguyên nhân chính gây nhiều đốm đen).
    const pngBlob = await renderOccupancyGridAsPng({ medianRadius: 2, mirrorVertical: true, smoothing: 0.7 });
    if (!pngBlob) {
        alert('⚠ Chưa có dữ liệu occupancyGrid. Hãy đợi SLAM quét xong một số scan.');
        return;
    }
    const img = new Image();
    img.onload = () => {
        mapImage = img;
        // Fit toàn bộ map vào viewport
        const scaleX = graphCanvas.width / img.width;
        const scaleY = graphCanvas.height / img.height;
        scale = Math.min(scaleX, scaleY) * 0.92;
        offsetX = (graphCanvas.width - img.width * scale) / 2;
        offsetY = (graphCanvas.height - img.height * scale) / 2;
        draw();
        appendSerialLog('[SLAM] ✅ Đã chụp occupancyGrid → set làm Background (đã lọc nhiễu + median).');
    };
    img.src = URL.createObjectURL(pngBlob);
});

// ============================================================================
// LIDAR STATUS BADGE & AUTO-CHECK
// ============================================================================
let lastLidarScanTimestamp = 0;

function updateLidarStatusBadge(connected, count = 0) {
    const badge = document.getElementById('lidarStatusBadge');
    if (!badge) return;
    if (connected) {
        badge.className = "flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-sm";
        badge.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></span><span class="text-slate-300">LiDAR 360°: Đã kết nối (${count}pts)</span>`;
    } else {
        badge.className = "flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/40 border border-slate-800 text-sm";
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-500"></span><span class="text-slate-500">LiDAR 360°: Chưa kết nối</span>';
    }
}

window.setLiveLidarPoints = function(points) {
    window.liveLidarScanPoints = points || [];
    lastLidarScanTimestamp = Date.now();
    const now = Date.now();

    // 1. Throttle cập nhật UI Badge (tối đa 2Hz - 500ms) để không gây reflow DOM
    if (!window._lastBadgeUpdateMs || now - window._lastBadgeUpdateMs >= 500) {
        window._lastBadgeUpdateMs = now;
        updateLidarStatusBadge(true, window.liveLidarScanPoints.length);
    }

    // 2. Throttle đẩy scan sang ROS2 Bridge (tối đa 10Hz - 100ms)
    if (typeof Ros2BridgeManager !== 'undefined' && Ros2BridgeManager.isConnected) {
        if (!window._lastRos2ScanMs || now - window._lastRos2ScanMs >= 100) {
            window._lastRos2ScanMs = now;
            Ros2BridgeManager.publishLaserScan(window.liveLidarScanPoints);
        }
    }

    // 3. Render Canvas không chặn luồng bằng requestAnimationFrame
    if (!window._rafScheduled) {
        window._rafScheduled = true;
        requestAnimationFrame(() => {
            window._rafScheduled = false;
            draw();
        });
    }
};

// ============================================================================
// ROS2 BRIDGE MANAGER (Chính Chủ Cách 1: Tích hợp ROS2 Core qua WebSocket Bridge)
// Kết nối WebManager với ROS2 slam_toolbox / Nav2 / rosbridge_suite
// ============================================================================
const Ros2BridgeManager = {
    ros: null,
    isConnected: false,
    url: 'ws://localhost:9090',
    mapTopic: null,
    poseTopic: null,
    cmdVelTopic: null,
    goalTopic: null,

    init(wsUrl) {
        if (wsUrl) this.url = wsUrl;
        if (typeof ROSLIB === 'undefined') {
            console.warn('[ROS2] Thư viện roslibjs chưa nạp thành công.');
            return;
        }

        try {
            this.ros = new ROSLIB.Ros({ url: this.url });
        } catch (err) {
            console.error('[ROS2] Khởi tạo ROSLIB thất bại:', err);
            return;
        }

        this.ros.on('connection', () => {
            this.isConnected = true;
            console.log('[ROS2] ✅ Đã kết nối ROS2 Core thành công qua WebSocket:', this.url);
            this.updateBadge(true, 'ROS2 Core: Đã kết nối (ws://' + this.url.split('://')[1] + ')');
            this.subscribeTopics();
        });

        this.ros.on('error', (error) => {
            this.isConnected = false;
            console.warn('[ROS2] Lỗi kết nối ROS2 WebSocket:', error);
            this.updateBadge(false, 'ROS2 Core: Lỗi kết nối');
        });

        this.ros.on('close', () => {
            this.isConnected = false;
            console.log('[ROS2] Đã ngắt kết nối ROS2 Core.');
            this.updateBadge(false, 'ROS2 Core: Chưa kết nối');
        });
    },

    updateBadge(connected, message) {
        const dot  = document.getElementById('ros2StatusDot');
        const text = document.getElementById('ros2StatusText');
        const badge = document.getElementById('ros2StatusBadge');

        if (dot && text && badge) {
            if (connected) {
                dot.className = "w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)] animate-pulse";
                text.className = "text-sky-300 font-semibold";
                text.innerText = message || 'ROS2 Core: Đã kết nối';
                badge.className = "flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-950/80 border border-sky-500/40 text-sm cursor-pointer";
            } else {
                dot.className = "w-2 h-2 rounded-full bg-rose-500";
                text.className = "text-slate-500";
                text.innerText = message || 'ROS2 Core: Chưa kết nối';
                badge.className = "flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/40 border border-slate-800 text-sm cursor-pointer";
            }
        }
    },

    subscribeTopics() {
        if (!this.ros || !this.isConnected) return;

        // 1. Subscribe Topic Bản Đồ ROS2 chuẩn (/map từ slam_toolbox)
        this.mapTopic = new ROSLIB.Topic({
            ros: this.ros,
            name: '/map',
            messageType: 'nav_msgs/msg/OccupancyGrid'
        });

        this.mapTopic.subscribe((gridMsg) => {
            if (!gridMsg || !gridMsg.info || !gridMsg.data) return;
            console.log(`[ROS2 /map] Nhận map ROS2 chuẩn: ${gridMsg.info.width}x${gridMsg.info.height}, resolution: ${gridMsg.info.resolution}m`);
            this.importRos2OccupancyGrid(gridMsg);
        });

        // 2. Subscribe Topic Vị Trí Robot ROS2 (/robot_pose)
        this.poseTopic = new ROSLIB.Topic({
            ros: this.ros,
            name: '/robot_pose',
            messageType: 'geometry_msgs/msg/PoseStamped'
        });

        this.poseTopic.subscribe((poseMsg) => {
            if (!poseMsg || !poseMsg.pose) return;
            const px = poseMsg.pose.position.x;
            const py = poseMsg.pose.position.y;
            const q = poseMsg.pose.orientation;
            const siny_cosp = 2 * (q.w * q.z + q.x * q.y);
            const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z);
            const heading = Math.atan2(siny_cosp, cosy_cosp);

            SlamEngine.pose = { x: px, y: py, heading: heading };
            SlamEngine.isInitialized = true;
            draw();
        });

        // 3. Khởi tạo Publisher Động Cơ ROS2 (/cmd_vel)
        this.cmdVelTopic = new ROSLIB.Topic({
            ros: this.ros,
            name: '/cmd_vel',
            messageType: 'geometry_msgs/msg/Twist'
        });

        // 4. Khởi tạo Publisher Đích Đến Tự Hành ROS2 (/goal_pose)
        this.goalTopic = new ROSLIB.Topic({
            ros: this.ros,
            name: '/goal_pose',
            messageType: 'geometry_msgs/msg/PoseStamped'
        });

        // 5. Khởi tạo Publisher Mây Điểm LiDAR 360° (/scan) cho ROS2 slam_toolbox
        this.scanTopic = new ROSLIB.Topic({
            ros: this.ros,
            name: '/scan',
            messageType: 'sensor_msgs/msg/LaserScan'
        });

        // 6. Khởi tạo Publisher Cây Tọa Độ TF (/tf) cho ROS2 slam_toolbox
        this.tfTopic = new ROSLIB.Topic({
            ros: this.ros,
            name: '/tf',
            messageType: 'tf2_msgs/msg/TFMessage'
        });
    },

    // Phát Cây Tọa Độ TF odom -> base_link -> laser chuẩn ROS2
    publishTf() {
        if (!this.tfTopic || !this.isConnected) return;
        const nowSec = Math.floor(Date.now() / 1000);
        const pose = SlamEngine.pose || { x: 0, y: 0, heading: 0 };

        const tfMsg = new ROSLIB.Message({
            transforms: [
                {
                    header: { frame_id: 'odom', stamp: { sec: nowSec, nanosec: 0 } },
                    child_frame_id: 'base_link',
                    transform: {
                        translation: { x: pose.x, y: pose.y, z: 0 },
                        rotation: { x: 0, y: 0, z: Math.sin(pose.heading / 2), w: Math.cos(pose.heading / 2) }
                    }
                },
                {
                    header: { frame_id: 'base_link', stamp: { sec: nowSec, nanosec: 0 } },
                    child_frame_id: 'laser',
                    transform: {
                        translation: { x: 0, y: 0, z: 0 },
                        rotation: { x: 0, y: 0, z: 0, w: 1 }
                    }
                }
            ]
        });

        this.tfTopic.publish(tfMsg);
    },

    // Phát mây điểm LiDAR 360° từ ESP32 WebSocket tới Topic /scan của ROS2 slam_toolbox
    publishLaserScan(rawPts) {
        if (!this.scanTopic || !this.isConnected || !rawPts || rawPts.length === 0) return;

        // Phát cây tọa độ TF trước khi đẩy mây điểm
        this.publishTf();

        // Resolution cao để SLAM map mịn nhất.
        // 1500 samples → angle_increment = 2π/1500 ≈ 0.24° → chi tiết rất cao
        const numSamples = 1500;
        const ranges = new Float32Array(numSamples).fill(0.0);

        for (const pt of rawPts) {
            const r = Math.sqrt(pt.x * pt.x + pt.y * pt.y);
            let angle = Math.atan2(pt.y, pt.x);
            if (angle < 0) angle += 2 * Math.PI;

            const idx = Math.floor((angle / (2 * Math.PI)) * numSamples) % numSamples;
            // Lấy giá trị MIN (closest hit) nếu có nhiều điểm cùng cung
            if (ranges[idx] === 0 || r < ranges[idx]) {
                ranges[idx] = r;
            }
        }

        const scanMsg = new ROSLIB.Message({
            header: {
                frame_id: 'laser',
                stamp: { sec: Math.floor(Date.now() / 1000), nanosec: 0 }
            },
            angle_min: 0.0,
            angle_max: 2 * Math.PI,
            angle_increment: (2 * Math.PI) / numSamples,
            time_increment: 0.0,
            scan_time: 0.1,
            range_min: 0.1,
            range_max: 8.0,
            ranges: Array.from(ranges)
        });

        this.scanTopic.publish(scanMsg);
    },

    // Chuyển bản đồ ROS2 OccupancyGrid sang OccupancyGrid Canvas HD
    importRos2OccupancyGrid(gridMsg) {
        const W = gridMsg.info.width;
        const H = gridMsg.info.height;
        const res = gridMsg.info.resolution;
        const rawData = gridMsg.data;

        // ★ Log throttling: chỉ log mỗi 5 giây (slam_toolbox publish ~1 Hz)
        const now = Date.now();
        if (!this._lastMapLogMs || now - this._lastMapLogMs > 5000) {
            this._lastMapLogMs = now;
            let unknown = 0, free = 0, occ = 0;
            for (let i = 0; i < rawData.length; i++) {
                const v = rawData[i];
                if (v < 0) unknown++;
                else if (v === 0) free++;
                else if (v >= 100) occ++;
            }
            console.log(`[ROS2 /map] ${W}x${H} res=${res}m  unknown=${unknown} free=${free} occ=${occ}`);
        }

        occupancyGrid.COLS = W;
        occupancyGrid.ROWS = H;
        occupancyGrid.RESOLUTION = res;
        occupancyGrid.ORIGIN_COL = Math.round(W / 2);
        occupancyGrid.ORIGIN_ROW = Math.round(H / 2);

        if (!occupancyGrid.data || occupancyGrid.data.length !== W * H) {
            occupancyGrid.data = new Float32Array(W * H);
            occupancyGrid.maskData = new Uint8Array(W * H).fill(255);
            occupancyGrid.offscreen.width = W * occupancyGrid.SUPER_SCALE;
            occupancyGrid.offscreen.height = H * occupancyGrid.SUPER_SCALE;
        }

        // ★ Mapping ROS OccupancyGrid [-1, 0..100] → Log-Odds của app:
        //   -1 (Unknown)       → 0.0 (giữa, sẽ render Unknown xám)
        //    0 (Free)          → -2.0 (rất tự do)
        //   100 (Occupied)     → 5.0 (chắc chắn tường)
        //    1..99 (xác suất)  → map tuyến tính từ -1.5 → 3.5 để giữ gradient
        // Lý do: ROS trả về giá trị xác suất (0..100), bỏ qua sẽ mất gradient → tường lem.
        for (let i = 0; i < rawData.length; i++) {
            const v = rawData[i];
            if (v < 0) {
                occupancyGrid.data[i] = 0.0;            // Unknown
            } else if (v === 0) {
                occupancyGrid.data[i] = -2.0;           // Free
            } else if (v >= 100) {
                occupancyGrid.data[i] = 5.0;            // Solid wall
            } else {
                // Gradient: v=1 → -1.5 (gần free), v=99 → 3.5 (gần occupied)
                occupancyGrid.data[i] = -1.5 + (v / 100) * 5.0;
            }
        }
        occupancyGrid.dirty = true;
        _mapStatsCache.grid = '';   // force re-count
        draw();
    },

    // Gửi lệnh điều khiển v, w về ROS2 (/cmd_vel)
    sendCmdVel(linearX, angularZ) {
        if (!this.cmdVelTopic || !this.isConnected) return;
        const twist = new ROSLIB.Message({
            linear: { x: linearX, y: 0, z: 0 },
            angular: { x: 0, y: 0, z: angularZ }
        });
        this.cmdVelTopic.publish(twist);
    },

    // Gửi điểm đích tự hành về ROS2 Nav2 (/goal_pose)
    sendGoalPose(x, y, heading = 0) {
        if (!this.goalTopic || !this.isConnected) return;
        const poseMsg = new ROSLIB.Message({
            header: {
                frame_id: 'map',
                stamp: { sec: Math.floor(Date.now() / 1000), nanosec: 0 }
            },
            pose: {
                position: { x: x, y: y, z: 0 },
                orientation: {
                    x: 0, y: 0,
                    z: Math.sin(heading / 2),
                    w: Math.cos(heading / 2)
                }
            }
        });
        this.goalTopic.publish(poseMsg);
        console.log(`[ROS2 Nav2] Đã phát lệnh tự hành /goal_pose tới điểm: (${x.toFixed(2)}m, ${y.toFixed(2)}m)`);
    }
};

// Tự động khởi tạo kết nối ROS2 khi nạp trang (Try default ws://localhost:9090)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        Ros2BridgeManager.init('ws://localhost:9090');
    }, 1500);
});

// Click vào Badge trạng thái ROS2 để nhập IP custom
document.getElementById('ros2StatusBadge')?.addEventListener('click', () => {
    const currentUrl = Ros2BridgeManager.url || 'ws://localhost:9090';
    const newUrl = prompt('Nhập địa chỉ ROS2 WebSocket Bridge Server:', currentUrl);
    if (newUrl && newUrl.trim()) {
        Ros2BridgeManager.init(newUrl.trim());
    }
});

// ============================================================================
// SLAM ENGINE — 2D Lidar SLAM (Scan-to-Scan Matching + Occupancy Grid)
// Toàn bộ SLAM back-end chạy trên PC (browser JavaScript)
// ESP32 chỉ làm front-end: thu thập và stream dữ liệu thô
// ============================================================================

// ---------- Occupancy Grid Map ----------
const occupancyGrid = {
    // Cấu hình lưới
    RESOLUTION: 0.05,     // 5cm mỗi ô chuẩn ROS/ROS2
    COLS: 500,            // 500 ô = 25m chiều ngang
    ROWS: 500,            // 500 ô = 25m chiều dọc
    ORIGIN_COL: 250,      // Gốc tọa độ (robot bắt đầu ở giữa grid)
    ORIGIN_ROW: 250,

    // Log-Odds parameters (Khóa Bộ Nhớ Bản Đồ Bền Vững Multi-Room)
    L_OCC:  1.8,          // Tăng mạnh khi ô bị tia LiDAR hit
    L_FREE: -0.38,        // Giảm vừa đủ khi tia đi qua (tự do)
    L_MIN:  -5.0,
    L_MAX:   8.0,         // Tăng giới hạn tích lũy lên 8.0 để tường đã quét được lưu bền vững vĩnh viễn
    L_THRESH_OCC:  0.4,   // Ngưỡng hiển thị tường nhạy
    L_THRESH_FREE: -0.5,  // Ngưỡng hiển thị là tự do

    // Dữ liệu lưới (Log-Odds)
    data: null,

    // Mảng Mask Vùng Cấm Keep-Out (0 = keepout, 255 = no keepout)
    maskData: null,

    // Chế độ theme hiển thị: 'ros' (Classic Light) hoặc 'rviz' (Dark Neon)
    theme: 'ros',

    // Offscreen canvas Ultra-HD Supersampling (2000×2000 px = Gấp 4 lần độ nét)
    offscreen: null,
    offCtx: null,
    dirty: false,
    SUPER_SCALE: 4, // 1 ô grid (5cm) = 4×4 pixel HD trên canvas offscreen

    init() {
        this.data = new Float32Array(this.COLS * this.ROWS).fill(0.0);
        this.maskData = new Uint8Array(this.COLS * this.ROWS).fill(255);
        this.offscreen = document.createElement('canvas');
        this.offscreen.width  = this.COLS * this.SUPER_SCALE; // 2000px HD
        this.offscreen.height = this.ROWS * this.SUPER_SCALE; // 2000px HD
        this.offCtx = this.offscreen.getContext('2d');
        this.dirty = true;
        this.render();
        console.log('[OccGrid] Khởi tạo lưới 500×500 ô kèm Bộ Render 4X Ultra-HD Supersampling (2000×2000 px)');
    },

    // Chuyển tọa độ thế giới (m) sang ô lưới
    worldToGrid(wx, wy) {
        const col = Math.round(this.ORIGIN_COL + wx / this.RESOLUTION);
        const row = Math.round(this.ORIGIN_ROW - wy / this.RESOLUTION);
        return { col, row };
    },

    get(col, row) {
        if (col < 0 || col >= this.COLS || row < 0 || row >= this.ROWS) return 0;
        return this.data[row * this.COLS + col];
    },

    update(col, row, delta) {
        if (col < 0 || col >= this.COLS || row < 0 || row >= this.ROWS) return;
        const idx = row * this.COLS + col;
        this.data[idx] = Math.max(this.L_MIN, Math.min(this.L_MAX, this.data[idx] + delta));
        this.dirty = true;
    },

    // Bresenham Raycasting (Khóa Bộ Nhớ Bản Đồ Vĩnh Viễn: Dừng tia khi đụng tường cũ, không làm mất Khu vực A khi sang Khu vực B)
    raycast(robCol, robRow, hitCol, hitRow, isHit) {
        let x0 = robCol, y0 = robRow;
        const x1 = hitCol, y1 = hitRow;
        const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
        const dy = Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        let steps = 0;
        while (steps++ < 600) {
            const isEnd = (x0 === x1 && y0 === y1);

            // Nếu tia đang bay ngang qua một ô ĐÃ LÀ TƯỜNG CẮNG (L_Odds >= 1.5) mà chưa tới điểm cuối -> DỪNG TIA NGAY!
            // Giúp bảo vệ 100% bản đồ khu vực A đã đi qua, không bị các tia bay từ khu vực B xóa nhầm!
            if (!isEnd && steps > 1 && this.get(x0, y0) >= 1.5) {
                break;
            }

            // Nếu ô đã là tường chắc, việc trừ L_FREE chỉ giảm rất nhẹ (-0.05) chống nhiễu
            const currentVal = this.get(x0, y0);
            let delta = (isEnd && isHit) ? this.L_OCC : this.L_FREE;
            if (!isEnd && currentVal >= 2.0) {
                delta = -0.05; // Bảo vệ tường chắc không bao giờ bị xóa nhầm
            }

            this.update(x0, y0, delta);
            if (isEnd) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 <  dx) { err += dx; y0 += sy; }
        }
    },

    // Cập nhật grid với 1 scan (Lọc khoảng cách tin cậy 4.0m chuẩn ROS2)
    updateWithScan(scanPtsXY, pose) {
        const robGrid = this.worldToGrid(pose.x, pose.y);
        const MAX_VALID_HIT_M = 4.0; // Tường thực tế tin cậy trong 4.0m (Khử hoàn toàn vệt quạt bắn xa)

        for (const pt of scanPtsXY) {
            const distM = Math.sqrt(pt.x * pt.x + pt.y * pt.y);
            if (distM < 0.12 || distM > MAX_VALID_HIT_M) continue; // Bỏ nhiễu cực gần và cực xa

            const cos_h = Math.cos(pose.heading);
            const sin_h = Math.sin(pose.heading);
            const wx = pose.x + pt.x * cos_h - pt.y * sin_h;
            const wy = pose.y + pt.x * sin_h + pt.y * cos_h;

            const hitGrid = this.worldToGrid(wx, wy);
            const isHit = (distM <= MAX_VALID_HIT_M * 0.95);

            this.raycast(robGrid.col, robGrid.row, hitGrid.col, hitGrid.row, isHit);
        }
    },

    // Render offscreen canvas 2000×2000 HD Supersample (Khử mốc rác lơ lửng, tường đen nét căng chuẩn ROS2)
    render() {
        if (!this.dirty) return;
        this.dirty = false;

        const superW = this.COLS * this.SUPER_SCALE; // 2000
        const superH = this.ROWS * this.SUPER_SCALE; // 2000
        const imgData = this.offCtx.createImageData(superW, superH);
        const pixels  = imgData.data;
        const S = this.SUPER_SCALE;
        const W = this.COLS, H = this.ROWS;

        for (let r = 0; r < H; r++) {
            for (let c = 0; c < W; c++) {
                const i = r * W + c;
                const lo = this.data[i];
                const maskVal = this.maskData ? this.maskData[i] : 255;

                // Tường đen sắc nét (Yêu cầu lo >= 1.5 và có ít nhất 1 ô hàng xóm lân cận)
                let isSolidWall = (lo >= 1.5);
                if (isSolidWall) {
                    let n = 0;
                    if (c > 0 && this.data[i - 1] > 0.4) n++;
                    if (c < W - 1 && this.data[i + 1] > 0.4) n++;
                    if (r > 0 && this.data[i - W] > 0.4) n++;
                    if (r < H - 1 && this.data[i + W] > 0.4) n++;
                    if (n === 0 && lo < 2.5) isSolidWall = false; // Bỏ mốc đơn lẻ lơ lửng ở giữa phòng
                }

                let red = 127, green = 140, blue = 141, alpha = 255; // Unknown Slate Gray #7F8C8D (chuẩn ROS OccupancyGrid)

                if (this.theme === 'rviz') {
                    if (isSolidWall) {
                        red = 255; green = 255; blue = 255; alpha = 255;
                    } else if (lo < this.L_THRESH_FREE) {
                        red = 17; green = 24; blue = 39; alpha = 240;
                    } else {
                        red = 30; green = 41; blue = 59; alpha = 180;
                    }
                } else {
                    // ★ ROS OccupancyGrid Standard (Tầng 4 — theo prompt Root-Cause)
                    //   Occupied (100) → Đen đậm #101010 (đường nét sắc nét)
                    //   Free      (0)  → Xám sáng/Trắng #F0F2F5 (sàn robot đi được)
                    //   Unknown   (-1) → Xám trung tính #7F8C8D (vùng chưa khám phá)
                    if (isSolidWall) {
                        red = 16; green = 16; blue = 16; alpha = 255;       // #101010 - Occupied
                    } else if (lo < this.L_THRESH_FREE) {
                        red = 240; green = 242; blue = 245; alpha = 255;   // #F0F2F5 - Free
                    } else {
                        red = 127; green = 140; blue = 141; alpha = 255;   // #7F8C8D - Unknown
                    }
                }

                // Phủ lớp Vùng Cấm Keep-Out Red Overlay
                if (maskVal === 0) {
                    const a = 0.55;
                    red   = Math.round(red * (1 - a) + 239 * a);
                    green = Math.round(green * (1 - a) + 68 * a);
                    blue  = Math.round(blue * (1 - a) + 68 * a);
                }

                // Ghi 4×4 subpixel HD cho mỗi ô grid
                const startY = r * S;
                const startX = c * S;

                for (let dy = 0; dy < S; dy++) {
                    const py = startY + dy;
                    const rowOffset = py * superW;
                    for (let dx = 0; dx < S; dx++) {
                        const px = startX + dx;
                        const base = (rowOffset + px) * 4;
                        pixels[base]     = red;
                        pixels[base + 1] = green;
                        pixels[base + 2] = blue;
                        pixels[base + 3] = alpha;
                    }
                }
            }
        }
        this.offCtx.putImageData(imgData, 0, 0);
    },

    // Reset toàn bộ bản đồ
    reset() {
        if (this.data) this.data.fill(0.0);
        if (this.maskData) this.maskData.fill(255);
        this.dirty = true;
        this.render();
        console.log('[OccGrid] Đã reset bản đồ Occupancy Grid và Keepout Mask.');
    }
};

// ---------- SLAM Engine ----------
const SlamEngine = {
    // Pose hiện tại (metre, radian)
    pose: { x: 0, y: 0, heading: 0 },

    // Histogram khoảng cách theo góc (360 bin) của scan trước
    prevBins: null,

    // Điểm scan thô trước (frame robot: x,y metre)
    prevPts: null,

    // Lịch sử hành trình
    trail: [],
    MAX_TRAIL: 5000,

    // Keyframe (để loop closure, dùng ở Phase 3)
    keyframes: [],
    lastKeyframeX: 0,
    lastKeyframeY: 0,
    KEYFRAME_DIST_M: 0.4, // Lưu keyframe mỗi khi di chuyển 40cm

    isInitialized: false,
    lastSendMs: 0,
    frameCount: 0,

    // Consecutive Motion Filter: số frame liên tiếp phát hiện chuyển động
    // Phải đạt MOTION_STREAK_NEEDED frame liên tiếp mới cập nhật pose
    motionStreak: 0,
    MOTION_STREAK_NEEDED: 1,   // ★ LIVE: 1 frame để phản hồi tức thì (cũ = 2 → lag)

    // Bật/tắt SLAM (UI toggle)
    enabled: true,

    // Xây dựng histogram khoảng cách theo góc 360°
    // Trả về Float32Array[NUM_BINS] (khoảng cách min trong bin, đơn vị: metre)
    buildBins(pts, numBins = 360) {
        const bins = new Float32Array(numBins).fill(0);
        for (const pt of pts) {
            let deg = Math.round((Math.atan2(pt.y, pt.x) * 180 / Math.PI + 360)) % numBins;
            const dist = Math.sqrt(pt.x * pt.x + pt.y * pt.y);
            if (dist < 0.05 || dist > 6.0) continue;
            if (bins[deg] === 0 || dist < bins[deg]) {
                bins[deg] = dist;
            }
        }
        return bins;
    },

    // Angular Correlation: Tìm góc dịch chuyển tốt nhất giữa 2 histogram
    // Tìm trong phạm vi ±MAX_SEARCH_DEG, trả về góc tối ưu (radian)
    findBestRotation(prevBins, currBins, maxSearchDeg = 25) {
        const N = prevBins.length;
        let bestScore = -Infinity;
        let bestShift = 0;

        for (let shift = -maxSearchDeg; shift <= maxSearchDeg; shift++) {
            let score = 0;
            let count = 0;
            for (let i = 0; i < N; i++) {
                const j = ((i + shift) % N + N) % N;
                const p = prevBins[i];
                const c = currBins[j];
                if (p > 0 && c > 0) {
                    const diff = Math.abs(p - c);
                    // Thưởng nếu khoảng cách khớp trong sai số ±8cm
                    score += diff < 0.08 ? 2 : (diff < 0.20 ? 0.5 : -0.5);
                    count++;
                }
            }
            // Chuẩn hoá theo số bin có dữ liệu để tránh bias scan thưa
            if (count > 10 && score / count > bestScore / Math.max(1, count)) {
                bestScore = score;
                bestShift = shift;
            }
        }
        return (bestShift * Math.PI) / 180; // → radian
    },

    // Translation Matching: Scan-to-Map Lock Engine (Tích hợp Motion Prior chống nhảy ziczac)
    findBestTranslation(currPts, dTheta, currentPose) {
        const targetHeading = currentPose.heading + dTheta;
        const cos_h = Math.cos(targetHeading);
        const sin_h = Math.sin(targetHeading);

        // Mẫu 1/2 số điểm để tính toán cực nhanh trong 1ms
        const samplePts = currPts.filter((_, i) => i % 2 === 0);

        let bestScore = -Infinity;
        let bestDx = 0, bestDy = 0;
        const STEP = 0.02; // Bước tìm kiếm 2cm siêu mịn
        const RANGE = 0.20; // Phạm vi tìm kiếm ±20cm

        for (let dx = -RANGE; dx <= RANGE; dx += STEP) {
            for (let dy = -RANGE; dy <= RANGE; dy += STEP) {
                const candX = currentPose.x + dx;
                const candY = currentPose.y + dy;
                let score = 0;

                // 1. Scan-to-Map Matching Score
                for (const pt of samplePts) {
                    const wx = candX + pt.x * cos_h - pt.y * sin_h;
                    const wy = candY + pt.x * sin_h + pt.y * cos_h;

                    const grid = occupancyGrid.worldToGrid(wx, wy);
                    const val = occupancyGrid.get(grid.col, grid.row);

                    if (val >= occupancyGrid.L_THRESH_OCC) {
                        score += 10; // Đâm trúng tường cũ trong map -> KHÓA KHỚP CỰC MẠNH (+10)
                    }
                }

                // 2. Motion Prior Penalty (Tốc độ chuyển động hợp lý, phạt nặng các bước nhảy vọt chéo vô lý)
                const distSq = dx * dx + dy * dy;
                score -= distSq * 90.0; // Phạt nặng nếu nhảy vị trí bất thường không có tường xác nhận

                if (score > bestScore) {
                    bestScore = score;
                    bestDx = dx;
                    bestDy = dy;
                }
            }
        }
        return { dx: bestDx, dy: bestDy };
    },

    // Xử lý scan mới: chạy toàn bộ pipeline SLAM
    processScan(rawPts, imuHeadingRad) {
        if (!this.enabled || rawPts.length < 20) return;

        const currBins = this.buildBins(rawPts);

        if (!this.isInitialized) {
            this.pose.heading    = imuHeadingRad;
            this.prevBins        = currBins;
            this.prevPts         = rawPts;
            this.isInitialized   = true;
            this.trail.push({ x: this.pose.x, y: this.pose.y });
            occupancyGrid.init();
            console.log('[SLAM] Khởi tạo SLAM Engine (Scan-to-Map Lock ROS2). Pose gốc: (0, 0)');
            return;
        }

        // ── Bước 0: Phát hiện scan tĩnh (Static Scan Detection) ─────────────
        let matchCount = 0, totalCount = 0;
        for (let i = 0; i < currBins.length; i++) {
            if (currBins[i] > 0 && this.prevBins[i] > 0) {
                totalCount++;
                if (Math.abs(currBins[i] - this.prevBins[i]) < 0.10) matchCount++;
            }
        }
        const similarity = totalCount > 0 ? matchCount / totalCount : 0;

        if (similarity > 0.93) {
            this.motionStreak = 0;
            this.frameCount++;
            if (this.frameCount % 3 === 0) {
                occupancyGrid.updateWithScan(rawPts, this.pose);
            }
            this.prevBins = currBins;
            this.prevPts  = rawPts;
            return;
        }

        // ── Bước 1: Rotation Matching (Tính góc xoay + Khóa kẹp chống xoáy góc mạng nhện) ──
        const rawDTheta = this.findBestRotation(this.prevBins, currBins, 18);

        let finalDTheta = 0;
        const currImu = (typeof imuHeadingRad === 'number' && !isNaN(imuHeadingRad) && imuHeadingRad !== 0) ? imuHeadingRad : null;

        if (currImu !== null && this.prevImuHeading !== null && this.prevImuHeading !== undefined) {
            let imuDelta = currImu - this.prevImuHeading;
            while (imuDelta > Math.PI)  imuDelta -= 2 * Math.PI;
            while (imuDelta < -Math.PI) imuDelta += 2 * Math.PI;

            // Kẹp gia tốc góc quay vật lý từ IMU (tối đa ±12°/frame)
            imuDelta = Math.max(-0.20, Math.min(0.20, imuDelta));
            finalDTheta = imuDelta;
        } else {
            // Không có IMU -> Kẹp dTheta cực nhỏ (tối đa ±4°/frame = 0.07 rad) chống giật xoáy 18° mạng nhện!
            if (Math.abs(rawDTheta) <= 0.10) {
                finalDTheta = rawDTheta;
            } else {
                finalDTheta = 0; // Bỏ qua nhảy góc vô lý
            }
        }

        if (currImu !== null) {
            this.prevImuHeading = currImu;
        }

        // Ngưỡng chết góc xoay chống trôi nhẹ (Deadband 2.5° = 0.044 rad)
        if (Math.abs(finalDTheta) < 0.044) {
            finalDTheta = 0;
        }

        // ── Bước 2: Scan-to-Map Translation Matching (Khóa vị trí với bản đồ) ──
        const t = this.findBestTranslation(rawPts, finalDTheta, this.pose);
        const dx = t.dx;
        const dy = t.dy;

        // ── Bước 3: Motion Gate — ngưỡng chết chống drift ──────────────────
        // YDLIDAR X3 noise: ~2-3cm, IMU gyro drift: ~0.5°/frame
        // Ngưỡng đặt cao hơn noise để chỉ nhận chuyển động thực sự:
        const MIN_TRANS_M = 0.06;  // 6cm (2× noise margin)
        const MIN_ROT_RAD = 0.052; // ~3° (6× gyro deadband)

        const distMoved      = Math.sqrt(dx * dx + dy * dy);
        const rotMoved       = Math.abs(finalDTheta);
        const hasTranslation = distMoved >= MIN_TRANS_M;
        const hasRotation    = rotMoved  >= MIN_ROT_RAD;

        if (!hasTranslation && !hasRotation) {
            // Không đủ ngưỡng → reset streak, chỉ cập nhật bản đồ
            this.motionStreak = 0;
            this.frameCount++;
            if (this.frameCount % 3 === 0) {
                occupancyGrid.updateWithScan(rawPts, this.pose);
            }
            this.prevBins = currBins;
            this.prevPts  = rawPts;
            return;
        }

        // ── Consecutive Motion Filter ─────────────────────────────────────────
        // Chỉ tin tưởng chuyển động nếu được phát hiện liên tiếp ≥ N frame.
        // Loại bỏ spike nhiễu nhất thời (vd: LiDAR bị che 1 frame → dx bất thường)
        this.motionStreak++;
        if (this.motionStreak < this.MOTION_STREAK_NEEDED) {
            // Frame đầu tiên phát hiện: chờ thêm 1 frame nữa xác nhận
            this.prevBins = currBins;
            this.prevPts  = rawPts;
            return;
        }

        // ── Bước 4: Cập nhật Pose ───────────────────────────────────────────
        if (hasTranslation) {
            const cos_h = Math.cos(this.pose.heading);
            const sin_h = Math.sin(this.pose.heading);
            this.pose.x += dx * cos_h - dy * sin_h;
            this.pose.y += dx * sin_h + dy * cos_h;
        }
        if (hasRotation) {
            this.pose.heading += finalDTheta;
            this.pose.heading  = ((this.pose.heading % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        }

        // Lưu trail (chỉ khi thực sự di chuyển)
        const lastTrail = this.trail[this.trail.length - 1] || { x: 0, y: 0 };
        const distFromLast = Math.sqrt(
            (this.pose.x - lastTrail.x) ** 2 + (this.pose.y - lastTrail.y) ** 2
        );
        if (distFromLast > 0.02) { // Lưu trail mỗi 2cm (tránh chấm quá dày)
            this.trail.push({ x: this.pose.x, y: this.pose.y });
            if (this.trail.length > this.MAX_TRAIL) this.trail.shift();
        }

// ── Bước 5: Cập nhật Occupancy Grid ────────────────────────────────
    this.frameCount++;
    // ★ LIVE-MODE: cập nhật occupancyGrid MỖI frame (không skip %2) để map mượt như RViz realtime
    occupancyGrid.updateWithScan(rawPts, this.pose);
    occupancyGrid.dirty = true;   // Đánh dấu cần render lại (render loop sẽ pick up)

        // Cập nhật prev
        this.prevBins = currBins;
        this.prevPts  = rawPts;

        // Gửi SLAM pose về ESP32 (tối đa 5 Hz)
        const nowMs = Date.now();
        if (nowMs - this.lastSendMs >= 200) {
            this.lastSendMs = nowMs;
            if (robotWs && isRobotWsConnected) {
                try {
                    robotWs.send(JSON.stringify({
                        t: 'slam_pose',
                        x: parseFloat(this.pose.x.toFixed(4)),
                        y: parseFloat(this.pose.y.toFixed(4)),
                        h: parseFloat(this.pose.heading.toFixed(5))
                    }));
                } catch (e) { /* silent */ }
            }
        }

        draw();
    },

    // Reset SLAM về gốc
    reset() {
        this.pose          = { x: 0, y: 0, heading: 0 };
        this.prevBins      = null;
        this.prevPts       = null;
        this.prevImuHeading = null;
        this.isInitialized = false;
        this.trail         = [];
        this.frameCount    = 0;
        this.lastSendMs    = 0;
        this.motionStreak  = 0;
        occupancyGrid.reset();
        console.log('[SLAM] Đã reset SLAM Engine và Occupancy Grid.');
        appendLidarLog('[SLAM] Đã reset bản đồ SLAM và Occupancy Grid.');
        draw();
    }
};

// ---------- Hook vào setLiveLidarPoints: chạy SLAM an toàn không gây lag ----------
const _origSetLiveLidarPoints = window.setLiveLidarPoints;
window.setLiveLidarPoints = function(points) {
    // 1. Gọi logic gốc (cập nhật liveLidarScanPoints, badge throttle, RAF draw)
    if (_origSetLiveLidarPoints) {
        _origSetLiveLidarPoints(points);
    } else {
        window.liveLidarScanPoints = points || [];
        lastLidarScanTimestamp = Date.now();
    }

    // 2. Nếu ROS2 Bridge đang kết nối, ROS2 slam_toolbox đang làm SLAM → bỏ qua SLAM JS để tiết kiệm 100% CPU!
    if (typeof Ros2BridgeManager !== 'undefined' && Ros2BridgeManager.isConnected) {
        return;
    }

    // 3. Nếu chạy SLAM JS nội bộ (không có ROS2), throttle tần số SLAM max 5Hz (200ms) để không khóa UI
    const now = Date.now();
    if (!window._lastSlamCpuProcessMs || now - window._lastSlamCpuProcessMs >= 200) {
        window._lastSlamCpuProcessMs = now;
        const imuHeading = (typeof window._lastImuHeadingRad === 'number') ? window._lastImuHeadingRad : 0;
        if (typeof SlamEngine !== 'undefined' && SlamEngine.enabled) {
            SlamEngine.processScan(points || [], imuHeading);
        }
    }
};

// ---------- Patch applyLiveTelemetry để lưu IMU heading ----------
const _origApplyTelemetry = typeof applyLiveTelemetry === 'function' ? applyLiveTelemetry : null;
if (_origApplyTelemetry) {
    window.applyLiveTelemetry = function(data) {
        _origApplyTelemetry(data);
        // Lưu IMU heading (radian) từ telemetry packet
        // Field name trong WebManager: HeadingRad (từ normalizeSignalRTelemetry)
        if (data && typeof data.HeadingRad === 'number') {
            window._lastImuHeadingRad = data.HeadingRad;
        } else if (data && typeof data.headingRad === 'number') {
            window._lastImuHeadingRad = data.headingRad;
        } else if (data && typeof data.imuHeading === 'number') {
            window._lastImuHeadingRad = data.imuHeading * Math.PI / 180;
        }
    };
}

// ---------- Patch draw() để vẽ SLAM trail + Occupancy Grid ----------
const _origDraw = typeof draw === 'function' ? draw : null;
if (_origDraw) {
    window.draw = function() {
        _origDraw();

        const canvas = document.getElementById('graphCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);

        // ── Tính Anchor: vị trí robot trên canvas (pixel) ─────────────────
        // Robot từ API (m → px). Nếu chưa có API, dùng gốc canvas center.
        const robCanvasX = (robotLiveX !== null)
            ? robotLiveX / PIXEL_TO_METER
            : (canvas.width  / 2 / scale - offsetX / scale);
        const robCanvasY = (robotLiveY !== null)
            ? robotLiveY / PIXEL_TO_METER
            : (canvas.height / 2 / scale - offsetY / scale);

        // ── Tỉ lệ scale: 1 ô lưới SLAM (5cm) = bao nhiêu pixel canvas ───
        // PIXEL_TO_METER = 0.006 (1px = 0.6cm), RESOLUTION = 0.05 (1cell = 5cm)
        // → 1 cell = 5cm / 0.6cm = 8.33 px trên canvas
        const cellPx = occupancyGrid.RESOLUTION / PIXEL_TO_METER; // ≈ 8.33

        // ── Gốc toạ độ SLAM trên canvas ──────────────────────────────────
        // Robot hiện tại ở (pose.x, pose.y) trong SLAM space.
        // → Gốc SLAM (0,0) ở vị trí: robot_canvas - pose_canvas_offset
        const slamOriginX = robCanvasX - SlamEngine.pose.x / PIXEL_TO_METER;
        const slamOriginY = robCanvasY + SlamEngine.pose.y / PIXEL_TO_METER;

        // ── Lớp 1: Occupancy Grid Map ─────────────────────────────────────
        if (showSlamGridLayer && occupancyGrid.offscreen && SlamEngine.isInitialized) {
            occupancyGrid.render(); // Chỉ render lại khi dirty

            const gx = slamOriginX - occupancyGrid.ORIGIN_COL * cellPx;
            const gy = slamOriginY - occupancyGrid.ORIGIN_ROW * cellPx;
            const mapW = occupancyGrid.COLS * cellPx;
            const mapH = occupancyGrid.ROWS * cellPx;

            ctx.save();
            // Bật Bilinear Subpixel Smoothing mịn màng như RViz / ROS2
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.globalAlpha = 1.0;

            // ★ Áp dụng Rotation + Flip quanh ROBOT CENTER (robCanvasX, robCanvasY)
            // Khi user click "Xoay Map" hoặc "Lật Map", toàn bộ occupancyGrid sẽ xoay/lật
            // nhưng ROBOT vẫn đứng yên ở tâm - giúp người dùng dễ định hướng.
            if (mapRotationDeg !== 0 || mapFlipMode !== 0) {
                ctx.translate(robCanvasX, robCanvasY);
                if (mapFlipMode === 1) ctx.scale(-1, 1);     // Lật ngang (trái↔phải)
                if (mapFlipMode === 2) ctx.scale(1, -1);     // Lật dọc (trên↔dưới)
                if (mapRotationDeg !== 0) ctx.rotate(mapRotationDeg * Math.PI / 180);
                ctx.translate(-robCanvasX, -robCanvasY);
            }

            ctx.drawImage(
                occupancyGrid.offscreen,
                gx, gy,
                mapW,
                mapH
            );
            ctx.restore();

            // ── Lớp 1.2: Lưới Thước Đo 1 Mét x 1 Mét Chuẩn RViz ────────────
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.lineWidth   = 1 / scale;
            const meterPx = 1.0 / PIXEL_TO_METER;

            // Kẻ dọc & ngang mỗi 1m quanh gốc SLAM
            for (let x = -15; x <= 15; x++) {
                const px = slamOriginX + x * meterPx;
                ctx.beginPath();
                ctx.moveTo(px, slamOriginY - 15 * meterPx);
                ctx.lineTo(px, slamOriginY + 15 * meterPx);
                ctx.stroke();
            }
            for (let y = -15; y <= 15; y++) {
                const py = slamOriginY - y * meterPx;
                ctx.beginPath();
                ctx.moveTo(slamOriginX - 15 * meterPx, py);
                ctx.lineTo(slamOriginX + 15 * meterPx, py);
                ctx.stroke();
            }
            ctx.restore();
        }

        // ── Lớp 1.5: Robot TF Coordinate Axes & Directional FOV Frustum (Chuẩn RViz) ──
        if (SlamEngine.isInitialized) {
            ctx.save();
            ctx.translate(robCanvasX, robCanvasY);
            ctx.rotate(SlamEngine.pose.heading);

            // Nón quét LiDAR 360°
            const fovGrad = ctx.createRadialGradient(0, 0, 4 / scale, 0, 0, 110 / scale);
            fovGrad.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
            fovGrad.addColorStop(0.6, 'rgba(16, 185, 129, 0.10)');
            fovGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, 110 / scale, -Math.PI * 0.4, Math.PI * 0.4);
            ctx.closePath();
            ctx.fillStyle = fovGrad;
            ctx.fill();

            // Trục tọa độ TF Robot (Red = X Forward, Green = Y Left chuẩn ROS)
            const axisLen = 22 / scale;
            // Trục X (Đỏ)
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(axisLen, 0);
            ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2.5 / scale; ctx.stroke();
            // Trục Y (Xanh lá)
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -axisLen);
            ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2.5 / scale; ctx.stroke();

            ctx.restore();
        }

        // ── Lớp 2: SLAM Trail (Vệt hành trình Xanh lá Neon) ───────────────────
        if (SlamEngine.trail.length > 1) {
            ctx.save();
            ctx.beginPath();
            const t0 = SlamEngine.trail[0];
            ctx.moveTo(
                slamOriginX + t0.x / PIXEL_TO_METER,
                slamOriginY - t0.y / PIXEL_TO_METER
            );
            for (let i = 1; i < SlamEngine.trail.length; i++) {
                const tp = SlamEngine.trail[i];
                ctx.lineTo(
                    slamOriginX + tp.x / PIXEL_TO_METER,
                    slamOriginY - tp.y / PIXEL_TO_METER
                );
            }
            ctx.shadowColor = '#10dc64';
            ctx.shadowBlur  = 8 / scale;
            ctx.strokeStyle = '#10dc64';
            ctx.lineWidth   = 2.5 / scale;
            ctx.lineCap     = 'round';
            ctx.lineJoin    = 'round';
            ctx.stroke();
            ctx.restore();

            // Chấm tròn tại vị trí SLAM hiện tại (= đúng vị trí robot trên canvas)
            ctx.save();
            ctx.shadowColor = '#10dc64';
            ctx.shadowBlur  = 12 / scale;
            ctx.beginPath();
            ctx.arc(robCanvasX, robCanvasY, 6.5 / scale, 0, Math.PI * 2);
            ctx.fillStyle = '#10dc64';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth   = 2 / scale;
            ctx.stroke();
            ctx.restore();

            // Label tọa độ SLAM ngay cạnh robot
            ctx.fillStyle = '#10dc64';
            ctx.font      = `bold ${10 / scale}px monospace`;
            ctx.textAlign = 'left';
            ctx.fillText(
                `SLAM (${SlamEngine.pose.x.toFixed(2)}m, ${SlamEngine.pose.y.toFixed(2)}m)`,
                robCanvasX + 12 / scale,
                robCanvasY - 12 / scale
            );
        }

        // ── Lớp 3: Shape & Measure Ghost Previews ────────────────────────
        if (slamPreviewing && (slamTool === 'measure' || slamShape === 'line' || slamShape === 'rect')) {
            const cellPx = occupancyGrid.RESOLUTION / PIXEL_TO_METER; // ~8.33
            const gx = slamOriginX - occupancyGrid.ORIGIN_COL * cellPx;
            const gy = slamOriginY - occupancyGrid.ORIGIN_ROW * cellPx;

            const px1 = gx + slamStartX * cellPx + cellPx / 2;
            const py1 = gy + slamStartY * cellPx + cellPx / 2;
            const px2 = gx + (slamLastPreviewX ?? slamStartX) * cellPx + cellPx / 2;
            const py2 = gy + (slamLastPreviewY ?? slamStartY) * cellPx + cellPx / 2;

            if (slamTool === 'measure') {
                // Đường thước đo (Cyan)
                ctx.beginPath();
                ctx.moveTo(px1, py1);
                ctx.lineTo(px2, py2);
                ctx.strokeStyle = 'rgba(6, 182, 212, 0.95)';
                ctx.lineWidth   = 2.5 / scale;
                ctx.setLineDash([6 / scale, 4 / scale]);
                ctx.stroke();
                ctx.setLineDash([]);

                // Chấm 2 đầu
                [ [px1, py1], [px2, py2] ].forEach(([x, y]) => {
                    ctx.beginPath();
                    ctx.arc(x, y, 4 / scale, 0, Math.PI * 2);
                    ctx.fillStyle = '#06b6d4';
                    ctx.fill();
                });

                // Tính khoảng cách thực tế (m & ft)
                const dCol = (slamLastPreviewX ?? slamStartX) - slamStartX;
                const dRow = (slamLastPreviewY ?? slamStartY) - slamStartY;
                const distM = Math.sqrt(dCol * dCol + dRow * dRow) * occupancyGrid.RESOLUTION;
                const distFt = distM * 3.28084;
                const labelTxt = `${distM.toFixed(3)} m (${distFt.toFixed(2)} ft)`;

                // Label khoảng cách
                const midX = (px1 + px2) / 2;
                const midY = (py1 + py2) / 2;
                ctx.font = `bold ${11 / scale}px sans-serif`;
                const tw = ctx.measureText(labelTxt).width;

                ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
                ctx.fillRect(midX - tw / 2 - 6 / scale, midY - 14 / scale, tw + 12 / scale, 18 / scale);
                ctx.strokeStyle = '#06b6d4';
                ctx.lineWidth = 1 / scale;
                ctx.strokeRect(midX - tw / 2 - 6 / scale, midY - 14 / scale, tw + 12 / scale, 18 / scale);

                ctx.fillStyle = '#22d3ee';
                ctx.textAlign = 'center';
                ctx.fillText(labelTxt, midX, midY);
            } else if (slamShape === 'line') {
                ctx.beginPath();
                ctx.moveTo(px1, py1);
                ctx.lineTo(px2, py2);
                ctx.strokeStyle = 'rgba(52, 211, 153, 0.8)';
                ctx.lineWidth   = (slamBrush * cellPx) / 2 / scale;
                ctx.stroke();
            } else if (slamShape === 'rect') {
                const rx = Math.min(px1, px2);
                const ry = Math.min(py1, py2);
                const rw = Math.abs(px2 - px1);
                const rh = Math.abs(py2 - py1);
                if (slamFilledRect) {
                    ctx.fillStyle = 'rgba(52, 211, 153, 0.35)';
                    ctx.fillRect(rx, ry, rw, rh);
                }
                ctx.strokeStyle = 'rgba(52, 211, 153, 0.9)';
                ctx.lineWidth   = 2 / scale;
                ctx.strokeRect(rx, ry, rw, rh);
            }
        }

        ctx.restore();
    };
}

// ============================================================================
// ROS SLAM MAP EDITOR SUITE (Integrated from ROS-SLAM-Map-Editor)
// ============================================================================

// State
let slamTool = 'select'; // 'select' | 'paint' | 'erase' | 'unscan' | 'mask' | 'measure'
let slamShape = 'freehand'; // 'freehand' | 'line' | 'rect'
let slamBrush = 8;
let slamFilledRect = false;

let slamDrawing = false;
let slamPreviewing = false;
let slamStartX = 0, slamStartY = 0;
let slamLastPreviewX = null, slamLastPreviewY = null;

// Undo / Redo Stacks
const slamUndoStack = [];
const slamRedoStack = [];
let slamCurrentStroke = null;
let slamTouchedIndices = null;

// ---------- PGM & YAML Parser / Encoder Utilities ----------

function parsePGM(buf) {
    const uint8 = new Uint8Array(buf);
    let pos = 0;
    function nextToken() {
        while (pos < uint8.length) {
            while (pos < uint8.length && uint8[pos] <= 32) pos++;
            if (uint8[pos] === 35) { // # comment
                while (pos < uint8.length && uint8[pos] !== 10 && uint8[pos] !== 13) pos++;
                continue;
            }
            break;
        }
        if (pos >= uint8.length) return null;
        let start = pos;
        while (pos < uint8.length && uint8[pos] > 32 && uint8[pos] !== 35) pos++;
        let str = '';
        for (let i = start; i < pos; i++) str += String.fromCharCode(uint8[i]);
        return str;
    }

    const magic = nextToken();
    if (!magic || (magic !== 'P5' && magic !== 'P2')) {
        throw new Error('Định dạng PGM không hỗ trợ: ' + magic);
    }
    const width = parseInt(nextToken(), 10);
    const height = parseInt(nextToken(), 10);
    const maxval = parseInt(nextToken(), 10);

    if (pos < uint8.length && (uint8[pos] === 10 || uint8[pos] === 13 || uint8[pos] === 32)) {
        pos++;
        if (pos < uint8.length && uint8[pos - 1] === 13 && uint8[pos] === 10) pos++;
    }

    let pixels;
    if (magic === 'P5') {
        pixels = uint8.subarray(pos, pos + width * height);
    } else {
        pixels = new Uint8Array(width * height);
        for (let i = 0; i < width * height; i++) {
            const tok = nextToken();
            pixels[i] = tok ? parseInt(tok, 10) : 0;
        }
    }
    return { magic, width, height, maxval, pixels };
}

function encodePGM(pixels, width, height, maxval = 255) {
    const headerStr = `P5\n${width} ${height}\n${maxval}\n`;
    const headerBytes = new TextEncoder().encode(headerStr);
    const out = new Uint8Array(headerBytes.length + width * height);
    out.set(headerBytes, 0);
    for (let i = 0; i < pixels.length; i++) {
        out[headerBytes.length + i] = Math.max(0, Math.min(255, pixels[i]));
    }
    return out;
}

function buildUpdatedYaml(imageName, resolution = 0.05, origin = [-12.5, -12.5, 0.0]) {
    return `image: ${imageName}
resolution: ${resolution.toFixed(6)}
origin: [${origin[0].toFixed(6)}, ${origin[1].toFixed(6)}, ${origin[2].toFixed(6)}]
negate: 0
occupied_thresh: 0.65
free_thresh: 0.196
`;
}

function dlBytes(bytes, filename, mime = 'application/octet-stream') {
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
}

function dlText(txt, filename, mime = 'text/yaml') {
    dlBytes(new TextEncoder().encode(txt), filename, mime);
}

// ---------- Undo / Redo Engine ----------

function beginSlamStroke() {
    slamCurrentStroke = [];
    slamTouchedIndices = new Set();
}

function finishSlamStroke() {
    if (slamCurrentStroke && slamCurrentStroke.length > 0) {
        slamUndoStack.push(slamCurrentStroke);
        if (slamUndoStack.length > 100) slamUndoStack.shift();
        slamRedoStack.length = 0;
    }
    slamCurrentStroke = null;
    slamTouchedIndices = null;
}

function undoSlam() {
    const changeSet = slamUndoStack.pop();
    if (!changeSet) return;
    const redoSet = [];
    for (const ch of changeSet) {
        if (ch.layer === 'data') {
            occupancyGrid.data[ch.idx] = ch.prev;
        } else if (ch.layer === 'mask') {
            occupancyGrid.maskData[ch.idx] = ch.prev;
        }
        redoSet.push({ layer: ch.layer, idx: ch.idx, prev: ch.prev, next: ch.next });
    }
    slamRedoStack.push(redoSet);
    occupancyGrid.dirty = true;
    draw();
}

function redoSlam() {
    const changeSet = slamRedoStack.pop();
    if (!changeSet) return;
    const undoSet = [];
    for (const ch of changeSet) {
        if (ch.layer === 'data') {
            occupancyGrid.data[ch.idx] = ch.next;
        } else if (ch.layer === 'mask') {
            occupancyGrid.maskData[ch.idx] = ch.next;
        }
        undoSet.push({ layer: ch.layer, idx: ch.idx, prev: ch.prev, next: ch.next });
    }
    slamUndoStack.push(undoSet);
    occupancyGrid.dirty = true;
    draw();
}

function setPixelWithUndo(layer, idx, nextVal) {
    const buf = (layer === 'data') ? occupancyGrid.data : occupancyGrid.maskData;
    if (!buf || idx < 0 || idx >= buf.length) return;
    const prevVal = buf[idx];
    if (prevVal === nextVal) return;

    if (slamTouchedIndices && !slamTouchedIndices.has(idx)) {
        if (slamCurrentStroke) {
            slamCurrentStroke.push({ layer, idx, prev: prevVal, next: nextVal });
        }
        slamTouchedIndices.add(idx);
    }
    buf[idx] = nextVal;
    occupancyGrid.dirty = true;
}

// ---------- Drawing Primitives ----------

function paintGridCellBuffer(layer, col, row, rad, value) {
    const cols = occupancyGrid.COLS, rows = occupancyGrid.ROWS;
    for (let r = row - rad; r <= row + rad; r++) {
        if (r < 0 || r >= rows) continue;
        for (let c = col - rad; c <= col + rad; c++) {
            if (c < 0 || c >= cols) continue;
            if ((c - col) ** 2 + (r - row) ** 2 <= rad ** 2) {
                const idx = r * cols + c;
                setPixelWithUndo(layer, idx, value);
            }
        }
    }
}

function paintAtGridCell(col, row) {
    if (!occupancyGrid.data) return;
    const rad = Math.max(1, Math.floor(slamBrush / 2));
    if (slamTool === 'paint') {
        paintGridCellBuffer('data', col, row, rad, occupancyGrid.L_MAX);
    } else if (slamTool === 'erase') {
        paintGridCellBuffer('data', col, row, rad, occupancyGrid.L_MIN);
        paintGridCellBuffer('mask', col, row, rad, 255);
    } else if (slamTool === 'unscan') {
        paintGridCellBuffer('data', col, row, rad, 0.0);
    } else if (slamTool === 'mask') {
        paintGridCellBuffer('mask', col, row, rad, 0);
    }
    draw();
}

function drawThickLineGrid(col1, row1, col2, row2) {
    let c0 = col1, r0 = row1, c1 = col2, r1 = row2;
    const dc = Math.abs(c1 - c0), dr = Math.abs(r1 - r0);
    const sc = c0 < c1 ? 1 : -1, sr = r0 < r1 ? 1 : -1;
    let err = dc - dr;
    while (true) {
        paintAtGridCell(c0, r0);
        if (c0 === c1 && r0 === r1) break;
        const e2 = 2 * err;
        if (e2 > -dr) { err -= dr; c0 += sc; }
        if (e2 <  dc) { err += dc; r0 += sr; }
    }
}

function drawThickRectGrid(col1, row1, col2, row2) {
    const cMin = Math.min(col1, col2), cMax = Math.max(col1, col2);
    const rMin = Math.min(row1, row2), rMax = Math.max(row1, row2);
    drawThickLineGrid(cMin, rMin, cMax, rMin);
    drawThickLineGrid(cMax, rMin, cMax, rMax);
    drawThickLineGrid(cMax, rMax, cMin, rMax);
    drawThickLineGrid(cMin, rMax, cMin, rMin);
}

function drawFilledRectGrid(col1, row1, col2, row2) {
    const cMin = Math.min(col1, col2), cMax = Math.max(col1, col2);
    const rMin = Math.min(row1, row2), rMax = Math.max(row1, row2);
    const rad = Math.max(1, Math.floor(slamBrush / 2));
    for (let r = rMin - rad; r <= rMax + rad; r++) {
        if (r < 0 || r >= occupancyGrid.ROWS) continue;
        for (let c = cMin - rad; c <= cMax + rad; c++) {
            if (c < 0 || c >= occupancyGrid.COLS) continue;
            const idx = r * occupancyGrid.COLS + c;
            if (slamTool === 'paint') setPixelWithUndo('data', idx, occupancyGrid.L_MAX);
            else if (slamTool === 'erase') { setPixelWithUndo('data', idx, occupancyGrid.L_MIN); setPixelWithUndo('mask', idx, 255); }
            else if (slamTool === 'unscan') setPixelWithUndo('data', idx, 0.0);
            else if (slamTool === 'mask') setPixelWithUndo('mask', idx, 0);
        }
    }
    draw();
}

// ---------- Import & Export ROS PGM + YAML Maps ----------

function exportSlamPgmYaml() {
    if (!occupancyGrid.data) return;
    const W = occupancyGrid.COLS, H = occupancyGrid.ROWS;
    const pixels = new Uint8Array(W * H);

    for (let i = 0; i < occupancyGrid.data.length; i++) {
        const lo = occupancyGrid.data[i];
        if (lo > occupancyGrid.L_THRESH_OCC) {
            pixels[i] = 0; // Occupied = 0 (black in ROS)
        } else if (lo < occupancyGrid.L_THRESH_FREE) {
            pixels[i] = 254; // Free = 254 (white in ROS)
        } else {
            pixels[i] = 205; // Unknown = 205 (gray in ROS)
        }
    }

    const pgmBytes = encodePGM(pixels, W, H, 255);
    const yamlTxt = buildUpdatedYaml('map_edited.pgm', occupancyGrid.RESOLUTION, [-12.5, -12.5, 0.0]);

    dlBytes(pgmBytes, 'map_edited.pgm', 'image/x-portable-graymap');
    dlText(yamlTxt, 'map_edited.yaml', 'text/yaml');
    console.log('[SLAM] Đã xuất bản đồ ROS map_edited.pgm và map_edited.yaml');
    appendLidarLog('[SLAM] Đã xuất thành công bản đồ ROS map_edited.pgm + .yaml');
}

function exportKeepoutMask() {
    if (!occupancyGrid.maskData) return;
    const W = occupancyGrid.COLS, H = occupancyGrid.ROWS;
    const pgmBytes = encodePGM(occupancyGrid.maskData, W, H, 255);
    const yamlTxt = buildUpdatedYaml('map_keepout.pgm', occupancyGrid.RESOLUTION, [-12.5, -12.5, 0.0]);

    dlBytes(pgmBytes, 'map_keepout.pgm', 'image/x-portable-graymap');
    dlText(yamlTxt, 'map_keepout.yaml', 'text/yaml');
    console.log('[SLAM] Đã xuất bản đồ vùng cấm map_keepout.pgm');
    appendLidarLog('[SLAM] Đã xuất thành công bản đồ vùng cấm map_keepout.pgm + .yaml');
}

function importPgmYaml(files) {
    if (!files || files.length === 0) return;
    for (const file of files) {
        const name = file.name.toLowerCase();
        if (name.endsWith('.pgm')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parsed = parsePGM(e.target.result);
                    const isKeepout = name.includes('keepout') || name.includes('mask');
                    if (isKeepout) {
                        occupancyGrid.maskData = new Uint8Array(parsed.pixels);
                        console.log('[SLAM] Đã nạp file Keepout Mask PGM thành công:', file.name);
                        appendLidarLog('[SLAM] Nạp thành công Keepout Mask: ' + file.name);
                    } else {
                        for (let i = 0; i < parsed.pixels.length && i < occupancyGrid.data.length; i++) {
                            const val = parsed.pixels[i];
                            if (val <= 50) occupancyGrid.data[i] = occupancyGrid.L_MAX;
                            else if (val >= 200) occupancyGrid.data[i] = occupancyGrid.L_MIN;
                            else occupancyGrid.data[i] = 0.0;
                        }
                        console.log('[SLAM] Đã nạp file ROS Map PGM thành công:', file.name);
                        appendLidarLog('[SLAM] Nạp thành công ROS Map: ' + file.name);
                    }
                    occupancyGrid.dirty = true;
                    draw();
                } catch (err) {
                    console.error('[SLAM] Lỗi parse file PGM:', err);
                    alert('Lỗi nạp file PGM: ' + err.message);
                }
            };
            reader.readAsArrayBuffer(file);
        } else if (name.endsWith('.yaml') || name.endsWith('.yml')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const txt = e.target.result;
                    const resMatch = txt.match(/resolution:\s*([\d.]+)/);
                    if (resMatch) {
                        const res = parseFloat(resMatch[1]);
                        if (res > 0) occupancyGrid.RESOLUTION = res;
                    }
                    console.log('[SLAM] Đã nạp file YAML resolution:', occupancyGrid.RESOLUTION);
                    appendLidarLog('[SLAM] Nạp YAML resolution = ' + occupancyGrid.RESOLUTION + 'm/cell');
                } catch (err) { /* silent */ }
            };
            reader.readAsText(file);
        }
    }
}

// ---------- UI Event Wireups & Canvas Interaction ----------

document.addEventListener('DOMContentLoaded', () => {
    // Tool buttons
    document.querySelectorAll('.slam-tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.slam-tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            slamTool = btn.dataset.tool;
            const cursor = document.getElementById('brushCursor');
            if (cursor) cursor.style.display = (slamTool !== 'select') ? 'block' : 'none';
        });
    });

    // Shape buttons
    document.querySelectorAll('.slam-shape-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.slam-shape-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            slamShape = btn.dataset.shape;
        });
    });

    // Filled Rect
    const chkFilled = document.getElementById('chkSlamFilledRect');
    if (chkFilled) {
        chkFilled.addEventListener('change', (e) => { slamFilledRect = e.target.checked; });
    }

    // Brush slider
    const rngBrush = document.getElementById('rngSlamBrushSize');
    const lblBrush = document.getElementById('lblSlamBrushSize');
    if (rngBrush && lblBrush) {
        rngBrush.addEventListener('input', (e) => {
            slamBrush = parseInt(e.target.value, 10);
            lblBrush.textContent = slamBrush + ' px';
            updateBrushCursorDisplay();
        });
    }

    // Undo / Redo
    const btnUndo = document.getElementById('btnSlamUndo');
    const btnRedo = document.getElementById('btnSlamRedo');
    if (btnUndo) btnUndo.addEventListener('click', undoSlam);
    if (btnRedo) btnRedo.addEventListener('click', redoSlam);

    // Export / Import
    const btnExportMap = document.getElementById('btnExportPgmYaml');
    const btnExportMask = document.getElementById('btnExportKeepoutMask');
    const btnImportMap = document.getElementById('btnImportPgmYaml');

    if (btnExportMap) btnExportMap.addEventListener('click', exportSlamPgmYaml);
    if (btnExportMask) btnExportMask.addEventListener('click', exportKeepoutMask);
    if (btnImportMap) {
        btnImportMap.addEventListener('change', (e) => importPgmYaml(e.target.files));
    }

    // Canvas Events for Map Editing
    const graphCanvas = document.getElementById('graphCanvas');
    const brushCursor = document.getElementById('brushCursor');

    function updateBrushCursorDisplay() {
        if (!brushCursor) return;
        const cellPx = occupancyGrid.RESOLUTION / PIXEL_TO_METER;
        const d = Math.max(4, Math.round(slamBrush * cellPx * scale));
        brushCursor.style.width = d + 'px';
        brushCursor.style.height = d + 'px';
    }

    function getGridCellFromEvent(e) {
        if (!graphCanvas) return { col: 0, row: 0, clientX: 0, clientY: 0 };
        const rect = graphCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const mouseX = clientX - rect.left;
        const mouseY = clientY - rect.top;

        // Un-transform canvas (translate & scale)
        const canvasX = (mouseX - offsetX) / scale;
        const canvasY = (mouseY - offsetY) / scale;

        // Robot position on canvas
        const robCanvasX = (robotLiveX !== null)
            ? robotLiveX / PIXEL_TO_METER
            : (graphCanvas.width / 2 / scale - offsetX / scale);
        const robCanvasY = (robotLiveY !== null)
            ? robotLiveY / PIXEL_TO_METER
            : (graphCanvas.height / 2 / scale - offsetY / scale);

        const cellPx = occupancyGrid.RESOLUTION / PIXEL_TO_METER;
        const slamOriginX = robCanvasX - SlamEngine.pose.x / PIXEL_TO_METER;
        const slamOriginY = robCanvasY + SlamEngine.pose.y / PIXEL_TO_METER;

        const gx = slamOriginX - occupancyGrid.ORIGIN_COL * cellPx;
        const gy = slamOriginY - occupancyGrid.ORIGIN_ROW * cellPx;

        const col = Math.round((canvasX - gx) / cellPx);
        const row = Math.round((canvasY - gy) / cellPx);

        return { col, row, clientX, clientY };
    }

    if (graphCanvas) {
        graphCanvas.addEventListener('mouseenter', () => {
            if (brushCursor && slamTool !== 'select') brushCursor.style.display = 'block';
        });
        graphCanvas.addEventListener('mouseleave', () => {
            if (brushCursor) brushCursor.style.display = 'none';
        });

        graphCanvas.addEventListener('mousedown', (e) => {
            if (slamTool === 'select') return;
            const { col, row } = getGridCellFromEvent(e);
            if (slamShape === 'freehand') {
                slamDrawing = true;
                beginSlamStroke();
                paintAtGridCell(col, row);
            } else if (slamShape === 'line' || slamShape === 'rect' || slamTool === 'measure') {
                slamPreviewing = true;
                slamStartX = col;
                slamStartY = row;
                slamLastPreviewX = col;
                slamLastPreviewY = row;
                draw();
            }
        });

        graphCanvas.addEventListener('mousemove', (e) => {
            if (brushCursor) {
                brushCursor.style.left = e.clientX + 'px';
                brushCursor.style.top  = e.clientY + 'px';
                updateBrushCursorDisplay();
            }
            if (slamTool === 'select') return;
            const { col, row } = getGridCellFromEvent(e);
            if (slamDrawing && slamShape === 'freehand') {
                paintAtGridCell(col, row);
            } else if (slamPreviewing) {
                slamLastPreviewX = col;
                slamLastPreviewY = row;
                draw();
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (slamDrawing) {
                slamDrawing = false;
                finishSlamStroke();
            } else if (slamPreviewing) {
                slamPreviewing = false;
                const { col, row } = getGridCellFromEvent(e);
                if (slamTool === 'measure') {
                    setTimeout(() => { slamLastPreviewX = null; slamLastPreviewY = null; draw(); }, 5000);
                } else if (slamShape === 'line') {
                    beginSlamStroke();
                    drawThickLineGrid(slamStartX, slamStartY, col, row);
                    finishSlamStroke();
                } else if (slamShape === 'rect') {
                    beginSlamStroke();
                    if (slamFilledRect) drawFilledRectGrid(slamStartX, slamStartY, col, row);
                    else drawThickRectGrid(slamStartX, slamStartY, col, row);
                    finishSlamStroke();
                }
            }
        });
    }

    // Keyboard Shortcuts (Ctrl+Z, Ctrl+Y)
    window.addEventListener('keydown', (e) => {
        if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            undoSlam();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            redoSlam();
        } else if (e.shiftKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            redoSlam();
        }
    });

    // Reset SLAM Button from UI
    const slamBtn = document.getElementById('btnCaptureSlamMap');
    if (slamBtn) {
        const resetBtn = document.createElement('button');
        resetBtn.id        = 'btnResetSlam';
        resetBtn.className = slamBtn.className;
        resetBtn.textContent = '🔄 Reset SLAM';
        resetBtn.title     = 'Xoá bản đồ SLAM và vệt hành trình, bắt đầu lại từ đầu';
        resetBtn.addEventListener('click', () => {
            if (confirm('Reset toàn bộ bản đồ SLAM và vệt hành trình?')) {
                SlamEngine.reset();
            }
        });
        slamBtn.parentNode.insertBefore(resetBtn, slamBtn.nextSibling);
    }
});

// Log khởi tạo
console.log('[SLAM] Module SLAM Engine + ROS SLAM Map Editor Suite đã tải thành công.');
appendLidarLog('[SLAM] Hệ thống SLAM 2D + Bộ biên tập bản đồ ROS sẵn sàng.');




