import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AdPlaylistItemDto, AdService } from '../services/AdService';
import { ROBOT_CODE, useRobotRealtime } from './RobotRealtimeContext';

export interface ZoneEnteredPayload {
  robotCode: string;
  zoneId: number;
  semanticObjectId?: number;
  objectName: string;
  dwellTimeSeconds?: number;
  missionId: string;
}

interface GeofencingContextType {
  isHubConnected: boolean;
  currentZone: ZoneEnteredPayload | null;
  currentPlaylist: AdPlaylistItemDto[];
  isInZone: boolean;
  isLoadingPlaylist: boolean;
  clearZone: () => void;
}

const GeofencingContext = createContext<GeofencingContextType | null>(null);
const ROBOT_ID = Number(process.env.EXPO_PUBLIC_ROBOT_ID ?? '1');

const field = <T,>(value: any, camel: string, pascal: string): T | undefined =>
  value?.[camel] ?? value?.[pascal];

function normalizePlaylist(raw: any[]): AdPlaylistItemDto[] {
  return raw.map((item, index) => ({
    sponsoredId: Number(field(item, 'sponsoredId', 'SponsoredId') ?? field(item, 'id', 'Id') ?? 0),
    // `id` trong payload ROS là SponsoredId, tuyệt đối không dùng thay AdCampaignId.
    adCampaignId: Number(field(item, 'adCampaignId', 'AdCampaignId') ?? 0),
    campaignName: String(field(item, 'campaignName', 'CampaignName') ?? field(item, 'name', 'Name') ?? ''),
    productId: Number(field(item, 'productId', 'ProductId') ?? 0),
    productName: String(field(item, 'productName', 'ProductName') ?? field(item, 'name', 'Name') ?? `Quảng cáo ${index + 1}`),
    productPrice: Number(field(item, 'productPrice', 'ProductPrice') ?? 0),
    priority: Number(field(item, 'priority', 'Priority') ?? index + 1),
    adScore: Number(field(item, 'adScore', 'AdScore') ?? 0),
    endDate: String(field(item, 'endDate', 'EndDate') ?? ''),
    imageUrl: String(field(item, 'imageUrl', 'ImageUrl') ?? ''),
    displayDurationSeconds: Number(
      field(item, 'displayDurationSeconds', 'DisplayDurationSeconds')
      ?? field(item, 'durationSeconds', 'DurationSeconds')
      ?? 0,
    ),
    mediaContents: (field<any[]>(item, 'mediaContents', 'MediaContents') ?? []).map((media) => {
      const rawType = String(field(media, 'resourceType', 'ResourceType') ?? '').toUpperCase();
      const resourceType = rawType === 'BANNER' ? 'IMAGE'
        : rawType === 'VOICETEXT' ? 'VOICE_TEXT'
          : rawType;
      return {
        resourceType: resourceType as any,
        resourceUrl: field<string | null>(media, 'resourceUrl', 'ResourceUrl') ?? null,
        contentText: field<string | null>(media, 'contentText', 'ContentText') ?? null,
        resolution: field<string | null>(media, 'resolution', 'Resolution') ?? null,
      };
    }),
  }));
}

