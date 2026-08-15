import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { GuideDestination, GuideRobotPose } from '../../context/RobotGuideContext';

const STORE_SIZE = 9;
const MAP_PAD = 22;

// Khung tọa độ của 4 waypoint đã đo trên active SLAM map.
// Có thể hiệu chỉnh khi thay map mà không phải sửa component.
const SLAM_MIN_X = Number(process.env.EXPO_PUBLIC_GUIDE_MAP_MIN_X ?? 0.3760);
const SLAM_MAX_X = Number(process.env.EXPO_PUBLIC_GUIDE_MAP_MAX_X ?? 1.9081);
const SLAM_MIN_Y = Number(process.env.EXPO_PUBLIC_GUIDE_MAP_MIN_Y ?? -0.3111);
const SLAM_MAX_Y = Number(process.env.EXPO_PUBLIC_GUIDE_MAP_MAX_Y ?? 1.4755);

const SHELVES = [
  { id: 'kv3-h', label: 'KV3', x: 1.2, y: 0.5, w: 2, h: 0.65, fill: '#FEF3C7', stroke: '#F59E0B', text: '#92400E' },
  { id: 'kv3-v', label: 'KV3', x: 0.5, y: 1.4, w: 0.65, h: 1.7, fill: '#FEF3C7', stroke: '#F59E0B', text: '#92400E' },
  { id: 'kv2-h', label: 'KV2', x: 5.7, y: 0.5, w: 2, h: 0.65, fill: '#DBEAFE', stroke: '#3B82F6', text: '#1E3A8A' },
  { id: 'kv2-v', label: 'KV2', x: 7.85, y: 1.4, w: 0.65, h: 1.7, fill: '#DBEAFE', stroke: '#3B82F6', text: '#1E3A8A' },
  { id: 'kv4-a', label: 'KV4', x: 0.5, y: 6.8, w: 0.7, h: 1.6, fill: '#EDE9FE', stroke: '#8B5CF6', text: '#4C1D95' },
  { id: 'kv4-b', label: 'KV4', x: 2.4, y: 6.8, w: 0.7, h: 1.6, fill: '#EDE9FE', stroke: '#8B5CF6', text: '#4C1D95' },
];

interface Point { x: number; y: number }

interface CartGuideMapProps {
  destinations: GuideDestination[];
  currentWaypointIndex: number;
  robotPose: GuideRobotPose | null;
}

function RouteSegment({ from, to, color = '#0ea5e9' }: { from: Point; to: Point; color?: string }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.routeSegment,
        {
          left: from.x,
          top: from.y - 2,
          width: length,
          backgroundColor: color,
          transform: [{ rotateZ: `${angle}deg` }],
        },
      ]}
    />
  );
}

