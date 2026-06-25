import React, { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { View, Text, XStack, YStack, Button, Card, Image, Progress } from 'tamagui';
import { ArrowLeft, Tag, Percent, Zap, ShoppingCart, Ticket, Clock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRobotVoice, useVoiceRouter } from '../../hooks/useRobotVoice';

export default function MemberOffersScreen() {
  const insets = useSafeAreaInsets();
  const router = useVoiceRouter();
  const { speak } = useRobotVoice();

  // State cho bộ đếm giờ Flash Sale
  const [timeLeft, setTimeLeft] = useState({ hours: '01', minutes: '45', seconds: '32' });

  useEffect(() => {
    // Chào mừng bằng giọng nói robot
    speak('Smart Martket Bot đã chọn lọc những ưu đãi và khuyến mãi tốt nhất cho hạng thành viên Vàng của bạn.');

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

    return () => clearInterval(timer);
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
            backgroundColor="#fef6e0"
            paddingHorizontal="$3"
            paddingVertical="$1.5"
            borderRadius={20}
            alignItems="center"
            gap="$2"
            borderWidth={1}
            borderColor="#fde8b7"
            style={{ elevation: 1 }}
          >
            <View width={6} height={6} borderRadius={3} backgroundColor="#d97706" />
            <Text fontSize={10} color="#d97706" fontWeight="bold">Hạng Vàng</Text>
          </XStack>
        </XStack>
      </YStack>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80 }}>

        {/* VOUCHER SECTION */}
        <YStack gap="$3" marginBottom="$6">
          <XStack alignItems="center" gap="$2">
            <Ticket size={20} color="#005b2b" />
            <Text fontSize={18} fontWeight="bold" color="#005b2b">Voucher của bạn</Text>
          </XStack>

          <YStack gap="$4">
            {/* Voucher 1 */}
            <Card flex={1} borderRadius={16} backgroundColor="white" padding="$4" borderWidth={1} borderColor="#e2e8f0" style={{ elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
              <XStack gap="$3" alignItems="flex-start">
                {/* Small colorful badge on the left */}
                <View width={56} height={56} borderRadius={14} backgroundColor="#f0fdf4" justifyContent="center" alignItems="center" borderWidth={1} borderColor="#dcfce7">
                  <Text fontSize={18} fontWeight="900" color="#16a34a">20k</Text>
                  <Text fontSize={10} fontWeight="bold" color="#16a34a">GIẢM</Text>
                </View>

                {/* Info on the right */}
                <YStack flex={1} gap="$1.5">
                  <XStack justifyContent="space-between" alignItems="center">
                    <Text fontSize={11} fontWeight="bold" color="#666" backgroundColor="#f1f5f9" paddingHorizontal="$2" paddingVertical="$0.5" borderRadius={6}>
                      Mã: GIAM20FRESH
                    </Text>
                    <XStack alignItems="center" gap="$1">
                      <Clock size={10} color="#f59e0b" />
                      <Text fontSize={10} color="#f59e0b" fontWeight="600">Sắp hết hạn</Text>
                    </XStack>
                  </XStack>
                  
                  <Text fontSize={15} fontWeight="bold" color="#111" numberOfLines={2} lineHeight={20}>
                    Giảm 20.000đ cho các mặt hàng Thực phẩm Tươi sống (Đơn từ 200k)
                  </Text>
                </YStack>
              </XStack>

              {/* Divider */}
              <View height={1} marginVertical="$3" overflow="hidden">
                <View height={2} borderWidth={1} borderColor="#e2e8f0" borderStyle="dashed" marginTop={-1} />
              </View>

              {/* Footer */}
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize={11} color="#888" fontWeight="500">HSD: Còn 2 ngày nữa</Text>
                <Button 
                  size="$3" 
                  backgroundColor="#16a34a" 
                  borderRadius={20} 
                  paddingHorizontal="$4" 
                  height={32}
                  onPress={() => speak('Voucher 20 nghìn đã được áp dụng vào giỏ hàng của bạn!')}
                  pressStyle={{ backgroundColor: '#15803d', scale: 0.95 }}
                >
                  <Text color="white" fontSize={12} fontWeight="bold">Dùng ngay</Text>
                </Button>
              </XStack>
            </Card>

            {/* Voucher 2 */}
            <Card flex={1} borderRadius={16} backgroundColor="white" padding="$4" borderWidth={1} borderColor="#e2e8f0" style={{ elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
              <XStack gap="$3" alignItems="flex-start">
                {/* Small colorful badge on the left */}
                <View width={56} height={56} borderRadius={14} backgroundColor="#fff7ed" justifyContent="center" alignItems="center" borderWidth={1} borderColor="#ffedd5">
                  <Text fontSize={18} fontWeight="900" color="#ea580c">50k</Text>
                  <Text fontSize={10} fontWeight="bold" color="#ea580c">GIẢM</Text>
                </View>

                {/* Info on the right */}
                <YStack flex={1} gap="$1.5">
                  <XStack justifyContent="space-between" alignItems="center">
                    <Text fontSize={11} fontWeight="bold" color="#666" backgroundColor="#f1f5f9" paddingHorizontal="$2" paddingVertical="$0.5" borderRadius={6}>
                      Mã: FRESHA150
                    </Text>
                  </XStack>
                  
                  <Text fontSize={15} fontWeight="bold" color="#111" numberOfLines={2} lineHeight={20}>
                    Giảm 50.000đ áp dụng cho mọi sản phẩm. Dành riêng cho Đơn hàng đầu tiên.
                  </Text>
                </YStack>
              </XStack>

              {/* Divider */}
              <View height={1} marginVertical="$3" overflow="hidden">
                <View height={2} borderWidth={1} borderColor="#e2e8f0" borderStyle="dashed" marginTop={-1} />
              </View>

              {/* Footer */}
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize={11} color="#888" fontWeight="500">HSD: 31/07/2026</Text>
                <Button 
                  size="$3" 
                  backgroundColor="#ea580c" 
                  borderRadius={20} 
                  paddingHorizontal="$4" 
                  height={32}
                  onPress={() => speak('Voucher 50 nghìn đã được áp dụng vào giỏ hàng của bạn!')}
                  pressStyle={{ backgroundColor: '#c2410c', scale: 0.95 }}
                >
                  <Text color="white" fontSize={12} fontWeight="bold">Dùng ngay</Text>
                </Button>
              </XStack>
            </Card>
          </YStack>
        </YStack>

        {/* EXCLUSIVE OFFERS */}
        <YStack gap="$3" marginBottom="$6">
          <XStack alignItems="center" gap="$2">
            <Percent size={20} color="#0d3a1f" />
            <Text fontSize={18} fontWeight="bold" color="#0d3a1f">Ưu đãi Đặc quyền</Text>
          </XStack>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
            {/* Card 1 */}
            <Card width={220} borderRadius={20} backgroundColor="white" overflow="hidden" borderWidth={1} borderColor="#e2e8f0" style={{ elevation: 2 }}>
              <View position="relative" height={130} backgroundColor="#f5f5f5">
                <Image src="https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80" width="100%" height="100%" objectFit="cover" />
                <View position="absolute" top={10} left={10} backgroundColor="#ef4444" paddingHorizontal="$2.5" paddingVertical="$1" borderRadius={8}>
                  <Text fontSize={10} color="white" fontWeight="900">-30%</Text>
                </View>
                <View position="absolute" top={10} right={10} backgroundColor="#ffffffb3" padding="$1.5" borderRadius={20}>
                  <Tag size={12} color="#d97706" />
                </View>
              </View>
              <YStack padding="$3.5" gap="$1.5">
                <Text fontSize={14} fontWeight="900" color="#333" numberOfLines={1}>Thịt Bò Mỹ Prime</Text>
                <XStack backgroundColor="#fef6e0" paddingHorizontal="$2" paddingVertical="$0.5" borderRadius={6} alignSelf="flex-start">
                  <Text fontSize={9} color="#d97706" fontWeight="bold">Thành viên Vàng</Text>
                </XStack>
                <Text fontSize={11} color="#666" numberOfLines={2} height={32} lineHeight={16}>
                  Ưu đãi chỉ dành cho khách hàng hạng Vàng.
                </Text>
                <XStack justifyContent="space-between" alignItems="center" marginTop="$2">
                  <YStack>
                    <Text fontSize={11} color="#aaa" style={{ textDecorationLine: 'line-through' }}>450.000đ</Text>
                    <Text fontSize={15} fontWeight="bold" color="#00A550">315.000đ</Text>
                  </YStack>
                  <Button
                    circular
                    size="$2.5"
                    backgroundColor="#00A550"
                    icon={<ShoppingCart size={14} color="white" />}
                    onPress={() => speak('Đã thêm thịt bò Mỹ Prime vào giỏ hàng')}
                    pressStyle={{ backgroundColor: '#008740' }}
                  />
                </XStack>
              </YStack>
            </Card>

            {/* Card 2 */}
            <Card width={220} borderRadius={20} backgroundColor="white" overflow="hidden" borderWidth={1} borderColor="#e2e8f0" style={{ elevation: 2 }}>
              <View position="relative" height={130} backgroundColor="#f5f5f5">
                <Image src="https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&q=80" width="100%" height="100%" objectFit="cover" />
                <View position="absolute" top={10} left={10} backgroundColor="#ef4444" paddingHorizontal="$2.5" paddingVertical="$1" borderRadius={8}>
                  <Text fontSize={10} color="white" fontWeight="900">-15%</Text>
                </View>
              </View>
              <YStack padding="$3.5" gap="$1.5">
                <Text fontSize={14} fontWeight="900" color="#333" numberOfLines={1}>Combo Rau Hữu Cơ</Text>
                <XStack backgroundColor="#f0fdf4" paddingHorizontal="$2" paddingVertical="$0.5" borderRadius={6} alignSelf="flex-start">
                  <Text fontSize={9} color="#00A550" fontWeight="bold">Nông trại xanh</Text>
                </XStack>
                <Text fontSize={11} color="#666" numberOfLines={2} height={32} lineHeight={16}>
                  Rau tươi thu hoạch trong ngày từ nông trại.
                </Text>
                <XStack justifyContent="space-between" alignItems="center" marginTop="$2">
                  <YStack>
                    <Text fontSize={11} color="#aaa" style={{ textDecorationLine: 'line-through' }}>85.000đ</Text>
                    <Text fontSize={15} fontWeight="bold" color="#00A550">72.000đ</Text>
                  </YStack>
                  <Button
                    circular
                    size="$2.5"
                    backgroundColor="#00A550"
                    icon={<ShoppingCart size={14} color="white" />}
                    onPress={() => speak('Đã thêm combo rau hữu cơ vào giỏ hàng')}
                    pressStyle={{ backgroundColor: '#008740' }}
                  />
                </XStack>
              </YStack>
            </Card>

            {/* Card 3 */}
            <Card width={220} borderRadius={20} backgroundColor="white" overflow="hidden" borderWidth={1} borderColor="#e2e8f0" style={{ elevation: 2 }}>
              <View position="relative" height={130} backgroundColor="#f5f5f5">
                <Image src="https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&q=80" width="100%" height="100%" objectFit="cover" />
                <View position="absolute" top={10} left={10} backgroundColor="#ef4444" paddingHorizontal="$2.5" paddingVertical="$1" borderRadius={8}>
                  <Text fontSize={10} color="white" fontWeight="900">-20%</Text>
                </View>
              </View>
              <YStack padding="$3.5" gap="$1.5">
                <Text fontSize={14} fontWeight="900" color="#333" numberOfLines={1}>Cá Hồi NaUy Fillet</Text>
                <XStack backgroundColor="#eff6ff" paddingHorizontal="$2" paddingVertical="$0.5" borderRadius={6} alignSelf="flex-start">
                  <Text fontSize={9} color="#3b82f6" fontWeight="bold">Hải sản tươi</Text>
                </XStack>
                <Text fontSize={11} color="#666" numberOfLines={2} height={32} lineHeight={16}>
                  Fillet tươi không xương, giàu Omega-3.
                </Text>
                <XStack justifyContent="space-between" alignItems="center" marginTop="$2">
                  <YStack>
                    <Text fontSize={11} color="#aaa" style={{ textDecorationLine: 'line-through' }}>280.000đ</Text>
                    <Text fontSize={15} fontWeight="bold" color="#00A550">224.000đ</Text>
                  </YStack>
                  <Button
                    circular
                    size="$2.5"
                    backgroundColor="#00A550"
                    icon={<ShoppingCart size={14} color="white" />}
                    onPress={() => speak('Đã thêm cá hồi Na Uy fillet vào giỏ hàng')}
                    pressStyle={{ backgroundColor: '#008740' }}
                  />
                </XStack>
              </YStack>
            </Card>

            {/* Card 4 */}
            <Card width={220} borderRadius={20} backgroundColor="white" overflow="hidden" borderWidth={1} borderColor="#e2e8f0" style={{ elevation: 2 }}>
              <View position="relative" height={130} backgroundColor="#f5f5f5">
                <Image src="https://images.unsplash.com/photo-1516448620398-c5f44bf9f441?w=400&q=80" width="100%" height="100%" objectFit="cover" />
                <View position="absolute" top={10} left={10} backgroundColor="#22c55e" paddingHorizontal="$2.5" paddingVertical="$1" borderRadius={8}>
                  <Text fontSize={10} color="white" fontWeight="900">MUA 2 TẶNG 1</Text>
                </View>
              </View>
              <YStack padding="$3.5" gap="$1.5">
                <Text fontSize={14} fontWeight="900" color="#333" numberOfLines={1}>Trứng Gà Ta Hữu Cơ</Text>
                <XStack backgroundColor="#f0fdf4" paddingHorizontal="$2" paddingVertical="$0.5" borderRadius={6} alignSelf="flex-start">
                  <Text fontSize={9} color="#00A550" fontWeight="bold">Dinh dưỡng</Text>
                </XStack>
                <Text fontSize={11} color="#666" numberOfLines={2} height={32} lineHeight={16}>
                  Ưu đãi mua 2 hộp tặng 1 hộp quà.
                </Text>
                <XStack justifyContent="space-between" alignItems="center" marginTop="$2">
                  <YStack>
                    <Text fontSize={11} color="#aaa" style={{ height: 16 }}></Text>
                    <Text fontSize={15} fontWeight="bold" color="#00A550">45.000đ</Text>
                  </YStack>
                  <Button
                    circular
                    size="$2.5"
                    backgroundColor="#00A550"
                    icon={<ShoppingCart size={14} color="white" />}
                    onPress={() => speak('Đã thêm trứng gà ta hữu cơ vào giỏ hàng')}
                    pressStyle={{ backgroundColor: '#008740' }}
                  />
                </XStack>
              </YStack>
            </Card>
          </ScrollView>
        </YStack>

        {/* FLASH SALE */}
        <YStack gap="$3">
          <XStack justifyContent="space-between" alignItems="center">
            <XStack alignItems="center" gap="$2">
              <Zap size={20} color="#b45309" />
              <Text fontSize={18} fontWeight="bold" color="#b45309">Ưu đãi Bùng nổ (Flash Sale)</Text>
            </XStack>

            {/* Timer */}
            <XStack alignItems="center" gap="$1.5">
              <Text fontSize={11} color="#666" fontWeight="bold">Kết thúc trong:</Text>
              <XStack gap="$1">
                <View backgroundColor="#78350f" paddingHorizontal="$1.5" paddingVertical="$0.5" borderRadius={4}>
                  <Text fontSize={11} color="white" fontWeight="bold">{timeLeft.hours}</Text>
                </View>
                <Text color="#78350f" fontWeight="bold">:</Text>
                <View backgroundColor="#78350f" paddingHorizontal="$1.5" paddingVertical="$0.5" borderRadius={4}>
                  <Text fontSize={11} color="white" fontWeight="bold">{timeLeft.minutes}</Text>
                </View>
                <Text color="#78350f" fontWeight="bold">:</Text>
                <View backgroundColor="#78350f" paddingHorizontal="$1.5" paddingVertical="$0.5" borderRadius={4}>
                  <Text fontSize={11} color="white" fontWeight="bold">{timeLeft.seconds}</Text>
                </View>
              </XStack>
            </XStack>
          </XStack>

          <YStack gap="$4">
            {/* Flash Sale Item 1 */}
            <Card flex={1} borderRadius={16} overflow="hidden" backgroundColor="white" borderWidth={1} borderColor="#e2e8f0" style={{ elevation: 1 }}>
              <XStack padding="$3" gap="$3" alignItems="center">
                <Image src="https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=200&q=80" width={80} height={80} borderRadius={12} objectFit="cover" />
                <YStack flex={1} gap="$1">
                  <Text fontSize={13} fontWeight="bold" color="#333" numberOfLines={1}>Dâu Tây Đà Lạt loại 1</Text>
                  <XStack alignItems="center" gap="$2">
                    <Text fontSize={14} fontWeight="bold" color="#b45309">119.000đ</Text>
                    <Text fontSize={11} color="#aaa" style={{ textDecorationLine: 'line-through' }}>195.000đ</Text>
                  </XStack>
                  <YStack gap="$1" marginTop="$1">
                    <Progress size="$1" value={78} backgroundColor="#fef3c7">
                      <Progress.Indicator backgroundColor="#d97706" />
                    </Progress>
                    <Text fontSize={10} color="#b45309" fontWeight="bold">Đã bán 78%</Text>
                  </YStack>
                </YStack>
                <Button
                  backgroundColor="#78350f"
                  size="$2.5"
                  borderRadius={15}
                  onPress={() => speak('Đang hướng dẫn bạn di chuyển đến kệ dâu tây Đà Lạt')}
                  pressStyle={{ backgroundColor: '#5c280b' }}
                >
                  <Text color="white" fontSize={11} fontWeight="bold">Dẫn đường</Text>
                </Button>
              </XStack>
            </Card>

            {/* Flash Sale Item 2 */}
            <Card flex={1} borderRadius={16} overflow="hidden" backgroundColor="white" borderWidth={1} borderColor="#e2e8f0" style={{ elevation: 1 }}>
              <XStack padding="$3" gap="$3" alignItems="center">
                <Image src="https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=200&q=80" width={80} height={80} borderRadius={12} objectFit="cover" />
                <YStack flex={1} gap="$1">
                  <Text fontSize={13} fontWeight="bold" color="#333" numberOfLines={1}>Bơ Sáp Đắk Lắk</Text>
                  <XStack alignItems="center" gap="$2">
                    <Text fontSize={14} fontWeight="bold" color="#b45309">42.000đ</Text>
                    <Text fontSize={11} color="#aaa" style={{ textDecorationLine: 'line-through' }}>65.000đ</Text>
                  </XStack>
                  <YStack gap="$1" marginTop="$1">
                    <Progress size="$1" value={35} backgroundColor="#fef3c7">
                      <Progress.Indicator backgroundColor="#d97706" />
                    </Progress>
                    <Text fontSize={10} color="#b45309" fontWeight="bold">Đã bán 35%</Text>
                  </YStack>
                </YStack>
                <Button
                  backgroundColor="#78350f"
                  size="$2.5"
                  borderRadius={15}
                  onPress={() => speak('Đang hướng dẫn bạn di chuyển đến kệ bơ sáp Đắk Lắk')}
                  pressStyle={{ backgroundColor: '#5c280b' }}
                >
                  <Text color="white" fontSize={11} fontWeight="bold">Dẫn đường</Text>
                </Button>
              </XStack>
            </Card>
          </YStack>
        </YStack>

      </ScrollView>

      {/* FLOATING CART WIDGET */}
      <View
        position="absolute"
        bottom={30}
        right={Math.max(insets.right, 30)}
        zIndex={200}
      >
        <Button
          circular
          size="$4"
          backgroundColor="#22c55e"
          style={{ elevation: 6 }}
          pressStyle={{ scale: 0.95, backgroundColor: '#15803d' }}
          icon={<ShoppingCart size={22} color="white" />}
          onPress={() => speak('Mở giỏ hàng của bạn')}
        />
        {/* Badge number */}
        <View
          position="absolute"
          top={-4}
          right={-4}
          backgroundColor="#ef4444"
          borderRadius={10}
          width={18}
          height={18}
          justifyContent="center"
          alignItems="center"
          borderWidth={1}
          borderColor="white"
        >
          <Text fontSize={9} fontWeight="bold" color="white">3</Text>
        </View>
      </View>
    </View>
  );
}
