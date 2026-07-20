import { BASE_URL } from './AuthService';

export interface ProductLocation {
  semanticObjectId: number;
  shelfName: string | null;
  zone: string | null;
}

export interface MobileProductSearchResultDto {
  productId: number;
  productName: string;
  unitPrice: number;
  status: string;
  imageUrl: string | null;
  productTypeId: number;
  location: ProductLocation | null;
  promotionPrice?: number;
  discountPercent?: number;
}

export const SearchService = {
  async searchProducts(keyword: string): Promise<MobileProductSearchResultDto[]> {
    try {
      const url = new URL(`${BASE_URL}/api/mobile/products/search`);
      url.searchParams.append('keyword', keyword);
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[SearchService] Error searching products:', error);
      throw error;
    }
  },

  async searchPersonalized(params: {
    q: string;
    limit?: number;
    sortBy?: string;
    useAi?: boolean;
    token?: string | null;
  }): Promise<any> {
    const { q, limit = 20, sortBy = 'relevance', useAi = false, token } = params;

    let url = `${BASE_URL}/api/search/personalized?q=${encodeURIComponent(q)}&limit=${limit}&sortBy=${sortBy}&useAi=${useAi}`;

    console.log(`[SearchService.searchPersonalized] GET ${url}`);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const rawText = await response.text();
    if (!response.ok) {
      console.error(`[SearchService.searchPersonalized] Error body (${response.status}):`, rawText);
      throw new Error(`Tìm kiếm cá nhân hóa thất bại (${response.status})`);
    }

    try {
      return JSON.parse(rawText);
    } catch (e) {
      throw new Error('Phản hồi từ server không hợp lệ');
    }
  },

  async searchAll(params: {
    q: string;
    limit?: number;
    sortBy?: string;
    useAi?: boolean;
    token?: string | null;
  }): Promise<any> {
    const { q, limit = 20, sortBy = 'relevance', useAi = false, token } = params;

    let url = `${BASE_URL}/api/search/all?q=${encodeURIComponent(q)}&limit=${limit}&sortBy=${sortBy}&useAi=${useAi}`;

    console.log(`[SearchService.searchAll] GET ${url}`);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const rawText = await response.text();
    if (!response.ok) {
      console.error(`[SearchService.searchAll] Error body (${response.status}):`, rawText);
      throw new Error(`Tìm kiếm tất cả thất bại (${response.status})`);
    }

    try {
      return JSON.parse(rawText);
    } catch (e) {
      throw new Error('Phản hồi từ server không hợp lệ');
    }
  },

  async getDeals(memberId?: number, minDiscountPercent?: number): Promise<MobileProductSearchResultDto[]> {
    try {
      const url = new URL(`${BASE_URL}/api/v1/products/deals`);
      if (memberId) url.searchParams.append('memberId', memberId.toString());
      if (minDiscountPercent) url.searchParams.append('minDiscountPercent', minDiscountPercent.toString());
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const items = data.items || data || [];
      return items.map((item: any) => ({
        ...item,
        unitPrice: item.unitPrice || item.originalPrice || 0,
        promotionPrice: item.promotionPrice || item.dealPrice,
      }));
    } catch (error) {
      console.error('[SearchService] Error fetching deals:', error);
      throw error;
    }
  }
};
