import React, { useEffect } from 'react';
import { View, Text, Button, XStack, YStack, ScrollView } from 'tamagui';
import { UserSearch, Star, ArrowRight } from 'lucide-react-native';
import { Header } from '../layout/Header';
import { useRobotVoice } from '../../hooks/useRobotVoice';
import Animated, { FadeInDown, FadeInUp, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withDelay, Easing } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Crown } from 'lucide-react-native';
import { Image } from 'expo-image';

export default function RoleSelectionScreen() {
  const { speak } = useRobotVoice();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Giá trị animation nổi/bồng bềnh cho thẻ
  const float1 = useSharedValue(0);
  const float2 = useSharedValue(0);
  const scaleMember = useSharedValue(1);

  useEffect(() => {
    speak('Vui lòng chọn vai trò của bạn');

    // Chạy animation thở/nổi liên tục
    float1.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2000 }),
        withTiming(0, { duration: 2000 })
      ),
      -1,
      true
    );

    float2.value = withDelay(
      1000,
      withRepeat(
        withSequence(
          withTiming(-8, { duration: 2000 }),
          withTiming(0, { duration: 2000 })
        ),
        -1,
        true
      )
    );

    // Hiệu ứng "thở" (scale) nhẹ nhàng cho thẻ Member
    scaleMember.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const floatStyle1 = useAnimatedStyle(() => ({
    transform: [{ translateY: float1.value }]
  }));

  const floatStyle2 = useAnimatedStyle(() => ({
    transform: [
      { translateY: float2.value },
      { scale: scaleMember.value }
    ]
  }));

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View flex={1} position="relative" overflow="hidden">

        {/* Mảng sương mờ Aura cực kỳ sang trọng (Real Image Background) */}
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1080&auto=format&fit=crop' }}
          contentFit="cover"
          style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 0 }}
          transition={500}
        />
        {/* Lớp phủ sáng mờ giúp chữ dễ đọc */}
        <View position="absolute" top={0} left={0} right={0} bottom={0} backgroundColor="rgba(255,255,255,0.85)" zIndex={0} />

        {/* 2. Grid Pattern (Sơ đồ siêu thị/AI map mờ) */}
        <View position="absolute" top={0} left={0} right={0} bottom={0} opacity={0.03} zIndex={0}>
          {/* Lưới ngang */}
          {[...Array(15)].map((_, i) => (
            <View key={`h-${i}`} position="absolute" top={i * 40} left={0} right={0} height={1} backgroundColor="black" />
          ))}
          {/* Lưới dọc */}
          {[...Array(25)].map((_, i) => (
            <View key={`v-${i}`} position="absolute" left={i * 40} top={0} bottom={0} width={1} backgroundColor="black" />
          ))}
        </View>

        {/* Header tĩnh ở trên cùng */}
        <View zIndex={10} paddingTop={insets.top}>
          <Header />
        </View>

        <ScrollView 
          flex={1} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-start', paddingBottom: 40, paddingTop: 30 }}
          zIndex={10}
        >
          <YStack alignItems="center" gap="$5">

            {/* Tiêu đề trang (Animation trượt xuống) */}
            <Animated.View entering={FadeInDown.duration(800).springify()}>
              <Text fontSize={28} fontWeight="900" color="#1a1a1a" textAlign="center" paddingHorizontal="$4" letterSpacing={0.5}>
                Vui lòng chọn vai trò
              </Text>
            </Animated.View>

            {/* Hai tấm thẻ chọn vai trò */}
            <YStack gap="$5" justifyContent="center" width="100%" paddingHorizontal="$4" marginTop={16} alignItems="center">

            {/* Card 1: Khách vãng lai */}
            <Animated.View entering={FadeInUp.delay(200).duration(600).springify()} style={{ width: '100%', maxWidth: 380 }}>
              <Animated.View style={floatStyle1}>
                <YStack
                  backgroundColor="white"
                  borderRadius={32}
                  paddingVertical="$5"
                  paddingHorizontal="$5"
                  shadowColor="rgba(0,0,0,0.06)"
                  shadowOffset={{ width: 0, height: 15 }}
                  shadowOpacity={1}
                  shadowRadius={30}
                  style={{ elevation: 4 }}
                  borderWidth={1}
                  borderColor="#F1F5F9"
                  position="relative"
                  overflow="hidden"
                  gap="$3"
                >
                  <YStack alignItems="center" gap="$3" justifyContent="center" zIndex={2}>
                    {/* Icon */}
                    <View width={64} height={64} borderRadius={32} backgroundColor="#F0FDF4" justifyContent="center" alignItems="center">
                      <UserSearch size={30} color="#00A550" strokeWidth={2} />
                    </View>

                    {/* Content */}
                    <YStack alignItems="center" gap="$1" paddingHorizontal="$2">
                      <Text fontSize={20} fontWeight="800" color="#0F172A">
                        Khách vãng lai
                      </Text>
                      <Text fontSize={13} color="#64748B" textAlign="center" lineHeight={18} fontWeight="500">
                        Trải nghiệm mua sắm nhanh chóng mà không cần đăng ký thành viên.
                      </Text>
                    </YStack>
                  </YStack>

                  <Button
                    variant="outlined"
                    borderColor="#E2E8F0"
                    borderWidth={1.5}
                    borderRadius={30}
                    paddingHorizontal="$5"
                    size="$4"
                    width="100%"
                    pressStyle={{ scale: 0.97, backgroundColor: '#F8FAFC' }}
                    onPress={() => {
                      speak('Chào mừng khách hàng đến với Smart Market Bot');
                      setTimeout(() => {
                        router.push('/guest-home' as any);
                      }, 1500);
                    }}
                    zIndex={2}
                  >
                    <Text color="#475569" fontWeight="800" fontSize={14} letterSpacing={0.5}>
                      BẮT ĐẦU NGAY
                    </Text>
                  </Button>
                </YStack>
              </Animated.View>
            </Animated.View>

            {/* Card 2: Khách hàng thành viên */}
            <Animated.View entering={FadeInUp.delay(400).duration(600).springify()} style={{ width: '100%', maxWidth: 380 }}>
              <Animated.View style={floatStyle2}>
                
                {/* Badge Khuyên dùng */}
                <View
                  position="absolute"
                  top={-16}
                  right={24}
                  backgroundColor="#FFD700"
                  paddingHorizontal="$4"
                  paddingVertical="$2"
                  borderRadius={20}
                  zIndex={100}
                  shadowColor="#FFD700"
                  shadowOffset={{ width: 0, height: 4 }}
                  shadowOpacity={0.6}
                  shadowRadius={12}
                  style={{ elevation: 6 }}
                >
                  <XStack alignItems="center" gap="$1.5">
                    <Crown size={14} color="#8B6508" fill="#8B6508" />
                    <Text color="#8B6508" fontWeight="900" fontSize={11} textTransform="uppercase" letterSpacing={1}>
                      Khuyên dùng
                    </Text>
                  </XStack>
                </View>

                <YStack
                  backgroundColor="#00A550"
                  borderRadius={32}
                  paddingVertical="$5"
                  paddingHorizontal="$5"
                  shadowColor="#00A550"
                  shadowOffset={{ width: 0, height: 15 }}
                  shadowOpacity={0.4}
                  shadowRadius={25}
                  style={{ elevation: 8 }}
                  overflow="hidden"
                  position="relative"
                  gap="$3"
                >
                  <YStack
                    position="absolute"
                    top={0} left={0} right={0} bottom={0}
                    overflow="hidden"
                    borderRadius={32}
                  >

                    {/* Lớp bóng Glossy chéo */}
                    <View
                      position="absolute"
                      top={-100}
                      left={-50}
                      width={300}
                      height={200}
                      backgroundColor="white"
                      opacity={0.15}
                      transform={[{ rotate: '-35deg' }]}
                      zIndex={1}
                    />

                    {/* Các mảng màu bùng nổ - Explosive background shapes */}
                    <View
                      position="absolute"
                      top={-40}
                      right={-40}
                      width={200}
                      height={200}
                      borderRadius={100}
                      backgroundColor="white"
                      opacity={0.1}
                      zIndex={0}
                    />
                    <View
                      position="absolute"
                      bottom={-60}
                      left={-40}
                      width={160}
                      height={160}
                      borderRadius={80}
                      backgroundColor="black"
                      opacity={0.15}
                      zIndex={0}
                    />
                  </YStack>

                  <YStack alignItems="center" gap="$3" justifyContent="center" zIndex={2}>
                    {/* Icon */}
                    <View width={64} height={64} borderRadius={32} backgroundColor="rgba(255,255,255,0.2)" justifyContent="center" alignItems="center" borderWidth={1.5} borderColor="rgba(255,255,255,0.3)">
                      <Star size={30} color="white" fill="white" />
                    </View>

                    {/* Content */}
                    <YStack alignItems="center" gap="$1" paddingHorizontal="$2">
                      <Text fontSize={20} fontWeight="800" color="white" textShadowColor="rgba(0,0,0,0.1)" textShadowOffset={{width:0, height:2}} textShadowRadius={4}>
                        Khách hàng thành viên
                      </Text>
                      <Text fontSize={13} color="rgba(255,255,255,0.9)" textAlign="center" lineHeight={18} fontWeight="500">
                        Tích điểm đổi quà, tư vấn dinh dưỡng và nhận nhiều ưu đãi đặc quyền.
                      </Text>
                    </YStack>
                  </YStack>

                  <Button
                    backgroundColor="white"
                    borderRadius={30}
                    paddingHorizontal="$5"
                    size="$4"
                    width="100%"
                    pressStyle={{ scale: 0.96, opacity: 0.9 }}
                    iconAfter={<ArrowRight size={18} color="#00A550" strokeWidth={3} />}
                    onPress={() => router.push('/face-scan')}
                    zIndex={2}
                    shadowColor="rgba(0,0,0,0.1)"
                    shadowOffset={{ width: 0, height: 4 }}
                    shadowOpacity={1}
                    shadowRadius={10}
                  >
                    <Text color="#00A550" fontWeight="900" fontSize={14} letterSpacing={0.5}>
                      ĐĂNG NHẬP / ĐĂNG KÝ
                    </Text>
                  </Button>
                </YStack>
              </Animated.View>
            </Animated.View>

          </YStack>
        </YStack>
        </ScrollView>

      </View>
    </View>
  );
}
