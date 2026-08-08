import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, Pressable } from 'react-native';
import { View, Text, XStack, YStack, Button, Card, Image, Spinner } from 'tamagui';
import { ArrowLeft, Sparkles, ShoppingCart, ArrowRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useRobotVoice, useVoiceRouter } from '../../hooks/useRobotVoice';
import { useRobotAuth } from '../../context/RobotAuthContext';
import { useNotification } from '../../context/NotificationContext';
import { CartService } from '../../services/CartService';
import { MemberService } from '../../services/MemberService';


export default function PersonalizedProductsScreen() {
  const insets = useSafeAreaInsets();
  const router = useVoiceRouter();
  const { speak } = useRobotVoice();
  const { showNotification } = useNotification();
  const { token, member } = useRobotAuth();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<any>(null);


  // Helper cho hạng thành viên
  const getTierDetails = (level: string | null | undefined) => {
    switch (level?.toUpperCase()) {
      case 'DIAMOND':
        return { name: 'Hạng Kim Cương', color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' };
      case 'PLATINUM':
        return { name: 'Hạng Bạch Kim', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };
      case 'GOLD':
        return { name: 'Hạng Vàng', color: '#d97706', bg: '#fef6e0', border: '#fde8b7' };
      case 'SILVER':
        return { name: 'Hạng Bạc', color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' };
      default:
        return { name: 'Hạng Đồng', color: '#92400e', bg: '#fffbeb', border: '#fef3c7' };
    }
  };

  const tier = getTierDetails(member?.membershipLevel);

  const handleAddToCart = async (productName: string, productId: number) => {
    try {
      if (token) {
        await CartService.addItem(productId, 1, token);
        speak(`Đã thêm ${productName} vào giỏ hàng của bạn!`);
        showNotification({
          title: 'THÔNG BÁO HỆ THỐNG',
          message: `Đã thêm ${productName} vào giỏ hàng`,
          type: 'success',
        });
      } else {
        speak(`Vui lòng đăng nhập để thêm vào giỏ hàng.`);
        showNotification({
          title: 'THÔNG BÁO HỆ THỐNG',
          message: `Vui lòng đăng nhập để thêm vào giỏ hàng`,
          type: 'warning',
        });
      }
    } catch (e) {
      console.log('Lỗi thêm giỏ hàng:', e);
      speak(`Xin lỗi, không thể thêm ${productName} vào giỏ hàng lúc này.`);
      showNotification({
        title: 'THÔNG BÁO HỆ THỐNG',
        message: `Lỗi khi thêm ${productName} vào giỏ`,
        type: 'error',
      });
    }
  };

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setLoading(true);

      speak(`Đang tải danh sách sản phẩm cá nhân hóa dành riêng cho ${tier.name.toLowerCase()} của bạn.`);

      if (token) {
        MemberService.getPersonalizedProducts(token)
          .then((res) => {
            if (mounted) {
              setProducts(res || []);
              setLoading(false);
            }
          })
          .catch((err) => {
            console.log('Lỗi lấy sản phẩm cá nhân hóa:', err);
            if (mounted) setLoading(false);
          });
      } else {
        if (mounted) setLoading(false);
      }

      // Auto sync cart
      const fetchCart = () => {
        if (token) {
          CartService.getCart(token)
            .then((res) => {
              if (mounted) setCart(res);
            })
            .catch((e) => console.log('Cart Error:', e));
        }
      };

      fetchCart();

      return () => {
        mounted = false;
      };
    }, [member, token])
  );

  return (
    <View
      flex={1}
      backgroundColor="#eef4ee"
      paddingTop={insets.top}
      paddingLeft={Math.max(insets.left, 0)}
      paddingRight={Math.max(insets.right, 0)}
    >
      {/* HEADER SECTION */}
      <YStack
        width="100%"
        paddingHorizontal="$4"
        paddingTop="$3"
        paddingBottom="$3"
        gap="$2.5"
      >
        <XStack justifyContent="space-between" alignItems="center">
          <XStack alignItems="center" gap="$2.5" flex={1}>
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
            <XStack alignItems="center" gap="$2" flex={1}>
              <Sparkles size={20} color="#00A550" />
              <Text fontSize={17} fontWeight="bold" color="#005b2b" numberOfLines={1} flex={1}>
                Sản phẩm dành riêng cho bạn
              </Text>
            </XStack>
          </XStack>
        </XStack>

        <XStack justifyContent="space-between" alignItems="center" gap="$2">
          <Text fontSize={12} color="#556b55" fontWeight="500" paddingLeft="$1" flex={1} lineHeight={16}>
            SmartMarketBot phân tích lịch sử mua sắm &amp; sức khỏe để gợi ý chuẩn xác nhất.
          </Text>
          {/* Member Level Badge */}
          <XStack
            backgroundColor={tier.bg}
            paddingHorizontal="$2.5"
            paddingVertical="$1"
            borderRadius={20}
            alignItems="center"
            gap="$1.5"
            borderWidth={1}
            borderColor={tier.border}
            style={{ elevation: 1 }}
          >
            <View width={6} height={6} borderRadius={3} backgroundColor={tier.color} />
            <Text fontSize={10} color={tier.color} fontWeight="bold">
              {tier.name}
            </Text>
          </XStack>
        </XStack>
      </YStack>

      {/* PRODUCTS LIST */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 90 }}
      >
        <YStack gap="$3">
          {loading ? (
            <YStack padding="$8" alignItems="center" justifyContent="center" gap="$3">
              <Spinner size="large" color="#00A550" />
              <Text fontSize={14} color="#666" fontStyle="italic">
                Đang phân tích gợi ý sản phẩm phù hợp...
              </Text>
            </YStack>
          ) : products.length > 0 ? (
            products.map((p, idx) => (
              <Card
                key={idx}
                borderRadius={20}
                backgroundColor="white"
                borderWidth={1.5}
                borderColor="#e2e8f0"
                overflow="hidden"
                style={{ elevation: 2 }}
                pressStyle={{ scale: 0.98 }}
                onPress={() => router.push(`/product/${p.productId}`)}
              >
                <XStack padding="$3.5" gap="$3" alignItems="center">
                  {/* Product Image */}
                  <View
                    width={84}
                    height={84}
                    borderRadius={14}
                    backgroundColor="#f8fafc"
                    overflow="hidden"
                    borderWidth={1}
                    borderColor="#f1f5f9"
                  >
                    <Image
                      src={(typeof p.imageUrl === 'string' && p.imageUrl.startsWith('http')) ? p.imageUrl : require('../../../assets/images/logocute.png')}
                      width="100%"
                      height="100%"
                      objectFit="cover"
                    />
                  </View>

                  {/* Product Info */}
                  <YStack flex={1} gap="$1">
                    <XStack alignItems="center" gap="$1">
                      <Sparkles size={11} color="#00A550" />
                      <Text fontSize={10} fontWeight="900" color="#00A550" letterSpacing={0.5} textTransform="uppercase">
                        PHÙ HỢP VỚI BẠN
                      </Text>
                    </XStack>

                    <Text fontSize={14} fontWeight="bold" color="#1e293b" numberOfLines={2}>
                      {p.productName}
                    </Text>

                    <Text fontSize={11} color="#64748b" numberOfLines={2}>
                      {p.description || "Phù hợp lịch sử mua sắm của bạn"}
                    </Text>

                    <XStack alignItems="center" gap="$2" marginTop="$0.5">
                      <Text fontSize={15} fontWeight="bold" color="#00A550">
                        {(p.promotionPrice || p.unitPrice).toLocaleString('vi-VN')}đ
                      </Text>
                      {!!p.promotionPrice && (
                        <Text fontSize={11} color="#aaa" style={{ textDecorationLine: 'line-through' }}>
                          {p.unitPrice.toLocaleString('vi-VN')}đ
                        </Text>
                      )}
                    </XStack>
                  </YStack>

                  {/* Add to Cart Action */}
                  <Button
                    backgroundColor="#00A550"
                    size="$2.5"
                    borderRadius={14}
                    paddingHorizontal="$2.5"
                    onPress={(e) => {
                      e.stopPropagation();
                      handleAddToCart(p.productName, p.productId);
                    }}
                    pressStyle={{ backgroundColor: '#008740', scale: 0.95 }}
                    style={{ elevation: 2 }}
                  >
                    <XStack alignItems="center" gap="$1">
                      <ShoppingCart size={13} color="white" />
                      <Text color="white" fontSize={11} fontWeight="bold">
                        Thêm giỏ
                      </Text>
                    </XStack>
                  </Button>
                </XStack>
              </Card>
            ))
          ) : (
            <YStack padding="$8" alignItems="center" justifyContent="center" gap="$3">
              <Text fontSize={14} color="#666" textAlign="center">
                Chưa tìm thấy sản phẩm cá nhân hóa nào cho bạn lúc này.
              </Text>
            </YStack>
          )}
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
            <Text fontSize={11} fontWeight="bold" color="white">
              {cart.totalItems}
            </Text>
          </View>
        </View>
      )}


    </View>
  );
}
