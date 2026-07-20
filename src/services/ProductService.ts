import { BASE_URL } from './AuthService';

export interface HealthTagDto {
  healthTagId: number;
  tagName: string;
  tagType: string;
}

export interface ProductDetailDto {
  productId: number;
  productName: string;
  unitPrice: number;
  promotionPrice?: number;
  status: string;
  imageUrl?: string;
  description?: string;
  productTypeId: number;
  isOnSale: boolean;
  isFavorite: boolean;
  healthTags: HealthTagDto[];
}

export class ProductService {
  static async getProductDetail(productId: number, memberId?: number | string): Promise<ProductDetailDto | null> {
    try {
      let url = `${BASE_URL}/api/products/${productId}/detail`;
      if (memberId) {
        url += `?memberId=${memberId}`;
      }
      
      const response = await fetch(url, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      
      if (!response.ok) {
        console.error(`[ProductService.getProductDetail] failed: ${response.status}`);
        return null;
      }
      
      return await response.json();
    } catch (error) {
      console.error('[ProductService.getProductDetail] error:', error);
      return null;
    }
  }
}
