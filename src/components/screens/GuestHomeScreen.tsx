import React, { useEffect, useState, useRef } from 'react';
import { ScrollView, Pressable, Dimensions, Modal, TouchableOpacity } from 'react-native';
import { View, Text, XStack, YStack, Button, Card } from 'tamagui';
import {
  Mic, Search, MapPin, QrCode, Bot, User, LogOut,
  ShoppingBag, Gift, Navigation, Sparkles, X, Crown, ChevronRight, Volume2
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown, FadeInUp, FadeInRight, FadeOutUp,
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing
} from 'react-native-reanimated';
import { useRobotVoice } from '../../hooks/useRobotVoice';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import RobotAdDisplay from '../robot/RobotAdDisplay';
import { SearchService, MobileProductSearchResultDto } from '../../services/SearchService';
import { useGeofencing } from '../../context/GeofencingContext';
import { useRobotAuth } from '../../context/RobotAuthContext';
import { useNotification } from '../../context/NotificationContext';
import { RobotControlService } from '../../services/RobotControlService';
import { useRobotGuide } from '../../context/RobotGuideContext';

const ROBOT_CODE = 'RB001';

export default function GuestHomeScreen() {
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [guidingId, setGuidingId] = useState<number | null>(null);
  const router = useRouter();
  const { speak, stop } = useRobotVoice();
  const { currentZone, isInZone } = useGeofencing();
  const { clearSession } = useRobotAuth();
  const { showNotification } = useNotification();
  const { dispatchCart } = useRobotGuide();

  const [hotProducts, setHotProducts] = useState<MobileProductSearchResultDto[]>([]);

  useEffect(() => {
    SearchService.getDeals()
      .then(res => setHotProducts(res || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    speak('Chào mừng quý khách đến với Smart Market Bot! Hãy chọn tính năng bạn cần hoặc nói chuyện trực tiếp với tôi nhé.');
    return () => {
      stop();
    };
  }, []);

  // Điều hướng robot dẫn đường đến kệ chứa sản phẩm
  const handleGuideToProduct = async (product: {
    productId: number;
    productName: string;
    imageUrl?: string | null;
    unitPrice?: number;
    location?: { shelfName?: string; zone?: string } | any;
  }) => {
    if (guidingId !== null) return;
    setGuidingId(product.productId);
    try {
      speak(`Dạ vâng! Robot sẽ dẫn quý khách đến quầy bán ${product.productName}. Xin mời đi theo tôi!`);
      showNotification({
        title: '🤖 DẪN ĐƯỜNG MUA SẮM',
        message: `Đang khởi tạo lộ trình đến quầy ${product.productName}`,
        type: 'info',
      });
      await dispatchCart([{ productId: product.productId, productName: product.productName }]);
      router.push({
        pathname: '/cart-guide-map',
        params: {
          productId: String(product.productId),
          productName: product.productName,
          productImage: product.imageUrl || '',
          productPrice: String(product.unitPrice || 0),
          shelfName: product.location?.shelfName || '',
        },
      } as any);
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

  const handleEndSession = () => {
    clearSession();
    setMenuOpen(false);
    speak('Hẹn gặp lại quý khách!');
    router.replace('/' as any);
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

  return (
    <View flex={1} backgroundColor="#F8FAFC" paddingTop={insets.top}>

      {/* 1. TOP HEADER */}
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$4"
        paddingVertical="$3"
        backgroundColor="white"
        borderBottomWidth={1}
        borderBottomColor="#F1F5F9"
        zIndex={100}
      >
        <YStack gap="$0.5">
          <XStack alignItems="center" gap="$2">
            <View width={10} height={10} borderRadius={5} backgroundColor="#00A550" />
            <Text fontSize={20} fontWeight="900" color="#00A550" letterSpacing={0.5}>
              SmartMarketBot
            </Text>
          </XStack>
          {isInZone && currentZone ? (
            <Animated.View entering={FadeInDown.duration(300)}>
              <XStack alignItems="center" gap="$1" marginLeft="$1">
                <MapPin size={11} color="#059669" />
                <Text fontSize={11} color="#059669" fontWeight="700">
                  {currentZone.objectName}
                </Text>
              </XStack>
            </Animated.View>
          ) : (
            <Text fontSize={11} color="#64748B" fontWeight="600" marginLeft="$1">
              Trợ lý siêu thị thông minh
            </Text>
          )}
        </YStack>

        {/* Guest Mode Dropdown Trigger */}
        <View position="relative" zIndex={100}>
          <Pressable
            onPress={() => setMenuOpen(!menuOpen)}
            style={({ pressed }) => ({
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <XStack
              alignItems="center"
              gap="$2"
              backgroundColor="#F1F5F9"
              paddingHorizontal="$3"
              paddingVertical="$2"
              borderRadius={20}
              borderWidth={1}
              borderColor={menuOpen ? '#00A550' : '#E2E8F0'}
            >
              <View width={24} height={24} borderRadius={12} backgroundColor="#E2E8F0" justifyContent="center" alignItems="center">
                <User size={14} color="#475569" />
              </View>
              <Text fontSize={12} fontWeight="800" color="#334155">
                Khách vãng lai
              </Text>
              <Text fontSize={10} color="#64748B">▼</Text>
            </XStack>
          </Pressable>

          {/* Dropdown Menu */}
          {menuOpen && (
            <Animated.View
              entering={FadeInUp.duration(200)}
              exiting={FadeOutUp.duration(150)}
              style={{
                position: 'absolute',
                top: '115%',
                right: 0,
                width: 220,
                backgroundColor: 'white',
                borderRadius: 16,
                shadowColor: 'black',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.12,
                shadowRadius: 16,
                elevation: 6,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                overflow: 'hidden',
                zIndex: 200,
              }}
            >
              {/* Option 1: Face ID Login */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
                onPress={() => {
                  setMenuOpen(false);
                  router.push('/face-scan' as any);
                }}
              >
                <Crown size={16} color="#D97706" />
                <YStack>
                  <Text color="#1E293B" fontWeight="700" fontSize={13}>Đăng nhập Face ID</Text>
                  <Text color="#64748B" fontSize={11}>Tích điểm & ưu đãi</Text>
                </YStack>
              </TouchableOpacity>

              {/* Option 2: Download App */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
                onPress={() => {
                  setMenuOpen(false);
                  setShowQrModal(true);
                }}
              >
                <QrCode size={16} color="#0284C7" />
                <Text color="#1E293B" fontWeight="600" fontSize={13}>Tải App Siêu Thị</Text>
              </TouchableOpacity>

              {/* Option 3: Change Role */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
                onPress={() => {
                  setMenuOpen(false);
                  router.push('/role-selection' as any);
                }}
              >
                <Bot size={16} color="#475569" />
                <Text color="#1E293B" fontWeight="600" fontSize={13}>Chọn lại vai trò</Text>
              </TouchableOpacity>

              {/* Option 4: End Session */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#FFF1F2' }}
                onPress={handleEndSession}
              >
                <LogOut size={16} color="#E11D48" />
                <Text color="#E11D48" fontWeight="800" fontSize={13}>Kết thúc phiên</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </XStack>

      {/* 2. MAIN SCROLLABLE CONTENT */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>

        {/* HERO GREETING BANNER (Mobile optimized) */}
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
              <XStack alignItems="center" gap="$2.5">
                <View width={36} height={36} borderRadius={18} backgroundColor="#DCFCE7" justifyContent="center" alignItems="center">
                  <Sparkles size={20} color="#00A550" />
                </View>
                <YStack flex={1}>
                  <Text fontSize={16} fontWeight="900" color="#0F172A">
                    Xin chào quý khách! 👋
                  </Text>
                  <Text fontSize={12} color="#166534" fontWeight="600">
                    Trợ lý siêu thị sẵn sàng dẫn đường & hỗ trợ bạn
                  </Text>
                </YStack>
              </XStack>

              <Text fontSize={13} color="#475569" lineHeight={19}>
                Khám phá hàng ngàn sản phẩm, kiểm tra vị trí quầy kệ và trải nghiệm robot tự hành dẫn đường mua sắm.
              </Text>

              {/* Action Buttons (Mobile balanced) */}
              <XStack gap="$2" marginTop="$1">
                <Button
                  flex={1.2}
                  size="$3"
                  backgroundColor="#00A550"
                  borderRadius={14}
                  paddingHorizontal="$2"
                  icon={<Crown size={14} color="white" />}
                  onPress={() => router.push('/face-scan' as any)}
                  pressStyle={{ opacity: 0.9, scale: 0.98 }}
                >
                  <Text color="white" fontWeight="800" fontSize={11} numberOfLines={1}>
                    Đăng Nhập Face ID
                  </Text>
                </Button>

                <Button
                  flex={0.8}
                  size="$3"
                  backgroundColor="white"
                  borderRadius={14}
                  borderWidth={1.5}
                  borderColor="#00A550"
                  paddingHorizontal="$2"
                  icon={<QrCode size={14} color="#00A550" />}
                  onPress={() => setShowQrModal(true)}
                  pressStyle={{ backgroundColor: '#F0FDF4', scale: 0.98 }}
                >
                  <Text color="#00A550" fontWeight="800" fontSize={11} numberOfLines={1}>
                    Tải App
                  </Text>
                </Button>
              </XStack>
            </YStack>
          </Card>
        </Animated.View>

        {/* 3. 4 CHỨC NĂNG KIOSK CỐT LÕI (2x2 Grid) */}
        <YStack gap="$2.5" marginBottom="$5">
          <XStack justifyContent="space-between" alignItems="center" marginBottom="$1">
            <Text fontSize={15} fontWeight="900" color="#0F172A" letterSpacing={0.3}>
              Dịch Vụ Mua Sắm Kiosk
            </Text>
            <Text fontSize={11} color="#64748B" fontWeight="600">
              Chạm để sử dụng
            </Text>
          </XStack>

          {/* Row 1: Giọng Nói & Tìm Kiếm Toàn Bộ */}
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
                  <View width={42} height={42} borderRadius={14} backgroundColor="#00A550" justifyContent="center" alignItems="center" shadowColor="#00A550" shadowRadius={8} shadowOpacity={0.25}>
                    <Mic size={22} color="white" />
                  </View>
                  <YStack gap="$0.5">
                    <Text fontSize={14} fontWeight="800" color="#0F172A">
                      Giọng Nói AI
                    </Text>
                    <Text fontSize={11} color="#64748B" numberOfLines={1}>
                      Nói tên món hàng
                    </Text>
                  </YStack>
                </YStack>
              </Card>
            </Pressable>

            {/* Card 2: Tra Cứu Sản Phẩm */}
            <Pressable
              onPress={() => router.push('/product-search' as any)}
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
                  <View width={42} height={42} borderRadius={14} backgroundColor="#0284C7" justifyContent="center" alignItems="center" shadowColor="#0284C7" shadowRadius={8} shadowOpacity={0.25}>
                    <Search size={22} color="white" />
                  </View>
                  <YStack gap="$0.5">
                    <Text fontSize={14} fontWeight="800" color="#0F172A">
                      Tra Cứu Sản Phẩm
                    </Text>
                    <Text fontSize={11} color="#64748B" numberOfLines={1}>
                      Theo danh mục & giá
                    </Text>
                  </YStack>
                </YStack>
              </Card>
            </Pressable>
          </XStack>

          {/* Row 2: Siêu Khuyến Mãi & Sơ Đồ Siêu Thị */}
          <XStack gap="$2.5">
            {/* Card 3: Siêu Khuyến Mãi */}
            <Pressable
              onPress={() => router.push('/guest-campaign' as any)}
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
                {/* Hot Badge */}
                <View
                  position="absolute"
                  top={10}
                  right={10}
                  backgroundColor="#EF4444"
                  paddingHorizontal="$1.5"
                  paddingVertical="$0.5"
                  borderRadius={8}
                >
                  <Text color="white" fontSize={9} fontWeight="900">HOT</Text>
                </View>

                <YStack gap="$2">
                  <View width={42} height={42} borderRadius={14} backgroundColor="#F59E0B" justifyContent="center" alignItems="center" shadowColor="#F59E0B" shadowRadius={8} shadowOpacity={0.25}>
                    <Gift size={22} color="white" />
                  </View>
                  <YStack gap="$0.5">
                    <Text fontSize={14} fontWeight="800" color="#0F172A">
                      Siêu Khuyến Mãi
                    </Text>
                    <Text fontSize={11} color="#64748B" numberOfLines={1}>
                      Giảm sốc hôm nay
                    </Text>
                  </YStack>
                </YStack>
              </Card>
            </Pressable>

            {/* Card 4: Sơ Đồ Siêu Thị */}
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
                  <View width={42} height={42} borderRadius={14} backgroundColor="#8B5CF6" justifyContent="center" alignItems="center" shadowColor="#8B5CF6" shadowRadius={8} shadowOpacity={0.25}>
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

        {/* 4. ROBOT ADS BANNER */}
        <RobotAdDisplay />

        {/* 5. HOT DEALS CAROUSEL */}
        <Animated.View entering={FadeInUp.delay(200).duration(500)}>
          <XStack justifyContent="space-between" alignItems="center" marginTop="$4" marginBottom="$3">
            <XStack alignItems="center" gap="$1.5">
              <Gift size={18} color="#EA580C" />
              <Text fontSize={15} fontWeight="900" color="#0F172A">
                Ưu Đãi Nổi Bật Hôm Nay
              </Text>
            </XStack>
            <TouchableOpacity
              onPress={() => router.push('/guest-campaign' as any)}
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
              {hotProducts.length > 0 ? (
                hotProducts.map((product, index) => (
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

                        {/* Shelf Location if available */}
                        {product.location?.shelfName ? (
                          <XStack alignItems="center" gap="$1">
                            <MapPin size={10} color="#64748B" />
                            <Text fontSize={10} color="#64748B" numberOfLines={1}>
                              {product.location.zone ? `${product.location.zone} · ` : ''}{product.location.shelfName}
                            </Text>
                          </XStack>
                        ) : null}

                        {/* Price & Guide Action (Vertical Stack for 100% mobile fit) */}
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
                              handleGuideToProduct({
                                productId: product.productId,
                                productName: product.productName,
                                imageUrl: product.imageUrl,
                                unitPrice: product.promotionPrice ?? product.unitPrice,
                                location: product.location,
                              });
                            }}
                            style={{
                              backgroundColor: '#00A550',
                              width: '100%',
                              paddingVertical: 7,
                              borderRadius: 10,
                              flexDirection: 'row',
                              justifyContent: 'center',
                              alignItems: 'center',
                              gap: 5,
                            }}
                          >
                            <Navigation size={12} color="white" />
                            <Text color="white" fontSize={11} fontWeight="800">Dẫn đường</Text>
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

      </ScrollView>

      {/* 6. FLOATING ACTION BUTTON (FAB) FOR INSTANT VOICE SEARCH */}
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

      {/* 7. QR CODE MODAL CHO KHÁCH TẢI APP */}
      <Modal
        visible={showQrModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQrModal(false)}
      >
        <View
          flex={1}
          backgroundColor="rgba(0,0,0,0.6)"
          justifyContent="center"
          alignItems="center"
          padding="$4"
        >
          <Card
            width="90%"
            maxWidth={360}
            borderRadius={24}
            backgroundColor="white"
            padding="$5"
            alignItems="center"
            gap="$3"
            shadowColor="black"
            shadowRadius={25}
            shadowOpacity={0.2}
            style={{ elevation: 10 }}
          >
            {/* Close Button */}
            <XStack width="100%" justifyContent="flex-end">
              <TouchableOpacity onPress={() => setShowQrModal(false)}>
                <View width={32} height={32} borderRadius={16} backgroundColor="#F1F5F9" justifyContent="center" alignItems="center">
                  <X size={18} color="#64748B" />
                </View>
              </TouchableOpacity>
            </XStack>

            <View width={52} height={52} borderRadius={26} backgroundColor="#F0FDF4" justifyContent="center" alignItems="center">
              <QrCode size={28} color="#00A550" />
            </View>

            <Text fontSize={18} fontWeight="900" color="#0F172A" textAlign="center">
              Tải App SmartMarketBot
            </Text>
            <Text fontSize={13} color="#64748B" textAlign="center" lineHeight={18}>
              Quét mã QR bằng camera điện thoại của bạn để tải ứng dụng và nhận ngay voucher ưu đãi 50.000đ!
            </Text>

            {/* QR Mockup Frame */}
            {(() => {
              const appDownloadUrl =
                process.env.EXPO_PUBLIC_APP_DOWNLOAD_URL ||
                'https://github.com/SuperMarketBot-SU26/SuperMarketBot-Android/releases';
              return (
                <>
                  <View
                    backgroundColor="#F8FAFC"
                    padding="$4"
                    borderRadius={18}
                    borderWidth={2}
                    borderColor="#E2E8F0"
                    alignItems="center"
                    justifyContent="center"
                    marginTop="$2"
                  >
                    <Image
                      source={{
                        uri: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(appDownloadUrl)}`,
                      }}
                      style={{ width: 170, height: 170 }}
                      contentFit="contain"
                    />
                  </View>
                  <Text fontSize={11} color="#94A3B8" textAlign="center" marginTop="$1" numberOfLines={1}>
                    {appDownloadUrl}
                  </Text>
                </>
              );
            })()}

            {/* Steps */}
            <YStack width="100%" gap="$1.5" marginTop="$2" paddingHorizontal="$2">
              <Text fontSize={12} color="#475569" fontWeight="600">
                1. Mở Camera trên điện thoại
              </Text>
              <Text fontSize={12} color="#475569" fontWeight="600">
                2. Hướng vào mã QR trên màn hình
              </Text>
              <Text fontSize={12} color="#475569" fontWeight="600">
                3. Nhấn vào liên kết để cài đặt ứng dụng
              </Text>
            </YStack>

            <Button
              marginTop="$3"
              width="100%"
              height={46}
              backgroundColor="#00A550"
              borderRadius={23}
              onPress={() => setShowQrModal(false)}
            >
              <Text color="white" fontWeight="800" fontSize={14}>
                Đã Hiểu
              </Text>
            </Button>
          </Card>
        </View>
      </Modal>

    </View>
  );
}
