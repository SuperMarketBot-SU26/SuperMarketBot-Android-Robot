import React, { useEffect, useState } from 'react';
import { ScrollView, DimensionValue, Pressable, useWindowDimensions } from 'react-native';
import { View, Text, XStack, YStack, Button, Card, Image, Spinner } from 'tamagui';
import {
  ArrowLeft,
  MapPin,
  Tag,
  ArrowRight,
  Navigation,
  Sparkles,
  Flame,
  ShoppingBag,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  FadeInUp,
  withRepeat,
  withSequence,
  withTiming,
  useSharedValue,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';
import { useRobotVoice, useVoiceRouter } from '../../hooks/useRobotVoice';
import { SearchService, MobileProductSearchResultDto } from '../../services/SearchService';
import { AdService, AdPlaylistItemDto } from '../../services/AdService';
import { RobotControlService } from '../../services/RobotControlService';
import { useNotification } from '../../context/NotificationContext';
import { ROBOT_CODE } from '../../context/RobotRealtimeContext';

const SkeletonCard = ({ cardWidth }: { cardWidth: DimensionValue }) => {
  const opacity = useSharedValue(0.4);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 600, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width: cardWidth,
          height: 320,
          borderRadius: 20,
          backgroundColor: '#e2e8f0',
          marginBottom: 16,
        },
        animatedStyle,
      ]}
    />
  );
};

