/**
 * RobotControlContext.tsx
 *
 * Quản lý trạng thái kết nối và cấu hình bánh xe toàn app.
 * Tự động kết nối WebSocket khi app khởi động.
 */

import React, {
  createContext, useContext, useEffect, useRef, useState, useCallback,
} from 'react';
import { RobotControlService } from '../services/RobotControlService';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface MotorLayoutConfig {
  /** Chỉ số slot driver cho mỗi bánh xe: [FL, RL, FR, RR] */
  mapMot: number[];
  /** Cờ đảo chiều: [FL, RL, FR, RR] — 0=thuận, 1=đảo */
  motInv: number[];
  /** Loại bánh xe: 0=Mecanum (đa hướng), 1=Normal (4WD vi sai) */
  wheelMode: 0 | 1;
}

interface RobotControlContextType {
  isConnected: boolean;
  motorLayout: MotorLayoutConfig;
  setMotorLayout: (cfg: MotorLayoutConfig) => void;
  setWheelMode: (mode: 0 | 1) => void;
  saveMotorLayout: () => void;
  testMotor: (slot: number, speedPct: number) => void;
}

const RobotControlContext = createContext<RobotControlContextType | null>(null);

const DEFAULT_LAYOUT: MotorLayoutConfig = {
  mapMot: [0, 1, 2, 3],
  motInv: [0, 0, 0, 0],
  wheelMode: 0, // 0=Mecanum
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function RobotControlProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setConnected] = useState(false);
  const [motorLayout, setMotorLayoutState] = useState<MotorLayoutConfig>(DEFAULT_LAYOUT);

  const connRef = useRef<(c: boolean) => void | undefined>(undefined);

  useEffect(() => {
    connRef.current = (c: boolean) => setConnected(c);
  });

  useEffect(() => {
    const onConn = (c: boolean) => connRef.current?.(c);
    RobotControlService.onConnection(onConn);

    // Auto-connect on mount
    RobotControlService.connect();

    return () => {
      RobotControlService.offConnection(onConn);
      RobotControlService.disconnect();
    };
  }, []);

  const setMotorLayout = useCallback((cfg: MotorLayoutConfig) => {
    setMotorLayoutState(cfg);
  }, []);

  const setWheelMode = useCallback((mode: 0 | 1) => {
    setMotorLayoutState(prev => ({ ...prev, wheelMode: mode }));
    RobotControlService.sendWheelMode(mode);
  }, []);

  const saveMotorLayout = useCallback(() => {
    RobotControlService.sendMotorLayout(motorLayout.mapMot, motorLayout.motInv);
    RobotControlService.sendWheelMode(motorLayout.wheelMode);
  }, [motorLayout]);

  const testMotor = useCallback((slot: number, speedPct: number) => {
    RobotControlService.sendMotorTest(slot, speedPct);
  }, []);

  return (
    <RobotControlContext.Provider value={{
      isConnected,
      motorLayout,
      setMotorLayout,
      setWheelMode,
      saveMotorLayout,
      testMotor,
    }}>
      {children}
    </RobotControlContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRobotControl() {
  const ctx = useContext(RobotControlContext);
  if (!ctx) throw new Error('useRobotControl must be used within RobotControlProvider');
  return ctx;
}
