import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
import { RobotControlService } from '../services/RobotControlService';
import { ROBOT_CODE, useRobotRealtime } from './RobotRealtimeContext';

const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
const RESPONSE_TIMEOUT_MS = 20_000;

export type GuideStatus =
  | 'IDLE' | 'DISPATCHING' | 'NAVIGATING' | 'MOVING' | 'ARRIVED'
  | 'PAUSED' | 'RESUMED' | 'WAYPOINT_COMPLETED' | 'COMPLETED'
  | 'FAILED' | 'CANCELLED' | 'ESTOP' | 'TIMEOUT';

export interface GuideDestination {
  nodeId: number;
  nodeName: string;
  xCoord: number;
  yCoord: number;
  headingYaw?: number | null;
  zoneName?: string | null;
  aisleName?: string | null;
  shelfName?: string | null;
  productNames?: string[] | null;
}

export interface GuideRobotPose {
  x: number;
  y: number;
  headingRad: number | null;
  timestampUtc: string | null;
}

interface NavigationStatusPayload {
  robotCode?: string;
  navStatus?: string;
  missionId?: string | null;
  currentWaypoint?: string | null;
  nodeId?: number | null;
  waypointIndex?: number | null;
  error?: string | null;
}

interface RobotGuideContextValue {
  status: GuideStatus;
  missionId: string | null;
  productName: string | null;
  destination: GuideDestination | null;
  destinations: GuideDestination[];
  currentWaypointIndex: number;
  robotPose: GuideRobotPose | null;
  error: string | null;
  awaitingPickup: boolean;
  isBusy: boolean;
  isHubConnected: boolean;
  dispatchCart: (items: { productId: number; productName: string }[]) => Promise<any>;
  confirmPickup: () => Promise<void>;
  cancelGuide: () => Promise<void>;
}

const RobotGuideContext = createContext<RobotGuideContextValue | null>(null);

