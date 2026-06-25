import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowRight, Cpu, Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text, View, XStack, YStack } from 'tamagui';
import { useRobotVoice } from '../../hooks/useRobotVoice';

export default function WelcomeScreen() {
  const { speak } = useRobotVoice();
  const router = useRouter();
  const params = useLocalSearchParams<{ skipStartup?: string }>();
  const shouldSkip = params.skipStartup === 'true';

  // Trạng thái quá trình khởi động hệ thống (Bỏ qua nếu quay lại từ Idle Timeout)
  const [isStarting, setIsStarting] = useState(!shouldSkip);
  const [startupLog, setStartupLog] = useState('⚡ Đang khởi động hệ thống robot...');

  // Animation values
  const floatY = useSharedValue(0);
  const glowOpacity = useSharedValue(0.4);
  const startupLogoScale = useSharedValue(1);
  const mainContentOpacity = useSharedValue(shouldSkip ? 1 : 0);

  useEffect(() => {
    // 2. KÍCH HOẠT HIỆU ỨNG BỒNG BỀNH & HÀO QUANG KHI VÀO MÀN CHÍNH
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1200 }),
        withTiming(0.4, { duration: 1200 })
      ),
      -1,
      true
    );

    if (isStarting) {
      // 1. CHẠY KỊCH BẢN KHỞI ĐỘNG HỆ THỐNG GIẢ LẬP (3 Giây)
      startupLogoScale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 750, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 750, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );

      const logTimers = [
        setTimeout(() => setStartupLog('🔍 Đang kiểm tra Camera AI & Cảm biến...'), 800),
        setTimeout(() => setStartupLog('🎙️ Đang kích hoạt cổng nhận diện giọng nói...'), 1600),
        setTimeout(() => setStartupLog('🟢 Hệ thống sẵn sàng! Khởi động giao diện Kiosk...'), 2400),
        setTimeout(() => {
          // Hoàn tất khởi động
          setIsStarting(false);
          // Phát tiếng chào mừng khi màn hình chính xuất hiện
          speak('Chào mừng quý khách đến với Smart Market Bót ! Tôi có thể giúp gì cho bạn?');
          // Kích hoạt opacity cho nội dung chính
          mainContentOpacity.value = withTiming(1, { duration: 800 });
        }, 3000)
      ];

      return () => {
        logTimers.forEach(clearTimeout);
      };
    } else {
      // Nếu skip startup thì set thẳng opacity bằng 1 tức thì
      mainContentOpacity.value = 1;
    }
  }, [isStarting]);

  // Styles chuyển đổi
  const animatedRobotStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const animatedGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const animatedStartupLogo = useAnimatedStyle(() => ({
    transform: [{ scale: startupLogoScale.value }],
  }));

  const animatedMainContent = useAnimatedStyle(() => ({
    opacity: mainContentOpacity.value,
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3FAF6' }}>
      <View flex={1} backgroundColor="#F3FAF6" justifyContent="center" alignItems="center" position="relative" style={styles.container}>

        {/* ============================================================== */}
        {/* PHASE 1: HIỆU ỨNG KHỞI ĐỘNG HỆ THỐNG (STARTUP SCREEN)         */}
        {/* ============================================================== */}
        {isStarting ? (
          <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(450)}
            style={styles.startupContainer}
          >
            <YStack alignItems="center" gap="$6" justifyContent="center">
              {/* Logo robot 2D gốc ở chính giữa nhấp nháy khởi động */}
              <Animated.View style={[styles.startupLogoWrapper, animatedStartupLogo]}>
                <Image
                  source={require('../../../assets/images/logocute.png')}
                  style={{ width: 140, height: 140 }}
                  resizeMode="contain"
                />
              </Animated.View>

              {/* Tiến trình và log hệ thống chạy mượt mà */}
              <YStack alignItems="center" gap="$3" marginTop="$2">
                <XStack gap="$2" alignItems="center">
                  <ActivityIndicator size="small" color="#00A550" />
                  <Text fontSize={14} color="#0F5132" fontWeight="700" letterSpacing={0.5}>
                    SYSTEM INITIALIZING
                  </Text>
                </XStack>

                {/* Dòng chữ logs chạy thời gian thực */}
                <View backgroundColor="rgba(0,165,80,0.06)" borderWidth={1} borderColor="rgba(0,165,80,0.15)" borderRadius={10} paddingHorizontal="$4" paddingVertical="$2" minWidth={350} alignItems="center">
                  <Text fontSize={12} color="#357A57" fontWeight="600" textAlign="center">
                    {startupLog}
                  </Text>
                </View>
              </YStack>
            </YStack>
          </Animated.View>
        ) : (
          // ==============================================================
          // PHASE 2: GIAO DIỆN CHÍNH SAU KHI KHỞI ĐỘNG XONG (MAIN SCREEN)
          // ==============================================================
          <Animated.View style={[{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }, animatedMainContent]}>

            {/* 1. FRESH FUTURISTIC LIGHT GRID PATTERN */}
            <View position="absolute" top={0} left={0} right={0} bottom={0} opacity={0.06} zIndex={0}>
              {[...Array(12)].map((_, i) => (
                <View key={`h-${i}`} position="absolute" top={i * 45} left={0} right={0} height={1} backgroundColor="#00A550" />
              ))}
              {[...Array(22)].map((_, i) => (
                <View key={`v-${i}`} position="absolute" left={i * 55} top={0} bottom={0} width={1} backgroundColor="#00A550" />
              ))}
            </View>

            {/* Soft Ambient glowing orbs */}
            <View position="absolute" top={-150} left={-100} width={400} height={400} borderRadius={200} backgroundColor="#E2F7EC" opacity={0.8} />
            <View position="absolute" bottom={-180} right={-120} width={450} height={450} borderRadius={225} backgroundColor="#E2F7EC" opacity={0.8} />

            {/* 2. TOP BRANDING HEADER AREA */}
            <XStack
              position="absolute"
              top={40}
              left={0}
              right={0}
              paddingHorizontal={24}
              justifyContent="space-between"
              alignItems="center"
              zIndex={10}
            >
              <YStack gap={1}>
                <XStack alignItems="center" gap={8}>
                  <View width={8} height={8} borderRadius={4} backgroundColor="#00A550" style={styles.greenDot} />
                  <Text
                    color="#0F5132"
                    fontSize={24}
                    fontWeight="900"
                    fontFamily="$heading"
                    letterSpacing={1.2}
                    style={styles.brandTitle}
                  >
                    SmartMarketBot
                  </Text>
                </XStack>
              </YStack>

              {/* AI Active Badge */}
              <XStack backgroundColor="rgba(0, 165, 80, 0.1)" borderWidth={1} borderColor="rgba(0, 165, 80, 0.25)" borderRadius={20} paddingHorizontal="$3.5" paddingVertical="$1" gap="$1.5" alignItems="center">
                <Cpu size={12} color="#00A550" />
                <Text fontSize={9} color="#005b2b" fontWeight="800" letterSpacing={1}>SYSTEM ONLINE</Text>
              </XStack>
            </XStack>

            {/* 3. CENTER PIECE: ANIMATED FLOATING ROBOT CONTAINER */}
            <YStack alignItems="center" gap="$5" zIndex={5} marginTop="$6">
              <Animated.View style={[styles.robotWrapper, animatedRobotStyle]}>
                {/* Tech glowing corners */}
                <View position="absolute" top={-8} left={-8} width={24} height={24} borderTopWidth={3.5} borderLeftWidth={3.5} borderColor="#00A550" borderRadius={4} />
                <View position="absolute" top={-8} right={-8} width={24} height={24} borderTopWidth={3.5} borderRightWidth={3.5} borderColor="#00A550" borderRadius={4} />
                <View position="absolute" bottom={-8} left={-8} width={24} height={24} borderBottomWidth={3.5} borderLeftWidth={3.5} borderColor="#00A550" borderRadius={4} />
                <View position="absolute" bottom={-8} right={-8} width={24} height={24} borderBottomWidth={3.5} borderRightWidth={3.5} borderColor="#00A550" borderRadius={4} />

                {/* Glowing tech aura ring */}
                <Animated.View style={[styles.glowRing, animatedGlowStyle]} />

                {/* Inner Circular Frame with beautiful live robot GIF */}
                <View
                  width={240}
                  height={240}
                  borderRadius={120}
                  overflow="hidden"
                  backgroundColor="#FFFFFF"
                  borderWidth={2}
                  borderColor="#00A550"
                  style={styles.avatarInner}
                  justifyContent="center"
                  alignItems="center"
                >
                  <Image
                    source={{ uri: "https://media.giphy.com/media/3og0IUzdgwVczU67eg/giphy.gif" }}
                    style={{ width: '110%', height: '110%' }}
                    resizeMode="contain"
                  />
                </View>
              </Animated.View>

              {/* AI Slogan beneath the robot */}
              <YStack alignItems="center" gap={4} marginTop="$2">
                <XStack alignItems="center" gap={6}>
                  <Sparkles size={14} color="#00A550" />
                  <Text color="#005b2b" fontSize={11} fontWeight="800" letterSpacing={2}>TRỢ LÝ SIÊU THỊ THÔNG MINH</Text>
                </XStack>
              </YStack>
            </YStack>

            {/* 4. FOOTER CALL-TO-ACTION BUTTON */}
            <View position="absolute" bottom={50} left={24} right={24} zIndex={10} alignItems="center">
              <Button
                size="$5"
                backgroundColor="#00A550"
                color="white"
                borderRadius={35}
                width="100%"
                height={58}
                pressStyle={{ scale: 0.95, backgroundColor: '#008440' }}
                iconAfter={<ArrowRight size={22} color="white" />}
                onPress={() => {
                  // Phát tiếng và chuyển trang
                  speak('Tuyệt vời! Chúng ta bắt đầu thôi.');
                  router.push('/role-selection');
                }}
                style={styles.ctaButton}
              >
                <Text color="white" fontWeight="900" fontSize={16} letterSpacing={0.5}>
                  Bắt đầu ngay
                </Text>
              </Button>
            </View>

          </Animated.View>
        )}

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  startupContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  startupLogoWrapper: {
    width: 180,
    height: 180,
    backgroundColor: '#FFFFFF',
    borderRadius: 90,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#00A550',
    shadowColor: 'rgba(0, 165, 80, 0.15)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  greenDot: {
    shadowColor: '#00A550',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 3,
  },
  brandTitle: {
    textShadowColor: 'rgba(0, 165, 80, 0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  robotWrapper: {
    width: 260,
    height: 260,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  glowRing: {
    position: 'absolute',
    width: 276,
    height: 276,
    borderRadius: 138,
    borderWidth: 2,
    borderColor: 'rgba(0, 165, 80, 0.3)',
    borderStyle: 'dashed',
  },
  avatarInner: {
    shadowColor: 'rgba(0, 165, 80, 0.16)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  ctaButton: {
    shadowColor: '#00A550',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
});
