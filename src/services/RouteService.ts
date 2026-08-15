/**
 * RouteService.ts
 *
 * Lấy danh sách các lộ trình cố định (Fixed Routes) cho 1 bản đồ từ Backend.
 * Endpoint: GET ${BASE_URL}/api/v1/routes?mapId={mapId}
 *
 * Khi BE không khả dụng hoặc trả về rỗng, caller phải khóa điều khiển robot.
 */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || '';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Waypoint {
  nodeId: number;
  nodeName?: string;
  x: number;
  y: number;
  sequenceOrder: number;
}

export interface RobotRoute {
  robotRouteId: number;
  mapId: number;
  robotId: number;
  routeName: string;
  routeType: string;
  description?: string | null;
  zoneId?: number | null;
  zoneName?: string | null;
  createdAt: string;
  waypoints: Waypoint[];
}

// ─── Service ───────────────────────────────────────────────────────────────────

/**
 * Fetch danh sách routes theo mapId.
 * Trả `[]` + console.warn khi lỗi (KHÔNG throw) để UI khóa điều khiển.
 */
export async function fetchRoutesByMap(mapId: number): Promise<RobotRoute[]> {
  const url = `${BASE_URL}/api/v1/routes?mapId=${mapId}`;
  console.log(`[RouteService] GET ${url}`);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    });

    if (!res.ok) {
      console.warn(`[RouteService] HTTP ${res.status} — fallback`);
      return [];
    }

    const raw: any[] = await res.json();
    if (!Array.isArray(raw)) {
      console.warn('[RouteService] Response không phải array — fallback');
      return [];
    }

    const routes: RobotRoute[] = raw.map((r) => ({
      robotRouteId: Number(r.robotRouteId ?? r.RobotRouteId ?? 0),
      mapId: Number(r.mapId ?? r.MapId ?? 0),
      robotId: Number(r.robotId ?? r.RobotId ?? 0),
      routeName: String(r.routeName ?? r.RouteName ?? '—'),
      routeType: String(r.routeType ?? r.RouteType ?? 'General'),
      description: r.description ?? r.Description ?? null,
      zoneId: r.zoneId ?? r.ZoneId ?? null,
      zoneName: r.zoneName ?? r.ZoneName ?? null,
      createdAt: r.createdAt ?? r.CreatedAt ?? new Date().toISOString(),
      waypoints: Array.isArray(r.waypoints)
        ? r.waypoints.map((w: any) => ({
            nodeId: Number(w.nodeId ?? w.NodeId ?? 0),
            nodeName: w.nodeName ?? w.NodeName ?? undefined,
            x: Number(w.x ?? w.X ?? w.XCoord ?? 0),
            y: Number(w.y ?? w.Y ?? w.YCoord ?? 0),
            sequenceOrder: Number(w.sequenceOrder ?? w.SequenceOrder ?? 0),
          }))
        : [],
    }));

    console.log(`[RouteService] OK — ${routes.length} routes`);
    return routes;
  } catch (e) {
    console.warn('[RouteService] Lỗi fetch:', e);
    return [];
  }
}
export async function optimizeShoppingRoute(productIds: number[], startX: number = 1.5, startY: number = 2.8) {
  const url = `${BASE_URL}/api/Navigation/optimize-shopping-route`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds, startX, startY, robotId: 1 }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.log('[RouteService] API Error:', res.status, errorText);
      return null;
    }
    const raw = await res.json();
    // The C# API returns OptimizeShoppingRouteResponseDto directly
    if (!raw || !raw.waypoints) return null;
    return raw;
  } catch (e) {
    console.warn('[RouteService] L?i optimize:', e);
    return null;
  }
}
