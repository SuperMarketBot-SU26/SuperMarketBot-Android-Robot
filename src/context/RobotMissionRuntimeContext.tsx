import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Speech from 'expo-speech';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useRouter } from 'expo-router';
import {
  X, Plus, Scan, Camera, ArrowRight, CheckCircle2, AlertTriangle, RefreshCw, Sparkles, Navigation
} from 'lucide-react-native';
import React, {
  createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { ActivityIndicator, AppState, AppStateStatus, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AdMissionOverlay } from '../components/mission/AdMissionOverlay';
import { ROBOT_CODE, useRobotRealtime } from './RobotRealtimeContext';
import { RobotControlService } from '../services/RobotControlService';
import { AdInterruptionService } from '../services/AdInterruptionService';

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

export interface PlaylistItem {
  id?: number;
  sponsoredId?: number;
  adCampaignId?: number;
  productId?: number;
  name?: string;
  productName?: string;
  campaignName?: string;
  productPrice?: number;
  unitPrice?: number;
  promotionPrice?: number;
  durationSeconds?: number;
  displayDurationSeconds?: number;
  imageUrl?: string | null;
  description?: string | null;
  mediaContents?: AdMedia[];
}

export interface MissionWaypoint {
  nodeId: number;
  nodeName: string;
  nodeRole?: string | null;
  zoneName?: string | null;
  aisleName?: string | null;
  shelfName?: string | null;
  playlist?: PlaylistItem[];
  transitTtsMessage?: string | null;
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
  activeWaypoint: MissionWaypoint | null;
  activeWaypointIndex: number;
  activePlaylist: PlaylistItem[];
  pendingScans: number;
  completedScans: number;
  failedScans: number;
  lastScan: ScanResult | null;
  hubConnected: boolean;
  resumeToNextWaypoint: () => Promise<void>;
  interruptAdForGuidance: (productItem: PlaylistItem) => Promise<void>;
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
  const waypoints: MissionWaypoint[] = rawWaypoints.map((item) => {
    const rawPlaylist = valueOf<any[]>(item, 'playlist', 'Playlist') ?? [];
    const playlist: PlaylistItem[] = rawPlaylist.map((p) => ({
      id: valueOf<number>(p, 'id', 'Id'),
      sponsoredId: valueOf<number>(p, 'sponsoredId', 'SponsoredId'),
      adCampaignId: valueOf<number>(p, 'adCampaignId', 'AdCampaignId'),
      productId: valueOf<number>(p, 'productId', 'ProductId'),
      name: valueOf<string>(p, 'name', 'Name'),
      productName: valueOf<string>(p, 'productName', 'ProductName'),
      campaignName: valueOf<string>(p, 'campaignName', 'CampaignName'),
      productPrice: valueOf<number>(p, 'productPrice', 'ProductPrice'),
      unitPrice: valueOf<number>(p, 'unitPrice', 'UnitPrice'),
      promotionPrice: valueOf<number>(p, 'promotionPrice', 'PromotionPrice'),
      durationSeconds: valueOf<number>(p, 'durationSeconds', 'DurationSeconds'),
      displayDurationSeconds: valueOf<number>(p, 'displayDurationSeconds', 'DisplayDurationSeconds'),
      imageUrl: valueOf<string>(p, 'imageUrl', 'ImageUrl'),
      description: valueOf<string>(p, 'description', 'Description'),
      mediaContents: valueOf<AdMedia[]>(p, 'mediaContents', 'MediaContents') ?? [],
    }));

    return {
      nodeId: Number(valueOf(item, 'nodeId', 'NodeId') ?? 0),
      nodeName: String(valueOf(item, 'nodeName', 'NodeName') ?? ''),
      nodeRole: valueOf<string>(item, 'nodeRole', 'NodeRole'),
      zoneName: valueOf<string>(item, 'zoneName', 'ZoneName'),
      aisleName: valueOf<string>(item, 'aisleName', 'AisleName'),
      shelfName: valueOf<string>(item, 'shelfName', 'ShelfName'),
      transitTtsMessage: valueOf<string>(item, 'transitTtsMessage', 'TransitTtsMessage'),
      playlist,
    };
  });

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
  const router = useRouter();
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

  const interruptAdForGuidance = useCallback(async (productItem: PlaylistItem) => {
    const activeMission = missionRef.current;
    if (!activeMission || activeMission.flowType !== 'ad') return;

    console.log('[RobotMissionRuntime] Khách tương tác yêu cầu dẫn đường từ màn hình quảng cáo:', productItem);
    const resolvedIndex = activeWaypointIndex >= 0
      ? activeWaypointIndex
      : (activeWaypoint ? activeMission.waypoints.findIndex((w) => w.nodeId === activeWaypoint.nodeId) : -1);
    const currentIdx = resolvedIndex >= 0 ? resolvedIndex : 0;
    const remainingWaypoints = activeMission.waypoints.slice(currentIdx + 1);
    const remainingNodeIds = remainingWaypoints.map((w) => w.nodeId);

    // 1. Lưu lộ trình quảng cáo bị tạm dừng vào AdInterruptionService
    AdInterruptionService.saveInterruptedMission({
      originalMissionId: activeMission.missionId,
      robotCode: ROBOT_CODE,
      remainingNodeIds,
      floorId: 1,
      campaignId: (productItem as any).adCampaignId ?? null,
      interruptedAtWaypointIndex: currentIdx,
      totalWaypoints: activeMission.waypoints.length,
      productName: productItem.productName || productItem.name,
      shelfName: activeWaypoint?.shelfName ?? undefined,
      savedTimestamp: Date.now(),
    });

    // 2. Hủy mission ad hiện tại trên Backend để giải phóng trạng thái robot
    await fetch(`${API_BASE}/api/v1/navigation/robots/${ROBOT_CODE}/cancel?reason=${encodeURIComponent('Customer requested guidance for advertised product')}`, {
      method: 'POST',
      headers: { 'ngrok-skip-browser-warning': 'true' },
    }).catch(() => undefined);

    // 3. Tắt màn hình quảng cáo và dọn dẹp state ad
    setActivePlaylist([]);
    setMission(null);
    missionRef.current = null;

    // 4. Phát giọng nói chào đón và xác nhận dẫn đường
    const pName = productItem.productName || productItem.name || 'sản phẩm';
    const shelfLabel = activeWaypoint?.shelfName || 'kệ hàng';
    Speech.speak(`Dạ vâng! Robot sẽ chuyển sang chế độ dẫn đường đến quầy ${shelfLabel} cho quý khách. Xin mời quý khách đi theo tôi!`, {
      language: 'vi-VN',
      rate: 0.9,
    });

    // 5. Phát lệnh dẫn đường (flowType: 'guide') tới sản phẩm
    const pId = productItem.productId || productItem.id || 0;
    if (pId > 0) {
      try {
        await RobotControlService.dispatchAutonomous({
          robotCode: ROBOT_CODE,
          flowType: 'guide',
          productId: pId,
          productIds: [pId],
          floorId: 1,
        });
        console.log(`[RobotMissionRuntime] Đã dispatch autonomous guide cho productId=${pId}`);
      } catch (err) {
        console.warn('[RobotMissionRuntime] Dispatch autonomous guide thất bại:', err);
      }
    }

    // 6. Điều hướng giao diện sang CartGuideMapScreen
    try {
      router.push('/cart-guide-map' as any);
    } catch (navErr) {
      console.warn('[RobotMissionRuntime] router.push(/cart-guide-map) warning:', navErr);
    }
  }, [activeWaypoint, activeWaypointIndex, router]);

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
        { compress: 0.75, format: SaveFormat.JPEG, base64: true },
      );

      const payload = {
        robotCode: ROBOT_CODE,
        robotId: ROBOT_ID,
        missionId: activeMission.missionId,
        waypointIndex,
        nodeId: waypoint.nodeId,
        capturedAt: new Date().toISOString(),
        imageBase64: resized.base64,
      };

      console.log(`[RobotMissionRuntime] Đang gửi ảnh phân tích AI Vision cho node ${waypoint.nodeId}...`);
      const response = await fetch(`${API_BASE}/api/v1/shelf-patrol/analyze-node-json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.errorMessage || result?.detail || `AI Vision HTTP ${response.status}`);
      console.log('[RobotMissionRuntime] AI Vision phân tích thành công:', result);
      setLastScan(result);
      setCompletedScans((count) => count + 1);

      // TTS thông báo kết quả kiểm tra tồn kho
      if (result.needsRestock || (result.emptySlotCount && result.emptySlotCount > 0)) {
        Speech.speak(
          `Phát hiện ${result.emptySlotCount ?? 1} vị trí hết hàng tại ${waypoint.shelfName || 'kệ'}. Tỷ lệ lấp đầy ${result.occupancyRatePct ?? 50}%. Cần bổ sung hàng gấp!`,
          { language: 'vi-VN', rate: 0.9 }
        );
      } else {
        Speech.speak(
          `Kệ ${waypoint.shelfName || 'hàng'} đã đủ hàng. Tỷ lệ lấp đầy ${result.occupancyRatePct ?? 100}%.`,
          { language: 'vi-VN', rate: 0.9 }
        );
      }
    } catch (error) {
      console.warn('[RobotMissionRuntime] Upload scan failed:', error);
      setFailedScans((count) => count + 1);
      setLastScan({
        nodeId: waypoint.nodeId,
        shelfName: waypoint.shelfName ?? undefined,
        analysisStatus: 'Failed',
        errorMessage: error instanceof Error ? error.message : 'Không phân tích được ảnh.',
      });
      Speech.speak('Không thể phân tích ảnh kệ này. Vui lòng kiểm tra lại.', { language: 'vi-VN', rate: 0.9 });
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
    Speech.speak('Góc camera đã chuẩn, bắt đầu chụp và gửi AI', { language: 'vi-VN', rate: 0.9 });

    // Đợi 1s để camera ổn định, lấy nét
    await new Promise((resolve) => setTimeout(resolve, 1000));

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

  const resumeToNextWaypoint = useCallback(async () => {
    if (!API_BASE) return;
    try {
      console.log('[RobotMissionRuntime] Tiếp tục di chuyển sang kệ tiếp theo...');
      Speech.speak('Đã ghi nhận kết quả. Đang di chuyển sang kệ tiếp theo.', { language: 'vi-VN', rate: 0.9 });
      await fetch(`${API_BASE}/api/v1/navigation/robots/${ROBOT_CODE}/resume?reason=Photo%20scan%20completed`, {
        method: 'POST',
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      setLastScan(null);
    } catch (err) {
      console.warn('[RobotMissionRuntime] Resume to next shelf failed:', err);
    }
  }, []);

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
      const matchedIdx = waypointIndex >= 0
        ? waypointIndex
        : activeMission.waypoints.findIndex((item) => item.nodeId === nodeId);
      const waypoint = activeMission.waypoints[matchedIdx];

      if (waypoint) {
        setActiveWaypoint(waypoint);
        setActiveWaypointIndex(matchedIdx);
      }
      if (nextStatus === 'ARRIVED' && waypoint) {
        const role = String(valueOf(payload, 'role', 'Role') ?? waypoint.nodeRole ?? '').toLowerCase();
        if (activeMission.flowType === 'patrol' && (role === 'photo' || role === 'scan')) {
          Speech.speak(`Đã đến ${waypoint.shelfName || waypoint.nodeName}. Xin vui lòng nhấn nút chụp ảnh để kiểm tra tồn kho.`, { language: 'vi-VN', rate: 0.9 });
        }
        if (activeMission.flowType === 'ad' && role === 'ad') {
          const statusPlaylist = valueOf<PlaylistItem[]>(payload, 'playlist', 'Playlist');
          const playlist = statusPlaylist?.length ? statusPlaylist : waypoint.playlist ?? [];
          setActivePlaylist(playlist);

          // Phát thông báo bằng giọng nói chào khách, giới thiệu sản phẩm khuyến mãi và mời tương tác
          const firstItem = playlist[0];
          const shelfLabel = waypoint.shelfName || waypoint.nodeName || 'kệ hàng';
          if (firstItem) {
            const pName = firstItem.productName || firstItem.name || 'sản phẩm';
            const price = firstItem.productPrice ?? firstItem.unitPrice ?? 0;
            const priceMsg = price > 0 ? ` với giá ưu đãi chỉ ${price.toLocaleString('vi-VN')} đồng.` : '.';
            Speech.speak(
              `Xin chào quý khách! Tại quầy ${shelfLabel}, siêu thị đang giới thiệu ${pName}${priceMsg} Quý khách có thể chạm vào màn hình để tôi dẫn đường mua sắm nhé!`,
              { language: 'vi-VN', rate: 0.9 }
            );
          } else {
            Speech.speak(
              `Chào mừng quý khách đến quầy ${shelfLabel}! Mời quý khách xem các chương trình ưu đãi hôm nay.`,
              { language: 'vi-VN', rate: 0.9 }
            );
          }
        }
      }

      if (['MOVING', 'NAVIGATING'].includes(nextStatus)) {
        if (prevStatus === 'ARRIVED' && activeMission.flowType === 'ad') {
          const nextWaypoint = updatedMission.waypoints.find(w => w.nodeId !== waypoint?.nodeId) || { shelfName: 'Kệ tiếp theo' };
          Speech.speak(`Cảm ơn quý khách. Tôi sẽ tiếp tục di chuyển sang ${nextWaypoint.shelfName || 'Kệ tiếp theo'}.`, { language: 'vi-VN', rate: 0.9 });
        } else if (waypoint?.transitTtsMessage) {
          Speech.speak(waypoint.transitTtsMessage, { language: 'vi-VN', rate: 0.9 });
        }
      }
      if (['MOVING', 'WAYPOINT_COMPLETED', 'PLAYLIST_COMPLETE'].includes(nextStatus)) {
        setActivePlaylist([]);
        setLastScan(null);
      }
      if (['COMPLETED', 'FAILED', 'CANCELLED', 'ESTOP'].includes(nextStatus)) {
        setActivePlaylist([]);
        setLastScan(null);
        if (nextStatus === 'CANCELLED') {
          const cancelReason = String(valueOf(payload, 'error', 'Error') ?? valueOf(payload, 'reason', 'Reason') ?? '');
          const isInterruptedForGuide = AdInterruptionService.hasInterruptedMission() || cancelReason.toLowerCase().includes('guidance');
          if (!isInterruptedForGuide) {
            Speech.speak('Đã dừng nhiệm vụ.', { language: 'vi-VN', rate: 0.9 });
          }
          setMission(null);
          missionRef.current = null;
        }
        if (nextStatus === 'ESTOP') {
          Speech.speak('Dừng khẩn cấp.', { language: 'vi-VN', rate: 0.9 });
          setMission(null);
          missionRef.current = null;
        }
        if (nextStatus === 'COMPLETED') {
          const completionMsg = activeMission.flowType === 'patrol' 
            ? 'Tuần tra toàn bộ siêu thị hoàn tất. Robot đang quay về trạm sạc.'
            : 'Quảng cáo hoàn tất. Robot đang quay về trạm sạc.';
          Speech.speak(completionMsg, { language: 'vi-VN', rate: 0.9 });
          void RobotControlService.dispatchAutonomous({ robotCode: ROBOT_CODE, flowType: 'return', nodeIds: [10029], floorId: 1 });
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
    mission,
    status,
    activeWaypoint,
    activeWaypointIndex,
    activePlaylist,
    pendingScans,
    completedScans,
    failedScans,
    lastScan,
    hubConnected,
    resumeToNextWaypoint,
    interruptAdForGuidance,
  }), [
    mission,
    status,
    activeWaypoint,
    activeWaypointIndex,
    activePlaylist,
    pendingScans,
    completedScans,
    failedScans,
    lastScan,
    hubConnected,
    resumeToNextWaypoint,
    interruptAdForGuidance,
  ]);

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
        onResumeNext={resumeToNextWaypoint}
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
        onStartGuide={interruptAdForGuidance}
        onDismiss={() => {
          setActivePlaylist([]);
        }}
      />
    </RuntimeContext.Provider>
  );
}

function MissionOverlay({
  mission, status, activeWaypoint, activePlaylist, pendingScans, completedScans, failedScans,
  lastScan, cameraRef, cameraPermission, isAligning, onCameraReady, onDismiss, onCapture, onResumeNext,
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
  onResumeNext?: () => void;
}) {
  const [zoom, setZoom] = useState(0); // 0 = 0.6x Ultra-wide / widest view on Redmi Note 13 Pro
  const [countdownToNext, setCountdownToNext] = useState<number | null>(null);

  // Tự động đếm ngược 6s để chuyển sang kệ tiếp theo khi có kết quả phân tích AI
  useEffect(() => {
    if (lastScan && pendingScans === 0 && status === 'ARRIVED') {
      setCountdownToNext(6);
      const timer = setInterval(() => {
        setCountdownToNext((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            onResumeNext?.();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setCountdownToNext(null);
    }
  }, [lastScan, pendingScans, status, onResumeNext]);

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

          <Text style={styles.status}>
            {pendingScans > 0
              ? '⏳ Đang gửi ảnh và phân tích AI Vision...'
              : status === 'ARRIVED'
                ? (lastScan ? 'Đã có kết quả phân tích kệ!' : 'Đã đến vị trí. Hãy nhấn nút chụp!')
                : `Robot: ${status}`}
          </Text>
          
          {/* Nút Chụp Ảnh Thủ Công khi đã đến nơi và chưa có kết quả */}
          {status === 'ARRIVED' && !lastScan && (
            <TouchableOpacity 
              style={[styles.captureBtn, pendingScans > 0 && styles.captureBtnDisabled]}
              onPress={onCapture}
              disabled={pendingScans > 0}
              activeOpacity={0.8}
            >
              {pendingScans > 0 ? (
                <View style={styles.btnRow}>
                  <ActivityIndicator color="white" size="small" />
                  <Text style={styles.captureBtnText}>🔍 ĐANG PHÂN TÍCH BẰNG AI...</Text>
                </View>
              ) : (
                <View style={styles.btnRow}>
                  <Camera size={20} color="white" />
                  <Text style={styles.captureBtnText}>📸 CHỤP ẢNH KỆ HÀNG (KIỂM TRA TỒN KHO)</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* Card Kết Quả Phân Tích AI */}
          {lastScan && (
            <View style={[styles.resultCard, lastScan.needsRestock ? styles.resultWarning : styles.resultSuccess]}>
              <View style={styles.resultHeader}>
                {lastScan.needsRestock ? (
                  <AlertTriangle size={22} color="#FBBF24" />
                ) : (
                  <CheckCircle2 size={22} color="#34D399" />
                )}
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.resultTitle}>
                    {lastScan.analysisStatus === 'Failed'
                      ? 'Không phân tích được ảnh'
                      : lastScan.needsRestock
                        ? `⚠️ CẦN BỔ SUNG HÀNG (${lastScan.emptySlotCount ?? 0} VỊ TRÍ TRỐNG)`
                        : `✅ KỆ ĐÃ ĐẦY ĐỦ HÀNG (${lastScan.occupancyRatePct}%)`}
                  </Text>
                  {lastScan.analysisStatus !== 'Failed' && (
                    <Text style={styles.resultSubText}>
                      {activeWaypoint?.shelfName || 'Kệ hàng'}: Tỷ lệ lấp đầy {lastScan.occupancyRatePct}% · Trống {lastScan.emptySlotCount ?? 0} ô
                    </Text>
                  )}
                </View>
              </View>

              {lastScan.errorMessage && <Text style={styles.error}>{lastScan.errorMessage}</Text>}

              {/* Nút Chuyển Tiếp Sang Kệ Sau */}
              {status === 'ARRIVED' && (
                <TouchableOpacity
                  style={styles.nextShelfBtn}
                  onPress={() => {
                    setCountdownToNext(null);
                    onResumeNext?.();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.nextShelfBtnText}>
                    🚀 TIẾP TỤC SANG KỆ TIẾP THEO {countdownToNext !== null ? `(${countdownToNext}s)` : ''}
                  </Text>
                  <ArrowRight size={18} color="white" />
                </TouchableOpacity>
              )}
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
    backgroundColor: 'rgba(4,14,29,0.94)',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  metrics: { flexDirection: 'row', gap: 10 },
  metric: { flex: 1, padding: 10, borderRadius: 14, backgroundColor: '#122238', alignItems: 'center' },
  metricValue: { color: '#6ee7b7', fontSize: 22, fontWeight: '900' },
  metricLabel: { color: '#94a3b8', fontSize: 11 },
  status: { color: 'white', fontSize: 14, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  
  // Nút chụp ảnh
  captureBtn: {
    marginTop: 12,
    backgroundColor: '#00A550',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00A550',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  captureBtnDisabled: {
    backgroundColor: '#374151',
  },
  captureBtnText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Result card
  resultCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  resultSuccess: {
    backgroundColor: 'rgba(6, 78, 59, 0.9)',
    borderColor: '#059669',
  },
  resultWarning: {
    backgroundColor: 'rgba(124, 45, 18, 0.9)',
    borderColor: '#DC2626',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultTitle: {
    color: 'white',
    fontWeight: '900',
    fontSize: 14,
  },
  resultSubText: {
    color: '#E2E8F0',
    fontSize: 12,
    marginTop: 2,
  },
  occupancyBarContainer: {
    marginTop: 8,
  },
  occupancyBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  occupancyBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  barSuccess: {
    backgroundColor: '#10B981',
  },
  barWarning: {
    backgroundColor: '#EF4444',
  },
  occupancyText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 4,
  },

  // Nút di chuyển tiếp theo
  nextShelfBtn: {
    marginTop: 10,
    backgroundColor: '#1D4ED8',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextShelfBtnText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 13,
  },

  error: { color: '#fca5a5', fontWeight: '700', marginTop: 4, fontSize: 12 },
  adRoot: { flex: 1, backgroundColor: '#030712' },
  adWaiting: { color: 'white', fontSize: 22, fontWeight: '700' },
  adBadge: { position: 'absolute', right: 24, top: 36, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: 'rgba(15,23,42,.82)', borderRadius: 999 },
  adBadgeText: { color: '#6ee7b7', fontWeight: '800' },
  creative: { flex: 1, justifyContent: 'flex-end' },
  creativeCaption: { padding: 34, backgroundColor: 'rgba(3,7,18,.72)' },
  creativeTitle: { color: 'white', fontSize: 38, fontWeight: '900' },
  creativeText: { color: '#e2e8f0', fontSize: 22, marginTop: 8 },
});