const newMissionId = () =>
  `guide-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export function RobotGuideProvider({ children }: { children: ReactNode }) {
  const { isConnected: isHubConnected, subscribeMissionAssigned, subscribeNavigationStatus, subscribeTelemetry } = useRobotRealtime();
  const [status, setStatus] = useState<GuideStatus>('IDLE');
  const [missionId, setMissionId] = useState<string | null>(null);
  const [productName, setProductName] = useState<string | null>(null);
  const [destination, setDestination] = useState<GuideDestination | null>(null);
  const [destinations, setDestinations] = useState<GuideDestination[]>([]);
  const [currentWaypointIndex, setCurrentWaypointIndex] = useState(0);
  const [robotPose, setRobotPose] = useState<GuideRobotPose | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [awaitingPickup, setAwaitingPickup] = useState(false);
  const missionRef = useRef<string | null>(null);
  const acknowledgedMissionRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destinationRef = useRef<GuideDestination | null>(null);
  const destinationsRef = useRef<GuideDestination[]>([]);
  const awaitingPickupRef = useRef(false);
  const currentWaypointIndexRef = useRef(0);

  const normalizeDestinations = useCallback((raw: any[]): GuideDestination[] => raw
    .map((item) => ({
      ...item,
      nodeId: Number(item?.nodeId ?? item?.NodeId ?? item?.id ?? item?.Id),
      nodeName: String(item?.nodeName ?? item?.NodeName ?? item?.name ?? item?.Name ?? 'Điểm lấy hàng'),
      xCoord: Number(item?.xCoord ?? item?.XCoord ?? item?.x ?? item?.X),
      yCoord: Number(item?.yCoord ?? item?.YCoord ?? item?.y ?? item?.Y),
      headingYaw: item?.headingYaw ?? item?.HeadingYaw ?? item?.yaw ?? item?.Yaw ?? null,
      zoneName: item?.zoneName ?? item?.ZoneName ?? null,
      aisleName: item?.aisleName ?? item?.AisleName ?? null,
      shelfName: item?.shelfName ?? item?.ShelfName ?? null,
      productNames: item?.productNames ?? item?.ProductNames ?? null,
    }))
    .filter((item) => Number.isFinite(item.nodeId) && Number.isFinite(item.xCoord) && Number.isFinite(item.yCoord)), []);

  const clearTimeoutGuard = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  useEffect(() => {
    let active = true;
    const recoverMission = async () => {
      if (!API_BASE) return;
      try {
        const response = await fetch(`${API_BASE}/api/v1/robot-operations/missions/${ROBOT_CODE}/active`, {
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });
        if (response.ok && active) {
          const assignedMission = await response.json();
          const flowType = String(assignedMission?.flowType ?? assignedMission?.FlowType ?? '').toLowerCase();
          const incomingRobot = String(assignedMission?.robotCode ?? assignedMission?.RobotCode ?? '');
          const incomingMission = String(assignedMission?.missionId ?? assignedMission?.MissionId ?? '');
          if (flowType === 'guide' && incomingRobot.toUpperCase() === ROBOT_CODE.toUpperCase() && incomingMission) {
            const recoveredDestinations = normalizeDestinations(assignedMission?.waypoints ?? assignedMission?.Waypoints ?? []);
            const recoveredStatus = String(assignedMission?.status ?? assignedMission?.Status ?? 'NAVIGATING').toUpperCase() as GuideStatus;
            missionRef.current = incomingMission;
            setMissionId(incomingMission);
            setStatus(recoveredStatus);
            const recoveredPickupWait = recoveredStatus === 'ARRIVED' || recoveredStatus === 'PAUSED';
            awaitingPickupRef.current = recoveredPickupWait;
            setAwaitingPickup(recoveredPickupWait);
            destinationsRef.current = recoveredDestinations;
            destinationRef.current = recoveredDestinations[0] ?? null;
            setDestinations(recoveredDestinations);
            setDestination(recoveredDestinations[0] ?? null);
            currentWaypointIndexRef.current = 0;
            setCurrentWaypointIndex(0);
          }
        }
      } catch (err) {
        console.warn('[RobotGuide] Recover active mission failed:', err);
      }
    };
    void recoverMission();

    const unsubscribe = subscribeMissionAssigned((assignedMission: any) => {
      const flowType = String(assignedMission?.flowType ?? assignedMission?.FlowType ?? '').toLowerCase();
      const incomingRobot = String(assignedMission?.robotCode ?? assignedMission?.RobotCode ?? '');
      const incomingMission = String(assignedMission?.missionId ?? assignedMission?.MissionId ?? '');
      if (flowType !== 'guide' || incomingRobot.toUpperCase() !== ROBOT_CODE.toUpperCase() || !incomingMission) return;
      const recoveredDestinations = normalizeDestinations(assignedMission?.waypoints ?? assignedMission?.Waypoints ?? []);
      const recoveredStatus = String(assignedMission?.status ?? assignedMission?.Status ?? 'NAVIGATING').toUpperCase() as GuideStatus;
      missionRef.current = incomingMission;
      setMissionId(incomingMission);
      setStatus(recoveredStatus);
      const recoveredPickupWait = recoveredStatus === 'ARRIVED' || recoveredStatus === 'PAUSED';
      awaitingPickupRef.current = recoveredPickupWait;
      setAwaitingPickup(recoveredPickupWait);
      destinationsRef.current = recoveredDestinations;
      destinationRef.current = recoveredDestinations[0] ?? null;
      setDestinations(recoveredDestinations);
      setDestination(recoveredDestinations[0] ?? null);
      currentWaypointIndexRef.current = 0;
      setCurrentWaypointIndex(0);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [normalizeDestinations, subscribeMissionAssigned]);

  useEffect(() => subscribeTelemetry((payload: any) => {
    const incomingRobot = String(payload?.robotCode ?? payload?.RobotCode ?? '');
    if (incomingRobot.toUpperCase() !== ROBOT_CODE.toUpperCase()) return;
    const x = Number(payload?.xCoord ?? payload?.XCoord);
    const y = Number(payload?.yCoord ?? payload?.YCoord);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const heading = Number(payload?.headingRad ?? payload?.HeadingRad);
    setRobotPose({
      x,
      y,
      headingRad: Number.isFinite(heading) ? heading : null,
      timestampUtc: payload?.timestampUtc ?? payload?.TimestampUtc ?? null,
    });
  }), [subscribeTelemetry]);

  useEffect(() => {
    return subscribeNavigationStatus((payload: NavigationStatusPayload) => {
      const incomingRobot = payload.robotCode ?? (payload as any).RobotCode;
      const incomingMission = payload.missionId ?? (payload as any).MissionId;
      const rawStatus = payload.navStatus ?? (payload as any).NavStatus ?? '';
      const incomingNodeId = payload.nodeId ?? (payload as any).NodeId;
      const incomingIndex = payload.waypointIndex ?? (payload as any).WaypointIndex;
      console.log(`[RobotGuide] NAV_STATUS: status=${rawStatus} robot=${incomingRobot} mission=${incomingMission} nodeId=${incomingNodeId} wpIndex=${incomingIndex} awaitingPickup=${awaitingPickupRef.current} currentMission=${missionRef.current} totalDest=${destinationsRef.current.length}`);

      if (incomingRobot?.toUpperCase() !== ROBOT_CODE.toUpperCase()) return;
      if (!incomingMission || incomingMission !== missionRef.current) return;
      acknowledgedMissionRef.current = incomingMission;

      const next = String(rawStatus).toUpperCase() as GuideStatus;
      const accepted: GuideStatus[] = ['NAVIGATING', 'MOVING', 'ARRIVED', 'PAUSED', 'RESUMED', 'WAYPOINT_COMPLETED', 'COMPLETED', 'FAILED', 'CANCELLED', 'ESTOP'];
      if (!accepted.includes(next)) {
        console.log(`[RobotGuide] Ignoring unrecognized status: ${next}`);
        return;
      }

      // ── Khi đang chờ khách lấy sản phẩm ──
      // Chặn mọi trạng thái mà ROS2 gửi tự động (MOVING, NAVIGATING,
      // RESUMED, WAYPOINT_COMPLETED) — chỉ cho phép:
      //   • ARRIVED / PAUSED  → cập nhật UI nhưng giữ nguyên awaitingPickup
      //   • COMPLETED ở waypoint cuối → hoãn lại, chờ confirmPickup
      //   • Terminal lỗi (FAILED/CANCELLED/ESTOP) → luôn xử lý
      if (awaitingPickupRef.current) {
        if (['MOVING', 'NAVIGATING', 'RESUMED', 'WAYPOINT_COMPLETED'].includes(next)) {
          console.log(`[RobotGuide] BLOCKED status=${next} — awaitingPickup=true, customer must confirm first.`);
          return;
        }
        if (next === 'COMPLETED') {
          // Waypoint cuối cùng: robot đã xong route nhưng khách chưa lấy sản phẩm.
          // Giữ awaitingPickup, chỉ cập nhật UI label.
          console.log(`[RobotGuide] DEFERRED COMPLETED — awaitingPickup=true at final waypoint, waiting for customer confirm.`);
          // Không thay đổi status, giữ nút confirm hiển thị
          return;
        }
      }

      clearTimeoutGuard();

      // ── Resolve destination hiện tại ──
      const currentTarget = destinationsRef.current.find(item => item.nodeId === incomingNodeId)
        ?? (typeof incomingIndex === 'number' ? destinationsRef.current[incomingIndex] : undefined)
        ?? destinationRef.current;
      if (currentTarget) {
        destinationRef.current = currentTarget;
        setDestination(currentTarget);
      }
      if (typeof incomingIndex === 'number' && incomingIndex >= 0) {
        const resolvedIdx = Math.min(incomingIndex, Math.max(destinationsRef.current.length - 1, 0));
        currentWaypointIndexRef.current = resolvedIdx;
        setCurrentWaypointIndex(resolvedIdx);
      } else if (currentTarget) {
        const matchedIndex = destinationsRef.current.findIndex(item => item.nodeId === currentTarget.nodeId);
        if (matchedIndex >= 0) {
          currentWaypointIndexRef.current = matchedIndex;
          setCurrentWaypointIndex(matchedIndex);
        }
      }

      // ── Cập nhật status ──
      setStatus(next);
      setError(payload.error ?? (payload as any).Error ?? null);

      // ── ARRIVED hoặc PAUSED trong guide → chờ khách lấy hàng ──
      if (next === 'ARRIVED' || next === 'PAUSED') {
        if (!awaitingPickupRef.current) {
          console.log(`[RobotGuide] ${next} at nodeId=${incomingNodeId} wpIndex=${incomingIndex} — setting awaitingPickup=true`);
          awaitingPickupRef.current = true;
          setAwaitingPickup(true);
          const target = currentTarget;
          const location = [target?.zoneName, target?.aisleName, target?.shelfName].filter(Boolean).join(', ');
          const products = target?.productNames?.length ? ` Các sản phẩm tại đây: ${target.productNames.join(', ')}.` : '';
          Speech.speak(
            location
              ? `Đã đến điểm lấy hàng tại ${location}.${products} Xin mời quý khách lấy sản phẩm.`
              : 'Đã đến nơi. Xin mời quý khách lấy sản phẩm.',
            { language: 'vi-VN', rate: 0.9 },
          );
        } else {
          console.log(`[RobotGuide] ${next} received but awaitingPickup already true — UI unchanged.`);
        }
        return; // Không xử lý thêm, chờ confirmPickup
      }

      // ── Terminal states → dọn dẹp mission ──
      if (['COMPLETED', 'FAILED', 'CANCELLED', 'ESTOP'].includes(next)) {
        console.log(`[RobotGuide] Terminal status=${next} — clearing mission state.`);
        awaitingPickupRef.current = false;
        setAwaitingPickup(false);
        missionRef.current = null;
        setMissionId(null);
      }
    });
  }, [clearTimeoutGuard, subscribeNavigationStatus]);

  useEffect(() => () => clearTimeoutGuard(), [clearTimeoutGuard]);

  const dispatchCart = useCallback(async (items: { productId: number; productName: string }[]) => {
    if (missionRef.current) throw new Error('RB001 đang dẫn một khách khác. Vui lòng chờ nhiệm vụ hoàn tất.');
    if (!isHubConnected) throw new Error('Chưa kết nối được kênh trạng thái của robot. Vui lòng thử lại.');
    const uniqueItems = items.filter((item, index, all) =>
      item.productId > 0 && all.findIndex(other => other.productId === item.productId) === index);
    if (uniqueItems.length === 0) throw new Error('Giỏ hàng chưa có sản phẩm hợp lệ để dẫn đường.');

    const nextMissionId = newMissionId();
    acknowledgedMissionRef.current = null;
    missionRef.current = nextMissionId;
    setMissionId(nextMissionId);
    setProductName(`${uniqueItems.length} sản phẩm trong giỏ`);
    setDestination(null);
    setDestinations([]);
    currentWaypointIndexRef.current = 0;
    setCurrentWaypointIndex(0);
    destinationRef.current = null;
    destinationsRef.current = [];
    setError(null);
    awaitingPickupRef.current = false;
    setAwaitingPickup(false);
    setStatus('DISPATCHING');

    const result = await RobotControlService.dispatchAutonomous({
      robotCode: ROBOT_CODE,
      missionId: nextMissionId,
      flowType: 'guide',
      productIds: uniqueItems.map(item => item.productId),
      floorId: 1,
    });
    if (!result.ok) {
      clearTimeoutGuard();
      missionRef.current = null;
      setMissionId(null);
      setStatus('FAILED');
      const message = result.data?.detail || result.data?.error || `Dispatch thất bại (${result.status})`;
      setError(message);
      throw new Error(message);
    }

    const confirmedMissionId = result.data?.missionId;
    if (typeof confirmedMissionId !== 'string'
        || !confirmedMissionId
        || confirmedMissionId !== nextMissionId) {
      clearTimeoutGuard();
      missionRef.current = null;
      setMissionId(null);
      setStatus('FAILED');
      setError('Backend không xác nhận đúng missionId để theo dõi nhiệm vụ.');
      throw new Error('Backend không xác nhận đúng missionId để theo dõi nhiệm vụ.');
    }
    missionRef.current = confirmedMissionId;
    setMissionId(confirmedMissionId);

    const confirmedDestinations: GuideDestination[] = Array.isArray(result.data?.waypoints)
      ? normalizeDestinations(result.data.waypoints)
      : [];
    if (confirmedDestinations.length === 0) {
      clearTimeoutGuard();
      missionRef.current = null;
      setMissionId(null);
      setStatus('FAILED');
      const message = 'Backend không trả điểm dừng cho giỏ hàng.';
      setError(message);
      throw new Error(message);
    }
    destinationsRef.current = confirmedDestinations;
    setDestinations(confirmedDestinations);
    destinationRef.current = confirmedDestinations[0];
    setDestination(confirmedDestinations[0]);
    if (acknowledgedMissionRef.current !== confirmedMissionId) {
      timeoutRef.current = setTimeout(() => {
        if (missionRef.current !== confirmedMissionId) return;
        // Nếu robot không ACK, giải phóng cả registry BE và gửi STOP phòng khi
        // lệnh MQTT đến trễ. Không để một mission DISPATCHED treo chặn lần sau.
        fetch(`${API_BASE}/api/v1/navigation/robots/${ROBOT_CODE}/cancel?reason=${encodeURIComponent('Robot did not acknowledge guide mission')}`, {
          method: 'POST',
          headers: { 'ngrok-skip-browser-warning': 'true' },
        }).catch(() => undefined);
        missionRef.current = null;
        setMissionId(null);
        setStatus('TIMEOUT');
        setError('Robot không gửi trạng thái xác nhận trong 20 giây.');
      }, RESPONSE_TIMEOUT_MS);
    }
    return result.data;
  }, [clearTimeoutGuard, isHubConnected, normalizeDestinations]);

  const confirmPickup = useCallback(async () => {
    const activeMissionId = missionRef.current;
    const totalStops = destinationsRef.current.length;
    const currentIdx = currentWaypointIndexRef.current >= 0
      ? currentWaypointIndexRef.current
      : (destinationRef.current ? destinationsRef.current.findIndex(d => d.nodeId === destinationRef.current?.nodeId) : -1);
    const isLastWaypoint = totalStops > 0 && currentIdx >= totalStops - 1;
    console.log(`[RobotGuide] confirmPickup called: mission=${activeMissionId} awaitingPickup=${awaitingPickupRef.current} currentIdx=${currentIdx} totalStops=${totalStops} isLastWaypoint=${isLastWaypoint}`);

    if (!activeMissionId || !awaitingPickupRef.current)
      throw new Error('Robot hiện không chờ xác nhận lấy hàng.');

    // Khóa nút ngay để tránh khách bấm hai lần.
    awaitingPickupRef.current = false;
    setAwaitingPickup(false);

    try {
      if (isLastWaypoint) {
        // Waypoint cuối: kết thúc mission, không cần robot đi tiếp.
        console.log(`[RobotGuide] Last waypoint confirmed — completing mission, sending CANCEL to stop robot.`);
        await fetch(
          `${API_BASE}/api/v1/navigation/robots/${ROBOT_CODE}/cancel?reason=${encodeURIComponent('Guide mission completed - all products picked up')}`,
          { method: 'POST', headers: { 'ngrok-skip-browser-warning': 'true' } },
        ).catch(() => undefined);
        missionRef.current = null;
        acknowledgedMissionRef.current = null;
        setMissionId(null);
        setStatus('COMPLETED');
        setError(null);
        Speech.speak('Tuyệt vời! Quý khách đã lấy xong tất cả sản phẩm. Chúc quý khách mua sắm vui vẻ!', {
          language: 'vi-VN', rate: 0.9,
        });
      } else {
        // Waypoint trung gian: cho robot đi tiếp đến kệ tiếp theo.
        console.log(`[RobotGuide] Intermediate waypoint confirmed — sending RESUME to continue to next shelf.`);
        const response = await fetch(
          `${API_BASE}/api/v1/navigation/robots/${ROBOT_CODE}/resume?reason=${encodeURIComponent('Customer confirmed product pickup')}`,
          { method: 'POST', headers: { 'ngrok-skip-browser-warning': 'true' } },
        );
        console.log(`[RobotGuide] RESUME response: ${response.status}`);
        if (!response.ok) throw new Error(`Không thể cho robot đi tiếp (${response.status})`);
        setStatus('RESUMED');
        Speech.speak('Đã xác nhận. Xin mời quý khách tiếp tục đi theo tôi.', {
          language: 'vi-VN', rate: 0.9,
        });
      }
    } catch (error) {
      console.error('[RobotGuide] confirmPickup FAILED, restoring awaitingPickup=true:', error);
      awaitingPickupRef.current = true;
      setAwaitingPickup(true);
      throw error;
    }
  }, []);

  const cancelGuide = useCallback(async () => {
    try {
      if (API_BASE) {
        await fetch(`${API_BASE}/api/v1/navigation/robots/${ROBOT_CODE}/cancel?reason=Customer%20cancelled%20guide`, {
          method: 'POST',
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });
      }
    } catch (err) {
      console.warn('[RobotGuide] Cancel request warning:', err);
    } finally {
      clearTimeoutGuard();
      missionRef.current = null;
      acknowledgedMissionRef.current = null;
      destinationRef.current = null;
      destinationsRef.current = [];
      setMissionId(null);
      setError(null);
      setDestination(null);
      setDestinations([]);
      awaitingPickupRef.current = false;
      setAwaitingPickup(false);
      setStatus('CANCELLED');
    }
  }, [clearTimeoutGuard]);

  const isBusy = missionId !== null || ['DISPATCHING', 'NAVIGATING', 'MOVING', 'ARRIVED'].includes(status);
  return (
    <RobotGuideContext.Provider value={{
      status, missionId, productName, destination, destinations, currentWaypointIndex, robotPose, error, awaitingPickup, isBusy, isHubConnected,
      dispatchCart, confirmPickup, cancelGuide,
    }}>
      {children}
    </RobotGuideContext.Provider>
  );
}

export function useRobotGuide() {
  const value = useContext(RobotGuideContext);
  if (!value) throw new Error('useRobotGuide must be used within RobotGuideProvider');
  return value;
}
