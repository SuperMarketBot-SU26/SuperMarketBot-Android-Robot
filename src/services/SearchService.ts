import { BASE_URL } from './AuthService';

export interface ProductLocation {
  semanticObjectId: number;
  shelfName: string | null;
  zone: string | null;
}

export interface MobileProductSearchResultDto {
  productId: number;
  productName: string;
  description?: string;
  unitPrice: number;
  status: string;
  imageUrl: string | null;
  productTypeId: number;
  location: ProductLocation | null;
  promotionPrice?: number;
  discountPercent?: number;
  promotionLabel?: string;
}

export interface SearchResultItemDto {
  productId: number;
  productName: string;
  description?: string;
  unitPrice: number;
  promotionPrice?: number;
  imageUrl?: string;
  status: string;
  categoryName?: string;
  subcategoryName?: string;
  productTypeName?: string;
  relevanceScore: number;
  healthTags: string[];
  aisleCode?: string;
  levelNumber?: number;
  slotCode?: string;
}

export interface SearchResponseDto {
  query: string;
  totalMatches: number;
  results: SearchResultItemDto[];
  aiRanked: boolean;
  aiExplanation?: string;
}

export interface IngredientRecommendationDto {
  productId: number;
  productName: string;
  reason: string;
  imageUrl: string;
  unitPrice: number;
  quantity: number;
  quantityText: string;
}

export interface RecommendIngredientsResponseDto {
  ingredients: IngredientRecommendationDto[];
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

  classifyIntent(query: string): 'recipe' | 'product' {
    if (!query) return 'product';
    const lowerQuery = query.toLowerCase();
    const recipeKeywords = [
      'nấu', 'món', 'cách làm', 'công thức', 'hướng dẫn', 
      'canh', 'kho', 'chiên', 'xào', 'luộc', 'gỏi', 'lẩu', 'chuẩn bị', 'nguyên liệu'
    ];
    if (recipeKeywords.some(kw => lowerQuery.includes(kw))) {
      return 'recipe';
    }
    return 'product';
  },

  async recommendIngredients(dishName: string): Promise<RecommendIngredientsResponseDto> {
    try {
      const url = `${BASE_URL}/api/search/recommend-ingredients`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ dishName }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[SearchService] Error recommending ingredients:', error);
      return { ingredients: [] }; // Fallback to empty list as per specs
    }
  },

  async searchPersonalized(params: {
    q: string;
    limit?: number;
    sortBy?: string;
    useAi?: boolean;
    token?: string | null;
  }): Promise<SearchResponseDto> {
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
      
      let errorMessage = `Tìm kiếm cá nhân hóa thất bại (${response.status})`;
      try {
        const errorJson = JSON.parse(rawText);
        if (errorJson.message) {
          errorMessage = errorJson.message;
        } else if (errorJson.detail) {
          errorMessage = errorJson.detail;
        } else if (errorJson.title) {
          errorMessage = errorJson.title;
        } else if (typeof errorJson === 'string') {
          errorMessage = errorJson;
        }
      } catch (e) {
        if (rawText) {
          errorMessage = rawText;
        }
      }
      
      throw new Error(errorMessage);
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
  }): Promise<SearchResponseDto> {
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
      
      console.log('[SearchService] getDeals calling URL:', url.toString());

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
        discountPercent: item.discountPercent,
        promotionLabel: item.promotionLabel,
      }));
    } catch (error) {
      console.error('[SearchService] Error fetching deals:', error);
      throw error;
    }
  }
};
