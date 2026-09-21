import { BASE_URL } from './AuthService';
import { StoreShelf, SHELVES_6 } from '../components/map/StoreLayoutConstants';

export interface StoreMapNode {
  nodeId: number;
  nodeName: string;
  xCoord: number;
  yCoord: number;
  nodeType: string;
  nodeRole?: string;
  isBlocked: boolean;
  headingYaw?: number;
}

export interface StoreMapSpecialNodes {
  dock?: StoreMapNode;
  cashier?: StoreMapNode;
  entrance?: StoreMapNode;
}

export interface StoreMapLayout {
  mapId: number;
  floorId: number;
  mapName: string;
  widthMeters: number;
  heightMeters: number;
  resolution: number;
  originX: number;
  originY: number;
  floorplanImageUrl?: string;
  shelves: StoreShelf[];
  nodes: StoreMapNode[];
  specialNodes?: StoreMapSpecialNodes;
  lastUpdatedAt?: string;
}

class StoreMapServiceClass {
  private cachedLayout: StoreMapLayout | null = null;
  private lastFetchTime = 0;
  private readonly CACHE_TTL_MS = 10_000; // 10s cache unless forceRefreshed

  async getStoreMapLayout(floorId = 1, forceRefresh = false): Promise<StoreMapLayout | null> {
    const now = Date.now();
    if (!forceRefresh && this.cachedLayout && now - this.lastFetchTime < this.CACHE_TTL_MS) {
      return this.cachedLayout;
    }

    try {
      const url = `${BASE_URL}/api/v1/maps/active/store-layout?floorId=${floorId}`;
      const response = await fetch(url, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`[StoreMapService] HTTP ${response.status} when fetching store-layout, falling back to local constants`);
        return this.cachedLayout ?? this.getDefaultFallbackLayout();
      }

      const data = await response.json();
      const mappedShelves: StoreShelf[] = (data.shelves || []).map((s: any) => ({
        shelfId: s.shelfId,
        arucoTag: s.arucoTag,
        aisleCode: s.aisleCode,
        name: s.shelfName,
        category: s.category,
        icon: s.icon,
        x: s.mapX,
        y: s.mapY,
        width: s.width,
        height: s.height,
        themeColor: s.themeColor,
        themeBg: s.themeBg,
        sampleProducts: s.sampleProducts || [],
        nodeId: s.nodeId,
        rosX: s.rosX,
        rosY: s.rosY,
      }));

      const layout: StoreMapLayout = {
        mapId: data.mapId ?? 1,
        floorId: data.floorId ?? floorId,
        mapName: data.mapName ?? 'Bản đồ siêu thị SmartMarket',
        widthMeters: data.widthMeters ?? 3.0,
        heightMeters: data.heightMeters ?? 3.0,
        resolution: data.resolution ?? 0.05,
        originX: data.originX ?? 0.0,
        originY: data.originY ?? 0.0,
        floorplanImageUrl: data.floorplanImageUrl,
        shelves: mappedShelves.length > 0 ? mappedShelves : SHELVES_6,
        nodes: data.nodes || [],
        specialNodes: data.specialNodes,
        lastUpdatedAt: data.lastUpdatedAt || new Date().toISOString(),
      };

      this.cachedLayout = layout;
      this.lastFetchTime = now;
      return layout;
    } catch (error) {
      console.warn('[StoreMapService] Network error fetching dynamic map layout:', error);
      return this.cachedLayout ?? this.getDefaultFallbackLayout();
    }
  }

  private getDefaultFallbackLayout(): StoreMapLayout {
    return {
      mapId: 1,
      floorId: 1,
      mapName: 'Sơ đồ siêu thị mặc định',
      widthMeters: 3.0,
      heightMeters: 3.0,
      resolution: 0.05,
      originX: 0.0,
      originY: 0.0,
      shelves: SHELVES_6,
      nodes: [],
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  clearCache() {
    this.cachedLayout = null;
    this.lastFetchTime = 0;
  }
}

export const StoreMapService = new StoreMapServiceClass();
