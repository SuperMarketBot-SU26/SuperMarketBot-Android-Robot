/**
 * Store2DMapCanvas.tsx
 *
 * Canvas bản đồ Siêu thị 2D (3.0m x 3.0m) vẽ bằng React Native SVG.
 * Tái hiện chuẩn xác 100% sơ đồ từ Web Staff/Admin (media_1789716323696.png):
 * - 6 Kệ hàng chính thức với ArUco tags (#1..#6), icon danh mục và mật độ hàng hóa.
 * - Quầy Thu Ngân (POS Checkout), Trạm Sạc (Dock Sạc ⚡), Cửa Vào (➔).
 * - Marker Robot AMR (RB0001) với nón sóng Radar định hướng và pin %.
 */

import React from 'react';
import { Platform } from 'react-native';
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import {
  CASHIER,
  DOCK,
  DOOR,
  SHELVES_6,
  StoreShelf,
} from './StoreLayoutConstants';

const SCALE = 1000;
const s = (v: number) => Math.round(v * SCALE);

export interface RobotPoseState {
  x: number;
  y: number;
  headingDeg: number;
  batteryPct?: number;
  statusText?: string;
  isOnline?: boolean;
}

interface Store2DMapCanvasProps {
  shelves?: StoreShelf[];
  robotPose?: RobotPoseState;
  selectedShelfId?: number | null;
  onShelfPress?: (shelf: StoreShelf) => void;
  onRobotPress?: () => void;
  width?: number | string;
  height?: number | string;
  showDimensions?: boolean;
}

