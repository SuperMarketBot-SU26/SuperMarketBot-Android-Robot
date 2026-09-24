import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

const ROBOT_ID = Number(process.env.EXPO_PUBLIC_ROBOT_ID ?? '1');
const SESSION_TIMEOUT_MS = 60000; // 60s không thao tác thì hết phiên

interface CustomerSessionContextValue {
  sessionId: string;
  refreshSession: () => string;
  endSession: () => void;
  fraudProductIds: Set<number>;
  markProductFraud: (productId: number) => void;
  isProductFraud: (productId: number) => boolean;
}

const CustomerSessionContext = createContext<CustomerSessionContextValue | null>(null);

function generateNewSessionId(): string {
  return `session-${ROBOT_ID}-${Date.now()}`;
}

export function CustomerSessionProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string>(() => generateNewSessionId());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fraudProductsRef = useRef<Set<number>>(new Set());
  const [fraudState, setFraudState] = useState<Set<number>>(new Set());

  const sessionIdRef = useRef(sessionId);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Kết thúc phiên hiện tại và reset
  const endSession = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    fraudProductsRef.current.clear();
    setFraudState(new Set());
    const nextId = generateNewSessionId();
    sessionIdRef.current = nextId;
    setSessionId(nextId);
    console.log(`[CustomerSession] Phiên kết thúc. Khởi tạo session mới: ${nextId}`);
  }, []);

  // Làm mới hoặc gia hạn phiên khi có thao tác người dùng (stable callback)
  const refreshSession = useCallback((): string => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      console.log('[CustomerSession] Timeout 60s không thao tác -> Hết phiên.');
      endSession();
    }, SESSION_TIMEOUT_MS);

    return sessionIdRef.current;
  }, [endSession]);

  const markProductFraud = useCallback((productId: number) => {
    fraudProductsRef.current.add(productId);
    setFraudState(new Set(fraudProductsRef.current));
  }, []);

  const isProductFraud = useCallback((productId: number): boolean => {
    return fraudProductsRef.current.has(productId);
  }, []);

  useEffect(() => {
    // Khởi tạo timer ban đầu
    refreshSession();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [refreshSession]);

  const value = React.useMemo(() => ({
    sessionId,
    refreshSession,
    endSession,
    fraudProductIds: fraudState,
    markProductFraud,
    isProductFraud,
  }), [sessionId, refreshSession, endSession, fraudState, markProductFraud, isProductFraud]);

  return (
    <CustomerSessionContext.Provider value={value}>
      {children}
    </CustomerSessionContext.Provider>
  );
}

export function useCustomerSession() {
  const ctx = useContext(CustomerSessionContext);
  if (!ctx) {
    throw new Error('useCustomerSession must be used within CustomerSessionProvider');
  }
  return ctx;
}
