import React, { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { Sheet, YStack, XStack, Text, Button, Image, Spinner, H4, Paragraph, View } from 'tamagui';
import { X, Sparkles, Heart, Activity, ShoppingCart, Minus, Plus } from 'lucide-react-native';
import { ProductService, ProductDetailDto } from '../../services/ProductService';
import { useRobotAuth } from '../../context/RobotAuthContext';
import { CartService } from '../../services/CartService';
import { useRobotVoice } from '../../hooks/useRobotVoice';
import { MealSuggestionService, MenuAssistantResponseDto } from '../../services/MealSuggestionService';

interface ProductDetailSheetProps {
  productId: number | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCartUpdated?: () => void;
  isRecipe?: boolean;
}

export function ProductDetailSheet({ productId, isOpen, onOpenChange, onCartUpdated, isRecipe = false }: ProductDetailSheetProps) {
  const { member, token } = useRobotAuth();
  const { speak } = useRobotVoice();
  
  const [detail, setDetail] = useState<ProductDetailDto | null>(null);
  const [recipeDetail, setRecipeDetail] = useState<MenuAssistantResponseDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (isOpen && productId) {
      setQuantity(1);
      fetchDetail();
    } else {
      setDetail(null);
      setRecipeDetail(null);
      setAddSuccess(false);
    }
  }, [isOpen, productId, isRecipe]);

  const fetchDetail = async () => {
    setLoading(true);
    if (isRecipe) {
      const data = await MealSuggestionService.getRecipeDetail(productId!);
      setRecipeDetail(data);
      setLoading(false);
      
      if (data) {
        speak(`Bạn đang xem công thức ${data.recipeName}. Ước tính tổng chi phí là ${data.estimatedTotalCost.toLocaleString('vi-VN')} đồng.`);
      }
    } else {
      const data = await ProductService.getProductDetail(productId!, member?.memberId);
      setDetail(data);
      setLoading(false);
      
      if (data) {
        speak(`Bạn đang xem ${data.productName}. Giá ${data.promotionPrice ? data.promotionPrice : data.unitPrice} đồng.`);
      }
    }
  };

  const handleAddToCart = async () => {
    if (!token) return;
    
    setAddingToCart(true);
    try {
      if (isRecipe && recipeDetail) {
        // Add all ingredients
        for (const item of recipeDetail.ingredients) {
          if (item.inStock) {
            await CartService.addItem(item.productId, 1, token);
          }
        }
        setAddSuccess(true);
        speak(`Đã thêm các nguyên liệu của ${recipeDetail.recipeName} vào giỏ hàng`);
      } else if (detail) {
        await CartService.addItem(detail.productId, quantity, token);
        setAddSuccess(true);
        speak(`Đã thêm ${quantity} ${detail.productName} vào giỏ hàng`);
      }
      
      if (onCartUpdated) onCartUpdated();
      setTimeout(() => setAddSuccess(false), 2000);
    } catch (err: any) {
      speak(err.message || 'Lỗi thêm vào giỏ hàng');
    } finally {
      setAddingToCart(false);
    }
  };

  return (
    <Sheet
      modal={false}
      open={isOpen}
      onOpenChange={onOpenChange}
      snapPoints={[85]}
      dismissOnSnapToBottom
    >
      <Sheet.Overlay backgroundColor="rgba(0,0,0,0.4)" />
      <Sheet.Frame backgroundColor="white" padding="$0" borderTopLeftRadius={24} borderTopRightRadius={24}>
        <Sheet.Handle />
        
        {/* Close Button */}
        <Button
          position="absolute"
          top="$3"
          right="$3"
          size="$4"
          circular
          backgroundColor="#f1f5f9"
          icon={<X size={20} color="#334155" />}
          onPress={() => onOpenChange(false)}
          zIndex={10}
        />

        {loading ? (
          <YStack flex={1} justifyContent="center" alignItems="center">
            <Spinner size="large" color="#00A550" />
            <Text marginTop="$4" color="#64748b">Đang tải thông tin {isRecipe ? 'công thức' : 'sản phẩm'}...</Text>
          </YStack>
        ) : (detail || recipeDetail) ? (
          <YStack flex={1}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View backgroundColor="white" padding="$4" height={280} width="100%" alignItems="center" justifyContent="center" borderBottomWidth={1} borderBottomColor="#f1f5f9">
                {(!isRecipe && detail?.imageUrl) ? (
                  <Image src={detail.imageUrl} width="100%" height="100%" resizeMode="contain" />
                ) : (
                  <YStack alignItems="center" gap="$2">
                    <ShoppingCart size={48} color="#cbd5e1" />
                    <Text color="#cbd5e1" fontSize={14}>
                      {isRecipe ? 'Hình ảnh món ăn' : 'Chưa có hình ảnh'}
                    </Text>
                  </YStack>
                )}
              </View>

              <YStack padding="$4" gap="$4">
                <YStack gap="$2">
                  <XStack justifyContent="space-between" alignItems="flex-start">
                    <H4 flex={1} fontWeight="900" color="#1e293b" paddingRight="$4">
                      {isRecipe ? recipeDetail?.recipeName : detail?.productName}
                    </H4>
                    {!isRecipe && detail?.isFavorite ? (
                      <Heart size={24} color="#ef4444" fill="#ef4444" />
                    ) : null}
                  </XStack>

                  <XStack alignItems="center" gap="$3">
                    {isRecipe ? (
                      <Text fontSize={22} fontWeight="bold" color="#00A550">
                        {recipeDetail?.estimatedTotalCost.toLocaleString('vi-VN')}đ (Ước tính)
                      </Text>
                    ) : detail?.promotionPrice ? (
                      <>
                        <Text fontSize={22} fontWeight="bold" color="#00A550">
                          {detail.promotionPrice.toLocaleString('vi-VN')}đ
                        </Text>
                        <Text fontSize={16} color="#94a3b8" textDecorationLine="line-through">
                          {detail.unitPrice.toLocaleString('vi-VN')}đ
                        </Text>
                      </>
                    ) : (
                      <Text fontSize={22} fontWeight="bold" color="#00A550">
                        {detail?.unitPrice.toLocaleString('vi-VN')}đ
                      </Text>
                    )}
                  </XStack>
                  
                  {!isRecipe && detail?.status === 'OutOfStock' ? (
                    <View alignSelf="flex-start" backgroundColor="#fee2e2" paddingHorizontal="$2" paddingVertical="$1" borderRadius={8}>
                      <Text color="#ef4444" fontSize={12} fontWeight="bold">Tạm hết hàng</Text>
                    </View>
                  ) : null}

                  {/* Quantity Selector for Products */}
                  {!isRecipe && detail?.status !== 'OutOfStock' ? (
                    <XStack alignItems="center" gap="$3" marginTop="$2" backgroundColor="#f8fafc" padding="$2" borderRadius={12} alignSelf="flex-start">
                      <Button size="$3" circular icon={<Minus size={16} color="#64748b" />} onPress={() => setQuantity(q => Math.max(1, q - 1))} backgroundColor="white" borderWidth={1} borderColor="#e2e8f0" disabled={quantity <= 1} />
                      <Text fontSize={16} fontWeight="bold" width={30} textAlign="center" color="#334155">{quantity}</Text>
                      <Button size="$3" circular icon={<Plus size={16} color="#64748b" />} onPress={() => setQuantity(q => q + 1)} backgroundColor="white" borderWidth={1} borderColor="#e2e8f0" />
                    </XStack>
                  ) : null}
                </YStack>

                {/* Recipe Ingredients Section */}
                {isRecipe && recipeDetail?.ingredients && (
                  <YStack gap="$3" marginTop="$2">
                    <Text fontSize={16} fontWeight="bold" color="#334155">Danh sách nguyên liệu</Text>
                    {recipeDetail.ingredients.map(ing => (
                      <XStack key={ing.productId} padding="$3" backgroundColor="#f8fafc" borderRadius={12} alignItems="center" gap="$3">
                        <View width={48} height={48} backgroundColor="#e2e8f0" borderRadius={8} overflow="hidden">
                          {ing.imageUrl ? (
                            <Image src={ing.imageUrl} width="100%" height="100%" />
                          ) : (
                            <View flex={1} justifyContent="center" alignItems="center">
                              <ShoppingCart size={20} color="#94a3b8" />
                            </View>
                          )}
                        </View>
                        <YStack flex={1}>
                          <Text fontSize={14} fontWeight="bold" color="#334155">{ing.productName}</Text>
                          <Text fontSize={12} color="#64748b">Số lượng: {ing.quantityRequired} {ing.unitOfMeasure}</Text>
                        </YStack>
                        <YStack alignItems="flex-end">
                          <Text fontSize={14} fontWeight="bold" color="#00A550">{ing.unitPrice.toLocaleString('vi-VN')}đ</Text>
                          {!ing.inStock && <Text fontSize={10} color="#ef4444" fontWeight="bold">Hết hàng</Text>}
                        </YStack>
                      </XStack>
                    ))}
                  </YStack>
                )}

                {/* Health Tags (Only for Product) */}
                {!isRecipe && detail?.healthTags && detail.healthTags.length > 0 ? (
                  <YStack gap="$2" marginTop="$2">
                    <Text fontSize={16} fontWeight="bold" color="#334155">Đặc tính sản phẩm</Text>
                    <XStack flexWrap="wrap" gap="$2">
                      {detail.healthTags.map(tag => (
                        <XStack key={tag.healthTagId} backgroundColor="#f0fdf4" paddingHorizontal="$3" paddingVertical="$2" borderRadius={16} alignItems="center" gap="$1.5">
                          <Activity size={14} color="#16a34a" />
                          <Text color="#16a34a" fontSize={12} fontWeight="bold">{tag.tagName}</Text>
                        </XStack>
                      ))}
                    </XStack>
                  </YStack>
                ) : null}

                {/* Description */}
                {(!isRecipe && detail?.description) || (isRecipe && recipeDetail?.alternativeSuggestion) ? (
                  <YStack gap="$2" marginTop="$2">
                    <Text fontSize={16} fontWeight="bold" color="#334155">
                      {isRecipe ? 'Gợi ý món thay thế' : 'Mô tả sản phẩm'}
                    </Text>
                    <Paragraph color="#475569" lineHeight={22}>
                      {isRecipe ? recipeDetail?.alternativeSuggestion : detail?.description}
                    </Paragraph>
                  </YStack>
                ) : null}
                
                <View height={100} />
              </YStack>
            </ScrollView>

            {/* Bottom Add to Cart Bar */}
            <XStack position="absolute" bottom={0} left={0} right={0} padding="$4" backgroundColor="white" borderTopWidth={1} borderTopColor="#f1f5f9" elevation={10}>
              <Button
                flex={1}
                size="$5"
                backgroundColor={(!isRecipe && detail?.status === 'OutOfStock') ? '#cbd5e1' : (addSuccess ? '#16a34a' : '#00A550')}
                borderRadius={20}
                onPress={handleAddToCart}
                disabled={addingToCart || addSuccess || (!isRecipe && detail?.status === 'OutOfStock') || !token}
                icon={addingToCart ? <Spinner color="white" /> : (addSuccess ? <Sparkles size={20} color="white" /> : undefined)}
              >
                <Text color="white" fontWeight="bold" fontSize={16}>
                  {(!isRecipe && detail?.status === 'OutOfStock') ? 'Hết hàng' : (addSuccess ? 'Đã thêm thành công' : (isRecipe ? 'Thêm nguyên liệu vào giỏ' : 'Thêm vào giỏ hàng'))}
                </Text>
              </Button>
            </XStack>
          </YStack>
        ) : (
          <YStack flex={1} justifyContent="center" alignItems="center">
            <Text color="#94a3b8">Không tìm thấy {isRecipe ? 'công thức' : 'sản phẩm'}</Text>
          </YStack>
        )}
      </Sheet.Frame>
    </Sheet>
  );
}
