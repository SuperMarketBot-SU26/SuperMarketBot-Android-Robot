import { BASE_URL } from './AuthService';

export interface CartItemDto {
  cartItemId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string;
  alertType?: string;
  alertMessage?: string;
}

export interface CartDto {
  cartId: number;
  memberId: number;
  totalItems: number;
  totalPrice: number;
  items: CartItemDto[];
  alertType?: string;
  alertMessage?: string;
  remainingBudget?: number;
}

const parseErrorBody = async (response: Response) => {
  const rawText = await response.text();
  try {
    const data = JSON.parse(rawText);
    return { rawText, data };
  } catch (e) {
    return { rawText, data: {} as any };
  }
};

const normalizeCartDto = (data: any): CartDto => {
  if (!data) return data;
  const items = Array.isArray(data.items) ? data.items : [];
  const calculatedTotal = items.reduce((sum: number, item: any) => sum + (Number(item?.quantity) || 0), 0);
  return {
    ...data,
    items,
    totalItems: typeof data.totalItems === 'number' && data.totalItems > 0 ? data.totalItems : calculatedTotal,
  };
};

export class CartService {
  static async addItem(productId: number, quantity: number, token: string): Promise<CartDto> {
    console.log(`[CartService.addItem] POST ${BASE_URL}/api/cart/items`);
    const response = await fetch(`${BASE_URL}/api/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ productId, quantity }),
    });

    if (!response.ok) {
      const { rawText, data } = await parseErrorBody(response);
      console.error(`[CartService.addItem] Error body (${response.status}):`, rawText);
      throw new Error(data.error || data.message || data.detail || `Thêm sản phẩm thất bại (${response.status})`);
    }

    const data = await response.json();
    return normalizeCartDto(data);
  }

  static async getCart(token: string): Promise<CartDto> {
    const response = await fetch(`${BASE_URL}/api/cart`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        Authorization: `Bearer ${token}`
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { cartId: 0, memberId: 0, totalItems: 0, totalPrice: 0, items: [] };
      }
      throw new Error(`Lấy giỏ hàng thất bại (${response.status})`);
    }
    const data = await response.json();
    return normalizeCartDto(data);
  }

  static async updateItemQuantity(productId: number, quantity: number, token: string): Promise<CartDto> {
    console.log(`[CartService.updateItemQuantity] PUT ${BASE_URL}/api/cart/items/${productId}`);
    const response = await fetch(`${BASE_URL}/api/cart/items/${productId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ quantity }),
    });

    if (!response.ok) {
      const { rawText, data } = await parseErrorBody(response);
      console.error(`[CartService.updateItemQuantity] Error body (${response.status}):`, rawText);
      throw new Error(data.error || data.message || data.detail || `Cập nhật số lượng thất bại (${response.status})`);
    }

    const data = await response.json();
    return normalizeCartDto(data);
  }

  static async removeItem(productId: number, token: string): Promise<CartDto> {
    console.log(`[CartService.removeItem] DELETE ${BASE_URL}/api/cart/items/${productId}`);
    const response = await fetch(`${BASE_URL}/api/cart/items/${productId}`, {
      method: 'DELETE',
      headers: {
        'ngrok-skip-browser-warning': 'true',
        Authorization: `Bearer ${token}`
      },
    });

    if (!response.ok) {
      const { rawText, data } = await parseErrorBody(response);
      console.error(`[CartService.removeItem] Error body (${response.status}):`, rawText);
      throw new Error(data.error || data.message || data.detail || `Xóa sản phẩm thất bại (${response.status})`);
    }

    const data = await response.json();
    return normalizeCartDto(data);
  }

  static async clearCart(token: string): Promise<CartDto> {
    console.log(`[CartService.clearCart] DELETE ${BASE_URL}/api/cart`);
    const response = await fetch(`${BASE_URL}/api/cart`, {
      method: 'DELETE',
      headers: {
        'ngrok-skip-browser-warning': 'true',
        Authorization: `Bearer ${token}`
      },
    });

    if (!response.ok) {
      const { rawText, data } = await parseErrorBody(response);
      console.error(`[CartService.clearCart] Error body (${response.status}):`, rawText);
      throw new Error(data.error || data.message || data.detail || `Xóa giỏ hàng thất bại (${response.status})`);
    }

    const data = await response.json();
    return normalizeCartDto(data);
  }

  /**
   * Lưu lịch sử chuyến mua sắm (Hóa đơn / InvoiceHistory) cho Member vào Backend.
   * Dùng khi Member hoàn tất dẫn đường từ giỏ hàng hoặc từ bất kỳ màn hình nào.
   */
  static async recordShoppingTrip(
    payload: {
      fromCart?: boolean;
      items?: { productId: number; quantity: number; unitPrice?: number }[];
    },
    token: string
  ): Promise<{ invoiceHistoryId: number; totalPrice: number; totalItems: number; message: string } | null> {
    console.log(`[CartService.recordShoppingTrip] POST ${BASE_URL}/api/members/me/orders/record-shopping-trip`, payload);
    try {
      const response = await fetch(`${BASE_URL}/api/members/me/orders/record-shopping-trip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fromCart: payload.fromCart ?? false,
          items: payload.items ?? [],
        }),
      });

      if (!response.ok) {
        const { rawText } = await parseErrorBody(response);
        console.warn(`[CartService.recordShoppingTrip] Warning (${response.status}):`, rawText);
        return null;
      }

      const data = await response.json();
      console.log(`[CartService.recordShoppingTrip] Success:`, data);
      return data;
    } catch (err) {
      console.warn(`[CartService.recordShoppingTrip] Network or parse error:`, err);
      return null;
    }
  }
}

