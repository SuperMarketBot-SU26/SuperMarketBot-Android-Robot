import * as SignalR from '@microsoft/signalr';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
export const ROBOT_CODE = process.env.EXPO_PUBLIC_ROBOT_CODE ?? 'RB001';

interface RobotRealtimeContextValue {
  isConnected: boolean;
  subscribeNavigationStatus: (handler: EventHandler) => () => void;
  subscribeMissionAssigned: (handler: EventHandler) => () => void;
  subscribeTelemetry: (handler: EventHandler) => () => void;
}

type EventHandler = (payload: any) => void;

const RobotRealtimeContext = createContext<RobotRealtimeContextValue | null>(null);

export function RobotRealtimeProvider({ children }: { children: ReactNode }) {
  const [isConnected, setConnected] = useState(false);
  const navigationHandlers = useRef(new Set<EventHandler>());
  const missionHandlers = useRef(new Set<EventHandler>());
  const telemetryHandlers = useRef(new Set<EventHandler>());
  const activeMissionRef = useRef<any | null>(null);

  const subscribeNavigationStatus = useCallback((handler: EventHandler) => {
    navigationHandlers.current.add(handler);
    return () => navigationHandlers.current.delete(handler);
  }, []);

  const subscribeMissionAssigned = useCallback((handler: EventHandler) => {
    missionHandlers.current.add(handler);
    const activeMission = activeMissionRef.current;
    if (activeMission) Promise.resolve().then(() => {
      if (missionHandlers.current.has(handler)) handler(activeMission);
    });
    return () => missionHandlers.current.delete(handler);
  }, []);

  const subscribeTelemetry = useCallback((handler: EventHandler) => {
    telemetryHandlers.current.add(handler);
    return () => telemetryHandlers.current.delete(handler);
  }, []);

  useEffect(() => {
    if (!API_BASE) return;
    let mounted = true;
    const connection = new SignalR.HubConnectionBuilder()
      .withUrl(`${API_BASE}/hubs/robot`, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      })
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000])
      .configureLogging(SignalR.LogLevel.Warning)
      .build();

    const joinAndRecover = async () => {
      await connection.invoke('JoinRobotGroup', ROBOT_CODE);
      const response = await fetch(`${API_BASE}/api/v1/robot-operations/missions/${ROBOT_CODE}/active`, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      if (response.ok && mounted) {
        const mission = await response.json();
        activeMissionRef.current = mission;
        missionHandlers.current.forEach((handler) => handler(mission));
      }
    };

    connection.on('navigationStatus', (payload: any) => {
      if (!mounted) return;
      navigationHandlers.current.forEach((handler) => handler(payload));
      const status = String(payload?.navStatus ?? payload?.NavStatus ?? '').toUpperCase();
      const missionId = String(payload?.missionId ?? payload?.MissionId ?? '');
      const activeMissionId = String(activeMissionRef.current?.missionId ?? activeMissionRef.current?.MissionId ?? '');
      if (missionId && missionId === activeMissionId
        && ['COMPLETED', 'FAILED', 'CANCELLED', 'ESTOP'].includes(status)) {
        activeMissionRef.current = null;
      }
    });
    connection.on('missionAssigned', (payload: any) => {
      if (!mounted) return;
      activeMissionRef.current = payload;
      missionHandlers.current.forEach((handler) => handler(payload));
    });
    connection.on('telemetry', (payload: any) => {
      if (!mounted) return;
      telemetryHandlers.current.forEach((handler) => handler(payload));
    });
    connection.onreconnecting(() => mounted && setConnected(false));
    connection.onreconnected(async () => {
      if (!mounted) return;
      setConnected(true);
      await joinAndRecover().catch((error) => console.warn('[RobotRealtime] Rejoin/recover failed:', error));
    });
    connection.onclose(() => mounted && setConnected(false));

    connection.start()
      .then(async () => {
        if (!mounted) return;
        setConnected(true);
        await joinAndRecover();
      })
      .catch((error) => console.warn('[RobotRealtime] SignalR connection failed:', error));

    return () => {
      mounted = false;
      connection.off('navigationStatus');
      connection.off('missionAssigned');
      connection.off('telemetry');
      connection.stop().catch(() => undefined);
    };
  }, []);

  const value = useMemo(() => ({
    isConnected,
    subscribeNavigationStatus,
    subscribeMissionAssigned,
    subscribeTelemetry,
  }), [isConnected, subscribeMissionAssigned, subscribeNavigationStatus, subscribeTelemetry]);

  return <RobotRealtimeContext.Provider value={value}>{children}</RobotRealtimeContext.Provider>;
}

export function useRobotRealtime() {
  const value = useContext(RobotRealtimeContext);
  if (!value) throw new Error('useRobotRealtime must be used inside RobotRealtimeProvider');
  return value;
}
