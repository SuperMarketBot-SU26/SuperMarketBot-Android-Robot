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

// Live Robot State
let robotLiveX = null;
let robotLiveY = null;
let robotLiveStatus = 'OFFLINE';

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
            id: Date.now(),
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
                        id: Date.now(),
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
                id: Date.now(),
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
                id: Date.now(),
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

// Backend Sync Logic
const BASE_URL = 'https://interiorly-pinnatisect-adalyn.ngrok-free.dev';

document.getElementById('btnSaveMap').addEventListener('click', async () => {
    // Chuyển đổi dữ liệu từ Web Manager sang định dạng DTO của Backend
    // Vấn đề 1: ID trên Web đang dùng Date.now() quá lớn so với kiểu int32 của Backend. Phải map lại thành số từ 1, 2, 3...
    // Vấn đề 2: Tọa độ x, y phải nhân với PIXEL_TO_METER để ra số thực (mét).
    const idMap = new Map();
    let currentId = 1;
    
    const beNodes = nodes.map(n => {
        let newId = currentId++;
        idMap.set(n.id, newId);
        return {
            nodeId: newId,
            nodeName: n.name || `Node ${newId}`,
            xCoord: parseFloat(n.x * PIXEL_TO_METER) || 0.0,
            yCoord: parseFloat(n.y * PIXEL_TO_METER) || 0.0,
            nodeType: n.type || 'WAYPOINT',
            isBlocked: false
        };
    });

    let edgeIdCounter = 1;
    const rawBeEdges = edges.map(e => ({
        edgeId: edgeIdCounter++,
        fromNodeId: idMap.get(e.from) || 1,
        toNodeId: idMap.get(e.to) || 1,
        distance: parseFloat(e.distance) || 0.0,
        isBidirectional: true
    }));

    // Lọc cực gắt:
    // 1. Bỏ các cạnh nối chính nó (from === to) -> Gây ra lỗi Key (3, 3) khi add vào Dictionary 2 chiều ở C#
    // 2. Bỏ các cạnh trùng lặp (duplicate)
    const seenEdges = new Set();
    const beEdges = [];
    rawBeEdges.forEach(e => {
        if (e.fromNodeId === e.toNodeId) return; // Bỏ self-loop
        
        // Chuẩn hoá key để check duplicate (vd: 3-4 và 4-3 là 1)
        const key1 = `${e.fromNodeId}-${e.toNodeId}`;
        const key2 = `${e.toNodeId}-${e.fromNodeId}`;
        
        if (!seenEdges.has(key1) && !seenEdges.has(key2)) {
            seenEdges.add(key1);
            beEdges.push(e);
        }
    });

    let shapeIdCounter = 1;
    const beSemanticObjects = shapes.map(s => {
        const rX = parseFloat(s.x * PIXEL_TO_METER) || 0.0;
        const rY = parseFloat(s.y * PIXEL_TO_METER) || 0.0;
        const rW = parseFloat((s.w || (s.r * 2)) * PIXEL_TO_METER) || 0.1;
        const rH = parseFloat((s.h || (s.r * 2)) * PIXEL_TO_METER) || 0.1;
        return {
            objectId: shapeIdCounter++,
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
        edges: beEdges,
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

document.getElementById('btnSimulate').addEventListener('click', async () => {
    if (!navStartNodeId || !navEndNodeId) {
        return alert('Vui lòng thiết lập đủ Điểm Start và Điểm End trước khi gửi lệnh!');
    }
    
    // Check if the IDs are large Date.now() timestamps which will crash backend int32 parser
    if (navStartNodeId > 2147483647 || navEndNodeId > 2147483647) {
        return alert('⚠️ Dữ liệu chưa đồng bộ!\n\nCác Node trên web đang dùng ID tạm thời. Vui lòng bấm nút "Lưu lên Server" (nếu bạn mới vẽ thêm) và sau đó bấm "Tải từ Server" để cập nhật ID chuẩn (1, 2, 3...) trước khi chạy Navigate!');
    }
    
    const robotCode = document.getElementById('inpRobotCode').value.trim() || 'RB001';
    const btn = document.getElementById('btnSimulate');
    const oldHtml = btn.innerHTML;
    
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin mr-2"></i> Đang Gửi...';
    btn.disabled = true;

    try {
        const payload = {
            robotCode: robotCode,
            startNodeId: parseInt(navStartNodeId),
            endNodeId: parseInt(navEndNodeId)
        };
        
        console.log("Sending Navigate Request:", payload);

        // 1. Gửi lệnh điều khiển Robot (Trả về 200 OK)
        const resNavigate = await fetch(`${BASE_URL}/api/Navigation/navigate`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': '69420'
            },
            body: JSON.stringify(payload)
        });

        if (!resNavigate.ok) {
            const errText = await resNavigate.text();
            throw new Error(`Lỗi Gửi Navigate (${resNavigate.status}): ${errText}`);
        }

        // 2. Kéo lộ trình dự kiến về để hiển thị UI
        const resRoute = await fetch(`${BASE_URL}/api/Navigation/route`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': '69420'
            },
            body: JSON.stringify({
                startNodeId: parseInt(navStartNodeId),
                endNodeId: parseInt(navEndNodeId)
            })
        });

        btn.innerHTML = '<i data-lucide="check" class="w-4 h-4 mr-2"></i> Đã ra lệnh Robot!';
        btn.classList.replace('bg-blue-600', 'bg-emerald-600');
        // Cập nhật giao diện danh sách các Node sẽ đi qua
        const list = document.getElementById('routeList');
        if (resRoute.ok) {
            const routeData = await resRoute.json();
            console.log("Route Path Response:", routeData);
            
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
        } else {
            list.innerHTML = `<div class="text-sm text-emerald-400 font-medium">Lệnh chạy thành công! Nhưng không vẽ được list do không tìm thấy API /route.</div>`;
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
                document.getElementById('robotStatus').textContent = robotLiveStatus;
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

// --- SPEED CONTROL MQTT BRIDGE ---
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

// Slider elements and value displays
const spdSlider = document.getElementById('spdSlider');
const spdVal = document.getElementById('spdVal');
if (spdSlider && spdVal) {
    spdSlider.addEventListener('input', (e) => {
        spdVal.textContent = e.target.value + '%';
    });
    spdSlider.addEventListener('change', (e) => {
        sendMqttCommand('set_speed_manual', e.target.value);
    });
}

const strSlider = document.getElementById('strSlider');
const strVal = document.getElementById('strVal');
if (strSlider && strVal) {
    strSlider.addEventListener('input', (e) => {
        strVal.textContent = e.target.value + '%';
    });
    strSlider.addEventListener('change', (e) => {
        sendMqttCommand('set_strafe', e.target.value);
    });
}

const spdAutoSlider = document.getElementById('spdAutoSlider');
const spdAutoVal = document.getElementById('spdAutoVal');
if (spdAutoSlider && spdAutoVal) {
    spdAutoSlider.addEventListener('input', (e) => {
        spdAutoVal.textContent = e.target.value + '%';
    });
    spdAutoSlider.addEventListener('change', (e) => {
        sendMqttCommand('set_speed_auto', e.target.value);
    });
}

const spdSwerveSlider = document.getElementById('spdSwerveSlider');
const spdSwerveVal = document.getElementById('spdSwerveVal');
if (spdSwerveSlider && spdSwerveVal) {
    spdSwerveSlider.addEventListener('input', (e) => {
        spdSwerveVal.textContent = e.target.value + '%';
    });
    spdSwerveSlider.addEventListener('change', (e) => {
        sendMqttCommand('set_speed_swerve', e.target.value);
    });
}

// --- MOTOR TEST BUTTONS ---
function setupMotorTestButton(buttonId, slot) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    const startTest = (e) => {
        e.preventDefault();
        const testSpeed = document.getElementById('spdSlider')?.value || 60;
        sendMqttCommand('test_motor', `${slot}_${testSpeed}`);
    };

    const stopTest = (e) => {
        e.preventDefault();
        sendMqttCommand('test_motor', `${slot}_0`);
    };

    // Mouse events
    btn.addEventListener('mousedown', startTest);
    btn.addEventListener('mouseup', stopTest);
    btn.addEventListener('mouseleave', stopTest);

    // Touch events for mobile/tablet test
    btn.addEventListener('touchstart', startTest, { passive: false });
    btn.addEventListener('touchend', stopTest, { passive: false });
}

setupMotorTestButton('btnTestFL', 0); // Front-Left (slot 0)
setupMotorTestButton('btnTestRL', 1); // Rear-Left (slot 1)
setupMotorTestButton('btnTestFR', 2); // Front-Right (slot 2)
setupMotorTestButton('btnTestRR', 3); // Rear-Right (slot 3)


