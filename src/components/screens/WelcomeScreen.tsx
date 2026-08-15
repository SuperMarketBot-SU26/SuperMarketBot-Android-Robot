import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowRight, Sparkles, Gift } from 'lucide-react-native';
import { TouchableWithoutFeedback, Dimensions, Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
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

  const floatY = useSharedValue(0);
  const glowOpacity = useSharedValue(0.4);
  const startupLogoScale = useSharedValue(1);
  const mainContentOpacity = useSharedValue(shouldSkip ? 1 : 0);
  const pulseOpacity = useSharedValue(0.5);
  
  const radarScale = useSharedValue(1);
  const radarOpacity = useSharedValue(0.8);
  const radarScale2 = useSharedValue(1);
  const radarOpacity2 = useSharedValue(0.8);
  
  const particleY1 = useSharedValue(0);
  const particleY2 = useSharedValue(0);
  const particleY3 = useSharedValue(0);

  // 3D Button
  const buttonY = useSharedValue(0);

  // Time state
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const dateString = currentTime.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  const handlePressIn = () => {
    buttonY.value = withTiming(6, { duration: 100 });
  };
  
  const handlePressOut = () => {
    buttonY.value = withTiming(0, { duration: 100 });
  };

  useEffect(() => {
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

    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0.4, { duration: 1000 })
      ),
      -1,
      true
    );

    // Radar pulse animation
    radarScale.value = withRepeat(withTiming(1.6, { duration: 2500, easing: Easing.out(Easing.ease) }), -1, false);
    radarOpacity.value = withRepeat(withTiming(0, { duration: 2500, easing: Easing.out(Easing.ease) }), -1, false);
    
    // Delayed second radar
    setTimeout(() => {
      radarScale2.value = withRepeat(withTiming(1.6, { duration: 2500, easing: Easing.out(Easing.ease) }), -1, false);
      radarOpacity2.value = withRepeat(withTiming(0, { duration: 2500, easing: Easing.out(Easing.ease) }), -1, false);
    }, 1250);

    // Particle animations floating up
    particleY1.value = withRepeat(withTiming(-300, { duration: 8000, easing: Easing.linear }), -1, false);
    particleY2.value = withRepeat(withTiming(-400, { duration: 12000, easing: Easing.linear }), -1, false);
    particleY3.value = withRepeat(withTiming(-250, { duration: 9000, easing: Easing.linear }), -1, false);

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

  const animatedPulse = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const animatedRadar1 = useAnimatedStyle(() => ({
    transform: [{ scale: radarScale.value }],
    opacity: radarOpacity.value,
  }));

  const animatedRadar2 = useAnimatedStyle(() => ({
    transform: [{ scale: radarScale2.value }],
    opacity: radarOpacity2.value,
  }));

  const animatedParticle1 = useAnimatedStyle(() => ({
    transform: [{ translateY: particleY1.value }],
  }));

  const animatedParticle2 = useAnimatedStyle(() => ({
    transform: [{ translateY: particleY2.value }],
  }));

  const animatedParticle3 = useAnimatedStyle(() => ({
    transform: [{ translateY: particleY3.value }],
  }));

  const animatedFrontButton = useAnimatedStyle(() => ({
    transform: [{ translateY: buttonY.value }]
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
          <TouchableWithoutFeedback onPress={() => {
            speak('Tuyệt vời! Chúng ta bắt đầu thôi.');
            router.push('/role-selection');
          }}>
            <Animated.View style={[{ width: '100%', height: '100%', justifyContent: 'space-between', alignItems: 'center', paddingTop: SCREEN_HEIGHT > 800 ? 25 : 10, paddingBottom: 20 }, animatedMainContent]}>

              {/* PARTICLES & BG OVERLAYS */}
              <View position="absolute" top={0} left={0} right={0} bottom={0} opacity={0.04} zIndex={0}>
                {[...Array(12)].map((_, i) => <View key={`h-${i}`} position="absolute" top={i * 45} left={0} right={0} height={1} backgroundColor="#00A550" />)}
                {[...Array(22)].map((_, i) => <View key={`v-${i}`} position="absolute" left={i * 55} top={0} bottom={0} width={1} backgroundColor="#00A550" />)}
              </View>

              {/* Glowing particles (Floating Orbs) */}
              <Animated.View style={[{ position: 'absolute', bottom: -50, left: '20%', width: 100, height: 100, borderRadius: 50, backgroundColor: '#00A550', opacity: 0.2, filter: 'blur(15px)' }, animatedParticle1]} />
              <Animated.View style={[{ position: 'absolute', bottom: -100, right: '15%', width: 150, height: 150, borderRadius: 75, backgroundColor: '#D1F2DF', opacity: 0.3, filter: 'blur(20px)' }, animatedParticle2]} />
              <Animated.View style={[{ position: 'absolute', bottom: -20, left: '60%', width: 80, height: 80, borderRadius: 40, backgroundColor: '#00A550', opacity: 0.15, filter: 'blur(15px)' }, animatedParticle3]} />
              
              {/* Soft Ambient glowing orbs */}
              <View position="absolute" top={-150} left={-100} width={400} height={400} borderRadius={200} backgroundColor="#D1F2DF" opacity={0.6} zIndex={0} pointerEvents="none" />
              <View position="absolute" bottom={-180} right={-120} width={450} height={450} borderRadius={225} backgroundColor="#D1F2DF" opacity={0.5} zIndex={0} pointerEvents="none" />

              {/* 2. TOP HEADER */}
              <YStack width="100%" paddingHorizontal={24} zIndex={10} marginTop={0}>
                {/* Brand Name */}
                <XStack alignItems="center" justifyContent="space-between" width="100%">
                  <XStack alignItems="center" gap={8}>
                    <View width={8} height={8} borderRadius={4} backgroundColor="#00A550" style={styles.greenDot} />
                    <Text color="#0F5132" fontSize={18} fontWeight="900" fontFamily="$heading" letterSpacing={1} style={styles.brandTitle}>
                      SmartMarketBot
                    </Text>
                  </XStack>

                </XStack>

                {/* BIG TIME DISPLAY */}
                <YStack alignItems="center" marginTop={10}>
                  <Text color="#00A550" fontSize={80} fontWeight="900" fontFamily="$heading" letterSpacing={2} style={styles.timeGlow}>
                    {timeString}
                  </Text>
                  <Text color="#0F5132" fontSize={16} fontWeight="600" opacity={0.8} marginTop={-5}>
                    {dateString}
                  </Text>
                </YStack>
              </YStack>

              {/* 3. CENTER PIECE: ROBOT AS A HUGE INTERACTIVE BUTTON */}
              <YStack alignItems="center" justifyContent="center" zIndex={5} flex={1}>
                <Animated.View style={[styles.robotWrapper, animatedRobotStyle]}>
                  
                  {/* Radar Pulse Rings */}
                  <Animated.View style={[{ position: 'absolute', width: 240, height: 240, borderRadius: 120, borderWidth: 3, borderColor: '#00A550' }, animatedRadar1]} />
                  <Animated.View style={[{ position: 'absolute', width: 240, height: 240, borderRadius: 120, borderWidth: 2, borderColor: '#00A550' }, animatedRadar2]} />

                  {/* Glowing tech aura ring (Static) */}
                  <Animated.View style={[styles.glowRing, animatedGlowStyle]} />

                  {/* Inner Circular Frame */}
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

                {/* Slogan & Hint placed nicely under robot */}
                <YStack alignItems="center" gap={12} marginTop={30}>
                  <XStack alignItems="center" gap={6} backgroundColor="rgba(0,165,80,0.08)" paddingHorizontal={12} paddingVertical={4} borderRadius={15}>
                    <Sparkles size={14} color="#00A550" />
                    <Text color="#00793b" fontSize={11} fontWeight="800" letterSpacing={1.5}>TRỢ LÝ SIÊU THỊ THÔNG MINH</Text>
                  </XStack>
                  
                  <Animated.View style={animatedPulse}>
                    <Text color="#00A550" fontSize={15} fontWeight="800" letterSpacing={2}>
                      [ CHẠM ĐỂ BẮT ĐẦU ]
                    </Text>
                  </Animated.View>
                </YStack>
              </YStack>

              {/* 4. FOOTER */}
              <View width="100%" alignItems="center" paddingBottom={10} zIndex={10}>
                <Pressable
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  onPress={(e) => {
                    e.stopPropagation();
                    speak('Đang mở trang khuyến mãi hôm nay. Mời bạn xem các ưu đãi hấp dẫn!');
                    router.push('/guest-campaign');
                  }}
                  style={{ width: '85%' }}
                >
                  {/* Background shadow box */}
                  <View
                    position="absolute"
                    top={6} left={0} right={0} bottom={-6}
                    backgroundColor="#007036"
                    borderRadius={35}
                  />
                  {/* Front Button */}
                  <Animated.View style={[{
                    backgroundColor: '#00A550',
                    borderRadius: 35,
                    height: 58,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: 2,
                    borderColor: '#007036'
                  }, animatedFrontButton]}>
                    <Gift size={22} color="white" style={{ marginRight: 8 }} />
                    <Text color="white" fontWeight="900" fontSize={16} letterSpacing={0.5}>
                      Khuyến mãi hôm nay
                    </Text>
                  </Animated.View>
                </Pressable>
              </View>

            </Animated.View>
          </TouchableWithoutFeedback>
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
  timeGlow: {
    textShadowColor: 'rgba(0, 165, 80, 0.25)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  }
});
