/* eslint-disable react-hooks/immutability */
import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, Pressable, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, XStack, YStack, Button, Card } from 'tamagui';
import {
  Search, Mic, MapPin, Gift, Navigation, Sparkles, Crown, ChevronRight,
  ShoppingCart, Utensils, Clock
} from 'lucide-react-native';
import { MemberHeader } from '../layout/MemberHeader';
import { useVoiceRouter, useRobotVoice } from '../../hooks/useRobotVoice';
import { useFocusEffect } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing, FadeInDown, FadeInUp
} from 'react-native-reanimated';
import { useRobotAuth } from '../../context/RobotAuthContext';
import { MemberService, MemberDealDto, SponsoredRecommendationDto, MemberAlertDto } from '../../services/MemberService';
import { CartService, CartDto } from '../../services/CartService';
import RobotAdDisplay from '../robot/RobotAdDisplay';
import { SearchService, MobileProductSearchResultDto } from '../../services/SearchService';
import { useGeofencing } from '../../context/GeofencingContext';
import { useNotification } from '../../context/NotificationContext';
import { RobotControlService } from '../../services/RobotControlService';
import { Image } from 'expo-image';

const ROBOT_CODE = 'RB001';

export default function MemberHomeScreen() {
  const { member, token } = useRobotAuth();
  const { currentZone, isInZone } = useGeofencing();
  const insets = useSafeAreaInsets();
  const router = useVoiceRouter();
  const { speak, stop } = useRobotVoice();
  const { showNotification } = useNotification();

  const [deals, setDeals] = useState<MemberDealDto[]>([]);
  const [sponsoredRecs, setSponsoredRecs] = useState<SponsoredRecommendationDto[]>([]);
  const [alerts, setAlerts] = useState<MemberAlertDto[]>([]);
  const [personalizedProducts, setPersonalizedProducts] = useState<any[]>([]);
  const [personalizedMeals, setPersonalizedMeals] = useState<any[]>([]);
  const [cart, setCart] = useState<CartDto | null>(null);
  const [systemDeals, setSystemDeals] = useState<MobileProductSearchResultDto[]>([]);
  const [guidingId, setGuidingId] = useState<number | null>(null);
  const [addingCartId, setAddingCartId] = useState<number | null>(null);

  // Tính tổng số lượng sản phẩm có trong giỏ hàng (hỗ trợ cả items array và totalItems)
  const totalCartCount = cart?.items && cart.items.length > 0
    ? cart.items.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0)
    : (Number(cart?.totalItems) || 0);

  // Focus effect: Load all member data, deals, recommendations & cart
  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      if (member?.memberId) {
        const id = Number(member.memberId);
        MemberService.getMemberDeals(id).then(res => {
          if (mounted) setDeals(res?.deals || []);
        }).catch(console.error);

        MemberService.getSponsoredRecommendations(id).then(res => {
          if (mounted) setSponsoredRecs(res?.items || []);
        }).catch(console.error);

        MemberService.getMemberAlerts(id).then(res => {
          if (mounted) setAlerts(res?.alerts || []);
        }).catch(console.error);

        MemberService.getPersonalizedProducts(token || '').then(res => {
          if (mounted) setPersonalizedProducts(res || []);
        }).catch(console.error);

        MemberService.getPersonalizedMeals(token || '').then(res => {
          if (mounted) setPersonalizedMeals(res || []);
        }).catch(console.error);

        SearchService.getDeals(id).then(res => {
          if (mounted) setSystemDeals(Array.isArray(res) ? res : []);
        }).catch(err => {
          console.error('[MemberHome] getDeals failed:', err);
          if (mounted) setSystemDeals([]);
        });
      }

      // Auto sync cart
      if (token) {
        CartService.getCart(token).then(res => {
          if (mounted) setCart(res);
        }).catch(e => console.log('Cart Error:', e));
      }

      return () => {
        mounted = false;
      };
    }, [member, token])
  );

  // Friendly voice greeting on screen entry
  useEffect(() => {
    const firstName = member?.fullName ? member.fullName.split(' ').pop() : 'quý khách';
    speak(`Chào mừng ${firstName} trở lại với Smart Market Bot! Hãy chọn tính năng bạn cần hoặc chạm vào biểu tượng micro để nói chuyện với tôi.`);
    return () => {
      stop();
    };
  }, [member?.fullName]);

  // Điều hướng robot dẫn đường đến kệ chứa sản phẩm
  const handleGuideToProduct = async (product: { productId: number; productName: string }) => {
    if (guidingId !== null) return;
    setGuidingId(product.productId);
    try {
      speak(`Dạ vâng! Robot sẽ dẫn bạn đến quầy bán ${product.productName}. Xin mời đi theo tôi!`);
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
        source: 'RobotKiosk',
        dispatchedBy: member?.fullName ? `${member.fullName} (VIP)` : 'Thành viên VIP',
        targetSummary: `Sản phẩm: ${product.productName}`,
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

  // Thêm nhanh sản phẩm vào giỏ hàng
  const handleAddToCart = async (product: { productId: number; productName: string }) => {
    if (!token) {
      showNotification({
        title: 'CHƯA ĐĂNG NHẬP',
        message: 'Vui lòng đăng nhập để thêm vào giỏ hàng',
        type: 'warning',
      });
      return;
    }
    setAddingCartId(product.productId);
    try {
      const updatedCart = await CartService.addItem(product.productId, 1, token);
      if (updatedCart) setCart(updatedCart);
      speak(`Đã thêm ${product.productName} vào giỏ hàng của bạn!`);
      showNotification({
        title: 'GIỎ HÀNG THÔNG MINH',
        message: `Đã thêm ${product.productName} vào giỏ`,
        type: 'success',
      });
    } catch (err: any) {
      showNotification({
        title: 'LỖI THÊM VÀO GIỎ',
        message: err?.message || 'Không thể thêm sản phẩm',
        type: 'error',
      });
    } finally {
      setAddingCartId(null);
    }
  };

  // Animation bồng bềnh cho FAB Mic
  const fabPulse = useSharedValue(1);
  useEffect(() => {
    fabPulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 900, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const fabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabPulse.value }],
  }));

  const firstName = member?.fullName ? member.fullName.split(' ').pop() : 'bạn';
  const tierName = member?.membershipLevel?.toUpperCase() || 'MEMBER';

  return (
    <View flex={1} backgroundColor="#F8FAFC" paddingTop={insets.top}>

      {/* 1. TOP MEMBER HEADER */}
      <MemberHeader />

      {/* Live Geofencing Zone Banner */}
      {isInZone && currentZone && (
        <Animated.View entering={FadeInDown.duration(400)}>
          <XStack
            alignItems="center"
            gap="$2"
            backgroundColor="#ECFDF5"
            borderColor="#A7F3D0"
            borderWidth={1}
            paddingHorizontal="$3.5"
            paddingVertical="$2"
            marginHorizontal="$4"
            marginTop="$2"
            borderRadius={12}
          >
            <View width={8} height={8} borderRadius={4} backgroundColor="#10B981" />
            <MapPin size={13} color="#059669" />
            <Text fontSize={12} fontWeight="700" color="#065F46">
              Bạn đang ở: {currentZone.objectName}
            </Text>
          </XStack>
        </Animated.View>
      )}

      {/* 2. MAIN SCROLLABLE CONTENT */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
      >

        {/* MEMBER HERO GREETING BANNER */}
        <Animated.View entering={FadeInDown.duration(500)}>
          <Card
            borderRadius={22}
            padding="$4"
            backgroundColor="#F0FDF4"
            borderWidth={1.5}
            borderColor="#BBF7D0"
            marginBottom="$4"
            shadowColor="#00A550"
            shadowRadius={10}
            shadowOpacity={0.05}
            style={{ elevation: 2 }}
          >
            <YStack gap="$3">
              <XStack alignItems="center" justifyContent="space-between">
                <XStack alignItems="center" gap="$2.5" flex={1}>
                  <View
                    width={38}
                    height={38}
                    borderRadius={19}
                    backgroundColor="#DCFCE7"
                    justifyContent="center"
                    alignItems="center"
                  >
                    <Sparkles size={20} color="#00A550" />
                  </View>
                  <YStack flex={1}>
                    <Text fontSize={16} fontWeight="900" color="#0F172A" numberOfLines={1}>
                      Chào {firstName}! 👋
                    </Text>
                    <Text fontSize={12} color="#166534" fontWeight="600" numberOfLines={1}>
                      Trợ lý AI sẵn sàng dẫn đường & hỗ trợ bạn
                    </Text>
                  </YStack>
                </XStack>

                {/* Tier Badge */}
                <XStack
                  alignItems="center"
                  gap="$1"
                  backgroundColor="#FEF3C7"
                  borderWidth={1}
                  borderColor="#FDE68A"
                  paddingHorizontal="$2"
                  paddingVertical="$1"
                  borderRadius={10}
                >
                  <Crown size={12} color="#D97706" />
                  <Text fontSize={10} fontWeight="900" color="#B45309">
                    {tierName}
                  </Text>
                </XStack>
              </XStack>

              <Text fontSize={13} color="#475569" lineHeight={19}>
                Hôm nay hệ thống đã đồng bộ danh mục thực phẩm tươi sống, món ngon dinh dưỡng và ưu đãi đặc quyền phù hợp cho bạn.
              </Text>

              {/* Quick Actions in Hero */}
              <XStack gap="$2" marginTop="$1">
                <Button
                  flex={1}
                  size="$3"
                  backgroundColor="#00A550"
                  borderRadius={14}
                  paddingHorizontal="$2"
                  icon={<MapPin size={14} color="white" />}
                  onPress={() => router.push('/map-viewer' as any)}
                  pressStyle={{ opacity: 0.9, scale: 0.98 }}
                >
                  <Text color="white" fontWeight="800" fontSize={11} numberOfLines={1}>
                    Sơ Đồ 2D Siêu Thị
                  </Text>
                </Button>

                <Button
                  flex={1}
                  size="$3"
                  backgroundColor="white"
                  borderRadius={14}
                  borderWidth={1.5}
                  borderColor="#00A550"
                  paddingHorizontal="$2"
                  icon={<ShoppingCart size={14} color="#00A550" />}
                  onPress={() => router.push('/member-cart' as any)}
                  pressStyle={{ backgroundColor: '#F0FDF4', scale: 0.98 }}
                >
                  <Text color="#00A550" fontWeight="800" fontSize={11} numberOfLines={1}>
                    Giỏ Hàng ({totalCartCount})
                  </Text>
                </Button>
              </XStack>
            </YStack>
          </Card>
        </Animated.View>

        {/* 3. 4 CORE KIOSK SERVICES (2x2 Grid) */}
        <YStack gap="$2.5" marginBottom="$5">
          <XStack justifyContent="space-between" alignItems="center" marginBottom="$1">
            <Text fontSize={15} fontWeight="900" color="#0F172A" letterSpacing={0.3}>
              Dịch Vụ Mua Sắm Kiosk
            </Text>
            <Text fontSize={11} color="#64748B" fontWeight="600">
              Chạm để sử dụng
            </Text>
          </XStack>

          {/* Row 1: Giọng Nói AI & Tra Cứu Sản Phẩm */}
          <XStack gap="$2.5">
            {/* Card 1: Giọng Nói */}
            <Pressable
              onPress={() => router.push('/voice-search' as any)}
              style={({ pressed }) => ({
                flex: 1,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <Card
                borderRadius={18}
                padding="$3.5"
                backgroundColor="white"
                borderWidth={1}
                borderColor="#DCFCE7"
                shadowColor="#00A550"
                shadowRadius={10}
                shadowOpacity={0.04}
                style={{ elevation: 2 }}
              >
                <YStack gap="$2">
                  <View
                    width={42}
                    height={42}
                    borderRadius={14}
                    backgroundColor="#00A550"
                    justifyContent="center"
                    alignItems="center"
                    shadowColor="#00A550"
                    shadowRadius={8}
                    shadowOpacity={0.25}
                  >
                    <Mic size={22} color="white" />
                  </View>
                  <YStack gap="$0.5">
                    <Text fontSize={14} fontWeight="800" color="#0F172A">
                      Giọng Nói AI
                    </Text>
                    <Text fontSize={11} color="#64748B" numberOfLines={1}>
                      Nói tên món bạn cần
                    </Text>
                  </YStack>
                </YStack>
              </Card>
            </Pressable>

            {/* Card 2: Tra Cứu Sản Phẩm */}
            <Pressable
              onPress={() => router.push('/member-search' as any)}
              style={({ pressed }) => ({
                flex: 1,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <Card
                borderRadius={18}
                padding="$3.5"
                backgroundColor="white"
                borderWidth={1}
                borderColor="#E0F2FE"
                shadowColor="#0284C7"
                shadowRadius={10}
                shadowOpacity={0.04}
                style={{ elevation: 2 }}
              >
                <YStack gap="$2">
                  <View
                    width={42}
                    height={42}
                    borderRadius={14}
                    backgroundColor="#0284C7"
                    justifyContent="center"
                    alignItems="center"
                    shadowColor="#0284C7"
                    shadowRadius={8}
                    shadowOpacity={0.25}
                  >
                    <Search size={22} color="white" />
                  </View>
                  <YStack gap="$0.5">
                    <Text fontSize={14} fontWeight="800" color="#0F172A">
                      Tra Cứu Sản Phẩm
                    </Text>
                    <Text fontSize={11} color="#64748B" numberOfLines={1}>
                      Vị trí quầy kệ & giá
                    </Text>
                  </YStack>
                </YStack>
              </Card>
            </Pressable>
          </XStack>

          {/* Row 2: Ưu Đãi Đặc Quyền & Sơ Đồ Quầy Kệ */}
          <XStack gap="$2.5">
            {/* Card 3: Ưu Đãi Đặc Quyền */}
            <Pressable
              onPress={() => router.push('/member-offers' as any)}
              style={({ pressed }) => ({
                flex: 1,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <Card
                borderRadius={18}
                padding="$3.5"
                backgroundColor="white"
                borderWidth={1}
                borderColor="#FEF3C7"
                shadowColor="#F59E0B"
                shadowRadius={10}
                shadowOpacity={0.04}
                style={{ elevation: 2 }}
                position="relative"
              >
                {/* VIP Badge */}
                <View
                  position="absolute"
                  top={10}
                  right={10}
                  backgroundColor="#EF4444"
                  paddingHorizontal="$1.5"
                  paddingVertical="$0.5"
                  borderRadius={8}
                >
                  <Text color="white" fontSize={9} fontWeight="900">VIP</Text>
                </View>

                <YStack gap="$2">
                  <View
                    width={42}
                    height={42}
                    borderRadius={14}
                    backgroundColor="#F59E0B"
                    justifyContent="center"
                    alignItems="center"
                    shadowColor="#F59E0B"
                    shadowRadius={8}
                    shadowOpacity={0.25}
                  >
                    <Gift size={22} color="white" />
                  </View>
                  <YStack gap="$0.5">
                    <Text fontSize={14} fontWeight="800" color="#0F172A">
                      Ưu Đãi Đặc Quyền
                    </Text>
                    <Text fontSize={11} color="#64748B" numberOfLines={1}>
                      Voucher & giảm sốc
                    </Text>
                  </YStack>
                </YStack>
              </Card>
            </Pressable>

            {/* Card 4: Sơ Đồ Quầy Kệ */}
            <Pressable
              onPress={() => router.push('/map-viewer' as any)}
              style={({ pressed }) => ({
                flex: 1,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <Card
                borderRadius={18}
                padding="$3.5"
                backgroundColor="white"
                borderWidth={1}
                borderColor="#EDE9FE"
                shadowColor="#8B5CF6"
                shadowRadius={10}
                shadowOpacity={0.04}
                style={{ elevation: 2 }}
              >
                <YStack gap="$2">
                  <View
                    width={42}
                    height={42}
                    borderRadius={14}
                    backgroundColor="#8B5CF6"
                    justifyContent="center"
                    alignItems="center"
                    shadowColor="#8B5CF6"
                    shadowRadius={8}
                    shadowOpacity={0.25}
                  >
                    <MapPin size={22} color="white" />
                  </View>
                  <YStack gap="$0.5">
                    <Text fontSize={14} fontWeight="800" color="#0F172A">
                      Sơ Đồ Quầy Kệ
                    </Text>
                    <Text fontSize={11} color="#64748B" numberOfLines={1}>
                      Bản đồ vị trí 2D
                    </Text>
                  </YStack>
                </YStack>
              </Card>
            </Pressable>
          </XStack>
        </YStack>

        {/* 4. ACTIVE CART HUD (if cart has items) */}
        {cart && totalCartCount > 0 && (
          <Animated.View entering={FadeInDown.duration(400)}>
            <Pressable
              onPress={() => router.push('/member-cart' as any)}
              style={({ pressed }) => ({
                opacity: pressed ? 0.92 : 1,
                transform: [{ scale: pressed ? 0.99 : 1 }],
                marginBottom: 16,
              })}
            >
              <Card
                borderRadius={18}
                padding="$3.5"
                backgroundColor="#F0FDF4"
                borderWidth={1.5}
                borderColor="#BBF7D0"
                shadowColor="#00A550"
                shadowRadius={8}
                shadowOpacity={0.08}
                style={{ elevation: 2 }}
              >
                <XStack justifyContent="space-between" alignItems="center">
                  <XStack alignItems="center" gap="$3" flex={1}>
                    <View
                      width={42}
                      height={42}
                      borderRadius={14}
                      backgroundColor="#00A550"
                      justifyContent="center"
                      alignItems="center"
                      shadowColor="#00A550"
                      shadowRadius={6}
                      shadowOpacity={0.2}
                    >
                      <ShoppingCart size={20} color="white" />
                    </View>
                    <YStack flex={1}>
                      <Text fontSize={14} fontWeight="900" color="#065F46">
                        Giỏ Hàng Của Bạn
                      </Text>
                      <Text fontSize={12} color="#047857" fontWeight="600">
                        {totalCartCount} sản phẩm đang chờ
                      </Text>
                    </YStack>
                  </XStack>

                  <XStack alignItems="center" gap="$2">
                    <Text fontSize={15} fontWeight="900" color="#00A550">
                      {(cart.totalPrice ?? 0).toLocaleString('vi-VN')}đ
                    </Text>
                    <ChevronRight size={18} color="#00A550" />
                  </XStack>
                </XStack>
              </Card>
            </Pressable>
          </Animated.View>
        )}

        {/* 5. ROBOT ADS DISPLAY BANNER */}
        <RobotAdDisplay robotId={1} robotCode={ROBOT_CODE} />

        {/* 6. HOT DEALS CAROUSEL (WITH DIRECT GUIDANCE BUTTON) */}
        <Animated.View entering={FadeInUp.delay(200).duration(500)}>
          <XStack justifyContent="space-between" alignItems="center" marginTop="$4" marginBottom="$3">
            <XStack alignItems="center" gap="$1.5">
              <Gift size={18} color="#EA580C" />
              <Text fontSize={15} fontWeight="900" color="#0F172A">
                Ưu Đãi Nổi Bật Hôm Nay
              </Text>
            </XStack>
            <TouchableOpacity
              onPress={() => router.push('/member-offers' as any)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
            >
              <Text fontSize={12} color="#00A550" fontWeight="800">
                Xem tất cả
              </Text>
              <ChevronRight size={14} color="#00A550" />
            </TouchableOpacity>
          </XStack>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
            <XStack gap="$3">
              {systemDeals.length > 0 ? (
                systemDeals.map((product, index) => (
                  <Pressable
                    key={`deal-${product.productId}-${index}`}
                    onPress={() => router.push(`/product/${product.productId}` as any)}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.92 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    })}
                  >
                    <Card
                      width={195}
                      borderRadius={18}
                      backgroundColor="white"
                      overflow="hidden"
                      shadowColor="black"
                      shadowRadius={10}
                      shadowOpacity={0.06}
                      borderWidth={1}
                      borderColor="#F1F5F9"
                      style={{ elevation: 3 }}
                    >
                      {/* Product Image */}
                      <View position="relative" height={125} backgroundColor="#FFFFFF" justifyContent="center" alignItems="center">
                        <Image
                          source={{ uri: product.imageUrl || 'https://via.placeholder.com/300x300.png?text=SmartMarket' }}
                          style={{ width: '85%', height: '85%' }}
                          contentFit="contain"
                        />
                        {product.discountPercent ? (
                          <View position="absolute" top={8} left={8} backgroundColor="#EF4444" paddingHorizontal="$2" paddingVertical="$0.5" borderRadius={8}>
                            <Text color="white" fontSize={10} fontWeight="900">-{product.discountPercent}%</Text>
                          </View>
                        ) : (
                          <View position="absolute" top={8} left={8} backgroundColor="#00A550" paddingHorizontal="$2" paddingVertical="$0.5" borderRadius={8}>
                            <Text color="white" fontSize={10} fontWeight="900">HOT</Text>
                          </View>
                        )}
                      </View>

                      {/* Product Details */}
                      <YStack padding="$3" gap="$1.5" backgroundColor="#FAFAFA" borderTopWidth={1} borderTopColor="#F1F5F9">
                        <Text fontSize={13} fontWeight="800" color="#0F172A" numberOfLines={2} height={36}>
                          {product?.productName || 'Sản phẩm siêu thị'}
                        </Text>

                        {/* Shelf Location */}
                        {product.location?.shelfName ? (
                          <XStack alignItems="center" gap="$1">
                            <MapPin size={10} color="#64748B" />
                            <Text fontSize={10} color="#64748B" numberOfLines={1}>
                              {product.location.zone ? `${product.location.zone} · ` : ''}{product.location.shelfName}
                            </Text>
                          </XStack>
                        ) : (
                          <XStack alignItems="center" gap="$1">
                            <MapPin size={10} color="#94A3B8" />
                            <Text fontSize={10} color="#94A3B8" numberOfLines={1}>Khu A · Quầy trung tâm</Text>
                          </XStack>
                        )}

                        {/* Price & Guide Action */}
                        <YStack gap="$1.5" marginTop="$1">
                          <XStack alignItems="baseline" gap="$1.5">
                            {product?.promotionPrice ? (
                              <>
                                <Text fontSize={14} fontWeight="900" color="#00A550">
                                  {(product.promotionPrice ?? 0).toLocaleString('vi-VN')}đ
                                </Text>
                                <Text fontSize={10} color="#94A3B8" textDecorationLine="line-through">
                                  {(product?.unitPrice ?? 0).toLocaleString('vi-VN')}đ
                                </Text>
                              </>
                            ) : (
                              <Text fontSize={14} fontWeight="900" color="#00A550">
                                {(product?.unitPrice ?? 0).toLocaleString('vi-VN')}đ
                              </Text>
                            )}
                          </XStack>

                          {/* Full-width clean guide button */}
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              handleGuideToProduct({ productId: product.productId, productName: product.productName });
                            }}
                            disabled={guidingId === product.productId}
                            style={{
                              backgroundColor: '#00A550',
                              width: '100%',
                              paddingVertical: 7,
                              borderRadius: 10,
                              flexDirection: 'row',
                              justifyContent: 'center',
                              alignItems: 'center',
                              gap: 5,
                              opacity: guidingId === product.productId ? 0.7 : 1,
                            }}
                          >
                            <Navigation size={12} color="white" />
                            <Text color="white" fontSize={11} fontWeight="800">
                              {guidingId === product.productId ? 'Đang dẫn đường...' : 'Dẫn đường'}
                            </Text>
                          </TouchableOpacity>
                        </YStack>
                      </YStack>
                    </Card>
                  </Pressable>
                ))
              ) : (
                <Text color="#64748B" padding="$4" fontSize={13}>
                  Đang tải danh sách khuyến mãi...
                </Text>
              )}
            </XStack>
          </ScrollView>
        </Animated.View>

        {/* 7. PERSONALIZED AI RECOMMENDATIONS CAROUSEL */}
        {personalizedProducts.length > 0 && (
          <Animated.View entering={FadeInUp.delay(300).duration(500)}>
            <XStack justifyContent="space-between" alignItems="center" marginTop="$3" marginBottom="$3">
              <XStack alignItems="center" gap="$1.5">
                <Sparkles size={18} color="#00A550" />
                <Text fontSize={15} fontWeight="900" color="#0F172A">
                  Gợi Ý Riêng Cho Bạn
                </Text>
              </XStack>
              <TouchableOpacity
                onPress={() => router.push('/personalized-products' as any)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
              >
                <Text fontSize={12} color="#00A550" fontWeight="800">
                  Xem tất cả
                </Text>
                <ChevronRight size={14} color="#00A550" />
              </TouchableOpacity>
            </XStack>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              <XStack gap="$3">
                {personalizedProducts.map((p, index) => (
                  <Pressable
                    key={`personal-${p.productId || index}`}
                    onPress={() => router.push(`/product/${p.productId}?isRecipe=false` as any)}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.92 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    })}
                  >
                    <Card
                      width={195}
                      borderRadius={18}
                      backgroundColor="white"
                      overflow="hidden"
                      shadowColor="black"
                      shadowRadius={10}
                      shadowOpacity={0.06}
                      borderWidth={1}
                      borderColor="#DCFCE7"
                      style={{ elevation: 3 }}
                    >
                      {/* Image */}
                      <View position="relative" height={125} backgroundColor="#FFFFFF" justifyContent="center" alignItems="center">
                        <Image
                          source={{ uri: (typeof p.imageUrl === 'string' && p.imageUrl.startsWith('http')) ? p.imageUrl : 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?q=80&w=400' }}
                          style={{ width: '85%', height: '85%' }}
                          contentFit="contain"
                        />
                        <View position="absolute" top={8} left={8} backgroundColor="#00A550" paddingHorizontal="$2" paddingVertical="$0.5" borderRadius={8}>
                          <Text color="white" fontSize={9} fontWeight="900">AI MATCH</Text>
                        </View>
                      </View>

                      {/* Details */}
                      <YStack padding="$3" gap="$1.5" backgroundColor="#FAFAFA" borderTopWidth={1} borderTopColor="#F1F5F9">
                        <Text fontSize={13} fontWeight="800" color="#0F172A" numberOfLines={2} height={36}>
                          {p?.productName || 'Sản phẩm gợi ý'}
                        </Text>

                        {/* Price */}
                        <Text fontSize={14} fontWeight="900" color="#00A550" marginTop="$0.5">
                          {((p?.promotionPrice || p?.unitPrice) ?? 0).toLocaleString('vi-VN')}đ
                        </Text>

                        {/* Two quick action buttons: + Giỏ & Dẫn */}
                        <XStack gap="$1.5" marginTop="$1.5">
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              handleAddToCart({ productId: p.productId, productName: p.productName });
                            }}
                            disabled={addingCartId === p.productId}
                            style={{
                              flex: 1,
                              backgroundColor: '#F0FDF4',
                              borderWidth: 1,
                              borderColor: '#86EFAC',
                              paddingVertical: 7,
                              borderRadius: 10,
                              flexDirection: 'row',
                              justifyContent: 'center',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <ShoppingCart size={12} color="#00A550" />
                            <Text color="#00A550" fontSize={11} fontWeight="800">
                              {addingCartId === p.productId ? '...' : '+ Giỏ'}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              handleGuideToProduct({ productId: p.productId, productName: p.productName });
                            }}
                            disabled={guidingId === p.productId}
                            style={{
                              flex: 1,
                              backgroundColor: '#00A550',
                              paddingVertical: 7,
                              borderRadius: 10,
                              flexDirection: 'row',
                              justifyContent: 'center',
                              alignItems: 'center',
                              gap: 4,
                              opacity: guidingId === p.productId ? 0.7 : 1,
                            }}
                          >
                            <Navigation size={12} color="white" />
                            <Text color="white" fontSize={11} fontWeight="800">
                              {guidingId === p.productId ? '...' : 'Dẫn'}
                            </Text>
                          </TouchableOpacity>
                        </XStack>
                      </YStack>
                    </Card>
                  </Pressable>
                ))}
              </XStack>
            </ScrollView>
          </Animated.View>
        )}

        {/* 8. NUTRITIONAL MEAL RECIPES (MÓN NGON DINH DƯỠNG) */}
        {personalizedMeals.length > 0 && (
          <Animated.View entering={FadeInUp.delay(350).duration(500)}>
            <XStack justifyContent="space-between" alignItems="center" marginTop="$2" marginBottom="$3">
              <XStack alignItems="center" gap="$1.5">
                <Utensils size={18} color="#EA580C" />
                <Text fontSize={15} fontWeight="900" color="#0F172A">
                  Món Ngon Dinh Dưỡng Hôm Nay
                </Text>
              </XStack>
            </XStack>

            <YStack gap="$3" marginBottom="$4">
              {personalizedMeals.slice(0, 2).map((meal, index) => (
                <Pressable
                  key={`meal-${meal?.recipeId ?? index}`}
                  onPress={() => router.push(`/product/${meal?.recipeId}?isRecipe=true` as any)}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.95 : 1,
                    transform: [{ scale: pressed ? 0.99 : 1 }],
                  })}
                >
                  <Card
                    borderRadius={18}
                    backgroundColor="white"
                    borderWidth={1}
                    borderColor="#FFEDD5"
                    overflow="hidden"
                    shadowColor="#EA580C"
                    shadowRadius={10}
                    shadowOpacity={0.04}
                    style={{ elevation: 2 }}
                    padding="$3"
                  >
                    <XStack gap="$3" alignItems="center">
                      <Image
                        source={{ uri: meal?.imageUrl || 'https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=400' }}
                        style={{ width: 84, height: 84, borderRadius: 14 }}
                        contentFit="cover"
                      />
                      <YStack flex={1} gap="$1" justifyContent="space-between">
                        <XStack alignItems="center" gap="$1">
                          <Sparkles size={11} color="#EA580C" />
                          <Text fontSize={10} fontWeight="900" color="#EA580C" letterSpacing={0.5} textTransform="uppercase">
                            THỰC ĐƠN GIA ĐÌNH
                          </Text>
                        </XStack>

                        <Text fontSize={14} fontWeight="800" color="#0F172A" numberOfLines={2}>
                          {meal?.recipeName || 'Món ngon dinh dưỡng'}
                        </Text>

                        <XStack alignItems="center" gap="$2">
                          <Clock size={12} color="#64748B" />
                          <Text fontSize={11} color="#64748B" fontWeight="600">
                            {meal?.yieldPortions ?? 2} khẩu phần
                          </Text>
                        </XStack>

                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            router.push(`/product/${meal?.recipeId}?isRecipe=true` as any);
                          }}
                          style={{
                            alignSelf: 'flex-start',
                            backgroundColor: '#FFF7ED',
                            borderWidth: 1,
                            borderColor: '#FED7AA',
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 8,
                            marginTop: 2,
                          }}
                        >
                          <Text color="#EA580C" fontSize={11} fontWeight="800">
                            Xem công thức & mua nguyên liệu →
                          </Text>
                        </TouchableOpacity>
                      </YStack>
                    </XStack>
                  </Card>
                </Pressable>
              ))}
            </YStack>
          </Animated.View>
        )}

        {/* 9. MEMBER URGENT ALERTS */}
        {alerts.filter(a => !a.isRead).slice(0, 1).map((alert, index) => (
          <Card
            key={`alert-${index}`}
            borderRadius={18}
            backgroundColor="#FEF2F2"
            borderColor="#FCA5A5"
            borderWidth={1.5}
            padding="$3.5"
            marginBottom="$4"
            style={{ elevation: 2 }}
          >
            <YStack gap="$2" alignItems="center">
              <XStack alignItems="center" gap="$1.5">
                <Sparkles size={14} color="#DC2626" />
                <Text fontSize={12} fontWeight="900" color="#DC2626" textTransform="uppercase">
                  {alert.alertType || 'CẢNH BÁO TỪ HỆ THỐNG'}
                </Text>
              </XStack>
              <Text fontSize={13} fontWeight="600" color="#7F1D1D" textAlign="center" lineHeight={18}>
                {alert.alertMessage}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  MemberService.markAlertsAsRead(Number(member?.memberId));
                  setAlerts(prev => prev.map(a => a.alertId === alert.alertId ? { ...a, isRead: true } : a));
                }}
                style={{
                  backgroundColor: '#DC2626',
                  paddingHorizontal: 16,
                  paddingVertical: 6,
                  borderRadius: 12,
                  marginTop: 4,
                }}
              >
                <Text color="white" fontWeight="800" fontSize={12}>
                  Đã hiểu
                </Text>
              </TouchableOpacity>
            </YStack>
          </Card>
        ))}

      </ScrollView>

      {/* 10. FLOATING ACTION BUTTON (FAB) FOR INSTANT VOICE SEARCH */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: Math.max(insets.bottom, 20) + 10,
            right: 20,
            zIndex: 99,
          },
          fabAnimatedStyle,
        ]}
      >
        <TouchableOpacity
          onPress={() => router.push('/voice-search' as any)}
          activeOpacity={0.85}
          style={{
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: '#00A550',
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#00A550',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 8,
            borderWidth: 2,
            borderColor: '#FFFFFF',
          }}
        >
          <Mic size={26} color="white" />
        </TouchableOpacity>
      </Animated.View>

    </View>
  );
}
