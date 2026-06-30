/**
 * RoutePolyline.tsx
 *
 * Vẽ polyline qua các waypoint của 1 RobotRoute lên Skia Canvas.
 * Dùng nhiều <Line> nối tiếp (đồng bộ pattern với MapViewerScreen).
 *
 * Props:
 *   - waypoints: đã sort theo sequenceOrder
 *   - mapInfo:   { originX, originY, scalePixelPerMeter } — đồng bộ với robotPose
 */

import React, { useMemo } from 'react';
import { Line, Circle, Group } from '@shopify/react-native-skia';
import { Waypoint } from '../../services/RouteService';

export interface MapInfoLite {
  originX: number;
  originY: number;
  scalePixelPerMeter: number;
}

interface Props {
  waypoints: Waypoint[];
  mapInfo: MapInfoLite;
  color?: string;
  strokeWidth?: number;
}

function toScreen(
  wp: Waypoint,
  map: MapInfoLite,
): { x: number; y: number } {
  // Đồng bộ với MapViewerScreen.tsx:
  //   screenX = originX + x * scale
  //   screenY = originY - y * scale   (Y đảo ngược)
  return {
    x: map.originX + wp.x * map.scalePixelPerMeter,
    y: map.originY - wp.y * map.scalePixelPerMeter,
  };
}

export default function RoutePolyline({
  waypoints,
  mapInfo,
  color = '#2dd4bf',
  strokeWidth = 4,
}: Props) {
  const sorted = useMemo(
    () => [...waypoints].sort((a, b) => a.sequenceOrder - b.sequenceOrder),
    [waypoints],
  );

  if (sorted.length === 0) return null;

  const points = sorted.map((wp) => toScreen(wp, mapInfo));

  return (
    <Group>
      {/* Polyline: nối từng cặp điểm liên tiếp */}
      {points.slice(0, -1).map((p, i) => {
        const next = points[i + 1];
        return (
          <Line
            key={`seg-${i}`}
            p1={p}
            p2={next}
            color={color}
            strokeWidth={strokeWidth}
          />
        );
      })}

      {/* Waypoint dots */}
      {points.map((p, i) => {
        const isEnd = i === 0 || i === points.length - 1;
        if (isEnd) {
          // Vòng lớn + outline cho waypoint đầu / cuối
          return (
            <Group key={`wp-${i}`}>
              <Circle cx={p.x} cy={p.y} r={10} color={color} opacity={0.25} />
              <Circle cx={p.x} cy={p.y} r={6} color={color} />
            </Group>
          );
        }
        return (
          <Circle key={`wp-${i}`} cx={p.x} cy={p.y} r={4} color={color} />
        );
      })}
    </Group>
  );
}