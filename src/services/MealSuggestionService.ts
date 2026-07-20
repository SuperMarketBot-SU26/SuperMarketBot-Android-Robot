const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || '';

export interface RecipeIngredientDto {
  productId: number;
  productName: string;
  unitPrice: number;
  imageUrl: string | null;
  quantityRequired: number;
  unitOfMeasure: string;
  inStock: boolean;
  currentStock: number;
  locationNodeId: number | null;
  shelfLocation: string | null;
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
}
