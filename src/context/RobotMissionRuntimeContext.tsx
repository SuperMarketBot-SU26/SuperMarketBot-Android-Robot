import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Speech from 'expo-speech';
import { useVideoPlayer, VideoView } from 'expo-video';
import { X, Plus, Scan } from 'lucide-react-native';
import React, {
  createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { ActivityIndicator, AppState, AppStateStatus, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AdMissionOverlay } from '../components/mission/AdMissionOverlay';
import { ROBOT_CODE, useRobotRealtime } from './RobotRealtimeContext';
import { RobotControlService } from '../services/RobotControlService';
const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
const ROBOT_ID = Number(process.env.EXPO_PUBLIC_ROBOT_ID ?? '1');

type MissionFlow = 'patrol' | 'ad';
type MissionStatus = 'IDLE' | 'DISPATCHED' | 'NAVIGATING' | 'MOVING' | 'ARRIVED'
  | 'PLAYLIST_PLAYING' | 'PLAYLIST_COMPLETE' | 'WAYPOINT_COMPLETED'
  | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'ESTOP';

interface AdMedia {
  resourceType?: string;
  resourceUrl?: string | null;
  contentText?: string | null;
}

interface PlaylistItem {
  id?: number;
  sponsoredId?: number;
  name?: string;
  productName?: string;
  durationSeconds?: number;
  displayDurationSeconds?: number;
  imageUrl?: string | null;
  mediaContents?: AdMedia[];
}

interface MissionWaypoint {
  nodeId: number;
  nodeName: string;
  nodeRole?: string | null;
  zoneName?: string | null;
  aisleName?: string | null;
  shelfName?: string | null;
  playlist?: PlaylistItem[];
}

interface RobotMission {
  missionId: string;
  robotCode: string;
  flowType: MissionFlow;
  status: MissionStatus;
  waypoints: MissionWaypoint[];
}

interface NavigationStatusPayload {
  robotCode?: string;
  RobotCode?: string;
  missionId?: string;
  MissionId?: string;
  navStatus?: string;
  NavStatus?: string;
  waypointIndex?: number;
  WaypointIndex?: number;
  nodeId?: number;
  NodeId?: number;
  role?: string;
  Role?: string;
  playlist?: PlaylistItem[];
  Playlist?: PlaylistItem[];
}

interface ScanResult {
  nodeId: number;
  shelfName?: string;
  analysisStatus: string;
  needsRestock?: boolean;
  occupancyRatePct?: number;
  emptySlotCount?: number;
  errorMessage?: string;
}

interface RuntimeContextValue {
  mission: RobotMission | null;
  status: MissionStatus;
  pendingScans: number;
  completedScans: number;
  failedScans: number;
  lastScan: ScanResult | null;
  hubConnected: boolean;
}

const RuntimeContext = createContext<RuntimeContextValue | null>(null);

function valueOf<T>(object: any, ...keys: string[]): T | undefined {
  if (!object) return undefined;
  for (const key of keys) {
    if (object[key] !== undefined) return object[key] as T;
  }
  return undefined;
}

function normalizeMission(raw: any): RobotMission | null {
  if (!raw) return null;
  const missionId = String(valueOf(raw, 'missionId', 'MissionId') ?? '');
  const robotCode = String(valueOf(raw, 'robotCode', 'RobotCode') ?? '');
  const flowType = String(valueOf(raw, 'flowType', 'FlowType') ?? '').toLowerCase() as MissionFlow;
  const status = String(valueOf(raw, 'status', 'Status') ?? 'DISPATCHED').toUpperCase() as MissionStatus;
  if (!missionId || !robotCode || !['patrol', 'ad'].includes(flowType)) return null;

  const rawWaypoints = valueOf<any[]>(raw, 'waypoints', 'Waypoints') ?? [];
  const waypoints: MissionWaypoint[] = rawWaypoints.map((item) => ({
    nodeId: Number(valueOf(item, 'nodeId', 'NodeId') ?? 0),
    nodeName: String(valueOf(item, 'nodeName', 'NodeName') ?? ''),
    nodeRole: valueOf<string>(item, 'nodeRole', 'NodeRole'),
    zoneName: valueOf<string>(item, 'zoneName', 'ZoneName'),
    aisleName: valueOf<string>(item, 'aisleName', 'AisleName'),
    shelfName: valueOf<string>(item, 'shelfName', 'ShelfName'),
    playlist: valueOf<PlaylistItem[]>(item, 'playlist', 'Playlist') ?? [],
  }));

  return {
    missionId,
    robotCode,
    flowType,
    status,
    waypoints,
  };
}

const matchRobot = (incoming?: string | null) => {
  return Boolean(incoming && incoming.toUpperCase() === ROBOT_CODE.toUpperCase());
};

export function RobotMissionRuntimeProvider({ children }: { children: ReactNode }) {
  const { isConnected: hubConnected, subscribeMissionAssigned, subscribeNavigationStatus } = useRobotRealtime();
  const [permission, requestPermission] = useCameraPermissions();
  const [mission, setMission] = useState<RobotMission | null>(null);
  const [status, setStatus] = useState<MissionStatus>('DISPATCHED');
  const [activeWaypoint, setActiveWaypoint] = useState<MissionWaypoint | null>(null);
  const [activeWaypointIndex, setActiveWaypointIndex] = useState<number>(-1);
  const [activePlaylist, setActivePlaylist] = useState<PlaylistItem[]>([]);
  const [pendingScans, setPendingScans] = useState(0);
  const [completedScans, setCompletedScans] = useState(0);
  const [failedScans, setFailedScans] = useState(0);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [cameraMounted, setCameraMounted] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [isAligning, setIsAligning] = useState(false);

  const missionRef = useRef<RobotMission | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const cameraRef = useRef<CameraView | null>(null);
  const capturedKeys = useRef<Set<string>>(new Set());
  const pendingScansRef = useRef(0);

  useEffect(() => {
    pendingScansRef.current = pendingScans;
    if (pendingScans === 0 && ['COMPLETED', 'FAILED', 'CANCELLED', 'ESTOP'].includes(status))
      missionRef.current = null;
  }, [pendingScans, status]);

  useEffect(() => {
    requestPermission().catch(() => undefined);
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, [requestPermission]);

  const acceptMission = useCallback((payload: any) => {
    const normalized = normalizeMission(payload);
    if (!normalized || !matchRobot(normalized.robotCode)) return;
    console.log('[RobotMissionRuntime] Đã nhận nhiệm vụ:', normalized.missionId, normalized.flowType);
    missionRef.current = normalized;
    setMission(normalized);
    setStatus(normalized.status);
    setPendingScans(0);
    setCompletedScans(0);
    setFailedScans(0);
    setLastScan(null);
    setActivePlaylist([]);
    capturedKeys.current.clear();
  }, []);

  useEffect(() => {
    return subscribeMissionAssigned(acceptMission);
  }, [acceptMission, subscribeMissionAssigned]);

  const uploadScan = useCallback(async (
    activeMission: RobotMission,
    waypoint: MissionWaypoint,
    waypointIndex: number,
    imageUri: string,
  ) => {
    try {
      const resized = await manipulateAsync(
        imageUri,
        [{ resize: { width: 1280 } }],
        { compress: 0.75, format: SaveFormat.JPEG },
      );

      const form = new FormData();
      form.append('image', {
        uri: resized.uri,
        name: `${activeMission.missionId}-${waypointIndex}.jpg`,
        type: 'image/jpeg',
      } as any);
      form.append('robotCode', ROBOT_CODE);
      form.append('robotId', String(ROBOT_ID));
      form.append('missionId', activeMission.missionId);
      form.append('waypointIndex', String(waypointIndex));
      form.append('nodeId', String(waypoint.nodeId));
      form.append('capturedAt', new Date().toISOString());

      const response = await fetch(`${API_BASE}/api/v1/shelf-patrol/analyze-node`, {
        method: 'POST',
        headers: { 'ngrok-skip-browser-warning': 'true' },
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.errorMessage || result?.detail || `AI Vision HTTP ${response.status}`);
      console.log('[RobotMissionRuntime] AI Vision phân tích thành công:', result);
      setLastScan(result);
      setCompletedScans((count) => count + 1);
    } catch (error) {
      console.warn('[RobotMissionRuntime] Upload scan failed:', error);
      setFailedScans((count) => count + 1);
      setLastScan({
        nodeId: waypoint.nodeId,
        shelfName: waypoint.shelfName ?? undefined,
        analysisStatus: 'Failed',
        errorMessage: error instanceof Error ? error.message : 'Không phân tích được ảnh.',
      });
    } finally {
      setPendingScans((count) => Math.max(0, count - 1));
    }
  }, []);

  const captureAtWaypoint = useCallback(async (
    activeMission: RobotMission,
    waypoint: MissionWaypoint,
    waypointIndex: number,
  ) => {
    const key = `${ROBOT_CODE}|${activeMission.missionId}|${waypointIndex}`;
    if (capturedKeys.current.has(key)) return;
    for (let attempt = 0; attempt < 10 && (!cameraRef.current || !cameraMounted); attempt += 1)
      await new Promise((resolve) => setTimeout(resolve, 300));
    if (!cameraRef.current || !permission?.granted) {
      setFailedScans((count) => count + 1);
      setLastScan({ nodeId: waypoint.nodeId, shelfName: waypoint.shelfName ?? undefined, analysisStatus: 'Failed', errorMessage: 'Camera sau chưa sẵn sàng.' });
      return;
    }

    setIsAligning(true);
    Speech.speak('Đang căn chỉnh góc camera', { language: 'vi-VN', rate: 0.9 });
    for (let alignAttempt = 0; alignAttempt < 3; alignAttempt++) {
      try {
        const previewPicture = await cameraRef.current.takePictureAsync({ quality: 0.3, skipProcessing: false });
        if (!previewPicture?.uri) break;

        const previewResized = await manipulateAsync(
          previewPicture.uri,
          [{ resize: { width: 640 } }],
          { compress: 0.5, format: SaveFormat.JPEG },
        );

        const alignForm = new FormData();
        alignForm.append('image', {
          uri: previewResized.uri,
          name: 'preview.jpg',
          type: 'image/jpeg',
        } as any);
        alignForm.append('nodeId', String(waypoint.nodeId));

        const alignResponse = await fetch(`${API_BASE}/api/v1/shelf-patrol/validate-framing`, {
          method: 'POST',
          headers: { 'ngrok-skip-browser-warning': 'true' },
          body: alignForm,
        });

        if (alignResponse.ok) {
          const alignResult = await alignResponse.json();
          if (alignResult.framingScore < 50 && alignResult.suggestion !== 'GOOD') {
            const rot = alignResult.suggestion === 'ROTATE_LEFT' ? -0.3 : 0.3;
            RobotControlService.sendMove(rot, 0, 0);
            await new Promise((resolve) => setTimeout(resolve, 500));
            RobotControlService.sendMove(0, 0, 0);
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          } else {
            break;
          }
        } else {
          break;
        }
      } catch (e) {
        console.warn('[Alignment] Failed', e);
        break;
      }
    }
    setIsAligning(false);
    Speech.speak('Góc camera đã chuẩn, bắt đầu chụp', { language: 'vi-VN', rate: 0.9 });

    // Đợi 1.5s để camera ổn định, lấy nét và định tâm vào mốc '+'
    await new Promise((resolve) => setTimeout(resolve, 1500));

    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.75, skipProcessing: false });
      if (!picture?.uri) throw new Error('Camera không trả ảnh.');
      capturedKeys.current.add(key);
      setPendingScans((count) => count + 1);
      queueRef.current = queueRef.current.then(() => uploadScan(activeMission, waypoint, waypointIndex, picture.uri));
    } catch (error) {
      setFailedScans((count) => count + 1);
      setLastScan({
        nodeId: waypoint.nodeId,
        shelfName: waypoint.shelfName ?? undefined,
        analysisStatus: 'Failed',
        errorMessage: error instanceof Error ? error.message : 'Không chụp được ảnh.',
      });
    }
  }, [cameraMounted, permission?.granted, uploadScan]);

  useEffect(() => {
    return subscribeNavigationStatus((payload: NavigationStatusPayload) => {
      const incomingRobot = valueOf<string>(payload, 'robotCode', 'RobotCode');
      const incomingMission = valueOf<string>(payload, 'missionId', 'MissionId');
      const activeMission = missionRef.current;
      if (!activeMission || !matchRobot(incomingRobot) || !incomingMission || incomingMission !== activeMission.missionId) return;

      const nextStatus = String(valueOf(payload, 'navStatus', 'NavStatus') ?? '').toUpperCase() as MissionStatus;
      console.log('[RobotMissionRuntime] navigationStatus:', nextStatus, 'role:', valueOf(payload, 'role', 'Role'));
      
      const prevStatus = activeMission.status;

      setStatus(nextStatus);
      const updatedMission = { ...activeMission, status: nextStatus };
      setMission((current) => current ? updatedMission : current);
      missionRef.current = updatedMission;

      const waypointIndex = Number(valueOf(payload, 'waypointIndex', 'WaypointIndex') ?? -1);
      const nodeId = Number(valueOf(payload, 'nodeId', 'NodeId') ?? -1);
      const waypoint = activeMission.waypoints[waypointIndex]
        ?? activeMission.waypoints.find((item) => item.nodeId === nodeId);

      if (waypoint) {
        setActiveWaypoint(waypoint);
        setActiveWaypointIndex(waypointIndex);
      }
      if (nextStatus === 'ARRIVED' && waypoint) {
        const role = String(valueOf(payload, 'role', 'Role') ?? waypoint.nodeRole ?? '').toLowerCase();
        if (activeMission.flowType === 'patrol' && (role === 'photo' || role === 'scan')) {
          Speech.speak(`Đã đến ${waypoint.shelfName || waypoint.nodeName}. Xin vui lòng nhấn chụp thủ công khi góc quay đã chuẩn.`, { language: 'vi-VN', rate: 0.9 });
          // void captureAtWaypoint(activeMission, waypoint, waypointIndex);
        }
        if (activeMission.flowType === 'ad' && role === 'ad') {
          const statusPlaylist = valueOf<PlaylistItem[]>(payload, 'playlist', 'Playlist');
          const playlist = statusPlaylist?.length ? statusPlaylist : waypoint.playlist ?? [];
          setActivePlaylist(playlist);
          if (playlist.length > 0) {
            const topProducts = playlist.slice(0, 2).map(p => p.productName || p.name).filter(Boolean);
            const productNamesStr = topProducts.join(' và ');
            Speech.speak(`Xin chào quý khách! Tôi đang ở ${waypoint.shelfName || 'Kệ hàng'}. Hôm nay xin giới thiệu sản phẩm ưu đãi đặc biệt: ${productNamesStr}!`, { language: 'vi-VN' });
          }
        }
      }

      if (['MOVING', 'NAVIGATING'].includes(nextStatus) && prevStatus === 'ARRIVED' && activeMission.flowType === 'ad') {
        const nextWaypoint = updatedMission.waypoints.find(w => w.nodeId !== waypoint?.nodeId) || { shelfName: 'Kệ tiếp theo' };
        Speech.speak(`Cảm ơn quý khách. Tôi sẽ tiếp tục di chuyển sang ${nextWaypoint.shelfName || 'Kệ tiếp theo'}.`, { language: 'vi-VN' });
      }
      if (['MOVING', 'WAYPOINT_COMPLETED', 'PLAYLIST_COMPLETE'].includes(nextStatus))
        setActivePlaylist([]);
      if (['COMPLETED', 'FAILED', 'CANCELLED', 'ESTOP'].includes(nextStatus)) {
        setActivePlaylist([]);
        if (nextStatus === 'COMPLETED' && activeMission.flowType === 'patrol') {
          Speech.speak('Tuần tra hoàn tất. Robot đang quay về vị trí chờ.', { language: 'vi-VN', rate: 0.9 });
          void RobotControlService.dispatchAutonomous({ robotCode: ROBOT_CODE, flowType: 'return', nodeIds: [10023], floorId: 1 });
        }
        if (nextStatus !== 'COMPLETED' || pendingScansRef.current === 0) {
          missionRef.current = null;
        }
      }
    });
  }, [captureAtWaypoint, subscribeNavigationStatus]);

  useEffect(() => {
    if (!API_BASE) return;
    const report = () => fetch(`${API_BASE}/api/v1/robot-operations/devices/${ROBOT_CODE}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({
        cameraReady: permission?.granted === true,
        adPlayerReady: true,
        isForeground: appState === 'active',
        appVersion: 'android-robot-1.0.0',
      }),
    }).catch(() => undefined);
    void report();
    const timer = setInterval(report, 10_000);
    return () => clearInterval(timer);
  }, [appState, permission?.granted]);

  const value = useMemo<RuntimeContextValue>(() => ({
    mission, status, pendingScans, completedScans, failedScans, lastScan, hubConnected,
  }), [mission, status, pendingScans, completedScans, failedScans, lastScan, hubConnected]);

  return (
    <RuntimeContext.Provider value={value}>
      {children}
      <MissionOverlay
        mission={mission}
        status={status}
        activeWaypoint={activeWaypoint}
        activePlaylist={activePlaylist}
        pendingScans={pendingScans}
        completedScans={completedScans}
        failedScans={failedScans}
        lastScan={lastScan}
        cameraRef={cameraRef}
        cameraPermission={permission?.granted === true}
        isAligning={isAligning}
        onCameraReady={() => setCameraMounted(true)}
        onCapture={() => {
          if (mission && activeWaypoint && activeWaypointIndex >= 0) {
            void captureAtWaypoint(mission, activeWaypoint, activeWaypointIndex);
          }
        }}
        onDismiss={() => {
          setMission(null);
          missionRef.current = null;
        }}
      />
      <AdMissionOverlay
        mission={mission}
        status={status}
        activeWaypoint={activeWaypoint}
        activePlaylist={activePlaylist}
      />
    </RuntimeContext.Provider>
  );
}

function MissionOverlay({
  mission, status, activeWaypoint, activePlaylist, pendingScans, completedScans, failedScans,
  lastScan, cameraRef, cameraPermission, isAligning, onCameraReady, onDismiss,
}: {
  mission: RobotMission | null;
  status: MissionStatus;
  activeWaypoint: MissionWaypoint | null;
  activePlaylist: PlaylistItem[];
  pendingScans: number;
  completedScans: number;
  failedScans: number;
  lastScan: ScanResult | null;
  cameraRef: React.RefObject<CameraView | null>;
  cameraPermission: boolean;
  isAligning: boolean;
  onCameraReady: () => void;
  onDismiss: () => void;
  onCapture?: () => void;
}) {
  const [zoom, setZoom] = useState(0); // 0 = 0.6x Ultra-wide / widest view on Redmi Note 13 Pro

  // Tự động đóng HUD sau 7s khi có kết quả phân tích
  useEffect(() => {
    if (lastScan && pendingScans === 0) {
      const timer = setTimeout(() => {
        onDismiss();
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [lastScan, pendingScans, onDismiss]);

  if (!mission || mission.flowType !== 'patrol') return null;
  const missionEnded = ['COMPLETED', 'FAILED', 'CANCELLED', 'ESTOP'].includes(status);
  const visible = !missionEnded || pendingScans > 0;
  if (!visible) return null;

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <View style={styles.root}>
        {cameraPermission
          ? <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" zoom={zoom} onCameraReady={onCameraReady} />
          : <View style={styles.center}><Text style={styles.error}>Camera chưa được cấp quyền</Text></View>}
        <View style={styles.scrim} />

        {/* Header with Close Button */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>AI VISION PATROL · {ROBOT_CODE}</Text>
            <Text style={styles.title} numberOfLines={1}>{activeWaypoint?.shelfName || activeWaypoint?.nodeName || 'Đang tới kệ tiếp theo'}</Text>
            <Text style={styles.subtitle}>{activeWaypoint?.zoneName} {activeWaypoint?.aisleName ? `· ${activeWaypoint.aisleName}` : ''}</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* Center Target Reticle [ + ] for Shelf Marker Alignment */}
        <View style={styles.centerReticleContainer} pointerEvents="none">
          <View style={styles.targetBox}>
            {/* 4 Corners */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />

            {/* Center Crosshair '+' */}
            <View style={styles.crosshairCenter}>
              <View style={styles.crosshairH} />
              <View style={styles.crosshairV} />
            </View>

            {/* Laser scan line */}
            <View style={styles.laserLine} />
          </View>
          <View style={styles.reticleBadge}>
            <Scan size={12} color="#00A550" />
            <Text style={styles.reticleText}>CĂN CHỈNH TÂM MỐC KỆ [ + ]</Text>
          </View>
        </View>

        {/* Floating Zoom Control (0.6x / 1x / 2x) */}
        <View style={styles.zoomContainer}>
          <TouchableOpacity
            style={[styles.zoomBtn, zoom === 0 && styles.zoomBtnActive]}
            onPress={() => setZoom(0)}
          >
            <Text style={[styles.zoomText, zoom === 0 && styles.zoomTextActive]}>0.6x</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.zoomBtn, zoom === 0.15 && styles.zoomBtnActive]}
            onPress={() => setZoom(0.15)}
          >
            <Text style={[styles.zoomText, zoom === 0.15 && styles.zoomTextActive]}>1x</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.zoomBtn, zoom === 0.35 && styles.zoomBtnActive]}
            onPress={() => setZoom(0.35)}
          >
            <Text style={[styles.zoomText, zoom === 0.35 && styles.zoomTextActive]}>2x</Text>
          </TouchableOpacity>
        </View>

        {/* Footer with Scan Metrics & AI Analysis Result */}
        <View style={styles.footer}>
          <View style={styles.metrics}>
            <Metric label="Đã quét" value={completedScans} />
            <Metric label="Đang xử lý" value={pendingScans} />
            <Metric label="Lỗi" value={failedScans} danger={failedScans > 0} />
          </View>
          <Text style={styles.status}>{status === 'ARRIVED' ? 'Đã đến vị trí. Hãy nhấn nút chụp!' : `Robot: ${status}`}</Text>
          
          {status === 'ARRIVED' && (
            <TouchableOpacity 
              style={{ marginTop: 15, backgroundColor: '#00A550', padding: 16, borderRadius: 12, alignItems: 'center' }}
              onPress={onCapture}
            >
              <Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>📸 CHỤP ẢNH KỆ NÀY</Text>
            </TouchableOpacity>
          )}

          {lastScan && (
            <View style={[styles.result, lastScan.needsRestock && styles.resultWarning]}>
              <Text style={styles.resultTitle}>{lastScan.analysisStatus === 'Failed' ? 'Không phân tích được' : lastScan.needsRestock ? 'Cần nhập hàng' : 'Kệ đạt yêu cầu'}</Text>
              {lastScan.analysisStatus !== 'Failed' && <Text style={styles.resultText}>Còn {lastScan.occupancyRatePct}% · {lastScan.emptySlotCount} vị trí trống</Text>}
              {lastScan.errorMessage && <Text style={styles.error}>{lastScan.errorMessage}</Text>}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return <View style={styles.metric}><Text style={[styles.metricValue, danger && styles.error]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function AdCarousel({ playlist }: { playlist: PlaylistItem[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (playlist.length < 2) return;
    const duration = (playlist[index]?.durationSeconds ?? playlist[index]?.displayDurationSeconds ?? 10) * 1000;
    const timer = setTimeout(() => setIndex((current) => (current + 1) % playlist.length), duration);
    return () => clearTimeout(timer);
  }, [index, playlist]);
  const item = playlist[index % Math.max(playlist.length, 1)];
  const media = item?.mediaContents?.[0];
  const type = String(media?.resourceType ?? '').toUpperCase();
  const url = media?.resourceUrl || item?.imageUrl || '';
  return <AdCreative type={type} url={url} title={item?.name || item?.productName || 'Ưu đãi hôm nay'} text={media?.contentText} />;
}

function AdCreative({ type, url, title, text }: { type: string; url: string; title: string; text?: string | null }) {
  const isVideo = type.includes('VIDEO') || /\.(mp4|webm|mov)(\?|$)/i.test(url);
  const player = useVideoPlayer(isVideo && url ? url : null, (instance) => {
    instance.loop = true;
    instance.play();
  });
  return (
    <View style={styles.creative}>
      {isVideo && url
        ? <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
        : url
          ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="contain" />
          : null}
      <View style={styles.creativeCaption}>
        <Text style={styles.creativeTitle}>{title}</Text>
        {!!text && <Text style={styles.creativeText}>{text}</Text>}
      </View>
    </View>
  );
}

export function useRobotMissionRuntime() {
  const value = useContext(RuntimeContext);
  if (!value) throw new Error('useRobotMissionRuntime must be used inside RobotMissionRuntimeProvider');
  return value;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07101f' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  scrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(3,10,22,0.30)' },
  header: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 44,
    padding: 18,
    borderRadius: 22,
    backgroundColor: 'rgba(4,14,29,0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  eyebrow: { color: '#6ee7b7', fontWeight: '900', letterSpacing: 1.5, fontSize: 12 },
  title: { color: 'white', fontSize: 24, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#cbd5e1', fontSize: 14, marginTop: 3 },

  // Center Reticle Styles
  centerReticleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '30%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  targetBox: {
    width: 220,
    height: 180,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#00A550',
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 6 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 6 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 6 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 },
  crosshairCenter: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crosshairH: {
    position: 'absolute',
    width: 26,
    height: 2,
    backgroundColor: '#00A550',
  },
  crosshairV: {
    position: 'absolute',
    height: 26,
    width: 2,
    backgroundColor: '#00A550',
  },
  laserLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 1.5,
    backgroundColor: 'rgba(0, 165, 80, 0.6)',
    shadowColor: '#00A550',
    shadowOpacity: 0.8,
    shadowRadius: 5,
  },
  reticleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(4,14,29,0.85)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 165, 80, 0.4)',
  },
  reticleText: {
    color: '#00A550',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },

  zoomContainer: {
    position: 'absolute',
    right: 20,
    top: 170,
    backgroundColor: 'rgba(4,14,29,0.85)',
    borderRadius: 24,
    padding: 4,
    gap: 6,
    alignItems: 'center',
    zIndex: 10,
  },
  zoomBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnActive: {
    backgroundColor: '#00A550',
  },
  zoomText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
  },
  zoomTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  footer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 30,
    padding: 18,
    borderRadius: 22,
    backgroundColor: 'rgba(4,14,29,0.92)',
    zIndex: 10,
  },
  metrics: { flexDirection: 'row', gap: 10 },
  metric: { flex: 1, padding: 10, borderRadius: 14, backgroundColor: '#122238', alignItems: 'center' },
  metricValue: { color: '#6ee7b7', fontSize: 22, fontWeight: '900' },
  metricLabel: { color: '#94a3b8', fontSize: 11 },
  status: { color: 'white', fontSize: 15, fontWeight: '700', marginTop: 12 },
  result: { marginTop: 12, padding: 14, backgroundColor: '#064e3b', borderRadius: 14 },
  resultWarning: { backgroundColor: '#7c2d12' },
  resultTitle: { color: 'white', fontWeight: '900', fontSize: 16 },
  resultText: { color: '#e2e8f0', marginTop: 4, fontSize: 13 },
  error: { color: '#fca5a5', fontWeight: '700' },
  adRoot: { flex: 1, backgroundColor: '#030712' },
  adWaiting: { color: 'white', fontSize: 22, fontWeight: '700' },
  adBadge: { position: 'absolute', right: 24, top: 36, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: 'rgba(15,23,42,.82)', borderRadius: 999 },
  adBadgeText: { color: '#6ee7b7', fontWeight: '800' },
  creative: { flex: 1, justifyContent: 'flex-end' },
  creativeCaption: { padding: 34, backgroundColor: 'rgba(3,7,18,.72)' },
  creativeTitle: { color: 'white', fontSize: 38, fontWeight: '900' },
  creativeText: { color: '#e2e8f0', fontSize: 22, marginTop: 8 },
});
