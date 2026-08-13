import * as SignalR from '@microsoft/signalr';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Speech from 'expo-speech';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, {
  createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ActivityIndicator, AppState, AppStateStatus, Modal, StyleSheet, Text, View,
} from 'react-native';

const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
const ROBOT_CODE = process.env.EXPO_PUBLIC_ROBOT_CODE ?? 'RB001';
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
  effectiveDwellTimeSeconds?: number;
  playlist?: PlaylistItem[] | null;
}

interface RobotMission {
  robotCode: string;
  missionId: string;
  flowType: MissionFlow;
  status: MissionStatus;
  currentWaypointIndex?: number | null;
  waypoints: MissionWaypoint[];
}

interface NavigationStatusPayload {
  robotCode?: string;
  missionId?: string | null;
  navStatus?: string;
  waypointIndex?: number | null;
  nodeId?: number | null;
  role?: string | null;
  playlist?: PlaylistItem[] | null;
  error?: string | null;
}

interface ScanResult {
  nodeId: number;
  shelfName?: string;
  occupancyRatePct?: number;
  emptySlotCount?: number;
  needsRestock?: boolean;
  analysisStatus?: string;
  errorMessage?: string | null;
  imageUrl?: string | null;
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

function valueOf<T>(source: any, camel: string, pascal: string): T | undefined {
  return source?.[camel] ?? source?.[pascal];
}

function normalizeMission(payload: any): RobotMission | null {
  const flow = String(valueOf(payload, 'flowType', 'FlowType') ?? '').toLowerCase();
  if (flow !== 'patrol' && flow !== 'ad') return null;
  const missionId = valueOf<string>(payload, 'missionId', 'MissionId');
  const robotCode = valueOf<string>(payload, 'robotCode', 'RobotCode');
  if (!missionId || !robotCode) return null;
  const rawWaypoints = valueOf<any[]>(payload, 'waypoints', 'Waypoints') ?? [];
  return {
    robotCode,
    missionId,
    flowType: flow,
    status: String(valueOf(payload, 'status', 'Status') ?? 'DISPATCHED').toUpperCase() as MissionStatus,
    currentWaypointIndex: valueOf(payload, 'currentWaypointIndex', 'CurrentWaypointIndex'),
    waypoints: rawWaypoints.map((waypoint) => ({
      nodeId: Number(valueOf(waypoint, 'nodeId', 'NodeId')),
      nodeName: valueOf(waypoint, 'nodeName', 'NodeName') ?? 'Waypoint',
      nodeRole: valueOf(waypoint, 'nodeRole', 'NodeRole'),
      zoneName: valueOf(waypoint, 'zoneName', 'ZoneName'),
      aisleName: valueOf(waypoint, 'aisleName', 'AisleName'),
      shelfName: valueOf(waypoint, 'shelfName', 'ShelfName'),
      effectiveDwellTimeSeconds: valueOf(waypoint, 'effectiveDwellTimeSeconds', 'EffectiveDwellTimeSeconds'),
      playlist: valueOf(waypoint, 'playlist', 'Playlist'),
    })),
  };
}

export function RobotMissionRuntimeProvider({ children }: { children: ReactNode }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [mission, setMission] = useState<RobotMission | null>(null);
  const [status, setStatus] = useState<MissionStatus>('IDLE');
  const [hubConnected, setHubConnected] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [cameraMounted, setCameraMounted] = useState(false);
  const [pendingScans, setPendingScans] = useState(0);
  const [completedScans, setCompletedScans] = useState(0);
  const [failedScans, setFailedScans] = useState(0);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [activePlaylist, setActivePlaylist] = useState<PlaylistItem[]>([]);
  const [activeWaypoint, setActiveWaypoint] = useState<MissionWaypoint | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const missionRef = useRef<RobotMission | null>(null);
  const capturedKeys = useRef(new Set<string>());
  const queueRef = useRef<Promise<void>>(Promise.resolve());
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
    if (!normalized || normalized.robotCode.toUpperCase() !== ROBOT_CODE.toUpperCase()) return;
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
      setLastScan(result);
      setCompletedScans((count) => count + 1);
    } catch (error) {
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
    capturedKeys.current.add(key);

    for (let attempt = 0; attempt < 10 && (!cameraRef.current || !cameraMounted); attempt += 1)
      await new Promise((resolve) => setTimeout(resolve, 300));
    if (!cameraRef.current || !permission?.granted) {
      setFailedScans((count) => count + 1);
      setLastScan({ nodeId: waypoint.nodeId, shelfName: waypoint.shelfName ?? undefined, analysisStatus: 'Failed', errorMessage: 'Camera sau chưa sẵn sàng.' });
      return;
    }

    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.75, skipProcessing: false });
      if (!picture?.uri) throw new Error('Camera không trả ảnh.');
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
    if (!API_BASE) return;
    let mounted = true;
    const connection = new SignalR.HubConnectionBuilder()
      .withUrl(`${API_BASE}/hubs/robot`, { headers: { 'ngrok-skip-browser-warning': 'true' } })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(SignalR.LogLevel.Warning)
      .build();

    const joinAndRecover = async () => {
      await connection.invoke('JoinRobotGroup', ROBOT_CODE);
      const response = await fetch(`${API_BASE}/api/v1/robot-operations/missions/${ROBOT_CODE}/active`, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      if (response.ok) acceptMission(await response.json());
    };

    connection.on('missionAssigned', acceptMission);
    connection.on('navigationStatus', (payload: NavigationStatusPayload) => {
      const incomingRobot = valueOf<string>(payload, 'robotCode', 'RobotCode');
      const incomingMission = valueOf<string>(payload, 'missionId', 'MissionId');
      const activeMission = missionRef.current;
      if (!activeMission || incomingRobot?.toUpperCase() !== ROBOT_CODE.toUpperCase()
          || incomingMission !== activeMission.missionId) return;

      const nextStatus = String(valueOf(payload, 'navStatus', 'NavStatus') ?? '').toUpperCase() as MissionStatus;
      setStatus(nextStatus);
      setMission((current) => current ? { ...current, status: nextStatus } : current);
      const waypointIndex = Number(valueOf(payload, 'waypointIndex', 'WaypointIndex') ?? -1);
      const nodeId = Number(valueOf(payload, 'nodeId', 'NodeId') ?? -1);
      const waypoint = activeMission.waypoints[waypointIndex]
        ?? activeMission.waypoints.find((item) => item.nodeId === nodeId);

      if (waypoint) setActiveWaypoint(waypoint);
      if (nextStatus === 'ARRIVED' && waypoint) {
        const role = String(valueOf(payload, 'role', 'Role') ?? waypoint.nodeRole ?? '').toLowerCase();
        if (activeMission.flowType === 'patrol' && role === 'photo') {
          Speech.speak(`Đang quét ${waypoint.shelfName || waypoint.nodeName}.`, { language: 'vi-VN', rate: 0.9 });
          void captureAtWaypoint(activeMission, waypoint, waypointIndex);
        }
        if (activeMission.flowType === 'ad' && role === 'ad') {
          const statusPlaylist = valueOf<PlaylistItem[]>(payload, 'playlist', 'Playlist');
          setActivePlaylist(statusPlaylist?.length ? statusPlaylist : waypoint.playlist ?? []);
        }
      }
      if (['MOVING', 'WAYPOINT_COMPLETED', 'PLAYLIST_COMPLETE'].includes(nextStatus))
        setActivePlaylist([]);
      if (['COMPLETED', 'FAILED', 'CANCELLED', 'ESTOP'].includes(nextStatus)) {
        setActivePlaylist([]);
        if (nextStatus !== 'COMPLETED' || pendingScansRef.current === 0) {
          missionRef.current = null;
        }
      }
    });
    connection.onreconnecting(() => mounted && setHubConnected(false));
    connection.onreconnected(async () => {
      if (!mounted) return;
      setHubConnected(true);
      await joinAndRecover().catch(() => undefined);
    });
    connection.onclose(() => mounted && setHubConnected(false));
    connection.start().then(async () => {
      if (!mounted) return;
      setHubConnected(true);
      await joinAndRecover();
    }).catch((error) => console.warn('[RobotMissionRuntime] SignalR failed', error));

    return () => {
      mounted = false;
      connection.off('missionAssigned');
      connection.off('navigationStatus');
      connection.stop().catch(() => undefined);
    };
  }, [acceptMission, captureAtWaypoint]);

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
        onCameraReady={() => setCameraMounted(true)}
      />
    </RuntimeContext.Provider>
  );
}

