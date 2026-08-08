import React, { useEffect, useState } from 'react';
import { ScrollView, Dimensions } from 'react-native';
import { View, Text, XStack, YStack, Button, Card, Image, Spinner } from 'tamagui';
import { ArrowLeft, Clock, Search, MapPin, Tag, ArrowRight, MessageCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp, withRepeat, withSequence, withTiming, useSharedValue, useAnimatedStyle, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRobotVoice, useVoiceRouter } from '../../hooks/useRobotVoice';
import { SearchService, MobileProductSearchResultDto } from '../../services/SearchService';
import { AdService, AdPlaylistItemDto } from '../../services/AdService';
import { RobotControlService } from '../../services/RobotControlService';

const { width } = Dimensions.get('window');

const SkeletonCard = () => {
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
    <Animated.View style={[{ width: '47%', height: 260, borderRadius: 20, backgroundColor: '#e2e8f0', marginBottom: 16 }, animatedStyle]} />
  );
};

export default function GuestCampaignScreen() {
  const insets = useSafeAreaInsets();
  const router = useVoiceRouter();
  const { speak } = useRobotVoice();

  const [deals, setDeals] = useState<MobileProductSearchResultDto[]>([]);
  const [generalAds, setGeneralAds] = useState<AdPlaylistItemDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Robot chào mừng khi vào trang Khuyến mãi hấp dẫn dành cho khách
    speak('Xin chào! Dưới đây là danh sách tất cả các sản phẩm đang được giảm giá cực sốc hôm nay tại siêu thị.');

    SearchService.getDeals()
      .then(res => {
        if (!mounted) return;
        setDeals(res || []);
      })
      .catch(err => {
        console.error('Error loading guest deals:', err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    AdService.getRobotPlaylist(1)
      .then(res => {
        if (!mounted) return;
        if (res && res.playlist) {
          setGeneralAds(res.playlist);
        }
      })
      .catch(err => console.log('Error loading guest ads:', err));

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View flex={1} backgroundColor="#f9fbf9" paddingTop={Math.max(insets.top, 0)} paddingLeft={Math.max(insets.left, 0)} paddingRight={Math.max(insets.right, 30)}>

      {/* HEADER BAR */}
      <XStack height={60} alignItems="center" paddingHorizontal="$4" borderBottomWidth={1} borderBottomColor="#f0f0f0" backgroundColor="white">
        <XStack alignItems="center" gap="$3">
          <Button
            circular
            size="$3.5"
            chromeless
            icon={<ArrowLeft size={22} color="#005b2b" />}
            onPress={() => router.back()}
            pressStyle={{ scale: 0.9 }}
          />
          <Text fontSize={20} fontWeight="900" color="#005b2b">SmartMarketBot</Text>
        </XStack>
      </XStack>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>

        {/* TITLE & SUBTITLE SECTION */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <YStack gap="$1" marginBottom="$6">
            <Text fontSize={28} fontWeight="900" color="#111">Siêu Khuyến Mãi Hôm Nay</Text>
            <Text fontSize={15} color="#666" lineHeight={22}>
              Khám phá các sản phẩm đang được giảm giá với mức giá tốt nhất, áp dụng cho mọi khách hàng!
            </Text>
          </YStack>
        </Animated.View>



        {/* GENERAL ADS (TÀI TRỢ) */}
        {generalAds.length > 0 && (
          <YStack gap="$4" marginBottom="$6">
            <XStack alignItems="center" gap="$2">
              <Text fontSize={20} fontWeight="900" color="#b45309">Gợi ý cho bạn (Tài trợ)</Text>
            </XStack>
            <XStack flexWrap="wrap" justifyContent="space-between" gap="$4">
              {generalAds.map((ad, index) => (
                <Animated.View key={`ad-${ad.productId}-${index}`} style={{ width: '47%' }} entering={FadeInUp.delay(300 + index * 50).duration(500)}>
                  <Card 
                    borderRadius={20} 
                    backgroundColor="white" 
                    overflow="hidden" 
                    borderWidth={1} 
                    borderColor="#e2e8f0" 
                    style={{ elevation: 2 }}
                    pressStyle={{ scale: 0.98 }}
                    onPress={() => speak(`Sản phẩm ${ad.productName} đang được khuyến mãi với giá ${(ad.productPrice || 0).toLocaleString('vi-VN')} đồng.`)}
                  >
                    <View position="relative" height={140} backgroundColor="#f5f5f5">
                      <Image
                        src={ad.imageUrl || require('../../../assets/images/logocute.png')}
                        width="100%"
                        height="100%"
                        objectFit="cover"
                      />
                      <View position="absolute" top={10} left={10} backgroundColor="#ef4444" paddingHorizontal="$2.5" paddingVertical="$1" borderRadius={8} style={{ elevation: 2 }}>
                        <Text fontSize={11} color="white" fontWeight="900">TÀI TRỢ</Text>
                      </View>
                    </View>
                    <YStack padding="$3.5" gap="$2" flex={1} justifyContent="space-between">
                      <YStack gap="$1">
                        <Text fontSize={14} fontWeight="bold" color="#333" numberOfLines={2} lineHeight={18} minHeight={36}>
                          {ad.productName}
                        </Text>
                        <Text fontSize={11} color="#666">Tài trợ bởi: {ad.campaignName}</Text>
                      </YStack>

                      <YStack>
                        <XStack alignItems="baseline" gap="$2">
                          <Text fontSize={15} fontWeight="900" color="#b45309">
                            {(ad.productPrice || 0).toLocaleString('vi-VN')}đ
                          </Text>
                        </XStack>
                      </YStack>
                    </YStack>
                  </Card>
                </Animated.View>
              ))}
            </XStack>
          </YStack>
        )}

        <XStack alignItems="center" gap="$2" marginBottom="$4" marginTop="$2">
          <Tag size={24} color="#ef4444" />
          <Text fontSize={22} fontWeight="900" color="#111">Danh sách Khuyến Mãi</Text>
        </XStack>

        {loading ? (
          <YStack>
            <XStack flexWrap="wrap" justifyContent="space-between" gap="$4">
              {[...Array(4)].map((_, i) => (
                <SkeletonCard key={`skel-${i}`} />
              ))}
            </XStack>
          </YStack>
        ) : deals.length === 0 ? (
          <Card padding="$6" borderRadius={16} backgroundColor="white" alignItems="center">
            <Text color="$textSecondary" fontSize={15}>Hiện tại chưa có khuyến mãi nào.</Text>
          </Card>
        ) : (
          <YStack>
            <XStack flexWrap="wrap" justifyContent="space-between" gap="$4">
              {deals.map((product, index) => (
                <Animated.View key={`deal-${product.productId}-${index}`} style={{ width: '47%' }} entering={FadeInUp.delay(300 + index * 50).duration(500)}>
                  <Card 
                    borderRadius={20} 
                    backgroundColor="white" 
                    overflow="hidden" 
                    borderWidth={1} 
                    borderColor="#e2e8f0" 
                    style={{ elevation: 2 }}
                    pressStyle={{ scale: 0.98 }}
                    onPress={() => {
                        const price = product.promotionPrice ? product.promotionPrice : product.unitPrice;
                        speak(`Sản phẩm ${product.productName} đang được giảm giá còn ${price.toLocaleString('vi-VN')} đồng.`);
                    }}
                  >
                    <View position="relative" height={140} backgroundColor="#f5f5f5">
                      <Image
                        src={product.imageUrl || require('../../../assets/images/logocute.png')}
                        width="100%"
                        height="100%"
                        objectFit="cover"
                      />
                      {product.discountPercent ? (
                        <View position="absolute" top={10} left={10} backgroundColor="#ef4444" paddingHorizontal="$2.5" paddingVertical="$1" borderRadius={8} style={{ elevation: 2 }}>
                          <Text fontSize={11} color="white" fontWeight="900">-{product.discountPercent}%</Text>
                        </View>
                      ) : (
                        <View position="absolute" top={10} left={10} backgroundColor="#f59e0b" paddingHorizontal="$2.5" paddingVertical="$1" borderRadius={8} style={{ elevation: 2 }}>
                          <Text fontSize={11} color="white" fontWeight="900">HOT</Text>
                        </View>
                      )}
                    </View>
                    <YStack padding="$3.5" gap="$2" flex={1} justifyContent="space-between">
                      <YStack gap="$1">
                        <Text fontSize={14} fontWeight="bold" color="#333" numberOfLines={2} lineHeight={18} minHeight={36}>
                          {product.productName}
                        </Text>
                        <Text fontSize={11} color="#666">{product.promotionLabel || (product.productTypeId ? product.status : 'Đang bán')}</Text>
                      </YStack>

                      <YStack>
                        <XStack alignItems="baseline" gap="$2">
                          <Text fontSize={15} fontWeight="900" color="#00A550">
                            {product.promotionPrice ? product.promotionPrice.toLocaleString('vi-VN') : product.unitPrice.toLocaleString('vi-VN')}đ
                          </Text>
                        </XStack>
                        {!!product.promotionPrice && (
                          <Text fontSize={12} color="#999" style={{ textDecorationLine: 'line-through' }} marginTop="$0.5">
                            {product.unitPrice.toLocaleString('vi-VN')}đ
                          </Text>
                        )}
                      </YStack>
                    </YStack>
                  </Card>
                </Animated.View>
              ))}
            </XStack>
          </YStack>
        )}

      </ScrollView>
    </View>
  );
}
