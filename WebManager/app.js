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
        // Grid pattern if no map
        bgCtx.strokeStyle = '#334155';
        bgCtx.lineWidth = 1/scale;
        for(let i=0; i<graphCanvas.width*2; i+=50) {
            bgCtx.beginPath(); bgCtx.moveTo(i, -graphCanvas.height); bgCtx.lineTo(i, graphCanvas.height*2); bgCtx.stroke();
            bgCtx.beginPath(); bgCtx.moveTo(-graphCanvas.width, i); bgCtx.lineTo(graphCanvas.width*2, i); bgCtx.stroke();
        }
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
    }

    bgCtx.restore();
    ctx.restore();
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

    const data = {
        floorId: 1,
        mapName: "Bản đồ Web Manager",
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
                
                if (data.type === 'log') {
                    appendSerialLog(`[WS-Direct] ${data.message}`);
                } else if (data.msg) {
                    appendSerialLog(`[WS-Direct] ${data.msg}`);
                } else {
                    applyLiveTelemetry(data);
                }
            } catch (e) {
                appendSerialLog(`[WS-Direct] ${event.data}`);
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
wireSlider('yawScaleSlider', 'yawScaleVal', 'set_yaw_scale', 'yawScale');



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
        
        if (modeVal === 0) {
            modeStr = 'LÁI TAY';
            badgeClass += 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        } else if (modeVal === 1) {
            modeStr = 'TỰ HÀNH';
            badgeClass += 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        } else if (modeVal === 2) {
            modeStr = 'WAYPOINT';
            badgeClass += 'bg-blue-500/10 text-blue-400 border-blue-500/20';
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
        if (btnManual && btnAuto && btnWaypoint) {
            btnManual.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30";
            btnAuto.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30";
            btnWaypoint.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30";
            
            if (modeVal === 0) {
                btnManual.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-emerald-500 text-slate-950 font-extrabold shadow-[0_0_10px_rgba(16,185,129,0.3)]";
            } else if (modeVal === 1) {
                btnAuto.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-amber-500 text-slate-950 font-extrabold shadow-[0_0_10px_rgba(245,158,11,0.3)]";
            } else if (modeVal === 2) {
                btnWaypoint.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-blue-500 text-slate-950 font-extrabold shadow-[0_0_10px_rgba(59,130,246,0.3)]";
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
        
        if (isRobotWsConnected && robotWs && robotWs.readyState === WebSocket.OPEN) {
            try {
                robotWs.send(JSON.stringify({ t: 'layoutGet' }));
                robotWs.send(JSON.stringify({ t: 'motorLayoutGet' }));
                robotWs.send(JSON.stringify({ t: 'cfgGet' }));
            } catch (err) {
                console.error('[RobotWS] Failed to query layouts on modal open:', err);
            }
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

        if (newUrl) {
            BASE_URL = newUrl;
            localStorage.setItem('smb_backend_url', newUrl);
        }
        if (newIp) {
            ROBOT_IP = newIp;
            localStorage.setItem('smb_robot_ip', newIp);
            
            if (robotWs) {
                robotWs.close();
            } else {
                connectRobotWs();
            }
        }
        
        if (isRobotWsConnected && robotWs && robotWs.readyState === WebSocket.OPEN) {
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

    const { x, y, s } = getDriveValues();
    
    // Only send if values changed to avoid network flooding
    if (x === lastSentDrive.x && y === lastSentDrive.y && s === lastSentDrive.s) {
        return;
    }

    lastSentDrive = { x, y, s };
    try {
        robotWs.send(JSON.stringify({ t: 'joy', x: x, y: y, s: s }));
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
    const btnAuto = document.getElementById('btnModeAuto');
    const btnWaypoint = document.getElementById('btnModeWaypoint');
    if (btnManual && btnAuto && btnWaypoint) {
        btnManual.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30";
        btnAuto.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30";
        btnWaypoint.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30";
        
        if (modeVal === 0) {
            btnManual.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-slate-700 text-emerald-400 border border-emerald-500/30 animate-pulse";
        } else if (modeVal === 1) {
            btnAuto.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-slate-700 text-amber-400 border border-amber-500/30 animate-pulse";
        } else if (modeVal === 2) {
            btnWaypoint.className = "flex-1 py-1.5 text-[10px] font-bold rounded transition-all focus:outline-none uppercase bg-slate-700 text-blue-400 border border-blue-500/30 animate-pulse";
        }
    }
    
    sendRobotCommand('set_mode', 'mode', modeVal);
};

// Gắn sự kiện click cho các nút chế độ điều khiển
document.getElementById('btnModeManual')?.addEventListener('click', () => changeRobotMode(0));
document.getElementById('btnModeAuto')?.addEventListener('click', () => changeRobotMode(1));
document.getElementById('btnModeWaypoint')?.addEventListener('click', () => changeRobotMode(2));

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
        
        routeSelectedNodes = route.waypoints.map(wp => wp.nodeId);
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
    
    if (routeSelectedNodes.length === 0) {
        return alert('Vui lòng chọn ít nhất 1 nút trên bản đồ!');
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


