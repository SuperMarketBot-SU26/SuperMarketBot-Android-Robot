const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || '';

export interface MemberDealDto {
  productId: number;
  productName: string;
  originalPrice: number;
  discountedPrice: number;
  discountPct: number;
  dealType: string;
  reason?: string;
  imageUrl?: string;
}

export interface MemberDealsResponseDto {
  memberId: number;
  deals: MemberDealDto[];
  totalDeals: number;
}

export interface SponsoredRecommendationDto {
  sponsoredId: number;
  adCampaignId: number;
  campaignName: string;
  brandId: number;
  brandName: string;
  productId: number;
  productName: string;
  unitPrice: number;
  promotionPrice?: number;
  imageUrl?: string;
  slotId?: number;
  slotCode?: string;
  zoneId?: number;
  zoneName?: string;
  priority: number;
  profileScore: number;
  weekendBonus: number;
  totalScore: number;
  hasAllergenConflict: boolean;
  allergenConflicts: string[];
}

export interface SponsoredRecommendationsResponseDto {
  memberId: number;
  contextSlotId?: number;
  contextZoneId?: number;
  contextZoneName?: string;
  totalCount: number;
  items: SponsoredRecommendationDto[];
}

export interface MemberAlertDto {
  alertId: number;
  alertType: string;
  alertMessage: string;
  createdAt: string;
  isRead: boolean;
}

export interface MemberAlertsResponseDto {
  memberId: number;
  unreadCount: number;
  alerts: MemberAlertDto[];
}

export class MemberService {
  /**
   * GET /api/members/{memberId}/deals
   * Lấy danh sách các ưu đãi (deals) dành riêng cho Member đang đứng trước Robot.
   */
  static async getMemberDeals(memberId: number): Promise<MemberDealsResponseDto | null> {
    try {
      const response = await fetch(`${BASE_URL}/api/members/${memberId}/deals`);
      if (!response.ok) {
        console.error('[MemberService.getMemberDeals] failed:', response.status);
        return null;
      }
      const data: MemberDealsResponseDto = await response.json();
      return data;
    } catch (error) {
      console.error('[MemberService.getMemberDeals] error:', error);
      return null;
    }
  }

  /**
   * GET /api/members/{memberId}/sponsored-recommendations
   * Lấy danh sách các sản phẩm gợi ý (có tài trợ) dành riêng cho Member.
   */
  static async getSponsoredRecommendations(memberId: number): Promise<SponsoredRecommendationsResponseDto | null> {
    try {
      const response = await fetch(`${BASE_URL}/api/members/${memberId}/sponsored-recommendations`);
      if (!response.ok) {
        console.error('[MemberService.getSponsoredRecommendations] failed:', response.status);
        return null;
      }
      const data: SponsoredRecommendationsResponseDto = await response.json();
      return data;
    } catch (error) {
      console.error('[MemberService.getSponsoredRecommendations] error:', error);
      return null;
    }
  }

  /**
   * GET /api/members/{memberId}/alerts
   * Lấy danh sách cảnh báo hệ thống dành cho Member đang tương tác.
   */
  static async getMemberAlerts(memberId: number): Promise<MemberAlertsResponseDto | null> {
    try {
      const response = await fetch(`${BASE_URL}/api/members/${memberId}/alerts`);
      if (!response.ok) {
        console.error('[MemberService.getMemberAlerts] failed:', response.status);
        return null;
      }
      const data: MemberAlertsResponseDto = await response.json();
      return data;
    } catch (error) {
      console.error('[MemberService.getMemberAlerts] error:', error);
      return null;
    }
  }

  /**
   * PUT /api/members/{memberId}/alerts/mark-read
   * Đánh dấu tất cả cảnh báo đã đọc cho Member.
   */
  static async markAlertsAsRead(memberId: number): Promise<boolean> {
    try {
      const response = await fetch(`${BASE_URL}/api/members/${memberId}/alerts/mark-read`, {
        method: 'PUT',
      });
      if (!response.ok) {
        console.error('[MemberService.markAlertsAsRead] failed:', response.status);
        return false;
      }
      return true;
    } catch (error) {
      console.error('[MemberService.markAlertsAsRead] error:', error);
      return false;
    }
  }
}
