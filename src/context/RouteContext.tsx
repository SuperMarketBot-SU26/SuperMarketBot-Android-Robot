/**
 * RouteContext.tsx
 *
 * Cung cấp state cho Fixed Routes + lộ trình đang chọn trên Tablet.
 * Auto-load map 1 khi mount. Không dùng route mock để điều khiển robot thật.
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

// ─── Types ─────────────────────────────────────────────────────────────────────

interface RouteContextType {
  routes: RobotRoute[];
  selectedRoute: RobotRoute | null;
  selectedRouteId: number | null;
  isLoading: boolean;
  error: string | null;
  selectRoute: (id: number | null) => void;
  refresh: () => Promise<void>;
}

const RouteContext = createContext<RouteContextType | null>(null);

const DEFAULT_MAP_ID = 1;

// ─── Provider ─────────────────────────────────────────────────────────────────

export function RouteProvider({ children }: { children: React.ReactNode }) {
  const [routes, setRoutes] = useState<RobotRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        console.log(`[RouteContext] Loaded ${fromBE.length} routes từ BE`);
      } else {
        setRoutes([]);
        setError('Backend không trả route thật cho active map.');
      }
    } catch (e: any) {
      setRoutes([]);
      setError(e?.message ?? 'Unknown error');
      console.warn('[RouteContext] Không tải được route thật:', e);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void loadRoutes(DEFAULT_MAP_ID), 0);
    return () => clearTimeout(timer);
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
