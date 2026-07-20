import React, { useEffect, useState } from 'react';
import { ScrollView, Pressable, ToastAndroid } from 'react-native';
import { View, Text, XStack, YStack, Button, Card, Image, Progress } from 'tamagui';
import { ArrowLeft, Tag, Percent, Zap, ShoppingCart, Ticket, Clock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRobotVoice, useVoiceRouter } from '../../hooks/useRobotVoice';
import { useRobotAuth } from '../../context/RobotAuthContext';
import { CartService } from '../../services/CartService';
import { MemberService, SponsoredRecommendationDto, MemberDealDto } from '../../services/MemberService';
import { AdService, AdPlaylistItemDto } from '../../services/AdService';
import { ProductDetailSheet } from '../ui/ProductDetailSheet';

export default function MemberOffersScreen() {
  const insets = useSafeAreaInsets();
  const router = useVoiceRouter();
  const { speak } = useRobotVoice();

  // State cho bộ đếm giờ Flash Sale
  const [timeLeft, setTimeLeft] = useState({ hours: '01', minutes: '45', seconds: '32' });
  const { token, member } = useRobotAuth();
  const [deals, setDeals] = useState<MemberDealDto[]>([]);
  const [generalAds, setGeneralAds] = useState<SponsoredRecommendationDto[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(true);
  const [cart, setCart] = useState<any>(null);

  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Helper để lấy tên và màu hạng thành viên
  const getTierDetails = (level: string | null | undefined) => {
    switch (level?.toUpperCase()) {
      case 'DIAMOND':
        return { name: 'Hạng Kim Cương', color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' }; // Blue
      case 'PLATINUM':
        return { name: 'Hạng Bạch Kim', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' }; // Slate
      case 'GOLD':
        return { name: 'Hạng Vàng', color: '#d97706', bg: '#fef6e0', border: '#fde8b7' }; // Gold
      case 'SILVER':
        return { name: 'Hạng Bạc', color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' }; // Gray
      default:
        return { name: 'Hạng Đồng', color: '#92400e', bg: '#fffbeb', border: '#fef3c7' }; // Bronze
    }
  };

  const tier = getTierDetails(member?.membershipLevel);

  const handleAddToCart = async (productName: string, productId: number) => {
    try {
      if (token) {
        await CartService.addItem(productId, 1, token);
        speak(`Đã thêm ${productName} vào giỏ hàng của bạn!`);
        ToastAndroid.show(`Đã thêm ${productName} vào giỏ`, ToastAndroid.SHORT);
      } else {
        speak(`Vui lòng đăng nhập để thêm vào giỏ hàng.`);
      }
    } catch (e) {
      console.log('Lỗi thêm giỏ hàng:', e);
      speak(`Xin lỗi, không thể thêm ${productName} vào giỏ hàng lúc này.`);
      ToastAndroid.show(`Lỗi khi thêm ${productName} vào giỏ`, ToastAndroid.SHORT);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Chào mừng bằng giọng nói robot
    speak(`Smart Market Bot đã chọn lọc những ưu đãi và khuyến mãi tốt nhất cho ${tier.name.toLowerCase()} của bạn.`);

    // Fetch Personalized Deals (Khuyến mãi cá nhân hóa)
    if (member?.memberId) {
      MemberService.getMemberDeals(Number(member.memberId)).then((res) => {
        if (!mounted) return;
        if (res && res.deals) {
          setDeals(res.deals);
        }
        setLoadingDeals(false);
      });

      // Fetch Personalized Ads (Quảng cáo cá nhân hóa)
      MemberService.getSponsoredRecommendations(Number(member.memberId)).then((res) => {
        if (!mounted) return;
        if (res && res.items) {
          setGeneralAds(res.items);
        }
      }).catch(err => console.log('Error fetching personalized ads', err));

    } else {
      if (mounted) setLoadingDeals(false);
    }
    
    // Auto sync cart
    const fetchCart = () => {
      if (token) {
        CartService.getCart(token).then(res => { if (mounted) setCart(res) }).catch(e => console.log('Cart Error:', e));
      }
    };

    fetchCart();
    const interval = setInterval(fetchCart, 3000);

    // Countdown logic
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        let h = parseInt(prev.hours);
        let m = parseInt(prev.minutes);
        let s = parseInt(prev.seconds);

        if (s > 0) {
          s--;
        } else {
          s = 59;
          if (m > 0) {
            m--;
          } else {
            m = 59;
            if (h > 0) {
              h--;
            } else {
              // Reset để demo
              h = 1;
              m = 45;
              s = 32;
            }
          }
        }

        return {
          hours: h.toString().padStart(2, '0'),
          minutes: m.toString().padStart(2, '0'),
          seconds: s.toString().padStart(2, '0'),
        };
      });
    }, 1000);

    return () => {
      mounted = false;
      clearInterval(timer);
      clearInterval(interval);
    };
  }, []);

  return (
    <View flex={1} backgroundColor="#eef4ee" paddingTop={insets.top} paddingLeft={Math.max(insets.left, 0)} paddingRight={Math.max(insets.right, 0)}>
      {/* HEADER SECTION */}
      <YStack
        width="100%"
        paddingHorizontal="$4"
        paddingTop="$4"
        paddingBottom="$4"
        backgroundColor="transparent"
        gap="$3"
      >
        <XStack justifyContent="space-between" alignItems="center">
          <XStack alignItems="center" gap="$3">
            <Button
              circular
              size="$3.5"
              backgroundColor="white"
              borderWidth={1}
              borderColor="#e0e8e0"
              onPress={() => router.back()}
              icon={<ArrowLeft size={18} color="#005b2b" />}
              pressStyle={{ scale: 0.95, backgroundColor: '#f0fdf4' }}
              style={{ elevation: 2 }}
            />
            <Text fontSize={20} fontWeight="bold" color="#005b2b" fontFamily="$heading">
              Ưu đãi dành riêng cho bạn
            </Text>
          </XStack>
        </XStack>

        <XStack justifyContent="space-between" alignItems="flex-start" gap="$2">
          <Text fontSize={13} color="#556b55" fontWeight="500" paddingLeft="$1" flex={1}>
            SmartMarketBot đã chọn lọc những khuyến mãi tốt nhất cho giỏ hàng của bạn.
          </Text>
          {/* Member Level Badge */}
          <XStack
            backgroundColor={tier.bg}
            paddingHorizontal="$3"
            paddingVertical="$1.5"
            borderRadius={20}
            alignItems="center"
            gap="$2"
            borderWidth={1}
            borderColor={tier.border}
            style={{ elevation: 1 }}
          >
            <View width={6} height={6} borderRadius={3} backgroundColor={tier.color} />
            <Text fontSize={10} color={tier.color} fontWeight="bold">{tier.name}</Text>
          </XStack>
        </XStack>
      </YStack>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80 }}>

        {/* EXCLUSIVE OFFERS */}
        <YStack gap="$3" marginBottom="$6">
          <XStack alignItems="center" gap="$2">
            <Percent size={20} color="#0d3a1f" />
            <Text fontSize={18} fontWeight="bold" color="#0d3a1f">Ưu đãi Đặc quyền</Text>
          </XStack>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
            {loadingDeals ? (
              <Text fontSize={14} color="#666" fontStyle="italic">Đang tải ưu đãi...</Text>
            ) : deals.length > 0 ? (
              deals.map((deal, idx) => (
                <Pressable key={idx} onPress={() => { setSelectedProductId(deal.productId); setSheetOpen(true); }}>
                  <Card width={220} borderRadius={20} backgroundColor="white" overflow="hidden" borderWidth={1} borderColor="#e2e8f0" style={{ elevation: 2 }}>
                    <View position="relative" height={130} backgroundColor="#f5f5f5">
                    <Image 
                      src={deal.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80'} 
                      width="100%" 
                      height="100%" 
                      objectFit="cover" 
                    />
                    {deal.discountedPrice && deal.originalPrice > deal.discountedPrice && (
                      <View position="absolute" top={10} left={10} backgroundColor="#ef4444" paddingHorizontal="$2.5" paddingVertical="$1" borderRadius={8}>
                        <Text fontSize={10} color="white" fontWeight="900">-{Math.round((1 - deal.discountedPrice / deal.originalPrice) * 100)}%</Text>
                      </View>
                    )}
                    <View position="absolute" top={10} right={10} backgroundColor="#ffffffb3" padding="$1.5" borderRadius={20}>
                      <Tag size={12} color={tier.color} />
                    </View>
                  </View>
                  <YStack padding="$3.5" gap="$1.5">
                    <Text fontSize={14} fontWeight="900" color="#333" numberOfLines={1}>{deal.productName}</Text>
                    <XStack backgroundColor={tier.bg} paddingHorizontal="$2" paddingVertical="$0.5" borderRadius={6} alignSelf="flex-start">
                      <Text fontSize={9} color={tier.color} fontWeight="bold">{tier.name.replace('Hạng', 'Thành viên')}</Text>
                    </XStack>
                    <Text fontSize={11} color="#666" numberOfLines={2} height={32} lineHeight={16}>
                      Phù hợp với lịch sử mua sắm của bạn.
                    </Text>
                    <XStack justifyContent="space-between" alignItems="center" marginTop="$2">
                      <YStack>
                        <Text fontSize={11} color="#aaa" style={{ textDecorationLine: 'line-through' }}>
                          {deal.originalPrice.toLocaleString('vi-VN')}đ
                        </Text>
                        <Text fontSize={15} fontWeight="bold" color="#00A550">
                          {deal.discountedPrice ? deal.discountedPrice.toLocaleString('vi-VN') : deal.originalPrice.toLocaleString('vi-VN')}đ
                        </Text>
                      </YStack>
                      <Button
                        circular
                        size="$2.5"
                        backgroundColor="#00A550"
                        icon={<ShoppingCart size={14} color="white" />}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleAddToCart(deal.productName, deal.productId);
                        }}
                        pressStyle={{ backgroundColor: '#008740' }}
                      />
                    </XStack>
                  </YStack>
                  </Card>
                </Pressable>
              ))
            ) : (
              <Text fontSize={14} color="#666">Chưa có ưu đãi đặc quyền nào cho bạn lúc này.</Text>
            )}
          </ScrollView>
        </YStack>

        {/* GENERAL ADS / RECOMMENDATIONS */}
        <YStack gap="$3">
          <XStack justifyContent="space-between" alignItems="center">
            <XStack alignItems="center" gap="$2">
              <Zap size={20} color="#b45309" />
              <Text fontSize={18} fontWeight="bold" color="#b45309">Gợi ý cho bạn (Tài trợ)</Text>
            </XStack>
          </XStack>

          <YStack gap="$4">
            {generalAds.length > 0 ? generalAds.map((ad, idx) => (
              <Pressable key={idx} onPress={() => { setSelectedProductId(ad.productId); setSheetOpen(true); }}>
                <Card flex={1} borderRadius={16} overflow="hidden" backgroundColor="white" borderWidth={1} borderColor="#e2e8f0" style={{ elevation: 1 }}>
                  <XStack padding="$3" gap="$3" alignItems="center">
                  <Image src={ad.imageUrl || 'https://via.placeholder.com/200x200.png'} width={80} height={80} borderRadius={12} objectFit="cover" />
                  <YStack flex={1} gap="$1">
                    <Text fontSize={13} fontWeight="bold" color="#333" numberOfLines={1}>{ad.productName}</Text>
                    <Text fontSize={11} color="#666" numberOfLines={1}>Tài trợ bởi: {ad.brandName}</Text>
                    <XStack alignItems="center" gap="$2" marginTop="$1">
                      <Text fontSize={14} fontWeight="bold" color="#b45309">{(ad.promotionPrice || ad.unitPrice).toLocaleString('vi-VN')}đ</Text>
                      {ad.promotionPrice && (
                         <Text fontSize={11} color="#aaa" style={{ textDecorationLine: 'line-through' }}>
                           {ad.unitPrice.toLocaleString('vi-VN')}đ
                         </Text>
                      )}
                    </XStack>
                  </YStack>
                  <Button
                    backgroundColor="#78350f"
                    size="$2.5"
                    borderRadius={15}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleAddToCart(ad.productName, ad.productId);
                    }}
                    pressStyle={{ backgroundColor: '#5c280b' }}
                  >
                    <Text color="white" fontSize={11} fontWeight="bold">Mua ngay</Text>
                  </Button>
                </XStack>
                </Card>
              </Pressable>
            )) : (
              <Text fontSize={14} color="#666">Đang tải gợi ý...</Text>
            )}
          </YStack>
        </YStack>

      </ScrollView>

      {/* FLOATING CART WIDGET */}
      {cart && cart.totalItems > 0 && (
        <View
          position="absolute"
          bottom={30}
          right={Math.max(insets.right, 30)}
          zIndex={200}
        >
          <Button
            circular
            size="$5"
            backgroundColor="#22c55e"
            style={{ elevation: 6 }}
            pressStyle={{ scale: 0.95, backgroundColor: '#15803d' }}
            icon={<ShoppingCart size={24} color="white" />}
            onPress={() => router.push('/member-cart' as any)}
          />
          {/* Badge number */}
          <View
            position="absolute"
            top={-4}
            right={-4}
            backgroundColor="#ef4444"
            borderRadius={12}
            minWidth={24}
            height={24}
            justifyContent="center"
            alignItems="center"
            borderWidth={2}
            borderColor="white"
            paddingHorizontal={4}
          >
            <Text fontSize={11} fontWeight="bold" color="white">{cart.totalItems}</Text>
          </View>
        </View>
      )}

      <ProductDetailSheet 
        productId={selectedProductId}
        isOpen={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </View>
  );
}
