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
  // ── DÃY A01: Bánh Kẹo & Nước Giải Khát (Hàng trên, cạnh Dock sạc) ──
  {
    shelfId: 1,
    arucoTag: 1,
    aisleCode: 'A01',
    name: 'Kệ 1 - Đồ Ăn Vặt & Bánh Kẹo',
    category: 'Bánh Kẹo',
    icon: '🍪',
    x: 1.50,
    y: 0.15,
    width: 0.65,
    height: 0.36,
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
    x: 2.25,
    y: 0.15,
    width: 0.65,
    height: 0.36,
    themeColor: '#2563eb',
    themeBg: 'rgba(37, 99, 235, 0.12)',
    sampleProducts: ['Coca-Cola lon', 'Pepsi không calo', 'Trà xanh C2 chanh', 'Nước ép cam Teppy', 'Nước suối Aquafina'],
  },

  // ── DÃY B01: Thực Phẩm Tươi Sống & Mì Ăn Liền (Tường phải & Tường đáy) ──
  {
    shelfId: 3,
    arucoTag: 3,
    aisleCode: 'B01',
    name: 'Kệ 3 - Thực Phẩm Tươi Sống',
    category: 'Tươi Sống',
    icon: '🥩',
    x: 2.55,
    y: 1.10,
    width: 0.36,
    height: 0.85,
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
    x: 1.45,
    y: 2.48,
    width: 0.85,
    height: 0.36,
    themeColor: '#16a34a',
    themeBg: 'rgba(22, 163, 74, 0.12)',
    sampleProducts: ['Mì Hảo Hảo tôm chua cay', 'Mì Kokomi tôm cay', 'Phở bò Đệ Nhất', 'Miến Phú Hương', 'Bún bò Huế khô'],
  },

  // ── DÃY C01: Đồ Gia Dụng & Gia Vị (Tường đáy trái & Vách giữa) ──
  {
    shelfId: 5,
    arucoTag: 5,
    aisleCode: 'C01',
    name: 'Kệ 5 - Đồ Gia Dụng & Tiện Ích',
    category: 'Gia Dụng',
    icon: '🧴',
    x: 0.35,
    y: 2.48,
    width: 0.85,
    height: 0.36,
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
    x: 0.60,
    y: 1.10,
    width: 0.85,
    height: 0.36,
    themeColor: '#d97706',
    themeBg: 'rgba(217, 119, 6, 0.12)',
    sampleProducts: ['Nước mắm Nam Ngư Đệ Nhị', 'Dầu ăn Simply hạt cải', 'Hạt nêm Knorr thịt thăn', 'Muối i-ốt Bạc Liêu', 'Trà Lipton túi lọc'],
  },
];

/* ─── Cashier desk ("Thu Ngân" - Góc trên bên trái) ─── */
export const CASHIER = {
  id: 'cashier-counter',
  label: 'THU NGÂN',
  subLabel: 'POS CHECKOUT',
  icon: '💳',
  x: 0.08,
  y: 0.12,
  width: 0.55,
  height: 0.50,
  fill: 'rgba(100, 116, 139, 0.12)',
  stroke: '#475569',
};

/* ─── Door (Cửa vào - Cạnh bên trái bên dưới Thu Ngân) ─── */
export const DOOR = {
  x: 0.0,
  y: 0.67,
  width: 0.18,
  height: 0.49,
  label: 'CỬA VÀO ➔',
};

