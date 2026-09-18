/**
 * StoreLayoutConstants.ts
 *
 * Tọa độ và thông số chuẩn hóa của Siêu thị 2D (3.0m x 3.0m)
 * Khớp 100% với sơ đồ Web Staff/Admin (media_1789716323696.png).
 *
 * Hệ tọa độ SVG: 0 -> 3000 (SCALE = 1000)
 * - Trục X: 0 -> 3.0m (trái -> phải)
 * - Trục Y: 0 -> 3.0m (trên -> dưới)
 */

export interface StoreShelf {
  shelfId: number;
  arucoTag: number;
  aisleCode: string;
  name: string;
  category: string;
  icon: string;
  x: number;
  y: number;
  width: number;
  height: number;
  themeColor: string;
  themeBg: string;
  sampleProducts: string[];
}

export const SHELVES_6: StoreShelf[] = [
  // ── DÃY A01: Bánh Kẹo & Nước Giải Khát (Xanh dương / Indigo) ──
  {
    shelfId: 1,
    arucoTag: 1,
    aisleCode: 'A01',
    name: 'Kệ 1 - Đồ Ăn Vặt & Bánh Kẹo',
    category: 'Bánh Kẹo',
    icon: '🍪',
    x: 0.08,
    y: 0.85,
    width: 0.38,
    height: 0.85,
    themeColor: '#2563eb',
    themeBg: 'rgba(37, 99, 235, 0.12)',
    sampleProducts: ['Bánh quy Oishi', 'Snack Lay\'s khoai tây', 'Bánh Chocopie', 'Kẹo dẻo Haribo', 'Bánh que Pocky'],
  },
  {
    shelfId: 2,
    arucoTag: 2,
    aisleCode: 'A01',
    name: 'Kệ 2 - Nước Giải Khát & Đồ Uống',
    category: 'Giải Khát',
    icon: '🥤',
    x: 0.45,
    y: 0.08,
    width: 0.85,
    height: 0.38,
    themeColor: '#2563eb',
    themeBg: 'rgba(37, 99, 235, 0.12)',
    sampleProducts: ['Coca-Cola lon', 'Pepsi không calo', 'Trà xanh C2 chanh', 'Nước ép cam Teppy', 'Nước suối Aquafina'],
  },

  // ── DÃY B01: Thực Phẩm Tươi Sống & Mì Ăn Liền (Xanh lá / Emerald) ──
  {
    shelfId: 3,
    arucoTag: 3,
    aisleCode: 'B01',
    name: 'Kệ 3 - Thực Phẩm Tươi Sống',
    category: 'Tươi Sống',
    icon: '🥩',
    x: 1.70,
    y: 0.08,
    width: 0.85,
    height: 0.38,
    themeColor: '#16a34a',
    themeBg: 'rgba(22, 163, 74, 0.12)',
    sampleProducts: ['Thịt heo ba chỉ rút sườn', 'Thịt bò Úc phi lê', 'Trứng gà Ba Huân', 'Cá hồi Na Uy', 'Rau xà lách hữu cơ'],
  },
  {
    shelfId: 4,
    arucoTag: 4,
    aisleCode: 'B01',
    name: 'Kệ 4 - Mì Ăn Liền & Đóng Gói',
    category: 'Mì & Khô',
    icon: '🍜',
    x: 2.54,
    y: 0.85,
    width: 0.38,
    height: 0.85,
    themeColor: '#16a34a',
    themeBg: 'rgba(22, 163, 74, 0.12)',
    sampleProducts: ['Mì Hảo Hảo tôm chua cay', 'Mì Kokomi tôm cay', 'Phở bò Đệ Nhất', 'Miến Phú Hương', 'Bún bò Huế khô'],
  },

  // ── DÃY C01: Đồ Gia Dụng & Gia Vị (Cam ấm / Amber) ──
  {
    shelfId: 5,
    arucoTag: 5,
    aisleCode: 'C01',
    name: 'Kệ 5 - Đồ Gia Dụng & Tiện Ích',
    category: 'Gia Dụng',
    icon: '🧴',
    x: 2.47,
    y: 1.90,
    width: 0.45,
    height: 0.95,
    themeColor: '#d97706',
    themeBg: 'rgba(217, 119, 6, 0.12)',
    sampleProducts: ['Nước rửa chén Sunlight chanh', 'Nước giặt OMO Matic', 'Dầu gội Sunsilk óng mượt', 'Khăn giấy Paseo'],
  },
  {
    shelfId: 6,
    arucoTag: 6,
    aisleCode: 'C01',
    name: 'Kệ 6 - Gia Vị & Trà',
    category: 'Gia Vị',
    icon: '🧂',
    x: 1.35,
    y: 1.95,
    width: 0.38,
    height: 0.95,
    themeColor: '#d97706',
    themeBg: 'rgba(217, 119, 6, 0.12)',
    sampleProducts: ['Nước mắm Nam Ngư Đệ Nhị', 'Dầu ăn Simply hạt cải', 'Hạt nêm Knorr thịt thăn', 'Muối i-ốt Bạc Liêu', 'Trà Lipton túi lọc'],
  },
];