export default function GuestCampaignScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useVoiceRouter();
  const { speak } = useRobotVoice();
  const { showNotification } = useNotification();

  const [deals, setDeals] = useState<MobileProductSearchResultDto[]>([]);
  const [generalAds, setGeneralAds] = useState<AdPlaylistItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [guidingId, setGuidingId] = useState<number | null>(null);

  // Responsive card width based on screen width (desktop web vs tablet vs mobile)
  const cardWidth: DimensionValue = width > 1100 ? '31.5%' : width > 680 ? '48%' : '100%';

  useEffect(() => {
    let mounted = true;

    // Robot chào mừng khi vào trang Khuyến mãi
    speak('Xin chào! Dưới đây là danh sách tất cả các sản phẩm đang được giảm giá cực sốc hôm nay. Chạm vào món bất kỳ để xem chi tiết hoặc nhờ robot dẫn đường nhé!');

    SearchService.getDeals()
      .then((res) => {
        if (!mounted) return;
        setDeals(res || []);
      })
      .catch((err) => {
        console.error('Error loading guest deals:', err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    AdService.getRobotPlaylist(1)
      .then((res) => {
        if (!mounted) return;
        if (res && res.playlist) {
          setGeneralAds(res.playlist);
        }
      })
      .catch((err) => console.log('Error loading guest ads:', err));

    return () => {
      mounted = false;
    };
  }, []);

  // Xử lý Robot dẫn đường đến kệ hàng khi khách bấm "Dẫn đến kệ"
  const handleGuideToProduct = async (product: { productId: number; productName: string }) => {
    if (guidingId !== null) return;
    setGuidingId(product.productId);
    try {
      speak(`Dạ vâng! Robot sẽ dẫn quý khách đến quầy bán ${product.productName}. Xin mời đi theo tôi!`);
      showNotification({
        title: '🤖 DẪN ĐƯỜNG MUA SẮM',
        message: `Đang khởi tạo lộ trình đến quầy ${product.productName}`,
        type: 'info',
      });
      await RobotControlService.dispatchAutonomous({
        robotCode: ROBOT_CODE,
        flowType: 'guide',
        productId: product.productId,
        productIds: [product.productId],
        floorId: 1,
      });
      router.push('/cart-guide-map' as any);
    } catch (err: any) {
      speak('Không thể khởi tạo dẫn đường. Vui lòng thử lại sau.');
      showNotification({
        title: 'LỖI DẪN ĐƯỜNG',
        message: err?.message || 'Không thể kết nối robot',
        type: 'error',
      });
    } finally {
      setGuidingId(null);
    }
  };

  return (
    <View
      flex={1}
      backgroundColor="#f8fafc"
      paddingTop={Math.max(insets.top, 0)}
      paddingLeft={Math.max(insets.left, 0)}
      paddingRight={Math.max(insets.right, 0)}
    >
      {/* HEADER BAR */}
      <XStack
        height={64}
        alignItems="center"
        paddingHorizontal="$4"
        borderBottomWidth={1}
        borderBottomColor="#e2e8f0"
        backgroundColor="white"
        justifyContent="space-between"
      >
        <XStack alignItems="center" gap="$3">
          <Button
            circular
            size="$3.5"
            chromeless
            icon={<ArrowLeft size={22} color="#005b2b" />}
            onPress={() => router.back()}
            pressStyle={{ scale: 0.9 }}
          />
          <YStack>
            <Text fontSize={18} fontWeight="900" color="#005b2b">
              SmartMarketBot
            </Text>
            <Text fontSize={11} color="#64748b" fontWeight="600">
              Trợ lý mua sắm tự hành
            </Text>
          </YStack>
        </XStack>

        <View
          flexDirection="row"
          alignItems="center"
          gap="$2"
          backgroundColor="#f0fdf4"
          paddingVertical="$1.5"
          paddingHorizontal="$3"
          borderRadius={20}
          borderWidth={1}
          borderColor="#bbf7d0"
        >
          <Sparkles size={14} color="#16a34a" />
          <Text fontSize={12} color="#16a34a" fontWeight="800">
            Ưu đãi trực tiếp
          </Text>
        </View>
      </XStack>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 80 }}
      >
        {/* HERO BANNER SECTION */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <View
            backgroundColor="#005b2b"
            borderRadius={22}
            padding="$4"
            marginBottom="$4"
            position="relative"
            overflow="hidden"
            style={{ elevation: 3 }}
          >
            <View
              position="absolute"
              right={-20}
              top={-20}
              width={140}
              height={140}
              borderRadius={70}
              backgroundColor="rgba(255,255,255,0.08)"
            />
            <YStack gap="$1">
              <XStack alignItems="center" gap="$2">
                <Flame size={18} color="#facc15" />
                <Text fontSize={11} fontWeight="900" color="#facc15" letterSpacing={0.8}>
                  FLASH SALE · ƯU ĐÃI NỔI BẬT
                </Text>
              </XStack>
              <Text fontSize={22} fontWeight="900" color="white">
                Siêu Khuyến Mãi Hôm Nay
              </Text>
              <Text fontSize={13} color="#bbf7d0" lineHeight={18}>
                Chạm vào sản phẩm để xem chi tiết hoặc nhờ Robot dẫn đường trực tiếp tới kệ hàng!
              </Text>
            </YStack>
          </View>
        </Animated.View>

        {/* GENERAL ADS (SẢN PHẨM TÀI TRỢ / NỔI BẬT) */}
        {generalAds.length > 0 && (
          <YStack gap="$3" marginBottom="$6">
            <XStack alignItems="center" gap="$2">
              <Flame size={20} color="#ea580c" />
              <Text fontSize={19} fontWeight="900" color="#0f172a">
                Gợi Ý Nổi Bật (Tài Trợ)
              </Text>
            </XStack>

            <XStack flexWrap="wrap" justifyContent="space-between" gap="$3">
              {generalAds.map((ad: AdPlaylistItemDto, index: number) => (
                <Animated.View
                  key={`ad-${ad.productId}-${index}`}
                  style={{ width: cardWidth, marginBottom: 12 }}
                  entering={FadeInUp.delay(200 + index * 40).duration(450)}
                >
                  <Card
                    borderRadius={20}
                    backgroundColor="white"
                    overflow="hidden"
                    borderWidth={1}
                    borderColor="#e2e8f0"
                    style={{ elevation: 3 }}
                    pressStyle={{ scale: 0.98 }}
                    onPress={() => router.push(`/product/${ad.productId}` as any)}
                  >
                    {/* Unstretched Centered Image Container */}
                    <View
                      position="relative"
                      height={180}
                      backgroundColor="#ffffff"
                      justifyContent="center"
                      alignItems="center"
                      padding="$3"
                      borderBottomWidth={1}
                      borderBottomColor="#f1f5f9"
                    >
                      <Image
                        src={ad.imageUrl || require('../../../assets/images/logocute.png')}
                        width="100%"
                        height="100%"
                        objectFit="contain"
                      />
                      <View
                        position="absolute"
                        top={10}
                        left={10}
                        backgroundColor="#ea580c"
                        paddingHorizontal="$2.5"
                        paddingVertical="$1"
                        borderRadius={8}
                        style={{ elevation: 2 }}
                      >
                        <Text fontSize={10} color="white" fontWeight="900" letterSpacing={0.5}>
                          TÀI TRỢ
                        </Text>
                      </View>
                    </View>

                    {/* Card Content */}
                    <YStack padding="$4" gap="$2" justifyContent="space-between" flex={1}>
                      <YStack gap="$1.5">
                        <Text
                          fontSize={15}
                          fontWeight="800"
                          color="#1e293b"
                          numberOfLines={2}
                          lineHeight={20}
                          minHeight={40}
                        >
                          {ad.productName}
                        </Text>
                        <Text fontSize={11} color="#64748b" numberOfLines={1}>
                          Chiến dịch: {ad.campaignName}
                        </Text>
                      </YStack>

                      {/* Price Row */}
                      <XStack alignItems="baseline" justifyContent="space-between" marginTop="$1">
                        <Text fontSize={19} fontWeight="900" color="#00A550">
                          {(ad.productPrice || 0).toLocaleString('vi-VN')}₫
                        </Text>
                      </XStack>

                      {/* Action Buttons */}
                      <XStack gap="$2" marginTop="$2" paddingTop="$2" borderTopWidth={1} borderTopColor="#f1f5f9">
                        <Button
                          flex={1}
                          size="$3"
                          backgroundColor="#00A550"
                          color="white"
                          fontWeight="800"
                          fontSize={12}
                          icon={
                            guidingId === ad.productId ? (
                              <Spinner size="small" color="white" />
                            ) : (
                              <Navigation size={13} color="white" />
                            )
                          }
                          disabled={guidingId !== null}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleGuideToProduct({ productId: ad.productId, productName: ad.productName });
                          }}
                          pressStyle={{ scale: 0.96 }}
                        >
                          Dẫn đến kệ
                        </Button>
                        <Button
                          size="$3"
                          backgroundColor="#f1f5f9"
                          color="#475569"
                          fontWeight="700"
                          fontSize={12}
                          iconAfter={<ArrowRight size={13} color="#475569" />}
                          onPress={() => router.push(`/product/${ad.productId}` as any)}
                          pressStyle={{ scale: 0.96 }}
                        >
                          Chi tiết
                        </Button>
                      </XStack>
                    </YStack>
                  </Card>
                </Animated.View>
              ))}
            </XStack>
          </YStack>
        )}

        {/* PROMOTION LIST HEADER */}
        <XStack alignItems="center" justifyContent="space-between" marginBottom="$3" marginTop="$1">
          <XStack alignItems="center" gap="$2">
            <Tag size={22} color="#ef4444" />
            <Text fontSize={20} fontWeight="900" color="#0f172a">
              Danh Sách Khuyến Mãi Hôm Nay
            </Text>
          </XStack>
          <Text fontSize={13} color="#64748b" fontWeight="600">
            {deals.length} sản phẩm
          </Text>
        </XStack>

        {loading ? (
          <XStack flexWrap="wrap" justifyContent="space-between" gap="$3">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={`skel-${i}`} cardWidth={cardWidth} />
            ))}
          </XStack>
        ) : deals.length === 0 ? (
          <Card padding="$6" borderRadius={20} backgroundColor="white" alignItems="center" borderWidth={1} borderColor="#e2e8f0">
            <ShoppingBag size={40} color="#94a3b8" />
            <Text color="#475569" fontSize={15} fontWeight="700" marginTop="$3">
              Hiện tại chưa có sản phẩm khuyến mãi nào.
            </Text>
            <Text color="#94a3b8" fontSize={13} marginTop="$1">
              Vui lòng quay lại sau hoặc hỏi nhân viên hỗ trợ.
            </Text>
          </Card>
        ) : (
          <XStack flexWrap="wrap" justifyContent="space-between" gap="$3">
            {deals.map((product: MobileProductSearchResultDto, index: number) => {
              const displayPrice = product.promotionPrice ?? product.unitPrice;
              const hasDiscount = !!product.promotionPrice && product.promotionPrice < product.unitPrice;

              return (
                <Animated.View
                  key={`deal-${product.productId}-${index}`}
                  style={{ width: cardWidth, marginBottom: 14 }}
                  entering={FadeInUp.delay(200 + index * 40).duration(450)}
                >
                  <View
                    borderRadius={20}
                    backgroundColor="white"
                    overflow="hidden"
                    borderWidth={1}
                    borderColor="#e2e8f0"
                    style={{
                      elevation: 3,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.06,
                      shadowRadius: 8,
                    }}
                  >
                    {/* Unstretched Centered Image Container - Tap to view detail */}
                    <Pressable
                      onPress={() => {
                        speak(`Mở chi tiết sản phẩm ${product.productName}.`);
                        router.push(`/product/${product.productId}` as any);
                      }}
                    >
                      <View
                        position="relative"
                        height={180}
                        backgroundColor="#ffffff"
                        justifyContent="center"
                        alignItems="center"
                        padding="$3"
                        borderBottomWidth={1}
                        borderBottomColor="#f1f5f9"
                      >
                        <Image
                          src={product.imageUrl || require('../../../assets/images/logocute.png')}
                          width="100%"
                          height="100%"
                          objectFit="contain"
                        />

                        {/* Discount Badge */}
                        {product.discountPercent ? (
                          <View
                            position="absolute"
                            top={10}
                            left={10}
                            backgroundColor="#ef4444"
                            paddingHorizontal="$2.5"
                            paddingVertical="$1"
                            borderRadius={8}
                            style={{ elevation: 2 }}
                          >
                            <Text fontSize={11} color="white" fontWeight="900">
                              -{product.discountPercent}%
                            </Text>
                          </View>
                        ) : (
                          <View
                            position="absolute"
                            top={10}
                            left={10}
                            backgroundColor="#f59e0b"
                            paddingHorizontal="$2.5"
                            paddingVertical="$1"
                            borderRadius={8}
                            style={{ elevation: 2 }}
                          >
                            <Text fontSize={11} color="white" fontWeight="900">
                              HOT DEAL
                            </Text>
                          </View>
                        )}
                      </View>
                    </Pressable>

                    {/* Card Content */}
                    <YStack padding="$3.5" gap="$2.5">
                      <Pressable
                        onPress={() => {
                          speak(`Mở chi tiết sản phẩm ${product.productName}.`);
                          router.push(`/product/${product.productId}` as any);
                        }}
                      >
                        <YStack gap="$1.5">
                          {/* Shelf Location Tag */}
                          <XStack
                            alignItems="center"
                            gap="$1"
                            backgroundColor="#f0fdf4"
                            paddingHorizontal="$2"
                            paddingVertical="$0.5"
                            borderRadius={6}
                            alignSelf="flex-start"
                          >
                            <MapPin size={11} color="#16a34a" />
                            <Text fontSize={11} color="#16a34a" fontWeight="700">
                              {product.location?.shelfName || 'Khu Vực Siêu Thị'}
                            </Text>
                          </XStack>

                          {/* Title */}
                          <Text
                            fontSize={15}
                            fontWeight="800"
                            color="#1e293b"
                            numberOfLines={2}
                            lineHeight={20}
                          >
                            {product.productName}
                          </Text>
                        </YStack>

                        {/* Price Section */}
                        <XStack alignItems="baseline" justifyContent="space-between" marginTop="$1.5">
                          <XStack alignItems="baseline" gap="$2">
                            <Text fontSize={18} fontWeight="900" color="#00A550">
                              {displayPrice.toLocaleString('vi-VN')}₫
                            </Text>
                            {hasDiscount && (
                              <Text
                                fontSize={12}
                                color="#94a3b8"
                                style={{ textDecorationLine: 'line-through' }}
                              >
                                {product.unitPrice.toLocaleString('vi-VN')}₫
                              </Text>
                            )}
                          </XStack>
                        </XStack>
                      </Pressable>

                      {/* Action Buttons */}
                      <XStack
                        gap="$2"
                        marginTop="$1"
                        paddingTop="$2"
                        borderTopWidth={1}
                        borderTopColor="#f1f5f9"
                      >
                        {/* Primary Button: Robot leads to shelf */}
                        <Button
                          flex={1}
                          size="$3"
                          backgroundColor="#00A550"
                          color="white"
                          fontWeight="800"
                          fontSize={12}
                          icon={
                            guidingId === product.productId ? (
                              <Spinner size="small" color="white" />
                            ) : (
                              <Navigation size={13} color="white" />
                            )
                          }
                          disabled={guidingId !== null}
                          onPress={() => {
                            handleGuideToProduct({
                              productId: product.productId,
                              productName: product.productName,
                            });
                          }}
                          pressStyle={{ scale: 0.96 }}
                        >
                          Dẫn đến kệ
                        </Button>

                        {/* Secondary Button: View Details */}
                        <Button
                          size="$3"
                          backgroundColor="#f1f5f9"
                          color="#475569"
                          fontWeight="700"
                          fontSize={12}
                          iconAfter={<ArrowRight size={13} color="#475569" />}
                          onPress={() => router.push(`/product/${product.productId}` as any)}
                          pressStyle={{ scale: 0.96 }}
                        >
                          Chi tiết
                        </Button>
                      </XStack>
                    </YStack>
                  </View>
                </Animated.View>
              );
            })}
          </XStack>
        )}
      </ScrollView>
    </View>
  );
}
