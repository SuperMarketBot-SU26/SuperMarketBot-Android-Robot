import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Speech from 'expo-speech';
import { useRouter } from 'expo-router';
import React, {
  createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { AdMissionOverlay } from '../components/mission/AdMissionOverlay';
import { PatrolMissionOverlay } from '../components/mission/PatrolMissionOverlay';
import { ROBOT_CODE, useRobotRealtime } from './RobotRealtimeContext';
import { RobotControlService } from '../services/RobotControlService';
import { AdInterruptionService } from '../services/AdInterruptionService';
import { BatteryService } from '../services/BatteryService';
import { VoiceService } from '../services/RobotVoiceService';

const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
const ROBOT_ID = Number(process.env.EXPO_PUBLIC_ROBOT_ID ?? '1');

export type MissionFlow = 'patrol' | 'ad';
export type MissionStatus = 'IDLE' | 'DISPATCHED' | 'NAVIGATING' | 'MOVING' | 'ARRIVED' | 'PAUSED' | 'RESUMED'
  | 'PLAYLIST_PLAYING' | 'PLAYLIST_COMPLETE' | 'WAYPOINT_COMPLETED'
  | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'ESTOP' | 'WAYPOINT_FAILED';

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
  shelfId?: number | null;
  shelfName?: string | null;
  aisleName?: string | null;
  zoneName?: string | null;
  adScore?: number;
  packageScore?: number;
  priority?: number;
}

export interface MissionWaypoint {
  nodeId: number;
  nodeName: string;
  nodeRole?: string | null;
  dwellTimeSeconds?: number;
  zoneName?: string | null;
  aisleName?: string | null;
  shelfId?: number | null;
  shelfName?: string | null;
  playlist?: PlaylistItem[];
  transitTtsMessage?: string | null;
}

export interface RobotMission {
  missionId: string;
  robotCode: string;
  flowType: MissionFlow;
  status: MissionStatus;
  waypoints: MissionWaypoint[];
  floorId?: number;
  campaignId?: number | null;
  isFreeRoam?: boolean;
  adMode?: string;
  estimatedDurationSeconds?: number | null;
  dispatchedAt?: string | null;
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

export interface ScanResult {
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
  interruptAdForMultiGuidance: (productItems: PlaylistItem[]) => Promise<void>;
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
  const adMode = valueOf<string>(raw, 'adMode', 'AdMode');
  const isFreeRoamExplicit = valueOf<boolean>(raw, 'isFreeRoam', 'IsFreeRoam');
  let isFreeRoam = false;
  if (flowType === 'ad') {
    if (isFreeRoamExplicit !== undefined) {
      isFreeRoam = Boolean(isFreeRoamExplicit);
    } else if (adMode === 'freeroam') {
      isFreeRoam = true;
    } else if (adMode === 'shelf') {
      isFreeRoam = false;
    } else {
      const allDwellsZero = rawWaypoints.length > 0 && rawWaypoints.every((item) => Number(valueOf(item, 'dwellTimeSeconds', 'DwellTimeSeconds') ?? 0) === 0 || String(valueOf(item, 'nodeRole', 'NodeRole', 'role', 'Role') ?? '').toLowerCase() === 'transit');
      isFreeRoam = allDwellsZero;
    }
  }

  const waypoints: MissionWaypoint[] = rawWaypoints.map((item) => {
    const rawPlaylist = valueOf<any[]>(item, 'playlist', 'Playlist') ?? [];
    const itemShelfId = valueOf<number>(item, 'shelfId', 'ShelfId');
    const itemShelfName = valueOf<string>(item, 'shelfName', 'ShelfName');
    const itemZoneName = valueOf<string>(item, 'zoneName', 'ZoneName');
    const itemAisleName = valueOf<string>(item, 'aisleName', 'AisleName');

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
      shelfId: valueOf<number>(p, 'shelfId', 'ShelfId') ?? itemShelfId,
      shelfName: valueOf<string>(p, 'shelfName', 'ShelfName') ?? itemShelfName,
      zoneName: valueOf<string>(p, 'zoneName', 'ZoneName') ?? itemZoneName,
      aisleName: valueOf<string>(p, 'aisleName', 'AisleName') ?? itemAisleName,
      adScore: valueOf<number>(p, 'adScore', 'AdScore', 'packageScore', 'PackageScore'),
      packageScore: valueOf<number>(p, 'packageScore', 'PackageScore', 'adScore', 'AdScore'),
      priority: valueOf<number>(p, 'priority', 'Priority'),
    }));