/* ─── Cashier desk ("Thu Ngân" - Góc dưới trái) ─── */
export const CASHIER = {
  id: 'cashier-counter',
  label: 'THU NGÂN',
  subLabel: 'POS CHECKOUT',
  icon: '💳',
  x: 0.08,
  y: 2.30,
  width: 0.60,
  height: 0.58,
  fill: 'rgba(100, 116, 139, 0.12)',
  stroke: '#475569',
};

/* ─── Door (Cửa vào - Cạnh dưới giữa Thu Ngân & Kệ 6) ─── */
export const DOOR = {
  x: 0.80,
  y: 3.0,
  width: 0.45,
  label: 'CỬA VÀO ➔',
};

/* ─── Dock / Trạm sạc Robot (sát phía trên quầy thu ngân) ─── */
export const DOCK = {
  x: 0.27,
  y: 2.09,
  outerRadius: 0.09,
  innerRadius: 0.045,
  label: 'DOCK SẠC',
  icon: '⚡',
};

/* ─── 8 Official Supermarket Nodes (Khớp database dbo.NAVIGATION_NODE) ─── */
export interface SupermarketNode {
  nodeId: number;
  name: string;
  shelfId?: number;
  role: string;
  rosX: number;
  rosY: number;
  mapX: number;
  mapY: number;
  headingDeg: number;
}

export const SUPERMARKET_NODES: Record<number, SupermarketNode> = {
  1: { nodeId: 1, name: 'Kệ 1 - Bánh kẹo & Snack', shelfId: 1, role: 'shelf', rosX: 1.5741, rosY: 0.0809, mapX: 0.27, mapY: 1.28, headingDeg: 90 },
  2: { nodeId: 2, name: 'Kệ 2 - Nước giải khát', shelfId: 2, role: 'shelf', rosX: 2.1035, rosY: -0.2687, mapX: 0.88, mapY: 0.27, headingDeg: 180 },
  3: { nodeId: 3, name: 'Kệ 3 - Thực phẩm tươi sống', shelfId: 3, role: 'shelf', rosX: 1.8738, rosY: -1.5971, mapX: 2.13, mapY: 0.27, headingDeg: 180 },
  4: { nodeId: 4, name: 'Kệ 4 - Mì ăn liền & Đóng gói', shelfId: 4, role: 'shelf', rosX: 1.3943, rosY: -1.7470, mapX: 2.73, mapY: 1.28, headingDeg: 270 },
  5: { nodeId: 5, name: 'Kệ 5 - Đồ gia dụng & Tiện ích', shelfId: 5, role: 'shelf', rosX: 0.0558, rosY: -1.5472, mapX: 2.70, mapY: 2.38, headingDeg: 270 },
  6: { nodeId: 6, name: 'Kệ 6 - Gia vị & Trà', shelfId: 6, role: 'shelf', rosX: 0.0858, rosY: -1.1976, mapX: 1.54, mapY: 2.43, headingDeg: 90 },
  7: { nodeId: 7, name: 'Quầy Thu Ngân (TN)', role: 'cashier', rosX: 0.2257, rosY: 0.0809, mapX: 0.38, mapY: 2.59, headingDeg: 0 },
  8: { nodeId: 8, name: 'Trạm Sạc Robot (Dock)', role: 'dock', rosX: 0.8949, rosY: 0.4006, mapX: 0.27, mapY: 2.09, headingDeg: 90 },
};

