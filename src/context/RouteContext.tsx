/**
 * RouteContext.tsx
 *
 * Cung cấp state cho Fixed Routes + lộ trình đang chọn trên Tablet.
 * Auto-load map 1 khi mount. Nếu BE fail/rỗng → fallback mock JSON.
 *
 * UI consumer: MapViewerScreen, RoutePickerSheet.
 */

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  fetchRoutesByMap,
  RobotRoute,
} from '../services/RouteService';
import mockData from '../mocks/routes.mock.json';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface RouteContextType {
  routes: RobotRoute[];
  selectedRoute: RobotRoute | null;
  selectedRouteId: number | null;
  isLoading: boolean;
  error: string | null;
  isMock: boolean;
  selectRoute: (id: number | null) => void;
  refresh: () => Promise<void>;
}

const RouteContext = createContext<RouteContextType | null>(null);

const DEFAULT_MAP_ID = 1;

interface MockPayload {
  routes: RobotRoute[];
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function RouteProvider({ children }: { children: React.ReactNode }) {
  const [routes, setRoutes] = useState<RobotRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMock, setMock] = useState(false);

  // Guard tránh double-load (React 18 StrictMode mount/unmount)
  const loadingRef = useRef(false);

  const loadRoutes = useCallback(async (mapId: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const fromBE = await fetchRoutesByMap(mapId);
      if (fromBE.length > 0) {
        setRoutes(fromBE);
        setMock(false);
        console.log(`[RouteContext] Loaded ${fromBE.length} routes từ BE`);
      } else {
        // Fallback mock
        const mock = (mockData as MockPayload).routes ?? [];
        setRoutes(mock);
        setMock(true);
        console.warn(`[RouteContext] Fallback MOCK — ${mock.length} routes`);
      }
    } catch (e: any) {
      // Defensive: RouteService không throw, nhưng cẩn thận vẫn fallback
      const mock = (mockData as MockPayload).routes ?? [];
      setRoutes(mock);
      setMock(true);
      setError(e?.message ?? 'Unknown error');
      console.warn('[RouteContext] Exception, fallback MOCK');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadRoutes(DEFAULT_MAP_ID);
  }, [loadRoutes]);

  const refresh = useCallback(async () => {
    await loadRoutes(DEFAULT_MAP_ID);
  }, [loadRoutes]);

  const selectRoute = useCallback((id: number | null) => {
    setSelectedRouteId(id);
  }, []);

  const selectedRoute = useMemo(
    () => routes.find((r) => r.robotRouteId === selectedRouteId) ?? null,
    [routes, selectedRouteId],
  );

  return (
    <RouteContext.Provider
      value={{
        routes,
        selectedRoute,
        selectedRouteId,
        isLoading,
        error,
        isMock,
        selectRoute,
        refresh,
      }}
    >
      {children}
    </RouteContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRoute() {
  const ctx = useContext(RouteContext);
  if (!ctx) throw new Error('useRoute must be used within RouteProvider');
  return ctx;
}