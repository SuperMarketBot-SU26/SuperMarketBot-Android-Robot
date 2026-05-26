import React, { useEffect } from 'react';
import { View, Text, Button, XStack, YStack } from 'tamagui';
import { UserSearch, Star, ArrowRight } from 'lucide-react-native';
import { Header } from '../layout/Header';
import { useRobotVoice } from '../../hooks/useRobotVoice';
import Animated, { FadeInDown, FadeInUp, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withDelay } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RoleSelectionScreen() {
  const { speak } = useRobotVoice();
  const router = useRouter();

  // Giá trị animation nổi/bồng bềnh cho thẻ
  const float1 = useSharedValue(0);
  const float2 = useSharedValue(0);

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
  }, []);

  // Style áp dụng animation vào thẻ
  const floatStyle1 = useAnimatedStyle(() => ({
    transform: [{ translateY: float1.value }]
  }));

  const floatStyle2 = useAnimatedStyle(() => ({
    transform: [{ translateY: float2.value }]
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fcfdfd' }}>
      <View flex={1} position="relative" overflow="hidden">

        {/* 1. Nền mờ giả Gradient Trắng -> Xanh Mint */}
        <View position="absolute" top={-100} left={-100} width={400} height={400} borderRadius={200} backgroundColor="#00A550" opacity={0.05} />
        <View position="absolute" bottom={-150} right={-100} width={500} height={500} borderRadius={250} backgroundColor="#00A550" opacity={0.06} />

        {/* 2. Grid Pattern (Sơ đồ siêu thị/AI map mờ) */}
        <View position="absolute" top={0} left={0} right={0} bottom={0} opacity={0.04} zIndex={0}>
          {/* Lưới ngang */}
          {[...Array(15)].map((_, i) => (
            <View key={`h-${i}`} position="absolute" top={i * 40} left={0} right={0} height={1} backgroundColor="black" />
          ))}
          {/* Lưới dọc */}
          {[...Array(25)].map((_, i) => (
            <View key={`v-${i}`} position="absolute" left={i * 40} top={0} bottom={0} width={1} backgroundColor="black" />
          ))}
          {/* Một vài Waypoint / Node tròn trên lưới */}
          <View position="absolute" top={120 - 4} left={240 - 4} width={8} height={8} borderRadius={4} backgroundColor="black" />
          <View position="absolute" top={200 - 4} left={480 - 4} width={8} height={8} borderRadius={4} backgroundColor="black" />
          <View position="absolute" top={280 - 4} left={360 - 4} width={8} height={8} borderRadius={4} backgroundColor="black" />
          <View position="absolute" top={80 - 4} left={600 - 4} width={8} height={8} borderRadius={4} backgroundColor="black" />
        </View>

        {/* Header tĩnh ở trên cùng */}
        <View zIndex={10}>
          <Header />
        </View>

        <YStack flex={1} justifyContent="center" alignItems="center" gap="$5" paddingBottom={80} zIndex={10}>

          {/* Tiêu đề trang (Animation trượt xuống) */}
          <Animated.View entering={FadeInDown.duration(800).springify()}>
            <Text fontSize={26} fontWeight="bold" color="$textPrimary" fontFamily="$heading">
              Vui lòng chọn vai trò của bạn
            </Text>
          </Animated.View>

          {/* Hai tấm thẻ chọn vai trò */}
          <XStack gap="$8" justifyContent="center" width="100%" paddingHorizontal="$4" marginTop={30}>

            {/* Card 1: Khách vãng lai */}
            <Animated.View entering={FadeInUp.delay(200).duration(600).springify()} style={{ flex: 1, maxWidth: 340 }}>
              <Animated.View style={floatStyle1}>
                <YStack
                  backgroundColor="white"
                  borderRadius={20}
                  padding="$5"
                  height={210}
                  justifyContent="space-between"
                  alignItems="center"
                  shadowColor="rgba(0,0,0,0.05)"
                  shadowOffset={{ width: 0, height: 8 }}
                  shadowOpacity={1}
                  shadowRadius={15}
                  elevation={3}
                  borderWidth={1}
                  borderColor="#f0f0f0"
                >
                  <YStack alignItems="center" gap="$3">
                    {/* Icon */}
                    <View width={50} height={50} borderRadius={25} backgroundColor="#f9f9f9" justifyContent="center" alignItems="center">
                      <UserSearch size={24} color="#888" />
                    </View>

                    {/* Content */}
                    <YStack alignItems="center" gap="$1.5">
                      <Text fontSize={18} fontWeight="bold" color="$textPrimary">
                        Khách vãng lai
                      </Text>
                      <Text fontSize={11} color="$textSecondary" textAlign="center" lineHeight={16}>
                        Trải nghiệm mua sắm nhanh chóng mà không cần đăng ký tài khoản thành viên.
                      </Text>
                    </YStack>
                  </YStack>

                  <Button
                    variant="outlined"
                    borderColor="#e0e0e0"
                    borderRadius={30}
                    paddingHorizontal="$5"
                    size="$3"
                    pressStyle={{ scale: 0.97, backgroundColor: '#f5f5f5' }}
                    onPress={() => {
                      speak('Chào mừng khách hàng đến với Smart Market Bot');
                      setTimeout(() => {
                        router.push('/guest-home' as any);
                      }, 1500);
                    }}
                  >
                    <Text color="$textSecondary" fontWeight="bold" fontSize={11}>
                      BẮT ĐẦU NGAY
                    </Text>
                  </Button>
                </YStack>
              </Animated.View>
            </Animated.View>

            {/* Card 2: Khách hàng thành viên */}
            <Animated.View entering={FadeInUp.delay(400).duration(600).springify()} style={{ flex: 1, maxWidth: 340 }}>
              <Animated.View style={floatStyle2}>
                <YStack
                  backgroundColor="#00A550"
                  borderRadius={20}
                  padding="$5"
                  height={210}
                  justifyContent="space-between"
                  alignItems="center"
                  shadowColor="#00A550"
                  shadowOffset={{ width: 0, height: 8 }}
                  shadowOpacity={0.3}
                  shadowRadius={15}
                  elevation={8}
                  overflow="hidden"
                  position="relative"
                >
                  {/* Trang trí vòng tròn góc phải */}
                  <View
                    position="absolute"
                    top={-15}
                    right={-15}
                    width={100}
                    height={100}
                    borderRadius={50}
                    backgroundColor="white"
                    opacity={0.08}
                  />
                  <View
                    position="absolute"
                    top={25}
                    right={15}
                    width={60}
                    height={60}
                    borderRadius={30}
                    backgroundColor="black"
                    opacity={0.1}
                  />

                  <YStack alignItems="center" gap="$3" zIndex={2}>
                    {/* Icon */}
                    <View width={50} height={50} borderRadius={16} backgroundColor="rgba(255,255,255,0.2)" justifyContent="center" alignItems="center">
                      <Star size={24} color="white" fill="white" />
                    </View>

                    {/* Content */}
                    <YStack alignItems="center" gap="$1.5">
                      <Text fontSize={18} fontWeight="bold" color="white">
                        Khách hàng thành viên
                      </Text>
                      <Text fontSize={11} color="rgba(255,255,255,0.8)" textAlign="center" lineHeight={16}>
                        Tích điểm đổi quà, nhận ưu đãi đặc quyền và được AI tư vấn dinh dưỡng cá nhân.
                      </Text>
                    </YStack>
                  </YStack>

                  <Button
                    backgroundColor="white"
                    borderRadius={30}
                    paddingHorizontal="$5"
                    size="$3"
                    pressStyle={{ scale: 0.97, opacity: 0.9 }}
                    iconAfter={<ArrowRight size={14} color="#00A550" />}
                    onPress={() => router.push('/face-scan')}
                    zIndex={2}
                  >
                    <Text color="#00A550" fontWeight="bold" fontSize={11}>
                      ĐĂNG NHẬP / ĐĂNG KÝ
                    </Text>
                  </Button>
                </YStack>
              </Animated.View>
            </Animated.View>

          </XStack>
        </YStack>

      </View>
    </SafeAreaView>
  );
}
