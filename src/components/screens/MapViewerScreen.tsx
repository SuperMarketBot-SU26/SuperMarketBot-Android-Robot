/**
 * MapViewerScreen.tsx
 *
 * Màn hình hiển thị bản đồ robot (CHỈ XEM - View Only).
 * Tablet nhận dữ liệu LiDAR từ ESP32 qua WebSocket cục bộ,
 * vẽ vị trí robot + các tia quét lên nền bản đồ tải từ Backend.
 *
 * Quản lý bản đồ / waypoint / lộ trình → THUỘC VỀ WEB MANAGER.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Dimensions,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { Canvas, Circle, Line, Group, Image as SkiaImage, useImage } from '@shopify/react-native-skia';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MapPin, Wifi, WifiOff, ChevronLeft, Maximize2 } from 'lucide-react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';

import { useMapViewer } from '../../context/MapViewerContext';
import { LidarPoint } from '../../services/LidarService';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Màu sắc LiDAR (theo ngưỡng khoảng cách) ─────────────────────────────────
function lidarPointColor(distMm: number): string {
  if (distMm <= 0) return 'transparent';
  if (distMm < 500)  return '#ef4444'; // <0.5m  đỏ — nguy hiểm
  if (distMm < 1000) return '#f59e0b'; // <1m    cam — cảnh báo
  if (distMm < 3000) return '#22c55e'; // <3m    xanh lá — bình thường
  return '#38bdf8';                     // >3m    xanh da trời — xa
}

// ─── Component: Vẽ 1 tia LiDAR ────────────────────────────────────────────────
interface LidarRayProps {
  point: LidarPoint;
  robotX: number;
  robotY: number;
  scale: number;       // pixel-per-meter
  headingRad: number;
}
const LidarRay = React.memo(({ point, robotX, robotY, scale, headingRad }: LidarRayProps) => {
  if (point.distMm <= 0 || point.distMm > 8000) return null;
  const angleRad = (point.angleDeg * Math.PI / 180) + headingRad;
  const distM    = point.distMm / 1000;
  const endX = robotX + distM * scale * Math.cos(angleRad);
  const endY = robotY - distM * scale * Math.sin(angleRad); // Y đảo ngược trong screen
  const color = lidarPointColor(point.distMm);

  return (
    <>
      <Line p1={{ x: robotX, y: robotY }} p2={{ x: endX, y: endY }}
            color="rgba(45,212,191,0.08)" strokeWidth={0.8} />
      <Circle cx={endX} cy={endY} r={2.5} color={color} opacity={0.85} />
    </>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MapViewerScreen() {
  const router = useRouter();
  const {
    isLidarConnected, latestFrame, robotPose,
    currentMap, loadMap, isLoadingMap,
    startLidar, stopLidar,
  } = useMapViewer();

  const [isFullscreen, setFullscreen] = useState(false);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [viewScale, setViewScale] = useState(1.0);

  // Tải bản đồ mặc định (MapID=1) khi vào màn hình
  useEffect(() => {
    loadMap(1);
    startLidar();
    return () => stopLidar();
  }, []);

  // Tọa độ robot trên canvas (pixel)
  const robotScreenX = currentMap
    ? currentMap.originX + (robotPose?.x ?? 0) * currentMap.scalePixelPerMeter
    : SW / 2;
  const robotScreenY = currentMap
    ? currentMap.originY - (robotPose?.y ?? 0) * currentMap.scalePixelPerMeter
    : SH / 2;

  const scale = currentMap?.scalePixelPerMeter ?? 80;
  const heading = robotPose?.headingRad ?? 0;

  // Animated: robot dot pulse
  const dotScale = useSharedValue(1);
  useEffect(() => {
    if (latestFrame) {
      dotScale.value = withSpring(1.3, { damping: 4 }, () => {
        dotScale.value = withSpring(1);
      });
    }
  }, [latestFrame]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
  }));

  // Map image từ URL — null-safe: useImage chỉ nhận string hoặc null
  const mapImageUrl = currentMap?.imageUrl ?? null;
  const mapImage = useImage(mapImageUrl);

  const canvasH = isFullscreen ? SH : SH * 0.65;
  const canvasW = SW;

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#e8edf4" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <MapPin size={16} color="#2dd4bf" />
          <Text style={styles.headerTitle}>
            {currentMap?.mapName ?? 'Bản đồ Robot'}
          </Text>
        </View>

        <View style={styles.headerRight}>
          {/* Trạng thái kết nối Lidar */}
          <View style={styles.connBadge}>
            {isLidarConnected
              ? <Wifi size={14} color="#22c55e" />
              : <WifiOff size={14} color="#ef4444" />}
            <Text style={[styles.connText, { color: isLidarConnected ? '#22c55e' : '#ef4444' }]}>
              {isLidarConnected ? 'LiDAR' : 'Mất kết nối'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setFullscreen(v => !v)}>
            <Maximize2 size={18} color="#8a97ab" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Canvas bản đồ ── */}
      <View style={[styles.mapContainer, { height: canvasH }]}>
        {isLoadingMap ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#2dd4bf" />
            <Text style={styles.loadingText}>Đang tải bản đồ...</Text>
          </View>
        ) : (
          <Canvas style={{ width: canvasW, height: canvasH }}>
            {/* Nền bản đồ */}
            {mapImage && (
              <SkiaImage image={mapImage} x={0} y={0} width={canvasW} height={canvasH} fit="contain" />
            )}
            {!mapImage && (
              // Grid nền khi chưa có map
              <>
                {Array.from({ length: 20 }).map((_, i) => (
                  <Line key={`h${i}`}
                    p1={{ x: 0, y: i * (canvasH / 20) }} p2={{ x: canvasW, y: i * (canvasH / 20) }}
                    color="rgba(30,40,54,0.6)" strokeWidth={0.5} />
                ))}
                {Array.from({ length: 20 }).map((_, i) => (
                  <Line key={`v${i}`}
                    p1={{ x: i * (canvasW / 20), y: 0 }} p2={{ x: i * (canvasW / 20), y: canvasH }}
                    color="rgba(30,40,54,0.6)" strokeWidth={0.5} />
                ))}
              </>
            )}

            {/* Tia LiDAR */}
            <Group>
              {latestFrame?.points.map((pt, idx) => (
                <LidarRay
                  key={idx}
                  point={pt}
                  robotX={robotScreenX}
                  robotY={robotScreenY}
                  scale={scale}
                  headingRad={heading}
                />
              ))}
            </Group>

            {/* Vị trí robot (vòng tròn + mũi tên hướng) */}
            <Circle cx={robotScreenX} cy={robotScreenY} r={14}
                    color="rgba(45,212,191,0.18)" />
            <Circle cx={robotScreenX} cy={robotScreenY} r={8}
                    color="#2dd4bf" />
            {/* Mũi tên hướng robot */}
            <Line
              p1={{ x: robotScreenX, y: robotScreenY }}
              p2={{
                x: robotScreenX + 22 * Math.cos(heading),
                y: robotScreenY - 22 * Math.sin(heading),
              }}
              color="#22c55e" strokeWidth={3}
            />
          </Canvas>
        )}
      </View>

      {/* ── Info Panel ── */}
      <View style={styles.infoPanel}>
        <View style={styles.infoRow}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Tọa độ X</Text>
            <Text style={styles.infoValue}>
              {(robotPose?.x ?? 0).toFixed(2)} m
            </Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Tọa độ Y</Text>
            <Text style={styles.infoValue}>
              {(robotPose?.y ?? 0).toFixed(2)} m
            </Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Hướng</Text>
            <Text style={styles.infoValue}>
              {((robotPose?.headingRad ?? 0) * 180 / Math.PI).toFixed(1)}°
            </Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Độ tin cậy</Text>
            <Text style={[styles.infoValue, {
              color: (robotPose?.confidence ?? 0) > 0.7 ? '#22c55e' : '#f59e0b',
            }]}>
              {((robotPose?.confidence ?? 0) * 100).toFixed(0)}%
            </Text>
          </View>
        </View>

        {/* Chú thích màu LiDAR */}
        <View style={styles.legend}>
          {[
            { color: '#ef4444', label: '< 0.5m' },
            { color: '#f59e0b', label: '< 1m' },
            { color: '#22c55e', label: '< 3m' },
            { color: '#38bdf8', label: '> 3m' },
          ].map(item => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.viewOnlyNote}>
          📋 Chế độ Xem — Quản lý lộ trình tại Web Manager
        </Text>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#080b0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2836',
    backgroundColor: '#0d1219',
  },
  backBtn: {
    width: 36, height: 36,
    borderRadius: 10,
    backgroundColor: '#111820',
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  headerTitle: {
    color: '#e8edf4',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  connBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#111820',
    borderWidth: 1,
    borderColor: '#1e2836',
  },
  connText: {
    fontSize: 11,
    fontWeight: '700',
  },
  mapContainer: {
    backgroundColor: '#050608',
    borderBottomWidth: 1,
    borderBottomColor: '#1e2836',
    overflow: 'hidden',
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#8a97ab',
    fontSize: 13,
  },
  infoPanel: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#111820',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1e2836',
    alignItems: 'center',
  },
  infoLabel: {
    color: '#8a97ab',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoValue: {
    color: '#2dd4bf',
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8, height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: '#8a97ab',
    fontSize: 11,
  },
  viewOnlyNote: {
    color: '#4a5568',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
