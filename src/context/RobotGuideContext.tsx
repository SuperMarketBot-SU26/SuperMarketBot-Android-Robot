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
  isBusy: boolean;
  isHubConnected: boolean;
  dispatchCart: (items: { productId: number; productName: string }[]) => Promise<any>;
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
  const missionRef = useRef<string | null>(null);
  const acknowledgedMissionRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destinationRef = useRef<GuideDestination | null>(null);
  const destinationsRef = useRef<GuideDestination[]>([]);

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
    return subscribeMissionAssigned((assignedMission: any) => {
      const flowType = String(assignedMission?.flowType ?? assignedMission?.FlowType ?? '').toLowerCase();
      const incomingRobot = String(assignedMission?.robotCode ?? assignedMission?.RobotCode ?? '');
      const incomingMission = String(assignedMission?.missionId ?? assignedMission?.MissionId ?? '');
      if (flowType !== 'guide' || incomingRobot.toUpperCase() !== ROBOT_CODE.toUpperCase() || !incomingMission) return;
      const recoveredDestinations = normalizeDestinations(assignedMission?.waypoints ?? assignedMission?.Waypoints ?? []);
      missionRef.current = incomingMission;
      setMissionId(incomingMission);
      setStatus(String(assignedMission?.status ?? assignedMission?.Status ?? 'NAVIGATING').toUpperCase() as GuideStatus);
      destinationsRef.current = recoveredDestinations;
      destinationRef.current = recoveredDestinations[0] ?? null;
      setDestinations(recoveredDestinations);
      setDestination(recoveredDestinations[0] ?? null);
      setCurrentWaypointIndex(0);
    });
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
      if (incomingRobot?.toUpperCase() !== ROBOT_CODE.toUpperCase()) return;
      if (!incomingMission || incomingMission !== missionRef.current) return;
      acknowledgedMissionRef.current = incomingMission;

      const next = String(payload.navStatus ?? (payload as any).NavStatus ?? '').toUpperCase() as GuideStatus;
      const accepted: GuideStatus[] = ['NAVIGATING', 'MOVING', 'ARRIVED', 'PAUSED', 'RESUMED', 'WAYPOINT_COMPLETED', 'COMPLETED', 'FAILED', 'CANCELLED', 'ESTOP'];
      if (!accepted.includes(next)) return;
      clearTimeoutGuard();
      setStatus(next);
      setError(payload.error ?? (payload as any).Error ?? null);
      const incomingNodeId = payload.nodeId ?? (payload as any).NodeId;
      const incomingIndex = payload.waypointIndex ?? (payload as any).WaypointIndex;
      const currentTarget = destinationsRef.current.find(item => item.nodeId === incomingNodeId)
        ?? (typeof incomingIndex === 'number' ? destinationsRef.current[incomingIndex] : undefined)
        ?? destinationRef.current;
      if (currentTarget) {
        destinationRef.current = currentTarget;
        setDestination(currentTarget);
      }
      if (typeof incomingIndex === 'number' && incomingIndex >= 0) {
        setCurrentWaypointIndex(Math.min(incomingIndex, Math.max(destinationsRef.current.length - 1, 0)));
      } else if (currentTarget) {
        const matchedIndex = destinationsRef.current.findIndex(item => item.nodeId === currentTarget.nodeId);
        if (matchedIndex >= 0) setCurrentWaypointIndex(matchedIndex);
      }
      if (next === 'ARRIVED') {
        const target = currentTarget;
        const location = [target?.zoneName, target?.aisleName, target?.shelfName].filter(Boolean).join(', ');
        const products = target?.productNames?.length ? ` Các sản phẩm tại đây: ${target.productNames.join(', ')}.` : '';
        Speech.speak(
          location
            ? `Đã đến điểm lấy hàng tại ${location}.${products} Xin mời quý khách lấy sản phẩm.`
            : 'Đã đến nơi. Xin mời quý khách lấy sản phẩm.',
          { language: 'vi-VN', rate: 0.9 },
        );
      }
      if (['COMPLETED', 'FAILED', 'CANCELLED', 'ESTOP'].includes(next)) {
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
    setCurrentWaypointIndex(0);
    destinationRef.current = null;
    destinationsRef.current = [];
    setError(null);
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
        missionRef.current = null;
        setMissionId(null);
        setStatus('TIMEOUT');
        setError('Robot không gửi trạng thái xác nhận trong 20 giây.');
      }, RESPONSE_TIMEOUT_MS);
    }
    return result.data;
  }, [clearTimeoutGuard, isHubConnected, normalizeDestinations]);

  const cancelGuide = useCallback(async () => {
    if (!missionRef.current) return;
    const response = await fetch(`${API_BASE}/api/v1/navigation/robots/${ROBOT_CODE}/cancel?reason=Customer%20cancelled%20guide`, {
      method: 'POST',
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    if (!response.ok) throw new Error(`Không thể hủy nhiệm vụ (${response.status})`);
  }, []);

  const isBusy = missionId !== null || ['DISPATCHING', 'NAVIGATING', 'MOVING', 'ARRIVED'].includes(status);
  return (
    <RobotGuideContext.Provider value={{
      status, missionId, productName, destination, destinations, currentWaypointIndex, robotPose, error, isBusy, isHubConnected,
      dispatchCart, cancelGuide,
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
