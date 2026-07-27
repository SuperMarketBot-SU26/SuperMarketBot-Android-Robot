/**
 * MapViewerContext.tsx
 *
 * Cung cấp dữ liệu Lidar + Robot Pose cho toàn bộ App qua React Context.
 * Tablet KHÔNG lưu / quản lý bản đồ — chỉ xem (View-only).
 * Bản đồ nền được tải từ Backend (Web Manager quản lý).
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { LidarService, LidarFrame, RobotPose } from '../services/LidarService';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface MapInfo {
  mapId: number;
  mapName: string;
  imageUrl: string;  // URL của ảnh bản đồ lưu trên Backend
  scalePixelPerMeter: number; // Số pixel = 1 mét (để chuyển đổi tọa độ)
  originX: number;   // Pixel X của điểm (0,0) trên ảnh
  originY: number;   // Pixel Y của điểm (0,0) trên ảnh
  // ── Thông số ROS chuẩn (từ MapFloorplanDto) ──────────────────────────────
  resolution: number;   // mét/pixel (default: 0.05)
  rosOriginX: number;   // Tọa độ gốc ROS X (mét)
  rosOriginY: number;   // Tọa độ gốc ROS Y (mét)
  originYaw: number;    // Góc xoay (radian)
}

interface MapViewerContextType {
  // Trạng thái kết nối với ESP32
  isLidarConnected: boolean;

  // Frame Lidar mới nhất (để vẽ các tia quét)
  latestFrame: LidarFrame | null;

  // Tọa độ robot ước lượng sau Scan Matching
  robotPose: RobotPose | null;

  // Thông tin bản đồ nền (tải từ Server)
  currentMap: MapInfo | null;

  // Actions
  startLidar: () => void;
  stopLidar: () => void;
  loadMap: (mapId: number) => Promise<void>;
  loadActiveMap: (floorId?: number) => Promise<void>;
  isLoadingMap: boolean;

  // Helper: Quy đổi tọa độ ROS (mét) -> Canvas Pixel
  rosToPixel: (rosX: number, rosY: number, canvasHeight: number) => { px: number; py: number };
}

const MapViewerContext = createContext<MapViewerContextType | null>(null);

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';

// ─── Provider ─────────────────────────────────────────────────────────────────

export function MapViewerProvider({ children }: { children: React.ReactNode }) {
  const [isLidarConnected, setLidarConnected] = useState(false);
  const [latestFrame, setLatestFrame] = useState<LidarFrame | null>(null);
  const [robotPose, setRobotPose] = useState<RobotPose | null>(null);
  const [currentMap, setCurrentMap] = useState<MapInfo | null>(null);
  const [isLoadingMap, setLoadingMap] = useState(false);

  // Dùng stable wrapper ổn định để register/unregister đúng cùng 1 reference
  const frameRef  = useRef<(f: LidarFrame) => void | undefined>(undefined);
  const poseRef   = useRef<(p: RobotPose) => void | undefined>(undefined);
  const connRef   = useRef<(c: boolean)   => void | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;
    // Stable wrapper: giữ nguyên reference nhưng delegate vào ref.current
    frameRef.current = (f: LidarFrame) => { if (isMounted) setLatestFrame(f); };
    poseRef.current  = (p: RobotPose)  => { if (isMounted) setRobotPose(p); };
    connRef.current  = (c: boolean)    => { if (isMounted) setLidarConnected(c); };

    const onFrame = (f: LidarFrame) => frameRef.current?.(f);
    const onPose  = (p: RobotPose)  => poseRef.current?.(p);
    const onConn  = (c: boolean)    => connRef.current?.(c);

    LidarService.onFrame(onFrame);
    LidarService.onPoseUpdate(onPose);
    LidarService.onConnection(onConn);

    return () => {
      isMounted = false;
      LidarService.offFrame(onFrame);
      LidarService.offPoseUpdate(onPose);
      LidarService.offConnection(onConn);
      LidarService.disconnect();
    };
  }, []);

  const startLidar = useCallback(() => {
    LidarService.connect();
  }, []);

  const stopLidar = useCallback(() => {
    LidarService.disconnect();
  }, []);

  /** Tải thông tin bản đồ từ Backend theo MapID */
  const loadMap = useCallback(async (mapId: number) => {
    setLoadingMap(true);
    try {
      const res = await fetch(`${API_BASE}/api/maps/${mapId}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const mapInfo: MapInfo = {
        mapId: data.mapId,
        mapName: data.mapName,
        imageUrl: data.imageUrl ?? `${API_BASE}/api/maps/${mapId}/image`,
        scalePixelPerMeter: data.scalePixelPerMeter ?? 100, // 100px = 1m mặc định
        originX: data.originX ?? 0,
        originY: data.originY ?? 0,
        resolution: data.resolution ?? 0.05,
        rosOriginX: data.originX ?? 0,
        rosOriginY: data.originY ?? 0,
        originYaw: data.originYaw ?? 0,
      };
      setCurrentMap(mapInfo);
      console.log(`[MapViewer] Loaded map: ${mapInfo.mapName}`);
    } catch (e) {
      console.warn('[MapViewer] Không thể tải bản đồ:', e);
    } finally {
      setLoadingMap(false);
    }
  }, []);

  /** Tải Active Map chính thức theo floorId — dùng endpoint /api/v1/maps/active */
  const loadActiveMap = useCallback(async (floorId: number = 1) => {
    setLoadingMap(true);
    try {
      const url = `${API_BASE}/api/v1/maps/active?floorId=${floorId}`;
      console.log(`[MapViewer] loadActiveMap: GET ${url}`);
      const res = await fetch(url, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const mapInfo: MapInfo = {
        mapId: data.mapId,
        mapName: data.mapName,
        imageUrl: data.floorplanImageUrl ?? data.imageUrl ?? `${API_BASE}/api/maps/${data.mapId}/image`,
        scalePixelPerMeter: data.scalePixelPerMeter ?? (1 / (data.resolution ?? 0.05)),
        originX: data.pixelOriginX ?? data.originX ?? 0,
        originY: data.pixelOriginY ?? data.originY ?? 0,
        // ROS fields
        resolution: data.resolution ?? 0.05,
        rosOriginX: data.rosOriginX ?? data.originX ?? 0,
        rosOriginY: data.rosOriginY ?? data.originY ?? 0,
        originYaw: data.originYaw ?? 0,
      };
      setCurrentMap(mapInfo);
      console.log(`[MapViewer] Active map loaded: ${mapInfo.mapName} (floor=${floorId})`);
    } catch (e) {
      console.warn('[MapViewer] Không thể tải active map, thử fallback loadMap(1):', e);
      // Fallback sang loadMap nếu active endpoint chưa có
      await loadMap(1);
    } finally {
      setLoadingMap(false);
    }
  }, [loadMap]);

  /**
   * Quy đổi tọa độ ROS (mét) sang Pixel Canvas.
   * Công thức chuẩn từ BackendMapFloorplanDto:
   *   pixelX = (rosX - map.rosOriginX) / map.resolution
   *   pixelY = canvasHeight - ((rosY - map.rosOriginY) / map.resolution)
   */
  const rosToPixel = useCallback(
    (rosX: number, rosY: number, canvasHeight: number): { px: number; py: number } => {
      if (!currentMap) return { px: 0, py: 0 };
      const px = (rosX - currentMap.rosOriginX) / currentMap.resolution;
      const py = canvasHeight - (rosY - currentMap.rosOriginY) / currentMap.resolution;
      return { px, py };
    },
    [currentMap],
  );

  return (
    <MapViewerContext.Provider value={{
      isLidarConnected,
      latestFrame,
      robotPose,
      currentMap,
      startLidar,
      stopLidar,
      loadMap,
      loadActiveMap,
      isLoadingMap,
      rosToPixel,
    }}>
      {children}
    </MapViewerContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMapViewer() {
  const ctx = useContext(MapViewerContext);
  if (!ctx) throw new Error('useMapViewer must be used within MapViewerProvider');
  return ctx;
}