    return {
      nodeId: Number(valueOf(item, 'nodeId', 'NodeId') ?? 0),
      nodeName: String(valueOf(item, 'nodeName', 'NodeName') ?? ''),
      nodeRole: valueOf<string>(item, 'nodeRole', 'NodeRole', 'role', 'Role'),
      dwellTimeSeconds: Number(valueOf(item, 'dwellTimeSeconds', 'DwellTimeSeconds') ?? 0),
      zoneName: itemZoneName,
      aisleName: itemAisleName,
      shelfId: itemShelfId,
      shelfName: itemShelfName,
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
    isFreeRoam,
    adMode: isFreeRoam ? 'freeroam' : 'shelf',
    campaignId: valueOf<number>(raw, 'campaignId', 'CampaignId') ?? null,
    floorId: Number(valueOf<number>(raw, 'floorId', 'FloorId') ?? 1),
    estimatedDurationSeconds: valueOf<number>(raw, 'estimatedDurationSeconds', 'EstimatedDurationSeconds') ?? null,
    dispatchedAt: valueOf<string>(raw, 'dispatchedAt', 'DispatchedAt') ?? new Date().toISOString(),
  };
}

const matchRobot = (incoming?: string | null) => {
  if (!incoming) return false;
  const inc = incoming.toUpperCase();
  const cur = ROBOT_CODE.toUpperCase();
  return inc === cur
    || (inc === 'RB001' && cur === 'RB0001')
    || (inc === 'RB0001' && cur === 'RB001');
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
  const isMissionExpiringRef = useRef(false);
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
    const remainingNodeIds = remainingWaypoints.map((w) => w.nodeId).filter((id) => id > 0);
    const remainingShelfIds = remainingWaypoints.map((w) => w.shelfId).filter((id): id is number => typeof id === 'number' && id > 0);
    const isPerShelf = Boolean(!activeMission.isFreeRoam && (remainingShelfIds.length > 0 || activeMission.adMode === 'shelf'));

    const isFreeRoam = Boolean(activeMission.isFreeRoam);
    let remainingDurationMinutes: number | undefined = undefined;
    if (isFreeRoam) {
      const totalEstSec = activeMission.estimatedDurationSeconds || 180;
      const startedAtMs = activeMission.dispatchedAt ? new Date(activeMission.dispatchedAt).getTime() : Date.now() - 60000;
      const elapsedSec = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
      const remainingSec = Math.max(30, totalEstSec - elapsedSec);
      remainingDurationMinutes = Math.max(1, Math.ceil(remainingSec / 60));
    }

    // Khi free-roam: không lưu remainingNodeIds/remainingShelfIds để tránh backend nhận ra là per-shelf
    AdInterruptionService.saveInterruptedMission({
      originalMissionId: activeMission.missionId,
      robotCode: ROBOT_CODE,
      remainingNodeIds: isFreeRoam ? [] : remainingNodeIds,
      remainingShelfIds: isFreeRoam ? undefined : (remainingShelfIds.length > 0 ? remainingShelfIds : undefined),
      isPerShelfAd: isFreeRoam ? false : isPerShelf,
      isFreeRoam,
      floorId: 1,
      campaignId: (isFreeRoam || !isPerShelf) ? (activeMission.campaignId ?? null) : null,
      interruptedAtWaypointIndex: currentIdx,
      totalWaypoints: activeMission.waypoints.length,
      productName: productItem.productName || productItem.name,
      shelfName: activeWaypoint?.shelfName ?? undefined,
      durationMinutes: remainingDurationMinutes,
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
    Speech.speak(`Dạ vâng! Robot sẽ dẫn quý khách đến quầy bán ${pName}. Xin mời quý khách đi theo tôi!`, {
      language: 'vi-VN',
      rate: 0.9,
    });

    // 5. Điều hướng sang CartGuideMapScreen — screen đó sẽ tự gọi dispatchCart()
    //    thông qua RobotGuideContext để đảm bảo destinations được điền đúng.
    //    (Không thể gọi useRobotGuide() ở đây vì RobotMissionRuntimeProvider là
    //    provider cha của RobotGuideProvider trong cây component.)
    const pId    = productItem.productId || productItem.id || 0;
    const pImage = productItem.imageUrl || '';
    const pPrice = productItem.promotionPrice ?? productItem.unitPrice ?? productItem.productPrice ?? 0;
    try {
      router.push({
        pathname: '/cart-guide-map',
        params: {
          fromAd: '1',
          productId: String(pId),
          productName: pName,
          productImage: pImage,
          productPrice: String(pPrice),
          shelfName: productItem.shelfName || '',
          aisleName: productItem.aisleName || '',
        },
      } as any);
    } catch (navErr) {
      console.warn('[RobotMissionRuntime] router.push(/cart-guide-map) warning:', navErr);
    }
  }, [activeWaypoint, activeWaypointIndex, router]);

  const interruptAdForMultiGuidance = useCallback(async (selectedProducts: PlaylistItem[]) => {
    const activeMission = missionRef.current;
    if (!activeMission || activeMission.flowType !== 'ad' || selectedProducts.length === 0) return;

    console.log('[RobotMissionRuntime] Khách yêu cầu dẫn đường nhiều món từ quảng cáo:', selectedProducts.length);
    const resolvedIndex = activeWaypointIndex >= 0
      ? activeWaypointIndex
      : (activeWaypoint ? activeMission.waypoints.findIndex((w) => w.nodeId === activeWaypoint.nodeId) : -1);
    const currentIdx = resolvedIndex >= 0 ? resolvedIndex : 0;
    const remainingWaypoints = activeMission.waypoints.slice(currentIdx + 1);
    const remainingNodeIds = remainingWaypoints.map((w) => w.nodeId).filter((id) => id > 0);
    const remainingShelfIds = remainingWaypoints.map((w) => w.shelfId).filter((id): id is number => typeof id === 'number' && id > 0);
    const isPerShelf = Boolean(!activeMission.isFreeRoam && (remainingShelfIds.length > 0 || activeMission.adMode === 'shelf'));

    // 1. Lưu lộ trình quảng cáo bị tạm dừng vào AdInterruptionService
    AdInterruptionService.saveInterruptedMission({
      originalMissionId: activeMission.missionId,
      robotCode: ROBOT_CODE,
      remainingNodeIds: remainingNodeIds.length > 0 ? remainingNodeIds : activeMission.waypoints.map((w) => w.nodeId).filter((id) => id > 0),
      remainingShelfIds: remainingShelfIds.length > 0 ? remainingShelfIds : undefined,
      isPerShelfAd: isPerShelf,
      isFreeRoam: Boolean(activeMission.isFreeRoam),
      floorId: 1,
      campaignId: isPerShelf ? null : (activeMission.campaignId ?? null),
      interruptedAtWaypointIndex: currentIdx,
      totalWaypoints: activeMission.waypoints.length,
      productName: selectedProducts.map(p => p.productName || p.name).join(', '),
      shelfName: activeWaypoint?.shelfName ?? undefined,
      savedTimestamp: Date.now(),
    });

    // 2. Hủy mission ad hiện tại trên Backend để giải phóng trạng thái robot
    await fetch(`${API_BASE}/api/v1/navigation/robots/${ROBOT_CODE}/cancel?reason=${encodeURIComponent('Customer requested multi-product guidance from ads')}`, {
      method: 'POST',
      headers: { 'ngrok-skip-browser-warning': 'true' },
    }).catch(() => undefined);

    // 3. Tắt màn hình quảng cáo và dọn dẹp state ad
    setActivePlaylist([]);
    setMission(null);
    missionRef.current = null;

    // 4. Phát giọng nói chào đón và thông báo dẫn đường
    const pNames = selectedProducts.map(p => p.productName || p.name).filter(Boolean);
    const spokenNames = pNames.slice(0, 3).join(', ') + (pNames.length > 3 ? ' cùng các món khác' : '');
    Speech.speak(`Dạ vâng! Robot sẽ dẫn quý khách lần lượt đến quầy bán ${spokenNames} theo lộ trình tối ưu nhất. Xin mời quý khách đi theo tôi!`, {
      language: 'vi-VN',
      rate: 0.9,
    });

    // 5. Điều hướng sang CartGuideMapScreen — screen đó sẽ tự gọi dispatchCart()
    //    với danh sách sản phẩm qua RobotGuideContext.
    const validProducts = selectedProducts.filter(p => (p.productId || p.id || 0) > 0);
    const productIdsParam = validProducts.map(p => String(p.productId || p.id)).join(',');
    const productNamesParam = validProducts.map(p => p.productName || p.name || '').join('||');
    const productImagesParam = validProducts.map(p => p.imageUrl || '').join('||');
    const productPricesParam = validProducts.map(p => String(p.promotionPrice ?? p.unitPrice ?? p.productPrice ?? 0)).join(',');
    try {
      router.push({
        pathname: '/cart-guide-map',
        params: {
          fromAd: '1',
          productIds: productIdsParam,
          productNames: productNamesParam,
          productImages: productImagesParam,
          productPrices: productPricesParam,
        },
      } as any);
    } catch (navErr) {
      console.warn('[RobotMissionRuntime] router.push(/cart-guide-map) warning:', navErr);
    }
  }, [activeWaypoint, activeWaypointIndex, router]);

  const searchOtherProductFromAd = useCallback(async () => {
    const activeMission = missionRef.current;
    if (!activeMission) return;

    // 1. Dọn dẹp trạng thái quảng cáo cũ, không lưu hoãn để tránh tự động kích hoạt ad sau khi dẫn đường
    AdInterruptionService.clear();

    // 2. Hủy mission ad hiện tại trên Backend để giải phóng robot
    await fetch(`${API_BASE}/api/v1/navigation/robots/${ROBOT_CODE}/cancel?reason=${encodeURIComponent('Guest requested search for other products')}`, {
      method: 'POST',
      headers: { 'ngrok-skip-browser-warning': 'true' },
    }).catch(() => undefined);

    // 3. Đóng overlay quảng cáo
    setActivePlaylist([]);
    setMission(null);
    missionRef.current = null;

    // 4. Phát giọng nói hướng dẫn
    Speech.speak('Quý khách muốn tìm sản phẩm nào? Xin mời chọn hoặc tìm kiếm trên màn hình để robot dẫn đường nhé!', {
      language: 'vi-VN',
      rate: 0.9,
    });

    // 5. Mở màn hình tìm kiếm Kiosk
    try {
      router.push('/product-search' as any);
    } catch (err) {
      console.warn('[RobotMissionRuntime] router.push(/product-search) warning:', err);
    }
  }, [activeWaypointIndex, router]);

  const openPromotedProductsCatalog = useCallback(async (currentPlaylist?: PlaylistItem[]) => {
    const activeMission = missionRef.current;
    console.log('[RobotMissionRuntime] Khách mở danh mục sản phẩm quảng cáo');

    // 1. Dừng ngay lập tức toàn bộ giọng nói TTS
    VoiceService.stop();
    Speech.stop();

    const resolvedIndex = activeWaypointIndex >= 0
      ? activeWaypointIndex
      : (activeWaypoint ? activeMission?.waypoints?.findIndex((w) => w.nodeId === activeWaypoint.nodeId) ?? 0 : 0);
    const currentIdx = resolvedIndex >= 0 ? resolvedIndex : 0;
    const currentWp = activeWaypoint || activeMission?.waypoints?.[currentIdx];

    const isPerShelf = Boolean(
      activeMission &&
      !activeMission.isFreeRoam &&
      (activeMission.adMode === 'shelf' || currentWp?.shelfId)
    );

    // 2. Lưu playlist và trạng thái nhiệm vụ dở dang
    // Nếu là quảng cáo theo kệ: CHỈ lưu playlist của kệ hiện tại, KHÔNG flatMap toàn siêu thị
    let playlistToCache: PlaylistItem[] = [];
    if (isPerShelf) {
      if (currentPlaylist && currentPlaylist.length > 0) {
        playlistToCache = currentPlaylist;
      } else if (currentWp?.playlist && currentWp.playlist.length > 0) {
        playlistToCache = currentWp.playlist;
      } else if (activePlaylist && activePlaylist.length > 0) {
        const sid = currentWp?.shelfId;
        const filtered = sid ? activePlaylist.filter((p) => p.shelfId === sid) : [];
        playlistToCache = filtered.length > 0 ? filtered : activePlaylist;
      }
    } else {
      if (currentPlaylist && currentPlaylist.length > 0) {
        playlistToCache = currentPlaylist;
      } else if (activePlaylist && activePlaylist.length > 0) {
        playlistToCache = activePlaylist;
      } else {
        playlistToCache = activeMission?.waypoints?.flatMap((w) => w.playlist || []) ?? [];
      }
    }

    if (playlistToCache.length > 0) {
      AdInterruptionService.setCachedAdPlaylist(playlistToCache);
    }

    if (activeMission && activeMission.flowType === 'ad') {
      const remainingWaypoints = activeMission.waypoints.slice(currentIdx);
      const remainingNodeIds = remainingWaypoints.map((w) => w.nodeId).filter((id) => id > 0);
      const remainingShelfIds = remainingWaypoints.map((w) => w.shelfId).filter((id): id is number => typeof id === 'number' && id > 0);

      const durMinutes = (activeMission as any).durationMinutes ?? (activeMission.estimatedDurationSeconds ? Math.ceil(activeMission.estimatedDurationSeconds / 60) : undefined);
      AdInterruptionService.saveInterruptedMission({
        originalMissionId: activeMission.missionId,
        robotCode: ROBOT_CODE,
        remainingNodeIds: remainingNodeIds.length > 0 ? remainingNodeIds : activeMission.waypoints.map((w) => w.nodeId).filter((id) => id > 0),
        remainingShelfIds: remainingShelfIds.length > 0 ? remainingShelfIds : undefined,
        currentShelfId: (currentWp?.shelfId && currentWp.shelfId > 0) ? currentWp.shelfId : undefined,
        currentShelfName: currentWp?.shelfName || currentWp?.nodeName || undefined,
        isPerShelfAd: isPerShelf,
        isFreeRoam: Boolean(activeMission.isFreeRoam),
        floorId: activeMission.floorId ?? 1,
        campaignId: isPerShelf ? null : (activeMission.campaignId ?? null),
        interruptedAtWaypointIndex: currentIdx,
        totalWaypoints: activeMission.waypoints.length,
        durationMinutes: durMinutes,
        estimatedDurationSeconds: activeMission.estimatedDurationSeconds ?? undefined,
        savedTimestamp: Date.now(),
      });

      // 3. Tạm dừng di chuyển robot trên Backend để robot đứng yên chờ khách thao tác
      fetch(`${API_BASE}/api/v1/navigation/robots/${ROBOT_CODE}/pause?reason=${encodeURIComponent('Customer viewing promoted products')}`, {
        method: 'POST',
        headers: { 'ngrok-skip-browser-warning': 'true' },
      }).catch(() => undefined);
    }

    // 4. Giữ nguyên mission state để Ad Session Timer & SignalR listener tiếp tục theo dõi,
    // chỉ làm rỗng activePlaylist tạm thời để nhường toàn bộ giao diện cho catalog screen.
    setActivePlaylist([]);

    // 5. Điều hướng tức thì sang màn hình danh mục tất cả sản phẩm khuyến mãi
    try {
      router.push('/ad-multi-select' as any);
    } catch (e) {
      console.warn('[RobotMissionRuntime] router.push(/ad-multi-select) failed:', e);
    }
  }, [activePlaylist, activeWaypoint, activeWaypointIndex, router]);

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
    console.log('[RobotMissionRuntime] Đã nhận nhiệm vụ:', normalized.missionId, normalized.flowType, 'isFreeRoam:', normalized.isFreeRoam);
    missionRef.current = normalized;
    setMission(normalized);
    setStatus(normalized.status);
    setPendingScans(0);
    setCompletedScans(0);
    setFailedScans(0);
    setLastScan(null);
    capturedKeys.current.clear();

    if (normalized.flowType === 'ad') {
      let initialPlaylist: PlaylistItem[] = [];

      if (!normalized.isFreeRoam) {
        // Quảng cáo theo kệ: Chỉ lấy danh sách sản phẩm của kệ đích đầu tiên
        const firstWp = normalized.waypoints[0];
        initialPlaylist = firstWp?.playlist ?? [];
        console.log(`[RobotMissionRuntime] Kích hoạt phát quảng cáo theo kệ (${firstWp?.shelfName || 'Kệ #' + firstWp?.shelfId}):`, initialPlaylist.length, 'sản phẩm');
      } else {
        // Quảng cáo tự do (free-roam): Tổng hợp tất cả các điểm trên lộ trình tuần tra
        const allWaypointsPlaylist = normalized.waypoints.flatMap((w) => w.playlist || []);
        const seen = new Set<string | number>();
        const dedupedPlaylist: any[] = [];
        for (const item of allWaypointsPlaylist) {
          const key = item.productId || item.id || item.sponsoredId || item.productName;
          if (key && !seen.has(key)) {
            seen.add(key);
            dedupedPlaylist.push(item);
          }
        }
        dedupedPlaylist.sort((a, b) => {
          const scoreA = Number(a.adScore ?? a.packageScore ?? 0);
          const scoreB = Number(b.adScore ?? b.packageScore ?? 0);
          if (scoreB !== scoreA) return scoreB - scoreA;
          const prioA = Number(a.priority ?? 0);
          const prioB = Number(b.priority ?? 0);
          return prioB - prioA;
        });

        initialPlaylist = dedupedPlaylist.length > 0
          ? dedupedPlaylist
          : (normalized.waypoints.find((w) => w.playlist && w.playlist.length > 0)?.playlist ?? []);
        console.log(`[RobotMissionRuntime] Kích hoạt phát quảng cáo tự do (${normalized.adMode}):`, initialPlaylist.length, 'sản phẩm ưu tiên');
      }

      if (initialPlaylist.length > 0) {
        AdInterruptionService.setCachedAdPlaylist(initialPlaylist);
        setActivePlaylist(initialPlaylist);
        if (normalized.waypoints.length > 0) {
          setActiveWaypoint(normalized.waypoints[0]);
          setActiveWaypointIndex(0);
        }
      } else {
        setActivePlaylist([]);
      }
    } else {
      setActivePlaylist([]);
    }
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
      if (['ARRIVED', 'PLAYLIST_PLAYING'].includes(nextStatus) && waypoint) {
        const role = String(valueOf(payload, 'role', 'Role') ?? waypoint.nodeRole ?? '').toLowerCase();
        if (activeMission.flowType === 'patrol' && (role === 'photo' || role === 'scan')) {
          Speech.speak(`Đã đến ${waypoint.shelfName || waypoint.nodeName}. Đang tiến hành quét phân tích kệ hàng.`, { language: 'vi-VN', rate: 0.9 });
        }
        if (activeMission.flowType === 'ad') {
          const statusPlaylist = valueOf<PlaylistItem[]>(payload, 'playlist', 'Playlist');
          const playlist = statusPlaylist?.length ? statusPlaylist : (waypoint.playlist?.length ? waypoint.playlist : (AdInterruptionService.getCachedAdPlaylist() ?? []));

          if (playlist.length > 0) {
            setActivePlaylist(playlist);
          }
        }
      }

      if (['MOVING', 'NAVIGATING'].includes(nextStatus)) {
        if (activeMission.flowType === 'ad') {
          // Khi robot di chuyển: luôn đảm bảo có playlist để phát sóng liên tục trên tablet
          const upcomingPlaylist = waypoint?.playlist?.length
            ? waypoint.playlist
            : (activeMission.waypoints.find((w) => w.playlist && w.playlist.length > 0)?.playlist ?? AdInterruptionService.getCachedAdPlaylist() ?? []);
          if (upcomingPlaylist.length > 0) {
            setActivePlaylist((prev) => (prev.length > 0 ? prev : upcomingPlaylist));
          }
        }
      }
      if (['WAYPOINT_COMPLETED'].includes(nextStatus)) {
        setLastScan(null);
      }
      if (['COMPLETED', 'FAILED', 'CANCELLED', 'ESTOP', 'WAYPOINT_FAILED'].includes(nextStatus)) {
        const isAdFlow = activeMission.flowType === 'ad';
        const isFreeRoamAd = isAdFlow && activeMission.isFreeRoam;
        const totalWps = activeMission.waypoints?.length ?? 0;
        const isIntermediateWaypoint = waypointIndex >= 0 && waypointIndex < totalWps - 1;

        // Nếu là lỗi cục bộ tại 1 waypoint của Free Roam Ad hoặc lộ trình nhiều waypoint:
        // Tiếp tục duy trì phát quảng cáo & không hủy nhiệm vụ
        if ((nextStatus === 'FAILED' || nextStatus === 'WAYPOINT_FAILED') && (isFreeRoamAd || isIntermediateWaypoint)) {
          console.log(`[RobotMissionRuntime] Bỏ qua ${nextStatus} tại waypoint ${waypointIndex} (tiếp tục duy trì nhiệm vụ & phát quảng cáo).`);
          const cached = AdInterruptionService.getCachedAdPlaylist() ?? [];
          if (cached.length > 0) {
            setActivePlaylist((prev) => prev.length > 0 ? prev : cached);
          }
          return;
        }

        if (nextStatus === 'COMPLETED') {
          if (isAdFlow) {
            console.log('[RobotMissionRuntime] Nhiệm vụ quảng cáo đã hoàn thành tất cả các điểm.');
            void VoiceService.speak('Nhiệm vụ quảng cáo đã hoàn tất. Robot chuẩn bị quay về trạm sạc.');
            // Giữ màn hình quảng cáo thêm 5 giây để khách hàng kịp xem/tương tác nốt, sau đó mới quay về trạm
            setTimeout(() => {
              setActivePlaylist([]);
              setMission(null);
              missionRef.current = null;
              AdInterruptionService.clear();
              try { router.replace('/' as any); } catch {}
              void RobotControlService.dispatchAutonomous({ robotCode: ROBOT_CODE, flowType: 'return', nodeIds: [7], floorId: 1 });
            }, 5000);
            return;
          } else if (activeMission.flowType === 'patrol') {
            void VoiceService.speak('Tuần tra toàn bộ siêu thị hoàn tất. Robot đang quay về trạm sạc.');
            setActivePlaylist([]);
            setLastScan(null);
            setMission(null);
            missionRef.current = null;
            AdInterruptionService.clear();
            try { router.replace('/' as any); } catch {}
            void RobotControlService.dispatchAutonomous({ robotCode: ROBOT_CODE, flowType: 'return', nodeIds: [7], floorId: 1 });
            return;
          }
        }
        if (nextStatus === 'CANCELLED') {
          const cancelReason = String(valueOf(payload, 'error', 'Error') ?? valueOf(payload, 'reason', 'Reason') ?? '');
          const isInterruptedForGuide = AdInterruptionService.hasInterruptedMission() ||
            cancelReason.toLowerCase().includes('guidance') ||
            cancelReason.toLowerCase().includes('search') ||
            cancelReason.toLowerCase().includes('guide');
          const isTimerExpired = cancelReason.toLowerCase().includes('expired') || isMissionExpiringRef.current;

          console.log(`[RobotMissionRuntime] Nhận trạng thái CANCELLED (reason: "${cancelReason}"). Dọn dẹp nhiệm vụ.`);
          if (!isInterruptedForGuide && !isTimerExpired) {
            void VoiceService.speak('Đã dừng nhiệm vụ.');
          }
          setActivePlaylist([]);
          setLastScan(null);
          setMission(null);
          missionRef.current = null;
          if (!isInterruptedForGuide) {
            AdInterruptionService.clear();
            try { router.replace('/' as any); } catch {}
          }
        }
        if (nextStatus === 'ESTOP') {
          void VoiceService.speak('Dừng khẩn cấp.');
          setActivePlaylist([]);
          setLastScan(null);
          setMission(null);
          missionRef.current = null;
          AdInterruptionService.clear();
          try { router.replace('/' as any); } catch {}
        }
        if (pendingScansRef.current === 0 && !isAdFlow) {
          missionRef.current = null;
        }
      }
    });
  }, [captureAtWaypoint, subscribeNavigationStatus]);

  useEffect(() => {
    if (!API_BASE) return;
    const report = async () => {
      try {
        const bat = await BatteryService.getBatteryInfo();
        // 1. Gửi Heartbeat
        fetch(`${API_BASE}/api/v1/robot-operations/devices/${ROBOT_CODE}/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
          body: JSON.stringify({
            cameraReady: permission?.granted === true,
            adPlayerReady: true,
            isForeground: appState === 'active',
            appVersion: 'android-robot-1.0.0',
            deviceBattery: bat.batteryPct,
            isCharging: bat.isCharging,
          }),
        }).catch(() => undefined);

        // 2. Cập nhật Device Battery lên Backend
        fetch(`${API_BASE}/api/v1/robots/${ROBOT_CODE}/device-battery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
          body: JSON.stringify({
            batteryPct: bat.batteryPct,
            isCharging: bat.isCharging,
          }),
        }).catch(() => undefined);
      } catch {}
    };
    void report();
    const timer = setInterval(report, 10_000);
    return () => clearInterval(timer);
  }, [appState, permission?.granted]);

  // ── Auto-expire Ad Session Timer ──────────────────────────────────────────
  // Khi mission quảng cáo có estimatedDurationSeconds được đặt (từ BE/web admin),
  // robot app sẽ đồng bộ hết giờ và tự động quay về trạm sạc (node 7).
  useEffect(() => {
    const activeMission = mission;
    if (!activeMission || activeMission.flowType !== 'ad') return;
    const durSec = activeMission.estimatedDurationSeconds;
    if (!durSec || durSec <= 0) return;

    // Không đếm thời gian hết hạn khi robot đang tạm dừng (PAUSED) hoặc đang bị gián đoạn dẫn đường
    if (status === 'PAUSED' || status === 'IDLE' || AdInterruptionService.hasInterruptedMission()) {
      return;
    }

    const dispatchedMs = activeMission.dispatchedAt
      ? new Date(activeMission.dispatchedAt).getTime()
      : Date.now();

    const elapsedMs = Date.now() - dispatchedMs;
    const remainingMs = Math.max(0, durSec * 1000 - elapsedMs);

    if (remainingMs <= 0) {
      // Đã hết giờ ngay khi nhận mission (edge case) - hủy và về trạm
      console.log('[RobotMissionRuntime] Ad session đã hết giờ ngay khi nhận, quay về trạm sạc.');
      void VoiceService.speak('Phiên quảng cáo đã kết thúc. Robot đang quay về trạm sạc.');
      setTimeout(() => {
        setActivePlaylist([]);
        setMission(null);
        missionRef.current = null;
        void RobotControlService.dispatchAutonomous({ robotCode: ROBOT_CODE, flowType: 'return', nodeIds: [7], floorId: 1 });
      }, 2000);
      return;
    }

    console.log(`[RobotMissionRuntime] Ad session timer: ${Math.round(remainingMs / 1000)}s còn lại (total: ${durSec}s). Sẽ tự kết thúc và quay về trạm.`);

    const timer = setTimeout(() => {
      const stillActive = missionRef.current;
      if (!stillActive || stillActive.missionId !== activeMission.missionId) return;
      if (stillActive.flowType !== 'ad') return;

      console.log('[RobotMissionRuntime] ⏰ Ad session hết giờ theo estimatedDurationSeconds. Đóng quảng cáo, hủy mission và quay về trạm sạc.');
      isMissionExpiringRef.current = true;
      void VoiceService.speak('Phiên quảng cáo đã kết thúc. Cảm ơn quý khách! Robot đang quay về trạm sạc.');

      // 1. Đóng ngay overlay quảng cáo để đưa robot về màn hình chờ
      setActivePlaylist([]);
      setMission(null);
      missionRef.current = null;
      AdInterruptionService.clear();
      try { router.replace('/' as any); } catch {}

      // 2. Hủy mission trên backend
      fetch(`${API_BASE}/api/v1/navigation/robots/${ROBOT_CODE}/cancel?reason=${encodeURIComponent('Ad session expired by duration timer')}`, {
        method: 'POST',
        headers: { 'ngrok-skip-browser-warning': 'true' },
      }).catch(() => undefined);

      // 3. Chờ 3 giây cho giọng nói kết thúc rồi điều hướng robot về trạm sạc Wp7
      setTimeout(() => {
        isMissionExpiringRef.current = false;
        void RobotControlService.dispatchAutonomous({ robotCode: ROBOT_CODE, flowType: 'return', nodeIds: [7], floorId: 1 });
      }, 3000);
    }, remainingMs);

    return () => clearTimeout(timer);
  }, [mission?.missionId, mission?.estimatedDurationSeconds, status]);

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
    interruptAdForMultiGuidance,
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
    interruptAdForMultiGuidance,
  ]);

  return (
    <RuntimeContext.Provider value={value}>
      {children}
      <PatrolMissionOverlay
        mission={mission}
        status={status}
        activeWaypoint={activeWaypoint}
        activeWaypointIndex={activeWaypointIndex}
        pendingScans={pendingScans}
        completedScans={completedScans}
        failedScans={failedScans}
        lastScan={lastScan}
        onResumeNext={resumeToNextWaypoint}
        onDismiss={() => {
          if (mission && API_BASE) {
            void fetch(`${API_BASE}/api/v1/navigation/robots/${ROBOT_CODE}/cancel?reason=Staff%20stopped%20patrol%20on%20tablet`, {
              method: 'POST',
              headers: { 'ngrok-skip-browser-warning': 'true' },
            });
          }
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
        onSearchOther={searchOtherProductFromAd}
        onOpenCatalog={(passedPlaylist) => {
          void openPromotedProductsCatalog(passedPlaylist || activePlaylist);
        }}
        onDismiss={() => {
          VoiceService.stop();
          Speech.stop();
        }}
      />
    </RuntimeContext.Provider>
  );
}


export function useRobotMissionRuntime() {
  const value = useContext(RuntimeContext);
  if (!value) throw new Error('useRobotMissionRuntime must be used inside RobotMissionRuntimeProvider');
  return value;
}