/**
 * Phân tích và trích xuất tọa độ hiển thị trên Map SVG từ Telemetry / Navigation status
 */
export function resolveRobotPosition(payload: any, prev?: { x: number; y: number; headingDeg: number; nodeName: string }): {
  x: number;
  y: number;
  headingDeg: number;
  nodeName: string;
} {
  if (!payload || typeof payload !== 'object') {
    if (prev && Number.isFinite(prev.x) && Number.isFinite(prev.y)) {
      return prev;
    }
    const def = SUPERMARKET_NODES[8];
    return { x: def.mapX, y: def.mapY, headingDeg: def.headingDeg, nodeName: def.name };
  }

  // 1. Kiểm tra explicit nodeId
  const rawNodeId = payload.nodeId ?? payload.NodeId ?? payload.currentNodeId ?? payload.CurrentNodeId ?? payload.shelfId ?? payload.ShelfId;
  const nid = Number(rawNodeId);
  if (Number.isFinite(nid) && nid > 0 && SUPERMARKET_NODES[nid]) {
    const node = SUPERMARKET_NODES[nid];
    return { x: node.mapX, y: node.mapY, headingDeg: node.headingDeg, nodeName: node.name };
  }

  // 2. Kiểm tra tọa độ trực tiếp trên Map SVG (0.1m -> 2.9m)
  const valX = payload.x ?? payload.X ?? payload.xCoord ?? payload.XCoord;
  const valY = payload.y ?? payload.Y ?? payload.yCoord ?? payload.YCoord;
  const numX = typeof valX === 'number' ? valX : typeof valX === 'string' && valX !== '' ? Number(valX) : null;
  const numY = typeof valY === 'number' ? valY : typeof valY === 'string' && valY !== '' ? Number(valY) : null;

  if (numX !== null && numY !== null && Number.isFinite(numX) && Number.isFinite(numY)) {
    // So khớp Euclid với tọa độ ROS (nếu là tọa độ ROS âm hoặc lớn hơn 3m)
    let nearestNode: SupermarketNode | null = null;
    let minDistance = Infinity;
    for (const n of Object.values(SUPERMARKET_NODES)) {
      const d = Math.hypot(numX - n.rosX, numY - n.rosY);
      if (d < minDistance) {
        minDistance = d;
        nearestNode = n;
      }
    }
    if (nearestNode && minDistance <= 1.5) {
      return { x: nearestNode.mapX, y: nearestNode.mapY, headingDeg: nearestNode.headingDeg, nodeName: nearestNode.name };
    }

    if (numX >= 0.1 && numX <= 2.9 && numY >= 0.1 && numY <= 2.9) {
      return {
        x: numX,
        y: numY,
        headingDeg: Number(payload.headingDeg ?? payload.HeadingDeg ?? prev?.headingDeg ?? 90),
        nodeName: nearestNode ? `Gần ${nearestNode.name}` : `Tọa độ (${numX.toFixed(1)}m, ${numY.toFixed(1)}m)`,
      };
    }
  }

  // 3. Giữ nguyên vị trí cũ nếu đã có
  if (prev && Number.isFinite(prev.x) && Number.isFinite(prev.y)) {
    return prev;
  }

  // 4. Mặc định trạm sạc Dock Sạc (Node 8)
  const def = SUPERMARKET_NODES[8];
  return { x: def.mapX, y: def.mapY, headingDeg: def.headingDeg, nodeName: def.name };
}
