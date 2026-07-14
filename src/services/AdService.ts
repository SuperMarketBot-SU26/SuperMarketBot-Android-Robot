import { API_BASE_URL } from '../api';

export interface AdResourceDto {
  resourceType: 'IMAGE' | 'VIDEO' | 'VOICE_TEXT';
  resourceUrl: string | null;
  contentText: string | null;
  resolution: string | null;
}

export interface AdPlaylistItemDto {
  sponsoredId: number;
  adCampaignId: number;
  campaignName: string;
  productId: number;
  productName: string;
  productPrice: number;
  priority: number;
  adScore: number;
  endDate: string;
  imageUrl: string;
  displayDurationSeconds: number;
  mediaContents: AdResourceDto[];
}

export interface RobotPlaylistResponseDto {
  robotId: number;
  currentZoneId?: number;
  semanticObjectId?: number;
  generatedAt: string;
  playlist: AdPlaylistItemDto[];
}

export interface ImpressionRequestDto {
  slotId: number;
  xCoord: number;
  yCoord: number;
  memberId?: number;
}

export interface LogInteractionRequestDto {
  adCampaignId: number;
  actionType: 'Click' | 'Navigation' | 'Impression';
  sponsoredId: number;
  productId: number;
  robotId: number;
  semanticObjectId?: number;
  zoneId?: number;
  slotId?: number;
  memberId?: number;
  sessionId?: string;
  xCoord?: number;
  yCoord?: number;
}

export const AdService = {
  /**
   * Lấy danh sách quảng cáo cần phát trên Robot dựa theo vị trí hiện tại
   */
  async getRobotPlaylist(robotId: number, semanticObjectId?: number): Promise<RobotPlaylistResponseDto> {
    const query = semanticObjectId ? `?semanticObjectId=${semanticObjectId}` : '';
    const response = await fetch(`${API_BASE_URL}/api/v1/ad-campaign/${robotId}/robot-playlist${query}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch robot playlist: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Ghi nhận impression khi Robot đi qua một vị trí (3 luồng charge tiền)
   */
  async recordImpression(robotCode: string, payload: ImpressionRequestDto): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/robots/${robotCode}/impression`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to record impression: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Ghi log tương tác của khách hàng với quảng cáo trên Robot (Ví dụ: Click)
   */
  async logInteraction(payload: LogInteractionRequestDto): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/v1/ad-campaign/log-interaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to log interaction: ${response.status}`);
    }

    return response.json();
  }
};
