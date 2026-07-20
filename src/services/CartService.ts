import { BASE_URL } from './AuthService';

export interface CartItemDto {
  cartItemId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string;
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

    return response.json();
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
    return response.json();
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

    return response.json();
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

    return response.json();
  }
}
