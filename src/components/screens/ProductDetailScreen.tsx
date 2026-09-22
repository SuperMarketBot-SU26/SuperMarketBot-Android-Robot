import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, TouchableOpacity, Alert, Pressable } from 'react-native';
import { View, Text, XStack, YStack, Button, Image, Spinner, Paragraph, Card } from 'tamagui';
import { ArrowLeft, ShoppingCart, Minus, Plus, Heart, Info, Tag, Navigation, MapPin, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp, useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useRobotAuth } from '../../context/RobotAuthContext';
import { useRobotVoice } from '../../hooks/useRobotVoice';
import { useNotification } from '../../context/NotificationContext';
import { ProductService, ProductDetailDto } from '../../services/ProductService';
import { MealSuggestionService, MenuAssistantResponseDto } from '../../services/MealSuggestionService';
import { CartService } from '../../services/CartService';
import { RobotControlService } from '../../services/RobotControlService';
import { useRobotGuide } from '../../context/RobotGuideContext';
import { SHELVES_6 } from '../map/StoreLayoutConstants';
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
  const { dispatchCart } = useRobotGuide();

  const [detail, setDetail] = useState<ProductDetailDto | null>(null);
  const [recipeDetail, setRecipeDetail] = useState<MenuAssistantResponseDto | null>(null);
  const [alternatives, setAlternatives] = useState<ProductDetailDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState(false);
  const [guiding, setGuiding] = useState(false);
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
        if (data.status === 'OutOfStock') {
          const altData = await ProductService.getAlternatives(productId, member?.memberId);
          setAlternatives(altData || []);
        }
        speak(`Bạn đang xem ${data.productName}. Giá ${data.promotionPrice ? data.promotionPrice : data.unitPrice} đồng.`);
      }
    }
  };

  const handleAddToCart = async () => {
    if (!token) {
      speak('Tính năng giỏ hàng lưu trữ dành cho thành viên. Quý khách muốn Quét Face ID hay để Robot dẫn đường đến quầy sản phẩm?');
      Alert.alert(
        'Giỏ Hàng Thành Viên',
        'Tính năng giỏ hàng lưu trữ dành cho khách thành viên. Quý khách muốn Quét Face ID đăng nhập hay để Robot dẫn đường đến quầy sản phẩm?',
        [
          {
            text: '🚀 Dẫn đường đến quầy',
            onPress: () => handleGuideToProduct(),
          },
          {
            text: '👑 Quét Face ID',
            onPress: () => router.push('/face-scan' as any),
          },
          { text: 'Đóng', style: 'cancel' },
        ]
      );
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

  // Resolve shelf details
  const shelfInfo = (() => {
    if (!detail) return null;
    let foundShelf = detail.shelfId ? SHELVES_6.find((s) => s.shelfId === detail.shelfId) : null;
    if (!foundShelf && detail.aisleCode) {
      foundShelf = SHELVES_6.find((s) => s.aisleCode.toLowerCase() === detail.aisleCode?.toLowerCase());
    }
    if (!foundShelf && (detail.categoryName || detail.productName)) {
      const q = `${detail.categoryName || ''} ${detail.productName}`.toLowerCase();
      if (q.includes('bánh') || q.includes('kẹo') || q.includes('snack') || q.includes('ăn vặt')) foundShelf = SHELVES_6.find((s) => s.shelfId === 1);
      else if (q.includes('nước') || q.includes('sữa') || q.includes('uống') || q.includes('giải khát')) foundShelf = SHELVES_6.find((s) => s.shelfId === 2);
      else if (q.includes('thịt') || q.includes('cá') || q.includes('trứng') || q.includes('rau') || q.includes('tươi')) foundShelf = SHELVES_6.find((s) => s.shelfId === 3);
      else if (q.includes('mì') || q.includes('gạo') || q.includes('phở') || q.includes('khô')) foundShelf = SHELVES_6.find((s) => s.shelfId === 4);
      else if (q.includes('giặt') || q.includes('rửa') || q.includes('gia dụng') || q.includes('tắm') || q.includes('gội')) foundShelf = SHELVES_6.find((s) => s.shelfId === 5);
      else if (q.includes('gia vị') || q.includes('dầu') || q.includes('mắm') || q.includes('hạt nêm') || q.includes('hào') || q.includes('trà')) foundShelf = SHELVES_6.find((s) => s.shelfId === 6);
    }

    const shelfName = detail.shelfName || foundShelf?.name || (detail.aisleCode ? `Kệ Dãy ${detail.aisleCode}` : 'Kệ Hàng Siêu Thị');
    const aisleCode = detail.aisleCode || foundShelf?.aisleCode || 'A01';
    let aisleDesc = detail.aisleName || foundShelf?.name || 'Dãy hàng';
    aisleDesc = aisleDesc.replace(/\s*\([A-Z0-9]+\)/i, '').replace(/^Dãy\s+[A-Z0-9]+\s*[-–]?\s*/i, '').trim();

    const levelName = detail.levelNumber ? `Tầng ${detail.levelNumber}` : 'Tầng 1';
    const slotCode = detail.slotCode || (foundShelf ? `K${foundShelf.shelfId}_T1_01` : null);
    const themeColor = foundShelf?.themeColor || '#00A550';
    const icon = foundShelf?.icon || '📦';

    return {
      shelfId: detail.shelfId || foundShelf?.shelfId || 1,
      shelfName,
      aisleCode,
      aisleDesc,
      levelName,
      slotCode,
      themeColor,
      icon,
    };
  })();

  const handleGuideToProduct = async () => {
    if (guiding || !detail || isOutOfStock) return;
    setGuiding(true);
    try {
      const destinationShelf = shelfInfo?.shelfName || (detail.aisleCode ? `Dãy ${detail.aisleCode}` : detail.productName);
      speak(`Dạ vâng! Robot sẽ dẫn quý khách đến ${destinationShelf}. Xin mời đi theo tôi!`);
      showNotification({
        title: '🤖 DẪN ĐƯỜNG MUA SẮM',
        message: `Đang khởi tạo lộ trình đến ${destinationShelf}`,
        type: 'info',
      });
      await dispatchCart([{ productId: detail.productId, productName: detail.productName }], {
        fromAd: false,
        returnUrl: '/product-search',
      });
      router.push({
        pathname: '/cart-guide-map',
        params: {
          productId: String(detail.productId),
          productName: detail.productName,
          productImage: detail.imageUrl || '',
          productPrice: String(detail.unitPrice || 0),
          shelfName: destinationShelf,
          returnUrl: '/product-search',
          from: 'search',
        },
      } as any);
    } catch (err: any) {
      speak('Không thể khởi tạo dẫn đường');
      showNotification({
        title: 'LỖI',
        message: err?.message || 'Lỗi phát lệnh dẫn đường',
        type: 'error',
      });
    } finally {
      setGuiding(false);
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
        contentContainerStyle={{ paddingTop: height * 0.42, paddingBottom: 130 }}
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
                  <Text fontSize={26} fontWeight="900" color="#0f172a" lineHeight={34} letterSpacing={-0.5}>{title}</Text>
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
                <Text fontSize={13} color="#64748b" style={{ textDecorationLine: promotionPrice ? 'line-through' : 'none' }}>
                  {promotionPrice ? unitPrice?.toLocaleString('vi-VN') + 'đ' : (isRecipe ? 'Tổng chi phí ước tính' : 'Giá bán niêm yết')}
                </Text>
                <XStack alignItems="center" gap="$3">
                  <Text fontSize={34} fontWeight="900" color="#00A550" letterSpacing={-1}>
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

              {/* Redesigned Shelf Location Card - Dễ đọc, Tinh gọn, Không trùng nút */}
              {!isRecipe && shelfInfo && (
                <Card
                  backgroundColor="#ffffff"
                  borderWidth={1.5}
                  borderColor="#bbf7d0"
                  borderRadius={22}
                  padding="$4"
                  marginTop={14}
                  shadowColor="#00A550"
                  shadowRadius={14}
                  shadowOpacity={0.06}
                  style={{ elevation: 3 }}
                >
                  {/* Header: Title + Status Pill */}
                  <XStack justifyContent="space-between" alignItems="center" paddingBottom="$3" borderBottomWidth={1} borderBottomColor="#f1f5f9">
                    <XStack alignItems="center" gap="$2.5">
                      <View
                        width={34}
                        height={34}
                        borderRadius={10}
                        backgroundColor="#00A550"
                        justifyContent="center"
                        alignItems="center"
                        shadowColor="#00A550"
                        shadowOpacity={0.2}
                        shadowRadius={4}
                      >
                        <MapPin size={18} color="white" />
                      </View>
                      <YStack>
                        <Text fontSize={12} fontWeight="900" color="#166534" letterSpacing={0.5} textTransform="uppercase">
                          Vị trí trưng bày tại siêu thị
                        </Text>
                        <Text fontSize={11} color="#64748b" fontWeight="500">
                          Định vị chính xác trên sơ đồ quầy kệ
                        </Text>
                      </YStack>
                    </XStack>

                    <View
                      backgroundColor={isOutOfStock ? '#fee2e2' : '#dcfce7'}
                      paddingHorizontal="$3"
                      paddingVertical="$1.5"
                      borderRadius={12}
                    >
                      <Text fontSize={11} fontWeight="800" color={isOutOfStock ? '#dc2626' : '#15803d'}>
                        {isOutOfStock ? 'Hết hàng' : 'Có sẵn trên kệ'}
                      </Text>
                    </View>
                  </XStack>

                  {/* Main Shelf Banner */}
                  <XStack alignItems="center" gap="$3" paddingVertical="$3.5" paddingHorizontal="$1">
                    <Text fontSize={32}>{shelfInfo.icon}</Text>
                    <YStack flex={1}>
                      <Text fontSize={12} fontWeight="700" color="#059669" textTransform="uppercase" letterSpacing={0.5}>
                        Khu vực quầy kệ
                      </Text>
                      <Text fontSize={19} fontWeight="900" color="#0f172a" numberOfLines={1}>
                        {shelfInfo.shelfName}
                      </Text>
                    </YStack>
                  </XStack>

                  {/* 3-Column Structured Position Grid (Dãy, Tầng, Ô) */}
                  <XStack gap="$2.5">
                    {/* Cột 1: Dãy */}
                    <View flex={1} backgroundColor="#f8fafc" borderWidth={1} borderColor="#e2e8f0" borderRadius={14} padding="$2.5">
                      <Text fontSize={10} fontWeight="800" color="#64748b" textTransform="uppercase" letterSpacing={0.3}>
                        Dãy hàng
                      </Text>
                      <Text fontSize={14} fontWeight="900" color="#0f172a" marginTop="$1" numberOfLines={1}>
                        {shelfInfo.aisleCode}
                      </Text>
                      <Text fontSize={10} color="#64748b" fontWeight="600" marginTop="$0.5" numberOfLines={1}>
                        {shelfInfo.aisleDesc || 'Khu hàng'}
                      </Text>
                    </View>

                    {/* Cột 2: Tầng */}
                    <View flex={1} backgroundColor="#f8fafc" borderWidth={1} borderColor="#e2e8f0" borderRadius={14} padding="$2.5">
                      <Text fontSize={10} fontWeight="800" color="#64748b" textTransform="uppercase" letterSpacing={0.3}>
                        Tầng kệ
                      </Text>
                      <Text fontSize={14} fontWeight="900" color="#0f172a" marginTop="$1" numberOfLines={1}>
                        {shelfInfo.levelName}
                      </Text>
                      <Text fontSize={10} color="#64748b" fontWeight="600" marginTop="$0.5">
                        Tầm mắt
                      </Text>
                    </View>

                    {/* Cột 3: Ô slot */}
                    <View flex={1} backgroundColor="#f8fafc" borderWidth={1} borderColor="#e2e8f0" borderRadius={14} padding="$2.5">
                      <Text fontSize={10} fontWeight="800" color="#64748b" textTransform="uppercase" letterSpacing={0.3}>
                        Vị trí ô
                      </Text>
                      <Text fontSize={14} fontWeight="900" color="#00A550" marginTop="$1" numberOfLines={1}>
                        {shelfInfo.slotCode || `K${shelfInfo.shelfId}_T1`}
                      </Text>
                      <Text fontSize={10} color="#64748b" fontWeight="600" marginTop="$0.5">
                        Chính xác
                      </Text>
                    </View>
                  </XStack>

                  {/* Footnote Guide Hint (thay thế nút bấm trùng lặp) */}
                  {!isOutOfStock && (
                    <XStack backgroundColor="#f0fdf4" borderRadius={12} paddingVertical="$2" paddingHorizontal="$3" alignItems="center" gap="$2" marginTop="$3" borderWidth={1} borderColor="#dcfce7">
                      <Navigation size={14} color="#00A550" />
                      <Text fontSize={11.5} fontWeight="600" color="#166534" flex={1}>
                        Bấm nút <Text fontWeight="900" color="#00A550">"Dẫn đường"</Text> bên dưới để Robot đưa bạn đến tận kệ này.
                      </Text>
                    </XStack>
                  )}
                </Card>
              )}

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

              {/* Alternatives when Out of Stock */}
              {isOutOfStock && alternatives.length > 0 && (
                <YStack gap="$3" marginTop="$4">
                  <Text fontSize={18} fontWeight="bold" color="#334155">Sản phẩm thay thế cùng loại</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <XStack gap="$4">
                      {alternatives.map((alt) => (
                        <TouchableOpacity 
                          key={alt.productId} 
                          onPress={() => router.replace({ pathname: '/product/[id]', params: { id: alt.productId } })}
                        >
                          <View 
                            backgroundColor="#f8fafc" 
                            borderRadius={12} 
                            borderWidth={1} 
                            borderColor="#e2e8f0" 
                            padding="$3" 
                            width={140}
                          >
                            <Image 
                              src={(alt.imageUrl && typeof alt.imageUrl === 'string' && alt.imageUrl.startsWith('http')) ? alt.imageUrl : require('../../../assets/images/logocute.png')} 
                              width={110} 
                              height={110} 
                              objectFit="cover" 
                              borderRadius={8} 
                              marginBottom="$2"
                            />
                            <Text fontSize={14} fontWeight="bold" color="#1e293b" numberOfLines={2}>{alt.productName}</Text>
                            <Text fontSize={14} fontWeight="bold" color="#00A550" marginTop="$1">
                              {alt.promotionPrice ? alt.promotionPrice.toLocaleString('vi-VN') : alt.unitPrice.toLocaleString('vi-VN')}đ
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </XStack>
                  </ScrollView>
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
          <YStack gap="$3">
            {/* Top Sub-Row: Quantity Selector + Price status */}
            {!isRecipe && (
              <XStack justifyContent="space-between" alignItems="center">
                <XStack alignItems="center" backgroundColor="#f1f5f9" borderRadius={24} padding="$1">
                  <Button circular size="$3" backgroundColor="white" icon={<Minus size={16} color="#475569" />} onPress={() => setQuantity(Math.max(1, quantity - 1))} />
                  <Text fontSize={16} fontWeight="bold" color="#1e293b" width={36} textAlign="center">{quantity}</Text>
                  <Button circular size="$3" backgroundColor="white" icon={<Plus size={16} color="#475569" />} onPress={() => setQuantity(quantity + 1)} />
                </XStack>

                <Text fontSize={13} fontWeight="800" color={isOutOfStock ? "#ef4444" : "#00A550"}>
                  {isOutOfStock ? 'Tạm hết hàng' : 'Có sẵn tại quầy'}
                </Text>
              </XStack>
            )}

            {/* Bottom Actions Row: 2 Big Mobile Buttons */}
            <XStack gap="$2.5">
              {/* Add to cart Button */}
              <Button
                flex={1}
                height={48}
                borderRadius={20}
                backgroundColor={isOutOfStock ? "#cbd5e1" : "#00A550"}
                disabled={addingToCart || isOutOfStock}
                icon={addingToCart ? <Spinner color="white" /> : <ShoppingCart size={18} color="white" />}
                onPress={handleAddToCart}
                pressStyle={{ scale: 0.98, backgroundColor: '#008740' }}
              >
                <Text color="white" fontSize={14} fontWeight="bold">
                  {isOutOfStock ? 'Hết hàng' : (isRecipe ? 'Mua nguyên liệu' : 'Thêm giỏ')}
                </Text>
              </Button>

              {/* Guide Me Button (Robot AMR guidance for Kiosk) */}
              {!isRecipe && !isOutOfStock && (
                <Button
                  flex={1}
                  height={48}
                  borderRadius={20}
                  backgroundColor="#0284c7"
                  disabled={guiding}
                  icon={guiding ? <Spinner color="white" /> : <Navigation size={18} color="white" />}
                  onPress={handleGuideToProduct}
                  pressStyle={{ scale: 0.98, backgroundColor: '#0369a1' }}
                >
                  <Text color="white" fontSize={14} fontWeight="bold">
                    {guiding ? 'Đang gọi xe...' : 'Dẫn đường'}
                  </Text>
                </Button>
              )}
            </XStack>
          </YStack>
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
