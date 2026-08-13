import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as SignalR from '@microsoft/signalr';
import * as Speech from 'expo-speech';
import { RobotControlService } from '../services/RobotControlService';

const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
const ROBOT_CODE = process.env.EXPO_PUBLIC_ROBOT_CODE ?? 'RB001';
const RESPONSE_TIMEOUT_MS = 20_000;

export type GuideStatus =
  | 'IDLE' | 'DISPATCHING' | 'NAVIGATING' | 'MOVING' | 'ARRIVED'
  | 'WAYPOINT_COMPLETED' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'ESTOP' | 'TIMEOUT';

export interface GuideDestination {
  nodeId: number;
  nodeName: string;
  zoneName?: string | null;
  aisleName?: string | null;
  shelfName?: string | null;
  productNames?: string[] | null;
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
  const [status, setStatus] = useState<GuideStatus>('IDLE');
  const [missionId, setMissionId] = useState<string | null>(null);
  const [productName, setProductName] = useState<string | null>(null);
  const [destination, setDestination] = useState<GuideDestination | null>(null);
  const [destinations, setDestinations] = useState<GuideDestination[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isHubConnected, setHubConnected] = useState(false);
  const missionRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionRef = useRef<SignalR.HubConnection | null>(null);
  const destinationRef = useRef<GuideDestination | null>(null);
  const destinationsRef = useRef<GuideDestination[]>([]);

  const clearTimeoutGuard = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  useEffect(() => {
    if (!API_BASE) return;
    let mounted = true;
    const connection = new SignalR.HubConnectionBuilder()
      .withUrl(`${API_BASE}/hubs/robot`, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(SignalR.LogLevel.Warning)
      .build();
    connectionRef.current = connection;

    const joinGroup = async () => {
      if (connection.state === SignalR.HubConnectionState.Connected)
        await connection.invoke('JoinRobotGroup', ROBOT_CODE);
    };

    connection.on('navigationStatus', (payload: NavigationStatusPayload) => {
      const incomingRobot = payload.robotCode ?? (payload as any).RobotCode;
      const incomingMission = payload.missionId ?? (payload as any).MissionId;
      if (incomingRobot?.toUpperCase() !== ROBOT_CODE.toUpperCase()) return;
      if (!incomingMission || incomingMission !== missionRef.current) return;

      const next = String(payload.navStatus ?? (payload as any).NavStatus ?? '').toUpperCase() as GuideStatus;
      const accepted: GuideStatus[] = ['NAVIGATING', 'MOVING', 'ARRIVED', 'WAYPOINT_COMPLETED', 'COMPLETED', 'FAILED', 'CANCELLED', 'ESTOP'];
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

    connection.onreconnecting(() => mounted && setHubConnected(false));
    connection.onreconnected(async () => {
      if (!mounted) return;
      setHubConnected(true);
      try { await joinGroup(); } catch (e) { console.warn('[RobotGuide] Rejoin group failed', e); }
    });
    connection.onclose(() => mounted && setHubConnected(false));

    connection.start()
      .then(async () => {
        if (!mounted) return;
        setHubConnected(true);
        await joinGroup();
      })
      .catch(e => console.warn('[RobotGuide] SignalR connection failed', e));

    return () => {
      mounted = false;
      clearTimeoutGuard();
      connection.off('navigationStatus');
      connection.stop().catch(() => undefined);
      connectionRef.current = null;
    };
  }, [clearTimeoutGuard]);

  const dispatchCart = useCallback(async (items: { productId: number; productName: string }[]) => {
    if (missionRef.current) throw new Error('RB001 đang dẫn một khách khác. Vui lòng chờ nhiệm vụ hoàn tất.');
    if (!isHubConnected) throw new Error('Chưa kết nối được kênh trạng thái của robot. Vui lòng thử lại.');
    const uniqueItems = items.filter((item, index, all) =>
      item.productId > 0 && all.findIndex(other => other.productId === item.productId) === index);
    if (uniqueItems.length === 0) throw new Error('Giỏ hàng chưa có sản phẩm hợp lệ để dẫn đường.');

    const nextMissionId = newMissionId();
    missionRef.current = nextMissionId;
    setMissionId(nextMissionId);
    setProductName(`${uniqueItems.length} sản phẩm trong giỏ`);
    setDestination(null);
    setDestinations([]);
    destinationRef.current = null;
    destinationsRef.current = [];
    setError(null);
    setStatus('DISPATCHING');

    timeoutRef.current = setTimeout(() => {
      if (missionRef.current !== nextMissionId) return;
      missionRef.current = null;
      setMissionId(null);
      setStatus('TIMEOUT');
      setError('Robot không gửi trạng thái xác nhận trong 20 giây.');
    }, RESPONSE_TIMEOUT_MS);

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
      ? result.data.waypoints
      : [];
    if (confirmedDestinations.length === 0) {
      throw new Error('Backend không trả điểm dừng cho giỏ hàng.');
    }
    destinationsRef.current = confirmedDestinations;
    setDestinations(confirmedDestinations);
    destinationRef.current = confirmedDestinations[0];
    setDestination(confirmedDestinations[0]);
    return result.data;
  }, [clearTimeoutGuard, isHubConnected]);

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
      status, missionId, productName, destination, destinations, error, isBusy, isHubConnected,
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