export function GeofencingProvider({ children }: { children: React.ReactNode }) {
  const { isConnected, subscribeMissionAssigned, subscribeNavigationStatus } = useRobotRealtime();
  const [currentZone, setCurrentZone] = useState<ZoneEnteredPayload | null>(null);
  const [currentPlaylist, setCurrentPlaylist] = useState<AdPlaylistItemDto[]>([]);
  const [isLoadingPlaylist, setLoadingPlaylist] = useState(false);
  const handledArrivalRef = useRef<string | null>(null);
  const activeMissionRef = useRef<any | null>(null);

  const clearZone = useCallback(() => {
    setCurrentZone(null);
    setCurrentPlaylist([]);
  }, []);

  useEffect(() => {
    return subscribeMissionAssigned((mission) => {
      activeMissionRef.current = mission;
    });
  }, [subscribeMissionAssigned]);

  useEffect(() => {
    return subscribeNavigationStatus((payload) => {
    const incomingRobot = String(field(payload, 'robotCode', 'RobotCode') ?? '');
    const incomingMissionId = String(field(payload, 'missionId', 'MissionId') ?? '');
    const activeMissionId = String(field(activeMissionRef.current, 'missionId', 'MissionId') ?? '');
    const activeFlow = String(field(activeMissionRef.current, 'flowType', 'FlowType') ?? '').toLowerCase();
    const status = String(field(payload, 'navStatus', 'NavStatus') ?? '').toUpperCase();
    const role = String(field(payload, 'role', 'Role') ?? '').toLowerCase();

    if (incomingRobot.toUpperCase() !== ROBOT_CODE.toUpperCase()
      || !incomingMissionId || incomingMissionId !== activeMissionId
      || activeFlow !== 'ad') return;

    if (['MOVING', 'WAYPOINT_COMPLETED', 'PLAYLIST_COMPLETE', 'COMPLETED', 'FAILED', 'CANCELLED', 'ESTOP'].includes(status)) {
      clearZone();
      return;
    }
    if (status !== 'ARRIVED' || role !== 'ad') return;

    const waypointIndex = Number(field(payload, 'waypointIndex', 'WaypointIndex') ?? -1);
    const nodeId = Number(field(payload, 'nodeId', 'NodeId') ?? 0);
    const arrivalKey = `${incomingMissionId}|${waypointIndex}|${nodeId}`;
    if (handledArrivalRef.current === arrivalKey) return;
    handledArrivalRef.current = arrivalKey;

    const payloadZoneId = Number(field(payload, 'zoneId', 'ZoneId') ?? 0);
    const missionWaypoints = field<any[]>(activeMissionRef.current, 'waypoints', 'Waypoints') ?? [];
    const missionWaypoint = missionWaypoints.find((item, index) =>
      Number(field(item, 'nodeId', 'NodeId') ?? 0) === nodeId
      || (nodeId <= 0 && index === waypointIndex));
    const zoneId = payloadZoneId || Number(field(missionWaypoint, 'zoneId', 'ZoneId') ?? 0);
    const shelfName = field<string>(missionWaypoint, 'shelfName', 'ShelfName');
    const waypointName = field<string>(missionWaypoint, 'nodeName', 'NodeName')
      ?? field<string>(payload, 'currentWaypoint', 'CurrentWaypoint');
    // Điểm đến nghiệp vụ là kệ; "Waypoint" chỉ là tên kỹ thuật của tọa độ ROS.
    const objectName = String(shelfName ?? waypointName ?? `Kệ tại node ${nodeId}`);
    const dwellTimeSeconds = Number(field(payload, 'dwellTimeSeconds', 'DwellTimeSeconds') ?? 0);
    const directPlaylist = field<any[]>(payload, 'playlist', 'Playlist') ?? [];

    setCurrentZone({
      robotCode: incomingRobot,
      zoneId,
      semanticObjectId: nodeId || undefined,
      objectName,
      dwellTimeSeconds,
      missionId: incomingMissionId,
    });

    const loadPlaylist = async () => {
      setLoadingPlaylist(true);
      try {
        let playlist = normalizePlaylist(directPlaylist);
        const directPlaylistHasIdentity = playlist.length > 0
          && playlist.every(item => item.adCampaignId > 0 && item.sponsoredId > 0 && item.productId > 0);
        if (!directPlaylistHasIdentity && nodeId > 0)
          playlist = normalizePlaylist((await AdService.getPlaylistForNode(ROBOT_ID, nodeId)).playlist ?? []);
        if (playlist.length === 0 && zoneId > 0)
          playlist = normalizePlaylist((await AdService.getZonePlaylist(ROBOT_ID, zoneId)).playlist ?? []);
        if (handledArrivalRef.current === arrivalKey) setCurrentPlaylist(playlist);
        if (playlist.length === 0) console.warn(`[Geofencing] Node ${nodeId} không có playlist thật; không phát quảng cáo.`);
      } catch (error) {
        console.warn('[Geofencing] Không tải được playlist thật:', error);
        if (handledArrivalRef.current === arrivalKey) setCurrentPlaylist([]);
      } finally {
        if (handledArrivalRef.current === arrivalKey) setLoadingPlaylist(false);
      }
    };
    void loadPlaylist();
    });
  }, [clearZone, subscribeNavigationStatus]);

  return (
    <GeofencingContext.Provider value={{
      isHubConnected: isConnected,
      currentZone,
      currentPlaylist,
      isInZone: currentZone !== null,
      isLoadingPlaylist,
      clearZone,
    }}>
      {children}
    </GeofencingContext.Provider>
  );
}

export function useGeofencing() {
  const value = useContext(GeofencingContext);
  if (!value) throw new Error('useGeofencing must be used inside GeofencingProvider');
  return value;
}