function MissionOverlay({
  mission, status, activeWaypoint, activePlaylist, pendingScans, completedScans, failedScans,
  lastScan, cameraRef, cameraPermission, onCameraReady,
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
  onCameraReady: () => void;
}) {
  if (!mission || !['patrol', 'ad'].includes(mission.flowType)) return null;
  const missionEnded = ['COMPLETED', 'FAILED', 'CANCELLED', 'ESTOP'].includes(status);
  const visible = !missionEnded || pendingScans > 0;
  if (!visible) return null;

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <View style={styles.root}>
        {mission.flowType === 'patrol' ? (
          <>
            {cameraPermission
              ? <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" onCameraReady={onCameraReady} />
              : <View style={styles.center}><Text style={styles.error}>Camera chưa được cấp quyền</Text></View>}
            <View style={styles.scrim} />
            <View style={styles.header}>
              <Text style={styles.eyebrow}>AI VISION PATROL · {ROBOT_CODE}</Text>
              <Text style={styles.title}>{activeWaypoint?.shelfName || activeWaypoint?.nodeName || 'Đang tới kệ tiếp theo'}</Text>
              <Text style={styles.subtitle}>{activeWaypoint?.zoneName} {activeWaypoint?.aisleName ? `· ${activeWaypoint.aisleName}` : ''}</Text>
            </View>
            <View style={styles.footer}>
              <View style={styles.metrics}>
                <Metric label="Đã quét" value={completedScans} />
                <Metric label="Đang xử lý" value={pendingScans} />
                <Metric label="Lỗi" value={failedScans} danger={failedScans > 0} />
              </View>
              <Text style={styles.status}>{status === 'ARRIVED' ? 'Đang chụp và phân tích kệ…' : `Robot: ${status}`}</Text>
              {lastScan && (
                <View style={[styles.result, lastScan.needsRestock && styles.resultWarning]}>
                  <Text style={styles.resultTitle}>{lastScan.analysisStatus === 'Failed' ? 'Không phân tích được' : lastScan.needsRestock ? 'Cần nhập hàng' : 'Kệ đạt yêu cầu'}</Text>
                  {lastScan.analysisStatus !== 'Failed' && <Text style={styles.resultText}>Còn {lastScan.occupancyRatePct}% · {lastScan.emptySlotCount} vị trí trống</Text>}
                  {lastScan.errorMessage && <Text style={styles.error}>{lastScan.errorMessage}</Text>}
                </View>
              )}
            </View>
          </>
        ) : (
          <View style={styles.adRoot}>
            {activePlaylist.length > 0
              ? <AdCarousel playlist={activePlaylist} />
              : <View style={styles.center}><ActivityIndicator size="large" color="#34d399" /><Text style={styles.adWaiting}>Đang di chuyển tới trạm quảng cáo…</Text></View>}
            <View style={styles.adBadge}><Text style={styles.adBadgeText}>{activeWaypoint?.zoneName || 'SmartMarketBot'} · {status}</Text></View>
          </View>
        )}
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
  scrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(3,10,22,0.38)' },
  header: { position: 'absolute', left: 28, right: 28, top: 44, padding: 22, borderRadius: 22, backgroundColor: 'rgba(4,14,29,0.78)' },
  eyebrow: { color: '#6ee7b7', fontWeight: '900', letterSpacing: 1.5, fontSize: 13 },
  title: { color: 'white', fontSize: 30, fontWeight: '900', marginTop: 8 },
  subtitle: { color: '#cbd5e1', fontSize: 16, marginTop: 5 },
  footer: { position: 'absolute', left: 28, right: 28, bottom: 34, padding: 22, borderRadius: 22, backgroundColor: 'rgba(4,14,29,0.9)' },
  metrics: { flexDirection: 'row', gap: 12 },
  metric: { flex: 1, padding: 13, borderRadius: 15, backgroundColor: '#122238', alignItems: 'center' },
  metricValue: { color: '#6ee7b7', fontSize: 26, fontWeight: '900' },
  metricLabel: { color: '#94a3b8', fontSize: 12 },
  status: { color: 'white', fontSize: 16, fontWeight: '700', marginTop: 16 },
  result: { marginTop: 14, padding: 15, backgroundColor: '#064e3b', borderRadius: 14 },
  resultWarning: { backgroundColor: '#7c2d12' },
  resultTitle: { color: 'white', fontWeight: '900', fontSize: 17 },
  resultText: { color: '#e2e8f0', marginTop: 4 },
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
