/**
 * GeofencingContext.tsx
 *
 * Kết nối SignalR đến RobotHub và lắng nghe sự kiện `zoneEntered`.
 * Khi Robot di chuyển đến gần 1 kệ hàng/zone, tự động tải playlist
 * quảng cáo của khu vực đó để hiển thị trên màn hình Robot.
 */

import React, {
  createContext, useContext, useEffect, useRef, useState, useCallback,
} from 'react';
import * as SignalR from '@microsoft/signalr';
import { AdService, RobotPlaylistResponseDto, AdPlaylistItemDto } from '../services/AdService';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ZoneEnteredPayload {
  robotCode: string;
  zoneId: number;
  semanticObjectId: number;
  objectName: string;
}

interface GeofencingContextType {
  /** Hub SignalR đã kết nối chưa */
  isHubConnected: boolean;

  /** Zone hiện tại robot đang đứng */
  currentZone: ZoneEnteredPayload | null;

  /** Playlist quảng cáo của zone đó */
  currentPlaylist: AdPlaylistItemDto[];

  /** Robot đang ở trong 1 zone nào đó */
  isInZone: boolean;

  /** Đang tải playlist */
  isLoadingPlaylist: boolean;

  /** Xóa zone hiện tại (khi overlay đóng) */
  clearZone: () => void;
}

const GeofencingContext = createContext<GeofencingContextType | null>(null);

const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
const ROBOT_ID = Number(process.env.EXPO_PUBLIC_ROBOT_ID ?? '1');
const HUB_URL  = `${API_BASE}/hubs/robot`;

// ─── Provider ─────────────────────────────────────────────────────────────────

export function GeofencingProvider({ children }: { children: React.ReactNode }) {
  const [isHubConnected, setHubConnected]   = useState(false);
  const [currentZone, setCurrentZone]       = useState<ZoneEnteredPayload | null>(null);
  const [currentPlaylist, setCurrentPlaylist] = useState<AdPlaylistItemDto[]>([]);
  const [isLoadingPlaylist, setLoadingPlaylist] = useState(false);

  const hubRef = useRef<SignalR.HubConnection | null>(null);
  const mountedRef = useRef(true);

  // ── Tải playlist khi vào zone ──────────────────────────────────────────────
  const fetchPlaylistForZone = useCallback(async (payload: ZoneEnteredPayload) => {
    if (!mountedRef.current) return;
    setLoadingPlaylist(true);
    try {
      console.log(`[Geofencing] Tải playlist cho zone "${payload.objectName}" (objectId=${payload.semanticObjectId})`);
      const data: RobotPlaylistResponseDto = await AdService.getRobotPlaylist(
        ROBOT_ID,
        payload.semanticObjectId,
      );
      if (mountedRef.current) {
        setCurrentPlaylist(data.playlist ?? []);
        console.log(`[Geofencing] Playlist loaded: ${data.playlist?.length ?? 0} ads`);
      }
    } catch (e) {
      console.warn('[Geofencing] Không thể tải playlist:', e);
      if (mountedRef.current) setCurrentPlaylist([]);
    } finally {
      if (mountedRef.current) setLoadingPlaylist(false);
    }
  }, []);

  // ── Xây dựng & kết nối SignalR Hub ────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    const connection = new SignalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        skipNegotiation: false,
        transport: SignalR.HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(SignalR.LogLevel.Warning)
      .build();

    hubRef.current = connection;

    // ── Handlers ──
    connection.onreconnecting(() => {
      console.log('[Geofencing] SignalR đang kết nối lại...');
      if (mountedRef.current) setHubConnected(false);
    });

    connection.onreconnected(() => {
      console.log('[Geofencing] SignalR đã kết nối lại.');
      if (mountedRef.current) setHubConnected(true);
    });

    connection.onclose(() => {
      console.warn('[Geofencing] SignalR bị đóng.');
      if (mountedRef.current) setHubConnected(false);
    });

    // ── Lắng nghe sự kiện zoneEntered ──
    connection.on('zoneEntered', (payload: ZoneEnteredPayload) => {
      if (!mountedRef.current) return;
      console.log(`[Geofencing] zoneEntered: ${payload.objectName} (zone=${payload.zoneId})`);
      setCurrentZone(payload);
      fetchPlaylistForZone(payload);
    });

    // ── Bắt đầu kết nối ──
    const startConnection = async () => {
      try {
        await connection.start();
        if (mountedRef.current) {
          setHubConnected(true);
          console.log(`[Geofencing] SignalR đã kết nối đến ${HUB_URL}`);
        }
      } catch (e) {
        console.warn('[Geofencing] Không thể kết nối SignalR:', e);
        if (mountedRef.current) setHubConnected(false);
      }
    };

    startConnection();

    return () => {
      mountedRef.current = false;
      connection.off('zoneEntered');
      connection.stop().catch(() => {});
      hubRef.current = null;
    };
  }, [fetchPlaylistForZone]);

  const clearZone = useCallback(() => {
    setCurrentZone(null);
    setCurrentPlaylist([]);
  }, []);

  return (
    <GeofencingContext.Provider value={{
      isHubConnected,
      currentZone,
      currentPlaylist,
      isInZone: currentZone !== null && currentPlaylist.length > 0,
      isLoadingPlaylist,
      clearZone,
    }}>
      {children}
    </GeofencingContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGeofencing() {
  const ctx = useContext(GeofencingContext);
  if (!ctx) throw new Error('useGeofencing must be used within GeofencingProvider');
  return ctx;
}
