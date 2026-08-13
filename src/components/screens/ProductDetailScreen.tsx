import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet } from 'react-native';
import { View, Text, XStack, YStack, Button, Image, Spinner, Paragraph } from 'tamagui';
import { ArrowLeft, ShoppingCart, Minus, Plus, Heart, Info, Tag } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp, useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useRobotAuth } from '../../context/RobotAuthContext';
import { useRobotVoice } from '../../hooks/useRobotVoice';
import { useNotification } from '../../context/NotificationContext';
import { ProductService, ProductDetailDto } from '../../services/ProductService';
import { MealSuggestionService, MenuAssistantResponseDto } from '../../services/MealSuggestionService';
import { CartService } from '../../services/CartService';
import { LinearGradient } from 'expo-linear-gradient';

const { height, width } = Dimensions.get('window');

interface Props {
  productId: number;
  isRecipe?: boolean;
}

export default function ProductDetailScreen({ productId, isRecipe = false }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { member, token } = useRobotAuth();
  const { speak, stop } = useRobotVoice();
  const { showNotification } = useNotification();

  const [detail, setDetail] = useState<ProductDetailDto | null>(null);
  const [recipeDetail, setRecipeDetail] = useState<MenuAssistantResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const imageAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(scrollY.value, [-100, 0, height * 0.5], [-50, 0, height * 0.25], Extrapolation.CLAMP),
        },
        {
          scale: interpolate(scrollY.value, [-100, 0, height * 0.5], [1.5, 1, 1], Extrapolation.CLAMP),
        }
      ]
    };
  });

  const fetchDetail = async () => {
    setLoading(true);
    if (isRecipe) {
      setLoadingText('Trợ lý AI đang lên công thức và tìm nguyên liệu...');
      const data = await MealSuggestionService.getAiMenuAssistant(productId, 1);
      setRecipeDetail(data);
      setLoadingText(null);
      setLoading(false);
      if (data) {
        speak(`AI đã gợi ý cho bạn món ${data.recipeName}. Ước tính tổng chi phí là ${data.estimatedTotalCost.toLocaleString('vi-VN')} đồng.`);
      } else {
        speak("Xin lỗi, hệ thống AI đang quá tải hoặc không thể sinh món ăn này. Vui lòng thử lại sau.");
        showNotification({ title: 'LỖI AI', message: 'Không thể sinh món ăn', type: 'error' });
      }
    } else {
      const data = await ProductService.getProductDetail(productId, member?.memberId);
      setDetail(data);
      setLoading(false);
      if (data) {
        speak(`Bạn đang xem ${data.productName}. Giá ${data.promotionPrice ? data.promotionPrice : data.unitPrice} đồng.`);
      }
    }
  };

  const handleAddToCart = async () => {
    if (!token) {
      speak('Vui lòng đăng nhập để thêm vào giỏ hàng.');
      showNotification({ title: 'LỖI', message: 'Vui lòng đăng nhập', type: 'error' });
      return;
    }

    setAddingToCart(true);
    try {
      if (isRecipe && recipeDetail) {
        for (const item of recipeDetail.ingredients) {
          if (item.inStock) {
            await CartService.addItem(item.productId, 1, token);
          }
        }
        speak(`Thành công! Đã thêm các nguyên liệu của món ${recipeDetail.recipeName} vào giỏ hàng`);
        showNotification({ title: '🛒 THÀNH CÔNG', message: `Đã thêm nguyên liệu món ${recipeDetail.recipeName} vào giỏ`, type: 'success' });
      } else if (detail) {
        await CartService.addItem(detail.productId, quantity, token);
        speak(`Thành công! Đã thêm ${quantity} ${detail.productName} vào giỏ hàng`);
        showNotification({ title: '🛒 THÀNH CÔNG', message: `Đã thêm ${quantity} ${detail.productName} vào giỏ`, type: 'success' });
      }
    } catch (err: any) {
      speak(err.message || 'Lỗi thêm vào giỏ hàng');
      showNotification({ title: 'LỖI', message: 'Không thể thêm vào giỏ hàng', type: 'error' });
    } finally {
      setAddingToCart(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchDetail();
    return () => {
      void stop();
    };
    // Product route params are the fetch lifecycle boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, isRecipe]);

  if (loading) {
    return (
      <View flex={1} backgroundColor="white" justifyContent="center" alignItems="center">
        <Spinner size="large" color="#00A550" />
        <Text marginTop="$4" color="#64748b">
          {loadingText ? loadingText : (isRecipe ? "Đang tải công thức..." : "Đang tải thông tin...")}
        </Text>
      </View>
    );
  }

  const imageUrl = isRecipe ? recipeDetail?.imageUrl : detail?.imageUrl;
  const title = isRecipe ? recipeDetail?.recipeName : detail?.productName;
  const description = isRecipe ? recipeDetail?.alternativeSuggestion : detail?.description;
  const unitPrice = isRecipe ? recipeDetail?.estimatedTotalCost : detail?.unitPrice;
  const promotionPrice = isRecipe ? null : detail?.promotionPrice;
  const isOutOfStock = !isRecipe && detail?.status === 'OutOfStock';

  return (
    <View flex={1} backgroundColor="#f8fafc">
      {/* Top Image Section (Parallax + Blurred Background) */}
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.5 }, imageAnimatedStyle]}>
        {/* Blurred Background */}
        <Image
          src={(typeof imageUrl === 'string' && imageUrl.startsWith('http')) ? imageUrl : require('../../../assets/images/logocute.png')}
          width="100%"
          height="100%"
          objectFit="cover"
          blurRadius={40}
        />
        {/* Sharp Foreground Image */}
        <View position="absolute" top={0} left={0} right={0} bottom={0} padding="$4" justifyContent="center" alignItems="center">
          <Image
            src={(typeof imageUrl === 'string' && imageUrl.startsWith('http')) ? imageUrl : require('../../../assets/images/logocute.png')}
            width="80%"
            height="80%"
            objectFit="contain"
            style={{ shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } }}
          />
        </View>
        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.05)', 'white']}
          locations={[0, 0.3, 0.8, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Bottom Content Section */}
      <Animated.ScrollView
        contentContainerStyle={{ paddingTop: height * 0.42, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <Animated.View entering={FadeInUp.duration(500)}>
          <View
            backgroundColor="white"
            borderTopLeftRadius={32}
            borderTopRightRadius={32}
            paddingTop="$6"
            paddingHorizontal="$5"
            minHeight={height * 0.6}
            style={{ elevation: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 }}
          >
            <YStack gap="$4">
              <XStack justifyContent="space-between" alignItems="flex-start">
                <YStack flex={1} gap="$2.5">
                  <Text fontSize={28} fontWeight="900" color="#0f172a" lineHeight={36} letterSpacing={-0.5}>{title}</Text>
                  <XStack gap="$2" alignItems="center" flexWrap="wrap">
                    {!isRecipe && detail?.categoryName && (
                      <View backgroundColor="#f1f5f9" paddingHorizontal="$3" paddingVertical="$1" borderRadius={20}>
                        <Text fontSize={12} color="#475569" fontWeight="600">{detail.categoryName}</Text>
                      </View>
                    )}
                    {isRecipe && (
                      <View backgroundColor="#ecfdf5" paddingHorizontal="$3" paddingVertical="$1" borderRadius={20}>
                        <Text fontSize={12} color="#059669" fontWeight="600">Công thức gợi ý</Text>
                      </View>
                    )}
                    {isOutOfStock && (
                      <View backgroundColor="#fee2e2" paddingHorizontal="$3" paddingVertical="$1" borderRadius={20}>
                        <Text fontSize={12} color="#dc2626" fontWeight="bold">Tạm hết hàng</Text>
                      </View>
                    )}
                  </XStack>
                </YStack>
              </XStack>

              <YStack gap="$1" marginTop="$2" backgroundColor="#f0fdf4" padding="$4" borderRadius={16} borderWidth={1} borderColor="#dcfce7">
                <Text fontSize={14} color="#64748b" style={{ textDecorationLine: promotionPrice ? 'line-through' : 'none' }}>
                  {promotionPrice ? unitPrice?.toLocaleString('vi-VN') + 'đ' : (isRecipe ? 'Tổng chi phí ước tính' : 'Giá bán')}
                </Text>
                <XStack alignItems="center" gap="$3">
                  <Text fontSize={36} fontWeight="900" color="#00A550" letterSpacing={-1}>
                    {promotionPrice ? promotionPrice.toLocaleString('vi-VN') : unitPrice?.toLocaleString('vi-VN')}đ
                  </Text>
                  {promotionPrice && (
                    <View backgroundColor="#ef4444" paddingHorizontal="$2.5" paddingVertical="$1" borderRadius={8}>
                      <Text fontSize={12} color="white" fontWeight="900">
                        -{Math.round((1 - promotionPrice / (unitPrice || 1)) * 100)}%
                      </Text>
                    </View>
                  )}
                </XStack>
              </YStack>

              {/* Health Tags */}
              {!isRecipe && detail?.healthTags && detail.healthTags.length > 0 && (
                <YStack gap="$3" marginTop="$4">
                  <XStack alignItems="center" gap="$2">
                    <Heart size={20} color="#3b82f6" />
                    <Text fontSize={18} fontWeight="800" color="#1e293b">Đặc tính sức khoẻ</Text>
                  </XStack>
                  <XStack flexWrap="wrap" gap="$2">
                    {detail.healthTags.map((tag, idx) => (
                      <View key={idx} backgroundColor="#eff6ff" paddingHorizontal="$3.5" paddingVertical="$2" borderRadius={20} borderWidth={1} borderColor="#bfdbfe">
                        <Text fontSize={13} color="#2563eb" fontWeight="700">{tag.tagName}</Text>
                      </View>
                    ))}
                  </XStack>
                </YStack>
              )}

              {/* Description */}
              {description && (
                <YStack gap="$2" marginTop="$4">
                  <XStack alignItems="center" gap="$2">
                    <Info size={20} color="#f59e0b" />
                    <Text fontSize={18} fontWeight="800" color="#1e293b">{isRecipe ? 'Lưu ý' : 'Chi tiết sản phẩm'}</Text>
                  </XStack>
                  <View backgroundColor="#f8fafc" padding="$4" borderRadius={16} borderWidth={1} borderColor="#e2e8f0">
                    <Paragraph fontSize={15} color="#475569" lineHeight={24}>{description}</Paragraph>
                  </View>
                </YStack>
              )}

              {/* Recipe Ingredients */}
              {isRecipe && recipeDetail?.ingredients && (
                <YStack gap="$3" marginTop="$4">
                  <Text fontSize={18} fontWeight="bold" color="#334155">Nguyên liệu cần chuẩn bị</Text>
                  {recipeDetail.ingredients.map((ing, i) => (
                    <XStack key={i} justifyContent="space-between" alignItems="center" paddingVertical="$3" borderBottomWidth={1} borderBottomColor="#f1f5f9">
                      <YStack flex={1}>
                        <Text fontSize={15} fontWeight="bold" color="#1e293b">{ing.productName}</Text>
                        <Text fontSize={13} color={ing.inStock ? "#059669" : "#dc2626"}>
                          {ing.inStock ? "Có sẵn tại siêu thị" : "Hết hàng"}
                        </Text>
                      </YStack>
                      <Text fontSize={15} fontWeight="bold" color="#00A550">{(ing.promotionPrice || ing.unitPrice).toLocaleString('vi-VN')}đ</Text>
                    </XStack>
                  ))}
                </YStack>
              )}

            </YStack>
          </View>
        </Animated.View>
      </Animated.ScrollView>

      {/* Bottom Bar */}
      <Animated.View entering={FadeInDown.delay(300).duration(500)} style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <View
          backgroundColor="white"
          paddingHorizontal="$5"
          paddingTop="$4"
          paddingBottom={Math.max(insets.bottom, 20)}
          borderTopWidth={1}
          borderTopColor="#e2e8f0"
          style={{ elevation: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: -5 } }}
        >
          <XStack gap="$4" alignItems="center" justifyContent="space-between">
            {/* Quantity Selector */}
            {!isRecipe && (
              <XStack alignItems="center" backgroundColor="#f1f5f9" borderRadius={30} padding="$1">
                <Button circular size="$3.5" backgroundColor="white" icon={<Minus size={18} color="#475569" />} onPress={() => setQuantity(Math.max(1, quantity - 1))} />
                <Text fontSize={18} fontWeight="bold" color="#1e293b" width={40} textAlign="center">{quantity}</Text>
                <Button circular size="$3.5" backgroundColor="white" icon={<Plus size={18} color="#475569" />} onPress={() => setQuantity(quantity + 1)} />
              </XStack>
            )}

            {/* Add to cart Button */}
            <Button
              flex={1}
              height={56}
              borderRadius={30}
              backgroundColor={isOutOfStock ? "#cbd5e1" : "#00A550"}
              disabled={addingToCart || isOutOfStock}
              icon={addingToCart ? <Spinner color="white" /> : <ShoppingCart size={22} color="white" />}
              onPress={handleAddToCart}
              pressStyle={{ scale: 0.98, backgroundColor: '#008740' }}
            >
              <Text color="white" fontSize={16} fontWeight="bold">
                {isOutOfStock ? 'Tạm hết hàng' : (isRecipe ? 'Mua tất cả nguyên liệu' : 'Thêm vào giỏ')}
              </Text>
            </Button>
          </XStack>
        </View>
      </Animated.View>

      {/* Back Button (Moved to top level so it is clickable and not blocked by ScrollView) */}
      <Button
        position="absolute"
        top={Math.max(insets.top, 20)}
        left={20}
        circular
        size="$4"
        backgroundColor="rgba(255,255,255,0.9)"
        icon={<ArrowLeft size={24} color="#333" />}
        onPress={() => router.back()}
        style={{ elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, zIndex: 100 }}
      />
    </View>
  );
}
