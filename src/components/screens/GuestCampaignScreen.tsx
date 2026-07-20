import React, { useEffect, useState } from 'react';
import { ScrollView, Dimensions } from 'react-native';
import { View, Text, XStack, YStack, Button, Card, Image, Spinner } from 'tamagui';
import { ArrowLeft, Clock, Search, MapPin, Tag, ArrowRight, MessageCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useRobotVoice, useVoiceRouter } from '../../hooks/useRobotVoice';
import { SearchService, MobileProductSearchResultDto } from '../../services/SearchService';
import { AdService, AdPlaylistItemDto } from '../../services/AdService';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48 - 16) / 2; // padding 24*2, gap 16

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
    <View flex={1} backgroundColor="#f9fbf9" paddingLeft={Math.max(insets.left, 0)} paddingRight={Math.max(insets.right, 30)}>

      {/* HEADER BAR */}
      <XStack height={60} alignItems="center" justifyContent="space-between" paddingHorizontal="$4" borderBottomWidth={1} borderBottomColor="#f0f0f0" backgroundColor="white">
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

        <Button
          borderRadius={20}
          size="$3"
          backgroundColor="#f0fdf4"
          color="#00A550"
          fontWeight="bold"
          icon={<MapPin size={16} color="#00A550" />}
          onPress={() => speak('Chức năng tìm đường đang được kích hoạt')}
        >
          Dẫn đường mua sắm
        </Button>
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

        {/* HERO BANNER SECTION */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)}>
          <Card
            borderRadius={24}
            overflow="hidden"
            backgroundColor="#ef4444"
            borderWidth={0}
            style={{ elevation: 3 }}
            marginBottom="$6"
          >
            <YStack flex={1}>
              <View position="relative" height={160} width="100%">
                <Image
                  src="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=600"
                  width="100%"
                  height="100%"
                  objectFit="cover"
                />
                <View position="absolute" top={0} left={0} right={0} bottom={0} backgroundColor="rgba(0,0,0,0.2)" />
                <View
                  position="absolute"
                  bottom={16}
                  left={16}
                  backgroundColor="#facc15"
                  paddingHorizontal="$3"
                  paddingVertical="$1"
                  borderRadius={12}
                  style={{ elevation: 2 }}
                >
                  <Text fontSize={12} color="#854d0e" fontWeight="950">HOT DEAL GIỜ VÀNG</Text>
                </View>
              </View>
              <YStack padding="$5" gap="$3">
                <YStack gap="$1">
                  <Text fontSize={20} fontWeight="900" color="white" lineHeight={24}>
                    Giảm Giá Sốc Lên Đến 50%
                  </Text>
                  <Text fontSize={13} color="#fecaca" lineHeight={18}>
                    Hàng ngàn sản phẩm tiêu dùng, thực phẩm tươi sống đang có giá ưu đãi đặc biệt hôm nay. Hãy chọn mua ngay!
                  </Text>
                </YStack>
                <Button
                  backgroundColor="white"
                  borderRadius={30}
                  paddingHorizontal="$5"
                  height={40}
                  alignSelf="flex-start"
                  onPress={() => {
                    speak('Đăng ký thành viên để nhận thêm nhiều ưu đãi độc quyền khác!');
                    router.push('/role-selection' as any);
                  }}
                  pressStyle={{ scale: 0.95 }}
                  iconAfter={<ArrowRight size={16} color="#ef4444" />}
                >
                  <Text color="#ef4444" fontSize={13} fontWeight="bold">Đăng ký Thành Viên</Text>
                </Button>
              </YStack>
            </YStack>
          </Card>
        </Animated.View>

        {/* GENERAL ADS (TÀI TRỢ) */}
        {generalAds.length > 0 && (
          <YStack gap="$4" marginBottom="$6">
            <XStack alignItems="center" gap="$2">
              <Text fontSize={20} fontWeight="900" color="#b45309">Gợi ý cho bạn (Tài trợ)</Text>
            </XStack>
            <XStack flexWrap="wrap" justifyContent="space-between" gap="$4">
              {generalAds.map((ad, index) => (
                <Animated.View key={`ad-${ad.productId}-${index}`} style={{ width: CARD_WIDTH }} entering={FadeInUp.delay(300 + index * 50).duration(500)}>
                  <Card borderRadius={20} backgroundColor="white" overflow="hidden" borderWidth={1} borderColor="#e2e8f0" style={{ elevation: 2, height: '100%' }}>
                    <View position="relative" height={140} backgroundColor="#f5f5f5">
                      <Image
                        src={ad.imageUrl || 'https://via.placeholder.com/400x400.png'}
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
                        <Text fontSize={14} fontWeight="bold" color="#333" numberOfLines={2} lineHeight={18}>
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
                        <Button
                          backgroundColor="#fffbeb"
                          borderWidth={1}
                          borderColor="#fde68a"
                          height={36}
                          borderRadius={12}
                          marginTop="$3"
                          icon={<MapPin size={14} color="#d97706" />}
                          onPress={() => speak(`Sản phẩm ${ad.productName} đang nằm ở kệ hàng gần đây`)}
                          pressStyle={{ scale: 0.95, backgroundColor: '#fef3c7' }}
                        >
                          <Text color="#d97706" fontSize={12} fontWeight="bold">Tìm Vị Trí</Text>
                        </Button>
                      </YStack>
                    </YStack>
                  </Card>
                </Animated.View>
              ))}
            </XStack>
          </YStack>
        )}

        <YStack gap="$1" marginBottom="$4">
          <Text fontSize={20} fontWeight="900" color="#111">Danh sách Khuyến Mãi</Text>
        </YStack>

        {loading ? (
          <YStack alignItems="center" justifyContent="center" padding="$10" gap="$4">
            <Spinner size="large" color="#00A550" />
            <Text color="$textSecondary" fontWeight="500">Đang tải danh sách khuyến mãi...</Text>
          </YStack>
        ) : deals.length === 0 ? (
          <Card padding="$6" borderRadius={16} backgroundColor="white" alignItems="center">
            <Text color="$textSecondary" fontSize={15}>Hiện tại chưa có khuyến mãi nào.</Text>
          </Card>
        ) : (
          <YStack>
            <XStack flexWrap="wrap" justifyContent="space-between" gap="$4">
              {deals.map((product, index) => (
                <Animated.View key={`deal-${product.productId}-${index}`} style={{ width: CARD_WIDTH }} entering={FadeInUp.delay(300 + index * 50).duration(500)}>
                  <Card borderRadius={20} backgroundColor="white" overflow="hidden" borderWidth={1} borderColor="#e2e8f0" style={{ elevation: 2, height: '100%' }}>
                    <View position="relative" height={140} backgroundColor="#f5f5f5">
                      <Image
                        src={product.imageUrl || 'https://via.placeholder.com/400x400.png?text=No+Image'}
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
                        <Text fontSize={14} fontWeight="bold" color="#333" numberOfLines={2} lineHeight={18}>
                          {product.productName}
                        </Text>
                        <Text fontSize={11} color="#666">{product.productTypeId ? product.status : 'Đang bán'}</Text>
                      </YStack>

                      <YStack>
                        <XStack alignItems="baseline" gap="$2">
                          <Text fontSize={15} fontWeight="900" color="#00A550">
                            {product.promotionPrice ? product.promotionPrice.toLocaleString('vi-VN') : product.unitPrice.toLocaleString('vi-VN')}đ
                          </Text>
                        </XStack>
                        {product.promotionPrice && (
                          <Text fontSize={12} color="#999" style={{ textDecorationLine: 'line-through' }} marginTop="$0.5">
                            {product.unitPrice.toLocaleString('vi-VN')}đ
                          </Text>
                        )}
                        <Button
                          backgroundColor="#f0fdf4"
                          borderWidth={1}
                          borderColor="#bbf7d0"
                          height={36}
                          borderRadius={12}
                          marginTop="$3"
                          icon={<MapPin size={14} color="#00A550" />}
                          onPress={() => speak(`Sản phẩm ${product.productName} đang nằm ở kệ hàng số ${product.location?.shelfName || 'Gần đây'}`)}
                          pressStyle={{ scale: 0.95, backgroundColor: '#dcfce7' }}
                        >
                          <Text color="#00A550" fontSize={12} fontWeight="bold">Tìm Vị Trí</Text>
                        </Button>
                      </YStack>
                    </YStack>
                  </Card>
                </Animated.View>
              ))}
            </XStack>
          </YStack>
        )}

      </ScrollView>
      {/* FLOATING CHAT BUTTON */}
      <View
        position="absolute"
        bottom={30}
        right={Math.max(insets.right, 30)}
        zIndex={200}
      >
        <Button
          circular
          size="$4.5"
          backgroundColor="#005b2b"
          style={{ elevation: 6 }}
          pressStyle={{ scale: 0.95, backgroundColor: '#0d3a1f' }}
          icon={<MessageCircle size={22} color="white" />}
          onPress={() => speak('Mở trợ lý ảo chat AI')}
        />
      </View>

    </View>
  );
}
