import React, { useEffect, useState } from 'react';
import { ScrollView, Dimensions } from 'react-native';
import { View, Text, XStack, YStack, Button, Card, Image, Spinner } from 'tamagui';
import { ArrowLeft, Trash2, ShoppingCart, Info, MapPin, ArrowRight, Plus, Minus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useRobotVoice, useVoiceRouter } from '../../hooks/useRobotVoice';
import { useRobotAuth } from '../../context/RobotAuthContext';
import { CartService, CartDto } from '../../services/CartService';
import { ProductDetailSheet } from '../ui/ProductDetailSheet';

const { width } = Dimensions.get('window');

export default function MemberCartScreen() {
  const insets = useSafeAreaInsets();
  const router = useVoiceRouter();
  const { speak } = useRobotVoice();
  const { token, member } = useRobotAuth();

  const [cart, setCart] = useState<CartDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleUpdateQuantity = async (productId: number, quantity: number) => {
    if (!token) return;
    try {
      if (quantity <= 0) {
        const res = await CartService.removeItem(productId, token);
        setCart(res);
      } else {
        const res = await CartService.updateItemQuantity(productId, quantity, token);
        setCart(res);
      }
    } catch (e: any) {
      console.log('Update quantity error', e);
      speak(e.message || 'Lỗi cập nhật số lượng');
    }
  };

  useEffect(() => {
    let mounted = true;
    speak('Dưới đây là chi tiết giỏ hàng hiện tại của bạn.');

    if (token) {
      CartService.getCart(token)
        .then(res => {
          if (mounted) setCart(res);
        })
        .catch(err => console.log('Error loading cart', err))
        .finally(() => {
          if (mounted) setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => { mounted = false; };
  }, [token]);

  const budget = member?.shoppingBudget ?? 1000000;
  const currentSpending = cart?.totalPrice || 0;
  const isOverBudget = currentSpending > budget;

  return (
    <View flex={1} backgroundColor="#f9fbf9" paddingLeft={Math.max(insets.left, 0)} paddingRight={Math.max(insets.right, 0)}>
      {/* HEADER BAR */}
      <XStack paddingTop={Math.max(insets.top, 10)} paddingBottom="$3" alignItems="center" justifyContent="space-between" paddingHorizontal="$4" borderBottomWidth={1} borderBottomColor="#f0f0f0" backgroundColor="white">
        <XStack alignItems="center" gap="$3">
          <Button
            circular
            size="$3.5"
            chromeless
            icon={<ArrowLeft size={22} color="#005b2b" />}
            onPress={() => router.back()}
            pressStyle={{ scale: 0.9 }}
          />
          <Text fontSize={20} fontWeight="900" color="#005b2b">Giỏ Hàng Của Bạn</Text>
        </XStack>
        
        <XStack alignItems="center" gap="$2">
          <View backgroundColor="#f0fdf4" paddingHorizontal="$3" paddingVertical="$1" borderRadius={12}>
            <Text color="#00A550" fontWeight="bold" fontSize={13}>
              {cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0} Sản phẩm
            </Text>
          </View>
        </XStack>
      </XStack>

      {/* OVER BUDGET WARNING */}
      {isOverBudget && (
        <Animated.View entering={FadeInDown}>
          <XStack backgroundColor="#fff1f2" padding="$4" alignItems="center" gap="$3" borderBottomWidth={1} borderBottomColor="#ffe4e6">
            <Info size={20} color="#e11d48" />
            <Text color="#e11d48" fontSize={14} flex={1} fontWeight="600">
              Cảnh báo: Bạn đã vượt quá ngân sách mua sắm dự kiến ({(currentSpending - budget).toLocaleString('vi-VN')}đ).
            </Text>
          </XStack>
        </Animated.View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {loading ? (
          <YStack alignItems="center" justifyContent="center" padding="$10" gap="$4">
            <Spinner size="large" color="#00A550" />
            <Text color="$textSecondary" fontWeight="500">Đang tải giỏ hàng...</Text>
          </YStack>
        ) : !cart || cart.items.length === 0 ? (
          <YStack alignItems="center" justifyContent="center" padding="$10" gap="$4" marginTop="$10">
            <View width={80} height={80} borderRadius={40} backgroundColor="#f0fdf4" justifyContent="center" alignItems="center">
              <ShoppingCart size={40} color="#bbf7d0" />
            </View>
            <Text color="$textSecondary" fontSize={16} fontWeight="500">Giỏ hàng của bạn đang trống</Text>
            <Button backgroundColor="#00A550" color="white" borderRadius={20} marginTop="$4" onPress={() => router.push('/member-home' as any)}>
              Tiếp tục mua sắm
            </Button>
          </YStack>
        ) : (
          <YStack gap="$4">
            {cart.items.map((item, index) => (
              <Animated.View key={`cart-item-${item.productId}-${index}`} entering={FadeInUp.delay(index * 50).duration(400)}>
                <Card size="$4" borderWidth={1} borderRadius={16} overflow="hidden" backgroundColor="white" borderColor="#f0f0f0" padding="$3" onPress={() => { setSelectedProductId(item.productId); setSheetOpen(true); }} pressStyle={{ scale: 0.98 }}>
                  <XStack gap="$3" alignItems="center">
                    <Image 
                      src={item.imageUrl || "https://via.placeholder.com/150"} 
                      width={70} 
                      height={70} 
                      borderRadius={12} 
                      backgroundColor="#f9f9f9"
                    />
                    <YStack flex={1} gap="$1">
                      <Text fontSize={15} fontWeight="bold" color="$textPrimary" numberOfLines={2}>
                        {item.productName}
                      </Text>
                      <Text fontSize={13} color="$textSecondary">
                        Đơn giá: {item.unitPrice.toLocaleString('vi-VN')}đ
                      </Text>
                      <XStack alignItems="center" gap="$3" marginTop="$1">
                        <Button
                          size="$2"
                          circular
                          icon={<Minus size={14} color="#005b2b" />}
                          backgroundColor="#f0fdf4"
                          onPress={(e) => { e.stopPropagation(); handleUpdateQuantity(item.productId, item.quantity - 1); }}
                        />
                        <Text fontSize={15} fontWeight="bold" color="#1e293b">{item.quantity}</Text>
                        <Button
                          size="$2"
                          circular
                          icon={<Plus size={14} color="#005b2b" />}
                          backgroundColor="#f0fdf4"
                          onPress={(e) => { e.stopPropagation(); handleUpdateQuantity(item.productId, item.quantity + 1); }}
                        />
                      </XStack>
                    </YStack>
                    <YStack alignItems="flex-end" justifyContent="space-between" height={70}>
                      <Button
                        size="$2"
                        circular
                        chromeless
                        icon={<Trash2 size={18} color="#ef4444" />}
                        onPress={(e) => { e.stopPropagation(); handleUpdateQuantity(item.productId, 0); }}
                      />
                      <Text fontSize={16} fontWeight="900" color="#00A550">
                        {item.totalPrice.toLocaleString('vi-VN')}đ
                      </Text>
                    </YStack>
                  </XStack>
                </Card>
              </Animated.View>
            ))}
          </YStack>
        )}
      </ScrollView>

      {/* FIXED BOTTOM BAR */}
      {cart && cart.items.length > 0 && (
        <View 
          position="absolute" 
          bottom={0} 
          left={0} 
          right={0} 
          backgroundColor="white" 
          padding="$4" 
          paddingBottom={Math.max(insets.bottom, 20)}
          borderTopWidth={1} 
          borderTopColor="#f0f0f0"
          shadowColor="black"
          shadowOpacity={0.05}
          shadowRadius={10}
          shadowOffset={{ width: 0, height: -5 }}
          style={{ elevation: 10 }}
        >
          <XStack justifyContent="space-between" alignItems="center">
            <YStack>
              <Text fontSize={13} color="$textSecondary">Tổng cộng</Text>
              <Text fontSize={22} fontWeight="900" color="#00A550">
                {currentSpending.toLocaleString('vi-VN')}đ
              </Text>
            </YStack>
            <Button
              size="$4"
              backgroundColor="#00A550"
              borderRadius={30}
              pressStyle={{ scale: 0.95 }}
              iconAfter={<MapPin size={18} color="white" />}
              onPress={() => {
                speak('Đang mở bản đồ dẫn đường.');
                router.push('/member-map' as any);
              }}
            >
              <Text color="white" fontWeight="bold">Dẫn đường</Text>
            </Button>
          </XStack>
        </View>
      )}

      <ProductDetailSheet
        productId={selectedProductId}
        isOpen={sheetOpen}
        onOpenChange={setSheetOpen}
        onCartUpdated={() => {
          if (token) {
            CartService.getCart(token).then(res => setCart(res));
          }
        }}
      />
    </View>
  );
}
