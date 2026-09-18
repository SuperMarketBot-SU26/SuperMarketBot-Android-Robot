import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowRight, Sparkles, Gift, ShoppingBag, Search, Bot } from 'lucide-react-native';
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
  withTiming,
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

  // Time state
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const dateString = currentTime.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

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
    radarScale.value = withRepeat(
      withTiming(1.6, { duration: 2500, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
    radarOpacity.value = withRepeat(
      withTiming(0, { duration: 2500, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );

    // Delayed second radar
    const timer = setTimeout(() => {
      radarScale2.value = withRepeat(
        withTiming(1.6, { duration: 2500, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
      radarOpacity2.value = withRepeat(
        withTiming(0, { duration: 2500, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
    }, 1250);

    // Particle animations floating up
    particleY1.value = withRepeat(
      withTiming(-300, { duration: 8000, easing: Easing.linear }),
      -1,
      false
    );
    particleY2.value = withRepeat(
      withTiming(-400, { duration: 12000, easing: Easing.linear }),
      -1,
      false
    );
    particleY3.value = withRepeat(
      withTiming(-250, { duration: 9000, easing: Easing.linear }),
      -1,
      false
    );

    if (isStarting) {
      // 1. CHẠY KỊCH BẢN KHỞI ĐỘNG HỆ THỐNG (3 Giây)
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
          setIsStarting(false);
          speak('Chào mừng quý khách đến với Smart Market Bot! Tôi có thể giúp gì cho bạn?');
          mainContentOpacity.value = withTiming(1, { duration: 800 });
        }, 3000),
      ];

      return () => {
        clearTimeout(timer);
        logTimers.forEach(clearTimeout);
      };
    } else {
      mainContentOpacity.value = 1;
      return () => clearTimeout(timer);
    }
  }, [isStarting]);

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3FAF6' }}>
      <View
        flex={1}
        backgroundColor="#F3FAF6"
        justifyContent="center"
        alignItems="center"
        position="relative"
        style={styles.container}
      >
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
                <View
                  backgroundColor="rgba(0,165,80,0.06)"
                  borderWidth={1}
                  borderColor="rgba(0,165,80,0.15)"
                  borderRadius={10}
                  paddingHorizontal="$4"
                  paddingVertical="$2"
                  width="90%"
                  maxWidth={320}
                  alignItems="center"
                >
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
          <TouchableWithoutFeedback
            onPress={() => {
              speak('Tuyệt vời! Chúng ta bắt đầu thôi.');
              router.push('/role-selection');
            }}
          >
            <Animated.View
              style={[
                {
                  width: '100%',
                  height: '100%',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: SCREEN_HEIGHT > 800 ? 25 : 12,
                  paddingBottom: 24,
                  paddingHorizontal: 24,
                },
                animatedMainContent,
              ]}
            >
              {/* BACKGROUND GRID OVERLAYS */}
              <View position="absolute" top={0} left={0} right={0} bottom={0} opacity={0.035} zIndex={0}>
                {[...Array(14)].map((_, i) => (
                  <View
                    key={`h-${i}`}
                    position="absolute"
                    top={i * 50}
                    left={0}
                    right={0}
                    height={1}
                    backgroundColor="#00A550"
                  />
                ))}
                {[...Array(24)].map((_, i) => (
                  <View
                    key={`v-${i}`}
                    position="absolute"
                    left={i * 55}
                    top={0}
                    bottom={0}
                    width={1}
                    backgroundColor="#00A550"
                  />
                ))}
              </View>

              {/* Glowing particles (Floating Orbs) */}
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    bottom: -50,
                    left: '20%',
                    width: 120,
                    height: 120,
                    borderRadius: 60,
                    backgroundColor: '#00A550',
                    opacity: 0.18,
                  },
                  animatedParticle1,
                ]}
              />
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    bottom: -100,
                    right: '15%',
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                    backgroundColor: '#D1F2DF',
                    opacity: 0.25,
                  },
                  animatedParticle2,
                ]}
              />
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    bottom: -20,
                    left: '60%',
                    width: 90,
                    height: 90,
                    borderRadius: 45,
                    backgroundColor: '#00A550',
                    opacity: 0.14,
                  },
                  animatedParticle3,
                ]}
              />

              {/* 1. TOP HEADER & STATUS BAR */}
              <YStack width="100%" zIndex={10}>
                <XStack alignItems="center" justifyContent="space-between" width="100%">
                  <XStack alignItems="center" gap={8}>
                    <View width={10} height={10} borderRadius={5} backgroundColor="#00A550" style={styles.greenDot} />
                    <Text color="#0F5132" fontSize={18} fontWeight="900" letterSpacing={0.8}>
                      SmartMarketBot
                    </Text>
                  </XStack>

                  {/* Robot Status Beacon */}
                  <XStack
                    alignItems="center"
                    gap={6}
                    backgroundColor="rgba(0,165,80,0.08)"
                    paddingHorizontal={12}
                    paddingVertical={5}
                    borderRadius={16}
                    borderWidth={1}
                    borderColor="rgba(0,165,80,0.18)"
                  >
                    <Bot size={14} color="#00A550" />
                    <Text color="#00793b" fontSize={12} fontWeight="800">
                      RB0001 · Sẵn sàng phục vụ
                    </Text>
                  </XStack>
                </XStack>

                {/* CRISP DIGITAL TIME DISPLAY (Mobile balanced) */}
                <YStack alignItems="center" marginTop={8}>
                  <Text
                    color="#00A550"
                    fontSize={48}
                    fontWeight="900"
                    letterSpacing={1.5}
                    style={styles.timeGlow}
                  >
                    {timeString}
                  </Text>
                  <Text
                    color="#0F5132"
                    fontSize={13}
                    fontWeight="700"
                    opacity={0.85}
                    marginTop={2}
                  >
                    {dateString}
                  </Text>
                </YStack>
              </YStack>

              {/* 2. CENTER PIECE: ANIMATED MASCOT AVATAR & SPEECH BUBBLE */}
              <YStack alignItems="center" justifyContent="center" zIndex={5} flex={1}>
                {/* Friendly Greeting Speech Bubble */}
                <View style={styles.speechBubble}>
                  <Sparkles size={14} color="#00A550" />
                  <Text style={styles.speechBubbleText}>
                    Xin chào! Chạm vào tôi để bắt đầu nhé!
                  </Text>
                </View>

                {/* Animated Robot Mascot */}
                <Animated.View style={[styles.robotWrapper, animatedRobotStyle]}>
                  {/* Radar Pulse Rings */}
                  <Animated.View
                    style={[
                      {
                        position: 'absolute',
                        width: 170,
                        height: 170,
                        borderRadius: 85,
                        borderWidth: 2.5,
                        borderColor: '#00A550',
                      },
                      animatedRadar1,
                    ]}
                  />
                  <Animated.View
                    style={[
                      {
                        position: 'absolute',
                        width: 170,
                        height: 170,
                        borderRadius: 85,
                        borderWidth: 1.5,
                        borderColor: '#00A550',
                      },
                      animatedRadar2,
                    ]}
                  />

                  {/* Glowing Tech Ring */}
                  <Animated.View style={[styles.glowRing, animatedGlowStyle]} />

                  {/* Circular Frame Containing Cute Robot Mascot */}
                  <View
                    width={150}
                    height={150}
                    borderRadius={75}
                    overflow="hidden"
                    backgroundColor="#FFFFFF"
                    borderWidth={2.5}
                    borderColor="#00A550"
                    style={styles.avatarInner}
                    justifyContent="center"
                    alignItems="center"
                  >
                    <Image
                      source={require('../../../assets/images/logocute.png')}
                      style={{ width: '82%', height: '82%' }}
                      resizeMode="contain"
                    />
                  </View>
                </Animated.View>

                {/* Interactive Touch Hint */}
                <YStack alignItems="center" gap={6} marginTop={16}>
                  <XStack
                    alignItems="center"
                    gap={5}
                    backgroundColor="rgba(0,165,80,0.08)"
                    paddingHorizontal={12}
                    paddingVertical={4}
                    borderRadius={14}
                  >
                    <Sparkles size={12} color="#00A550" />
                    <Text color="#00793b" fontSize={11} fontWeight="800" letterSpacing={1}>
                      TRỢ LÝ SIÊU THỊ THÔNG MINH
                    </Text>
                  </XStack>

                  <Animated.View style={animatedPulse}>
                    <Text color="#00A550" fontSize={13.5} fontWeight="900" letterSpacing={1.5}>
                      [ 👆 CHẠM VÀO MÀN HÌNH ĐỂ BẮT ĐẦU ]
                    </Text>
                  </Animated.View>
                </YStack>
              </YStack>

              {/* 3. BOTTOM QUICK ACTION BUTTONS (Clean 2-tier mobile stack) */}
              <YStack width="100%" maxWidth={480} alignItems="center" gap={8} zIndex={10}>
                {/* Tier 1: Big prominent full-width CTA */}
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    speak('Tuyệt vời! Hãy cùng bắt đầu mua sắm.');
                    router.push('/role-selection');
                  }}
                  style={{ width: '100%' }}
                >
                  <View style={styles.primaryActionButton}>
                    <ShoppingBag size={20} color="white" style={{ marginRight: 8 }} />
                    <Text color="white" fontWeight="900" fontSize={15} letterSpacing={0.5}>
                      Bắt Đầu Mua Sắm
                    </Text>
                    <ArrowRight size={18} color="white" style={{ marginLeft: 6 }} />
                  </View>
                </Pressable>

                {/* Tier 2: 2 Companion buttons side-by-side (50% - 50%) */}
                <XStack width="100%" gap={8}>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      speak('Đang mở danh sách siêu khuyến mãi hôm nay!');
                      router.push('/guest-campaign');
                    }}
                    style={{ flex: 1 }}
                  >
                    <View style={styles.secondaryActionButton}>
                      <Gift size={16} color="#ea580c" style={{ marginRight: 6 }} />
                      <Text color="#ea580c" fontWeight="800" fontSize={13} numberOfLines={1}>
                        Khuyến Mãi
                      </Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      speak('Mở trang tìm kiếm sản phẩm.');
                      router.push('/product-search' as any);
                    }}
                    style={{ flex: 1 }}
                  >
                    <View style={styles.tertiaryActionButton}>
                      <Search size={16} color="#00A550" style={{ marginRight: 6 }} />
                      <Text color="#00793b" fontWeight="800" fontSize={13} numberOfLines={1}>
                        Tra Cứu Hàng
                      </Text>
                    </View>
                  </Pressable>
                </XStack>

                <Text color="#64748b" fontSize={11} fontWeight="600" marginTop={2}>
                  Chạm vào bất kỳ vị trí nào trên màn hình để bắt đầu
                </Text>
              </YStack>
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
  timeGlow: {
    textShadowColor: 'rgba(0, 165, 80, 0.2)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  speechBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 165, 80, 0.25)',
    marginBottom: 20,
    shadowColor: 'rgba(0, 165, 80, 0.15)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  speechBubbleText: {
    color: '#0F5132',
    fontSize: 13.5,
    fontWeight: '800',
  },
  robotWrapper: {
    width: 180,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  glowRing: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 2,
    borderColor: 'rgba(0, 165, 80, 0.35)',
    borderStyle: 'dashed',
  },
  avatarInner: {
    shadowColor: 'rgba(0, 165, 80, 0.25)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  primaryActionButton: {
    backgroundColor: '#00A550',
    borderRadius: 25,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    shadowColor: '#00A550',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  secondaryActionButton: {
    backgroundColor: '#fff7ed',
    borderRadius: 22,
    height: 44,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 2,
  },
  tertiaryActionButton: {
    backgroundColor: '#f0fdf4',
    borderRadius: 22,
    height: 44,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#bbf7d0',
    shadowColor: '#00A550',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 2,
  },
});