export function Store2DMapCanvas({
  shelves,
  robotPose,
  selectedShelfId,
  onShelfPress,
  onRobotPress,
  width = '100%',
  height = '100%',
  showDimensions = true,
}: Store2DMapCanvasProps) {
  const gridLineColor = 'rgba(20, 83, 45, 0.08)';
  const gridMajorColor = 'rgba(20, 83, 45, 0.18)';
  const wallStroke = '#14532d';
  const dimColor = '#4a5a52';
  const canvasBg = '#ffffff';
  const floorTileBg = '#f8faf9';

  const vbX = showDimensions ? -450 : -100;
  const vbY = showDimensions ? -350 : -100;
  const vbW = showDimensions ? 3900 : 3200;
  const vbH = showDimensions ? 3800 : 3300;

  // Tọa độ Robot trên canvas SVG
  const rx = robotPose ? s(Math.max(0.15, Math.min(2.85, robotPose.x))) : s(DOCK.x);
  const ry = robotPose ? s(Math.max(0.15, Math.min(2.85, robotPose.y))) : s(DOCK.y);
  const heading = robotPose ? robotPose.headingDeg : 90;
  const batteryPct = robotPose?.batteryPct ?? 80;
  const rSize = 85;

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      style={{ flex: 1 }}
    >
      {/* ── 0. Nền Canvas ── */}
      <Rect x={vbX} y={vbY} width={vbW} height={vbH} fill={canvasBg} />

      {/* ── 1. Sàn Siêu Thị (0,0 đến 3000,3000) ── */}
      <Rect x={0} y={0} width={3000} height={3000} fill={floorTileBg} rx={40} />

      {/* ── 2. Lưới đo đạc (0.5m nét đứt, 1.0m nét liền) ── */}
      <G opacity={0.85}>
        {[0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0].map((v) => {
          const pos = s(v);
          const isMajor = v % 1 === 0;
          return (
            <G key={`grid-${v}`}>
              <Line
                x1={pos}
                y1={0}
                x2={pos}
                y2={3000}
                stroke={isMajor ? gridMajorColor : gridLineColor}
                strokeWidth={isMajor ? 12 : 6}
                strokeDasharray={isMajor ? undefined : '20, 20'}
              />
              <Line
                x1={0}
                y1={pos}
                x2={3000}
                y2={pos}
                stroke={isMajor ? gridMajorColor : gridLineColor}
                strokeWidth={isMajor ? 12 : 6}
                strokeDasharray={isMajor ? undefined : '20, 20'}
              />
            </G>
          );
        })}
      </G>

      {/* ── 3. Thước đo kích thước thực tế (3.0 m x 3.0 m) ── */}
      {showDimensions && (
        <G>
          {/* Thước ngang trên */}
          <Line x1={0} y1={-160} x2={3000} y2={-160} stroke={dimColor} strokeWidth={12} />
          <Line x1={0} y1={-220} x2={0} y2={-100} stroke={dimColor} strokeWidth={15} />
          <Line x1={3000} y1={-220} x2={3000} y2={-100} stroke={dimColor} strokeWidth={15} />
          <SvgText x={1500} y={-210} fill={dimColor} fontSize={95} fontWeight="800" textAnchor="middle">
            3.0 m (Lối vào & Dãy kệ)
          </SvgText>

          {/* Thước dọc trái */}
          <Line x1={-160} y1={0} x2={-160} y2={3000} stroke={dimColor} strokeWidth={12} />
          <Line x1={-220} y1={0} x2={-100} y2={0} stroke={dimColor} strokeWidth={15} />
          <Line x1={-220} y1={3000} x2={-100} y2={3000} stroke={dimColor} strokeWidth={15} />
          <SvgText
            x={-240}
            y={1500}
            fill={dimColor}
            fontSize={95}
            fontWeight="800"
            textAnchor="middle"
            transform="rotate(-90, -240, 1500)"
          >
            3.0 m
          </SvgText>
        </G>
      )}

      {/* ── 4. Tường ranh giới & Cửa vào siêu thị ── */}
      <G>
        <Line x1={0} y1={0} x2={3000} y2={0} stroke={wallStroke} strokeWidth={38} strokeLinecap="round" />
        <Line x1={3000} y1={0} x2={3000} y2={3000} stroke={wallStroke} strokeWidth={38} strokeLinecap="round" />
        <Line x1={0} y1={3000} x2={3000} y2={3000} stroke={wallStroke} strokeWidth={38} strokeLinecap="round" />

        {/* Tường bên trái mở lối cho Cửa vào hành lang */}
        <Line x1={0} y1={0} x2={0} y2={1500} stroke={wallStroke} strokeWidth={38} />
        <Line x1={0} y1={2100} x2={0} y2={3000} stroke={wallStroke} strokeWidth={38} />

        {/* Mũi tên & Nhãn Cửa Vào */}
        <Line x1={-60} y1={1800} x2={180} y2={1800} stroke="#16a34a" strokeWidth={20} strokeLinecap="round" />
        <SvgText x={-90} y={1825} fill="#15803d" fontSize={70} fontWeight="800" textAnchor="end">
          ➔ CỬA VÀO
        </SvgText>
      </G>

      {/* ── 5. Quầy Thu Ngân (POS Checkout - Góc dưới trái) ── */}
      <G>
        <Rect
          x={s(CASHIER.x)}
          y={s(CASHIER.y)}
          width={s(CASHIER.width)}
          height={s(CASHIER.height)}
          fill={CASHIER.fill}
          stroke={CASHIER.stroke}
          strokeWidth={22}
          rx={25}
        />
        <Circle
          cx={s(CASHIER.x + CASHIER.width / 2)}
          cy={s(CASHIER.y + CASHIER.height / 2) - 80}
          r={78}
          fill="#ffffff"
          stroke={CASHIER.stroke}
          strokeWidth={8}
        />
        <SvgText
          x={s(CASHIER.x + CASHIER.width / 2)}
          y={s(CASHIER.y + CASHIER.height / 2) - 52}
          fontSize={72}
          textAnchor="middle"
        >
          {CASHIER.icon}
        </SvgText>
        <SvgText
          x={s(CASHIER.x + CASHIER.width / 2)}
          y={s(CASHIER.y + CASHIER.height / 2) + 55}
          fill="#1e293b"
          fontSize={54}
          fontWeight="900"
          textAnchor="middle"
        >
          {CASHIER.label}
        </SvgText>
        <SvgText
          x={s(CASHIER.x + CASHIER.width / 2)}
          y={s(CASHIER.y + CASHIER.height / 2) + 115}
          fill="#64748b"
          fontSize={40}
          fontWeight="700"
          textAnchor="middle"
        >
          {CASHIER.subLabel}
        </SvgText>
      </G>

      {/* ── 6. Trạm Sạc Robot (Dock Sạc ⚡ - Trên Quầy Thu Ngân) ── */}
      <G>
        <Circle cx={s(DOCK.x)} cy={s(DOCK.y)} r={s(DOCK.outerRadius)} fill={canvasBg} stroke="#16a34a" strokeWidth={14} />
        <Circle cx={s(DOCK.x)} cy={s(DOCK.y)} r={s(DOCK.innerRadius) + 20} fill="#16a34a" />
        <SvgText
          x={s(DOCK.x)}
          y={s(DOCK.y) + 24}
          fontSize={54}
          textAnchor="middle"
        >
          {DOCK.icon}
        </SvgText>
        <SvgText x={s(DOCK.x)} y={s(DOCK.y) - 125} fill="#15803d" fontSize={52} fontWeight="800" textAnchor="middle">
          DOCK SẠC
        </SvgText>
      </G>

      {/* ── 7. KỆ HÀNG SIÊU THỊ (Đồng bộ động từ Web Admin) ── */}
      {(shelves && shelves.length > 0 ? shelves : SHELVES_6).map((shelf) => {
        const shX = s(shelf.x);
        const shY = s(shelf.y);
        const shW = s(shelf.width);
        const shH = s(shelf.height);
        const cX = shX + shW / 2;
        const cY = shY + shH / 2;
        const isHoriz = shelf.width > shelf.height;
        const isSelected = selectedShelfId === shelf.shelfId;

        const handlePress = () => {
          onShelfPress?.(shelf);
        };

        return (
          <G
            key={`shelf-${shelf.shelfId}`}
            {...(Platform.OS === 'web'
              ? ({ onClick: handlePress, style: { cursor: 'pointer' } } as any)
              : ({ onPress: handlePress } as any))}
          >
            {/* Halo khi được chọn (Active Selection Highlight) */}
            {isSelected && (
              <Rect
                x={shX - 35}
                y={shY - 35}
                width={shW + 70}
                height={shH + 70}
                rx={45}
                fill="none"
                stroke="#00A550"
                strokeWidth={18}
                strokeDasharray="30, 20"
                opacity={0.95}
              />
            )}

            {/* Khung thân kệ */}
            <Rect
              x={shX}
              y={shY}
              width={shW}
              height={shH}
              fill={shelf.themeBg}
              stroke={isSelected ? '#00A550' : shelf.themeColor}
              strokeWidth={isSelected ? 26 : 22}
              rx={25}
            />

            {isHoriz ? (
              /* ── Kệ ngang (Kệ 2, Kệ 3) ── */
              <G>
                {/* Icon tròn bên trái */}
                <Circle
                  cx={shX + 175}
                  cy={cY}
                  r={110}
                  fill="#ffffff"
                  stroke={shelf.themeColor}
                  strokeWidth={10}
                />
                <SvgText
                  x={shX + 175}
                  y={cY + 36}
                  fontSize={96}
                  textAnchor="middle"
                >
                  {shelf.icon}
                </SvgText>

                {/* Thông tin bên phải */}
                {/* Header Pill: KỆ X · Tag #Y */}
                <Rect
                  x={shX + 370}
                  y={cY - 130}
                  width={320}
                  height={74}
                  rx={20}
                  fill={shelf.themeColor}
                />
                <SvgText
                  x={shX + 530}
                  y={cY - 78}
                  fill="#ffffff"
                  fontSize={48}
                  fontWeight="900"
                  textAnchor="middle"
                >
                  {`KỆ ${shelf.shelfId} · #${shelf.arucoTag}`}
                </SvgText>

                {/* Tên danh mục */}
                <SvgText
                  x={shX + 530}
                  y={cY - 8}
                  fill="#0f172a"
                  fontSize={48}
                  fontWeight="800"
                  textAnchor="middle"
                >
                  {shelf.category}
                </SvgText>

                {/* Badge tỷ lệ hàng: ✓ 100% */}
                <Rect
                  x={shX + 420}
                  y={cY + 45}
                  width={220}
                  height={68}
                  rx={18}
                  fill="rgba(22, 163, 74, 0.18)"
                  stroke="#16a34a"
                  strokeWidth={6}
                />
                <SvgText
                  x={shX + 530}
                  y={cY + 95}
                  fill="#16a34a"
                  fontSize={44}
                  fontWeight="900"
                  textAnchor="middle"
                >
                  ✓ 100%
                </SvgText>
              </G>
            ) : (
              /* ── Kệ dọc (Kệ 1, Kệ 4, Kệ 5, Kệ 6) ── */
              <G>
                {/* Header Pill: KỆ X */}
                <Rect
                  x={cX - 120}
                  y={cY - 325}
                  width={240}
                  height={76}
                  rx={22}
                  fill={shelf.themeColor}
                />
                <SvgText
                  x={cX}
                  y={cY - 272}
                  fill="#ffffff"
                  fontSize={50}
                  fontWeight="900"
                  textAnchor="middle"
                >
                  {`KỆ ${shelf.shelfId}`}
                </SvgText>

                {/* Icon ở giữa */}
                <Circle
                  cx={cX}
                  cy={cY - 145}
                  r={95}
                  fill="#ffffff"
                  stroke={shelf.themeColor}
                  strokeWidth={10}
                />
                <SvgText
                  x={cX}
                  y={cY - 112}
                  fontSize={88}
                  textAnchor="middle"
                >
                  {shelf.icon}
                </SvgText>

                {/* Tên danh mục */}
                <SvgText
                  x={cX}
                  y={cY + 30}
                  fill="#0f172a"
                  fontSize={48}
                  fontWeight="800"
                  textAnchor="middle"
                >
                  {shelf.category}
                </SvgText>

                {/* Dãy & Tag */}
                <SvgText
                  x={cX}
                  y={cY + 95}
                  fill="#64748b"
                  fontSize={38}
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {`Dãy ${shelf.aisleCode} · #${shelf.arucoTag}`}
                </SvgText>

                {/* Badge hàng đầy */}
                <Rect
                  x={cX - 110}
                  y={cY + 160}
                  width={220}
                  height={72}
                  rx={18}
                  fill="rgba(22, 163, 74, 0.18)"
                  stroke="#16a34a"
                  strokeWidth={6}
                />
                <SvgText
                  x={cX}
                  y={cY + 212}
                  fill="#16a34a"
                  fontSize={44}
                  fontWeight="900"
                  textAnchor="middle"
                >
                  ✓ 100%
                </SvgText>
              </G>
            )}
          </G>
        );
      })}

      {/* ── 8. ROBOT AMR TELEMETRY MARKER (RB0001) ── */}
      <G
        {...(Platform.OS === 'web'
          ? ({ onClick: onRobotPress, style: { cursor: 'pointer' } } as any)
          : ({ onPress: onRobotPress } as any))}
      >
        {/* Nón sóng Radar quét định hướng theo góc heading */}
        <G transform={`translate(${rx}, ${ry}) rotate(${heading})`}>
          <Path
            d="M 0,0 L -220,-380 A 440,440 0 0,1 220,-380 Z"
            fill="rgba(16, 185, 129, 0.22)"
            stroke="#10b981"
            strokeWidth={8}
            strokeDasharray="20, 20"
          />
        </G>

        {/* Vòng phát xung halo */}
        <Circle
          cx={rx}
          cy={ry}
          r={rSize + 40}
          fill="rgba(16, 185, 129, 0.25)"
        />

        {/* Thân robot puck kim loại tối màu viền xanh neon */}
        <Circle
          cx={rx}
          cy={ry}
          r={rSize}
          fill="#0f172a"
          stroke="#10b981"
          strokeWidth={16}
        />

        {/* Mũi tên chỉ hướng di chuyển */}
        <G transform={`translate(${rx}, ${ry}) rotate(${heading})`}>
          <Path
            d="M 0,-65 L 38,35 L -38,35 Z"
            fill="#10b981"
          />
        </G>

        {/* Đèn LED trung tâm robot */}
        <Circle cx={rx} cy={ry} r={15} fill="#ffffff" />

        {/* Tên & % Pin hiển thị dưới robot */}
        <G transform={`translate(${rx}, ${ry + rSize + 70})`}>
          <Rect
            x={-160}
            y={-35}
            width={320}
            height={68}
            rx={20}
            fill="rgba(15, 23, 42, 0.88)"
            stroke="#10b981"
            strokeWidth={4}
          />
          <SvgText
            x={0}
            y={12}
            fill="#ffffff"
            fontSize={40}
            fontWeight="900"
            textAnchor="middle"
          >
            {`RB0001 · ${batteryPct}%`}
          </SvgText>
        </G>
      </G>
    </Svg>
  );
}
