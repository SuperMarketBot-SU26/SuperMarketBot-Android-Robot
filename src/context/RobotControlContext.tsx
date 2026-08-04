/**
 * RobotControlContext.tsx
 *
 * Context đơn giản — không còn WS connection.
 * Chỉ cung cấp RobotControlService cho toàn app qua context.
 */

import React, { createContext, useContext } from 'react';
import { RobotControlService } from '../services/RobotControlService';

interface RobotControlContextType {
  dispatchAutonomous: typeof RobotControlService.dispatchAutonomous;
  sendNavigateViaBackend: typeof RobotControlService.sendNavigateViaBackend;
}

const RobotControlContext = createContext<RobotControlContextType | null>(null);

export function RobotControlProvider({ children }: { children: React.ReactNode }) {
  return (
    <RobotControlContext.Provider value={{
      dispatchAutonomous: RobotControlService.dispatchAutonomous.bind(RobotControlService),
      sendNavigateViaBackend: RobotControlService.sendNavigateViaBackend.bind(RobotControlService),
    }}>
      {children}
    </RobotControlContext.Provider>
  );
}

export function useRobotControl() {
  const ctx = useContext(RobotControlContext);
  if (!ctx) throw new Error('useRobotControl must be used within RobotControlProvider');
  return ctx;
}
