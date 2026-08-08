const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || '';

export interface RecipeIngredientDto {
  productId: number;
  productName: string;
  unitPrice: number;
  promotionPrice?: number | null;
  imageUrl: string | null;
  quantityRequired: number;
  unitOfMeasure: string;
  inStock: boolean;
  currentStock: number;
  locationNodeId: number | null;
  shelfLocation: string | null;
}

export interface AiMenuAssistantRequestDto {
  recipeId: number;
  portions?: number;
}

export interface MenuAssistantResponseDto {
  recipeId: number;
  recipeName: string;
  portions: number;
  calories: number | null;
  healthyScore: number | null;
  alternativeSuggestion: string | null;
  estimatedTotalCost: number;
  ingredients: RecipeIngredientDto[];
  optimizedShoppingRoute: number[];
  imageUrl?: string | null;
}

export class MealSuggestionService {
  /**
   * Lấy chi tiết món ăn và danh sách nguyên liệu
   */
  static async getRecipeDetail(recipeId: number, portions: number = 1): Promise<MenuAssistantResponseDto | null> {
    try {
      const response = await fetch(`${BASE_URL}/api/MealSuggestions/menu-assistant?recipeId=${recipeId}&portions=${portions}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (!response.ok) {
        console.error(`[MealSuggestionService.getRecipeDetail] failed: ${response.status}`);
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('[MealSuggestionService.getRecipeDetail] error:', error);
      return null;
    }
  }

  /**
   * Gọi AI Menu Assistant
   */
  static async getAiMenuAssistant(recipeId: number, portions: number = 1): Promise<MenuAssistantResponseDto | null> {
    try {
      const requestDto: AiMenuAssistantRequestDto = { recipeId, portions };
      const response = await fetch(`${BASE_URL}/api/MealSuggestions/ai-menu-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(requestDto)
      });
      
      if (!response.ok) {
        console.warn(`[MealSuggestionService.getAiMenuAssistant] failed: ${response.status}`);
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('[MealSuggestionService.getAiMenuAssistant] error:', error);
      return null;
    }
  }
}
