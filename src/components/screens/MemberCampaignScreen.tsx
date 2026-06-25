import React, { useEffect } from 'react';
import { ScrollView } from 'react-native';
import { View, Text, XStack, YStack, Button, Card, Image } from 'tamagui';
import { ArrowLeft, Wifi, Bell, History, Star, MessageCircle, Clock, Sparkles } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useRobotVoice, useVoiceRouter } from '../../hooks/useRobotVoice';

export default function MemberCampaignScreen() {
  const insets = useSafeAreaInsets();
  const router = useVoiceRouter();
  const { speak } = useRobotVoice();

  useEffect(() => {
    // Robot chào mừng khi vào trang Khuyến mãi hấp dẫn
    speak('Chào mừng bạn đến với chương trình Khuyến mãi hấp dẫn nhất hôm nay, được AI cá nhân hóa riêng cho bạn!');
  }, []);

  const handleAddToCart = (productName: string) => {
    speak(`Đã thêm ${productName} vào giỏ hàng của bạn!`);
  };

  return (
    <View flex={1} backgroundColor="#f9fbf9" paddingLeft={Math.max(insets.left, 0)} paddingRight={Math.max(insets.right, 30)}>

      {/* HEADER BAR (Khớp ảnh mẫu) */}
      <XStack height={50} alignItems="center" justifyContent="space-between" paddingHorizontal="$4" borderBottomWidth={1} borderBottomColor="#f0f0f0" backgroundColor="white">
        <XStack alignItems="center" gap="$2">
          <Button
            circular
            size="$3.5"
            chromeless
            icon={<ArrowLeft size={20} color="#005b2b" />}
            onPress={() => router.back()}
            pressStyle={{ scale: 0.9 }}
          />
          <Text fontSize={18} fontWeight="bold" color="#005b2b">SmartMarketBot</Text>
        </XStack>

        <XStack alignItems="center" gap="$4">
          <XStack alignItems="center" gap="$1">
            <Wifi size={16} color="#666" />
            <Text fontSize={12} color="#666" fontWeight="bold">10:45 AM</Text>
          </XStack>
          <Button circular size="$3" chromeless icon={<Bell size={18} color="#666" />} />
          <Button circular size="$3" chromeless icon={<History size={18} color="#666" />} />
        </XStack>
      </XStack>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24 }}>

        {/* TITLE & SUBTITLE SECTION */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <YStack gap="$1" marginBottom="$6">
            <Text fontSize={26} fontWeight="bold" color="#005b2b">Chương trình Khuyến mãi Hấp dẫn</Text>
            <Text fontSize={14} color="#666">
              Khám phá các ưu đãi tươi ngon nhất được AI cá nhân hóa dành riêng cho bạn mỗi ngày.
            </Text>
          </YStack>
        </Animated.View>

        {/* HERO BANNER SECTION (Green Banner) */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)}>
          <Card
            borderRadius={24}
            overflow="hidden"
            backgroundColor="#22c55e"
            borderWidth={0}
            style={{ elevation: 3 }}
            marginBottom="$6"
          >
            <YStack flex={1}>
              {/* Top - Image & Floating Badge */}
              <View position="relative" height={160} width="100%">
                <Image
                  src="https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&q=80"
                  width="100%"
                  height="100%"
                  objectFit="cover"
                />

                {/* AI Badge (#1 AI Pick) */}
                <View
                  position="absolute"
                  bottom={12}
                  right={12}
                  backgroundColor="rgba(254, 243, 199, 0.9)"
                  borderWidth={1.5}
                  borderColor="rgba(217, 119, 6, 0.4)"
                  paddingHorizontal="$3.5"
                  paddingVertical="$1.5"
                  borderRadius={12}
                  style={{ elevation: 2 }}
                >
                  <Text fontSize={11} color="#b45309" fontWeight="950">#1 AI Pick</Text>
                </View>
              </View>

              {/* Bottom - Promotion Details */}
              <YStack padding="$5" gap="$3">
                <XStack
                  backgroundColor="#15803d"
                  paddingHorizontal="$2.5"
                  paddingVertical="$1"
                  borderRadius={12}
                  alignSelf="flex-start"
                  alignItems="center"
                  gap="$1"
                >
                  <Star size={11} color="#facc15" fill="#facc15" />
                  <Text fontSize={9} color="white" fontWeight="900" letterSpacing={0.5}>ƯU ĐÃI ĐẶC QUYỀW THÀNH VIÊN</Text>
                </XStack>

                <YStack gap="$1">
                  <Text fontSize={18} fontWeight="bold" color="white" lineHeight={22}>
                    Giảm ngay 50.000 VNĐ cho đơn hàng đầu tiên trong ngày!
                  </Text>
                  <Text fontSize={11} color="#dcfce7" lineHeight={15}>
                    Nâng cấp thẻ thành viên Gold để nhận thêm 5% tích điểm cho mỗi lần mua sắm tại hệ thống Robot Fresh Mart.
                  </Text>
                </YStack>

                <Button
                  backgroundColor="white"
                  borderRadius={30}
                  paddingHorizontal="$4"
                  height={36}
                  alignSelf="flex-start"
                  onPress={() => speak('Voucher 50 nghìn đã được áp dụng vào đơn hàng tiếp theo của bạn!')}
                  pressStyle={{ scale: 0.95 }}
                >
                  <Text color="#15803d" fontSize={12} fontWeight="bold">Nhận Ưu Đãi Ngay</Text>
                </Button>
              </YStack>
            </YStack>
          </Card>
        </Animated.View>

        {/* 4 PRODUCT CARDS GRID */}
        <YStack gap="$4" marginBottom="$6">
          <XStack gap="$4">

          {/* Card 1 */}
          <Animated.View style={{ flex: 1 }} entering={FadeInUp.delay(300).duration(500)}>
            <Card borderRadius={20} backgroundColor="white" overflow="hidden" borderWidth={1} borderColor="#e2e8f0" style={{ elevation: 2 }}>
              <View position="relative" height={120} backgroundColor="#f5f5f5">
                <Image src="https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=300&q=80" width="100%" height="100%" objectFit="cover" />
                <View position="absolute" top={10} left={10} backgroundColor="#f97316" paddingHorizontal="$2.5" paddingVertical="$1" borderRadius={8}>
                  <Text fontSize={9} color="white" fontWeight="900">-20%</Text>
                </View>
              </View>
              <YStack padding="$3.5" gap="$1.5">
                <Text fontSize={13} fontWeight="bold" color="#333" numberOfLines={1}>Trái cây Nhiệt đới hỗn hợp</Text>

                <XStack alignItems="baseline" gap="$2">
                  <Text fontSize={14} fontWeight="bold" color="#00A550">85.000 VNĐ</Text>
                  <Text fontSize={10} color="#999" style={{ textDecorationLine: 'line-through' }}>106.000 VNĐ</Text>
                </XStack>

                <XStack alignItems="center" gap="$1" marginTop="$1">
                  <Clock size={11} color="#ef4444" />
                  <Text fontSize={9} color="#ef4444" fontWeight="600">Hết hạn: 2 ngày tới</Text>
                </XStack>

                <Button
                  backgroundColor="#00A550"
                  height={32}
                  borderRadius={12}
                  marginTop="$2"
                  onPress={() => handleAddToCart('Trái cây Nhiệt đới')}
                  pressStyle={{ scale: 0.95, backgroundColor: '#008740' }}
                >
                  <Text color="white" fontSize={11} fontWeight="bold">Thêm vào Giỏ</Text>
                </Button>
              </YStack>
            </Card>
          </Animated.View>

          {/* Card 2 */}
          <Animated.View style={{ flex: 1 }} entering={FadeInUp.delay(400).duration(500)}>
            <Card borderRadius={20} backgroundColor="white" overflow="hidden" borderWidth={1} borderColor="#e2e8f0" style={{ elevation: 2 }}>
              <View position="relative" height={120} backgroundColor="#f5f5f5">
                <Image src="https://images.unsplash.com/photo-1544025162-d76694265947?w=300&q=80" width="100%" height="100%" objectFit="cover" />
                <View position="absolute" top={10} left={10} backgroundColor="#f97316" paddingHorizontal="$2.5" paddingVertical="$1" borderRadius={8}>
                  <Text fontSize={9} color="white" fontWeight="900">Mua 1 Tặng 1</Text>
                </View>
              </View>
              <YStack padding="$3.5" gap="$1.5">
                <Text fontSize={13} fontWeight="bold" color="#333" numberOfLines={1}>Thịt Bò Úc Thượng Hạng</Text>

                <XStack alignItems="baseline" gap="$2">
                  <Text fontSize={14} fontWeight="bold" color="#00A550">245.000 VNĐ</Text>
                </XStack>

                <XStack alignItems="center" gap="$1" marginTop="$1">
                  <Clock size={11} color="#f59e0b" />
                  <Text fontSize={9} color="#f59e0b" fontWeight="600">Duy nhất hôm nay</Text>
                </XStack>

                <Button
                  backgroundColor="#00A550"
                  height={32}
                  borderRadius={12}
                  marginTop="$2"
                  onPress={() => handleAddToCart('Thịt Bò Úc Thượng Hạng')}
                  pressStyle={{ scale: 0.95, backgroundColor: '#008740' }}
                >
                  <Text color="white" fontSize={11} fontWeight="bold">Thêm vào Giỏ</Text>
                </Button>
              </YStack>
            </Card>
          </Animated.View>
          </XStack>
          <XStack gap="$4">

          {/* Card 3 */}
          <Animated.View style={{ flex: 1 }} entering={FadeInUp.delay(500).duration(500)}>
            <Card borderRadius={20} backgroundColor="white" overflow="hidden" borderWidth={1} borderColor="#e2e8f0" style={{ elevation: 2 }}>
              <View position="relative" height={120} backgroundColor="#f5f5f5">
                <Image src="https://res.cloudinary.com/db3ed4buc/image/upload/v1779677233/raucu_t5pmol.jpg" width="100%" height="100%" objectFit="cover" />
                <View position="absolute" top={10} left={10} backgroundColor="#f97316" paddingHorizontal="$2.5" paddingVertical="$1" borderRadius={8}>
                  <Text fontSize={9} color="white" fontWeight="900">-15%</Text>
                </View>
              </View>
              <YStack padding="$3.5" gap="$1.5">
                <Text fontSize={13} fontWeight="bold" color="#333" numberOfLines={1}>Combo Rau Xanh Tươi Sạch</Text>

                <XStack alignItems="baseline" gap="$2">
                  <Text fontSize={14} fontWeight="bold" color="#00A550">42.000 VNĐ</Text>
                  <Text fontSize={10} color="#999" style={{ textDecorationLine: 'line-through' }}>50.000 VNĐ</Text>
                </XStack>

                <XStack alignItems="center" gap="$1" marginTop="$1">
                  <Clock size={11} color="#ef4444" />
                  <Text fontSize={9} color="#ef4444" fontWeight="600">Hết hạn: 3 ngày tới</Text>
                </XStack>

                <Button
                  backgroundColor="#00A550"
                  height={32}
                  borderRadius={12}
                  marginTop="$2"
                  onPress={() => handleAddToCart('Combo Rau Xanh')}
                  pressStyle={{ scale: 0.95, backgroundColor: '#008740' }}
                >
                  <Text color="white" fontSize={11} fontWeight="bold">Thêm vào Giỏ</Text>
                </Button>
              </YStack>
            </Card>
          </Animated.View>

          {/* Card 4 */}
          <Animated.View style={{ flex: 1 }} entering={FadeInUp.delay(600).duration(500)}>
            <Card borderRadius={20} backgroundColor="white" overflow="hidden" borderWidth={1} borderColor="#e2e8f0" style={{ elevation: 2 }}>
              <View position="relative" height={120} backgroundColor="#f5f5f5">
                <Image src="https://images.unsplash.com/photo-1563636619-e9143da7973b?w=300&q=80" width="100%" height="100%" objectFit="cover" />
                <View position="absolute" top={10} left={10} backgroundColor="#f97316" paddingHorizontal="$2.5" paddingVertical="$1" borderRadius={8}>
                  <Text fontSize={9} color="white" fontWeight="900">Giảm 10k</Text>
                </View>
              </View>
              <YStack padding="$3.5" gap="$1.5">
                <Text fontSize={13} fontWeight="bold" color="#333" numberOfLines={1}>Sữa Tươi Tiệt Trùng Nguyên Chất</Text>

                <XStack alignItems="baseline" gap="$2">
                  <Text fontSize={14} fontWeight="bold" color="#00A550">25.000 VNĐ</Text>
                  <Text fontSize={10} color="#999" style={{ textDecorationLine: 'line-through' }}>35.000 VNĐ</Text>
                </XStack>

                <XStack alignItems="center" gap="$1" marginTop="$1">
                  <Clock size={11} color="#ef4444" />
                  <Text fontSize={9} color="#ef4444" fontWeight="600">Hết hạn: 5 ngày tới</Text>
                </XStack>

                <Button
                  backgroundColor="#00A550"
                  height={32}
                  borderRadius={12}
                  marginTop="$2"
                  onPress={() => handleAddToCart('Sữa Tươi Tiệt Trùng')}
                  pressStyle={{ scale: 0.95, backgroundColor: '#008740' }}
                >
                  <Text color="white" fontSize={11} fontWeight="bold">Thêm vào Giỏ</Text>
                </Button>
              </YStack>
            </Card>
          </Animated.View>

        </XStack>
        </YStack>

        {/* AI SAVINGS RECOMMENDATION BAR */}
        <Animated.View entering={FadeInDown.delay(700).duration(600)}>
          <Card
            borderRadius={20}
            borderWidth={1}
            borderColor="#e2e8f0"
            backgroundColor="#f8fafc"
            padding="$4"
            marginBottom="$4"
          >
            <YStack gap="$4">
              <XStack alignItems="center" gap="$3.5" flex={1}>
                {/* Circular Icon */}
                <View
                  width={46}
                  height={46}
                  borderRadius={23}
                  backgroundColor="#e6f5ea"
                  justifyContent="center"
                  alignItems="center"
                >
                  <Sparkles size={20} color="#00A550" />
                </View>

                <YStack flex={1} gap="$1">
                  <Text fontSize={14} fontWeight="bold" color="#111">Gợi ý từ AI: Tiết kiệm hơn cho gia đình</Text>
                  <Text fontSize={12} color="#666" lineHeight={16}>
                    Dựa trên lịch sử mua sắm, bạn có thể tiết kiệm thêm <Text color="#00A550" fontWeight="bold">120.000 VNĐ</Text> bằng cách chọn mua theo gói "Gia đình Hạnh phúc" đang được giảm giá sâu.
                  </Text>
                </YStack>
              </XStack>

              <Button
                borderWidth={1}
                borderColor="#00A550"
                backgroundColor="transparent"
                borderRadius={20}
                paddingHorizontal="$4"
                height={38}
                onPress={() => speak('Đang tải các gợi ý mua sắm theo combo gia đình')}
                pressStyle={{ backgroundColor: '#e6f5ea' }}
              >
                <Text color="#00A550" fontSize={12} fontWeight="bold">Xem Gợi Ý</Text>
              </Button>
            </YStack>
          </Card>
        </Animated.View>

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