/* ─── Dock / Trạm sạc Robot (Cạnh trên giữa Thu Ngân & Kệ 1) ─── */
export const DOCK = {
  x: 1.07,
  y: 0.22,
  outerRadius: 0.14,
  innerRadius: 0.07,
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
  1: { nodeId: 1, name: 'Kệ 1 - Bánh kẹo & Snack', shelfId: 1, role: 'shelf', rosX: 1.8653, rosY: 0.0230, mapX: 1.87, mapY: 0.48, headingDeg: 0 },
  2: { nodeId: 2, name: 'Kệ 2 - Nước giải khát', shelfId: 2, role: 'shelf', rosX: 2.4465, rosY: -0.1091, mapX: 2.45, mapY: 0.61, headingDeg: 0 },
  3: { nodeId: 3, name: 'Kệ 3 - Thực phẩm tươi sống', shelfId: 3, role: 'shelf', rosX: 2.3056, rosY: -1.2232, mapX: 2.31, mapY: 1.72, headingDeg: 270 },
  4: { nodeId: 4, name: 'Kệ 4 - Mì ăn liền & Đóng gói', shelfId: 4, role: 'shelf', rosX: 1.5600, rosY: -1.7933, mapX: 1.56, mapY: 2.29, headingDeg: 270 },
  5: { nodeId: 5, name: 'Kệ 5 - Đồ gia dụng & Tiện ích', shelfId: 5, role: 'shelf', rosX: 0.4254, rosY: -1.7383, mapX: 0.43, mapY: 2.24, headingDeg: 270 },
  6: { nodeId: 6, name: 'Kệ 6 - Gia vị & Trà', shelfId: 6, role: 'shelf', rosX: 0.6543, rosY: -0.9325, mapX: 0.65, mapY: 1.43, headingDeg: 0 },
  7: { nodeId: 7, name: 'Vị Trí Của Robot (Dock)', role: 'dock', rosX: 0.2787, rosY: -0.0549, mapX: 1.07, mapY: 0.22, headingDeg: 0 },
  8: { nodeId: 8, name: 'Quầy Thu Ngân (POS)', role: 'cashier', rosX: 1.0402, rosY: 0.3161, mapX: 0.23, mapY: 0.42, headingDeg: 0 },
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
    const def = SUPERMARKET_NODES[7];
    return { x: def.mapX, y: def.mapY, headingDeg: def.headingDeg, nodeName: def.name };
  }

  // 1. Kiểm tra explicit nodeId
  const rawNodeId = payload.nodeId ?? payload.NodeId ?? payload.currentNodeId ?? payload.CurrentNodeId ?? payload.shelfId ?? payload.ShelfId;
  const nid = Number(rawNodeId);
  if (Number.isFinite(nid) && nid > 0 && SUPERMARKET_NODES[nid]) {
    const node = SUPERMARKET_NODES[nid];
    return { x: node.mapX, y: node.mapY, headingDeg: node.headingDeg, nodeName: node.name };
  }

  // 2. Kiểm tra tọa độ trực tiếp
  const valX = payload.x ?? payload.X ?? payload.xCoord ?? payload.XCoord;
  const valY = payload.y ?? payload.Y ?? payload.yCoord ?? payload.YCoord;
  const numX = typeof valX === 'number' ? valX : typeof valX === 'string' && valX !== '' ? Number(valX) : null;
  const numY = typeof valY === 'number' ? valY : typeof valY === 'string' && valY !== '' ? Number(valY) : null;

  if (numX !== null && numY !== null && Number.isFinite(numX) && Number.isFinite(numY)) {
    // Chuyển đổi tọa độ ROS sang hệ Canvas 3m x 3m (mapX = x, mapY = 0.50 - y)
    let canvasX = numX;
    let canvasY = numY;
    if (numY <= 0.5 && numY >= -2.5) {
      canvasX = Math.max(0.1, Math.min(2.9, numX));
      canvasY = Math.max(0.1, Math.min(2.9, 0.50 - numY));
    }

    let nearestNode: SupermarketNode | null = null;
    let minDistance = Infinity;
    for (const n of Object.values(SUPERMARKET_NODES)) {
      const d = Math.hypot(canvasX - n.mapX, canvasY - n.mapY);
      if (d < minDistance) {
        minDistance = d;
        nearestNode = n;
      }
    }

    return {
      x: canvasX,
      y: canvasY,
      headingDeg: Number(payload.headingDeg ?? payload.HeadingDeg ?? prev?.headingDeg ?? 0),
      nodeName: nearestNode ? `Gần ${nearestNode.name}` : `Tọa độ (${canvasX.toFixed(1)}m, ${canvasY.toFixed(1)}m)`,
    };
  }

  // 3. Giữ nguyên vị trí cũ nếu đã có
  if (prev && Number.isFinite(prev.x) && Number.isFinite(prev.y)) {
    return prev;
  }

  // 4. Mặc định Vị Trí Của Robot / Dock Sạc (Node 7)
  const def = SUPERMARKET_NODES[7];
  return { x: def.mapX, y: def.mapY, headingDeg: def.headingDeg, nodeName: def.name };
}