export default function CartGuideMap({ destinations, currentWaypointIndex, robotPose }: CartGuideMapProps) {
  const [size, setSize] = useState(0);
  const floorSize = Math.max(size - MAP_PAD * 2, 1);
  const ppm = floorSize / STORE_SIZE;

  const points = destinations.map(item => ({ x: item.xCoord, y: item.yCoord }));
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const minX = points.length ? Math.min(SLAM_MIN_X, ...xs) : SLAM_MIN_X;
  const maxX = points.length ? Math.max(SLAM_MAX_X, ...xs) : SLAM_MAX_X;
  const minY = points.length ? Math.min(SLAM_MIN_Y, ...ys) : SLAM_MIN_Y;
  const maxY = points.length ? Math.max(SLAM_MAX_Y, ...ys) : SLAM_MAX_Y;
  const spanX = Math.max(maxX - minX, 0.1);
  const spanY = Math.max(maxY - minY, 0.1);
  const projection = (point: Point) => {
    if (!points.length) return { x: 7.25, y: 8.6 };
    return {
      // Waypoint là tọa độ ROS (Y hướng lên), còn sơ đồ kiosk có Y hướng xuống.
      // Auto-fit giữ nguyên hình học tương đối của tuyến, không thay đổi dữ liệu thật.
      x: 0.9 + ((point.x - minX) / spanX) * 7.2,
      y: 8.1 - ((point.y - minY) / spanY) * 7.2,
    };
  };

  const routePoints = destinations.map(item => projection({ x: item.xCoord, y: item.yCoord }));
  const projectedRobot = robotPose ? projection(robotPose) : null;
  const clamp = (value: number) => Math.max(0.25, Math.min(8.75, value));
  const toPixel = (point: Point): Point => ({
    x: MAP_PAD + clamp(point.x) * ppm,
    y: MAP_PAD + clamp(point.y) * ppm,
  });
  const pixelRoute = routePoints.map(toPixel);
  const pixelRobot = projectedRobot ? toPixel(projectedRobot) : null;

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.min(event.nativeEvent.layout.width, event.nativeEvent.layout.height);
    if (next > 0 && Math.abs(next - size) > 1) setSize(next);
  };

  return (
    <View style={styles.frame} onLayout={onLayout}>
      {size > 0 && (
        <View style={{ width: size, height: size }}>
          <View style={[styles.floor, { left: MAP_PAD, top: MAP_PAD, width: floorSize, height: floorSize }]} />

          {Array.from({ length: 10 }).map((_, index) => (
            <React.Fragment key={`grid-${index}`}>
              <View style={[styles.gridLineV, { left: MAP_PAD + index * ppm, top: MAP_PAD, height: floorSize }]} />
              <View style={[styles.gridLineH, { left: MAP_PAD, top: MAP_PAD + index * ppm, width: floorSize }]} />
              <Text style={[styles.axisX, { left: MAP_PAD + index * ppm - 9, top: 2 }]}>{index}m</Text>
              <Text style={[styles.axisY, { left: 0, top: MAP_PAD + index * ppm - 6 }]}>{index}m</Text>
            </React.Fragment>
          ))}

          {SHELVES.map(shelf => (
            <View
              key={shelf.id}
              style={[
                styles.shelf,
                {
                  left: MAP_PAD + shelf.x * ppm,
                  top: MAP_PAD + shelf.y * ppm,
                  width: shelf.w * ppm,
                  height: shelf.h * ppm,
                  backgroundColor: shelf.fill,
                  borderColor: shelf.stroke,
                },
              ]}
            >
              <Text style={[styles.shelfText, { color: shelf.text }]}>{shelf.label}</Text>
            </View>
          ))}

          {pixelRoute.slice(1).map((point, index) => (
            <RouteSegment key={`segment-${index}`} from={pixelRoute[index]} to={point} />
          ))}
          {pixelRobot && pixelRoute[currentWaypointIndex] && (
            <RouteSegment from={pixelRobot} to={pixelRoute[currentWaypointIndex]} color="#f97316" />
          )}

          {pixelRoute.map((point, index) => {
            const active = index === currentWaypointIndex;
            const completed = index < currentWaypointIndex;
            return (
              <View
                key={`stop-${destinations[index]?.nodeId ?? index}`}
                style={[
                  styles.stop,
                  { left: point.x - 14, top: point.y - 14 },
                  completed && styles.stopCompleted,
                  active && styles.stopActive,
                ]}
              >
                <Text style={styles.stopText}>{index + 1}</Text>
              </View>
            );
          })}

          {pixelRobot && (
            <View style={[styles.robot, { left: pixelRobot.x - 19, top: pixelRobot.y - 19 }]}>
              <Text style={styles.robotEmoji}>🤖</Text>
            </View>
          )}

          <View style={[styles.wallTop, { left: MAP_PAD, top: MAP_PAD, width: floorSize }]} />
          <View style={[styles.wallLeft, { left: MAP_PAD, top: MAP_PAD, height: floorSize }]} />
          <View style={[styles.wallRight, { left: MAP_PAD + floorSize - 5, top: MAP_PAD, height: floorSize }]} />
          <View style={[styles.wallBottom, { left: MAP_PAD, top: MAP_PAD + floorSize - 5, width: floorSize * (6.5 / 9) }]} />
          <View style={[styles.wallBottom, { left: MAP_PAD + floorSize * (8 / 9), top: MAP_PAD + floorSize - 5, width: floorSize / 9 }]} />
          <View style={[styles.door, { left: MAP_PAD + floorSize * (6.5 / 9), top: MAP_PAD + floorSize - 5, width: floorSize * (1.5 / 9) }]}>
            <Text style={styles.doorText}>CỬA</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef4fa', borderRadius: 22, overflow: 'hidden' },
  floor: { position: 'absolute', backgroundColor: '#fff' },
  gridLineV: { position: 'absolute', width: 1, backgroundColor: '#e2e8f0' },
  gridLineH: { position: 'absolute', height: 1, backgroundColor: '#e2e8f0' },
  axisX: { position: 'absolute', width: 24, textAlign: 'center', color: '#94a3b8', fontSize: 8 },
  axisY: { position: 'absolute', width: 20, textAlign: 'right', color: '#94a3b8', fontSize: 8 },
  shelf: { position: 'absolute', borderWidth: 1.5, borderRadius: 5, alignItems: 'center', justifyContent: 'center', zIndex: 2, elevation: 1 },
  shelfText: { fontSize: 10, fontWeight: '900' },
  routeSegment: { position: 'absolute', height: 4, borderRadius: 2, transformOrigin: 'left center', zIndex: 3 },
  stop: { position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: '#2563eb', borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', zIndex: 6, elevation: 5 },
  stopActive: { backgroundColor: '#f97316', width: 34, height: 34, borderRadius: 17, marginLeft: -3, marginTop: -3 },
  stopCompleted: { backgroundColor: '#16a34a' },
  stopText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  robot: { position: 'absolute', width: 38, height: 38, borderRadius: 19, backgroundColor: '#6366f1', borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', zIndex: 7, elevation: 8 },
  robotEmoji: { fontSize: 20 },
  wallTop: { position: 'absolute', height: 5, backgroundColor: '#334155', zIndex: 5 },
  wallLeft: { position: 'absolute', width: 5, backgroundColor: '#334155', zIndex: 5 },
  wallRight: { position: 'absolute', width: 5, backgroundColor: '#334155', zIndex: 5 },
  wallBottom: { position: 'absolute', height: 5, backgroundColor: '#334155', zIndex: 5 },
  door: { position: 'absolute', height: 7, backgroundColor: '#d1fae5', borderLeftWidth: 2, borderRightWidth: 2, borderColor: '#10b981', alignItems: 'center', zIndex: 6 },
  doorText: { position: 'absolute', top: -2, color: '#059669', fontSize: 10, fontWeight: '900' },
});
