import { useRouter, useLocalSearchParams } from 'expo-router';
import { Sparkles, Gift } from 'lucide-react-native';
import { TouchableWithoutFeedback, Dimensions, StyleSheet } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  FadeIn,
  FadeOut
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text, View, XStack, YStack } from 'tamagui';
import { useRobotVoice } from '../../hooks/useRobotVoice';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const { speak } = useRobotVoice();
  const router = useRouter();
  const params = useLocalSearchParams<{ skipStartup?: string }>();
  const shouldSkip = params.skipStartup === 'true';

  const [isStarting, setIsStarting] = useState(!shouldSkip);
  const [startupLog, setStartupLog] = useState('⚡ Đang khởi động hệ thống robot...');
  
  // Ref to track if TTS has spoken on mount
  const hasSpokenWelcome = useRef(false);

  // Animations
  const floatY = useSharedValue(0);
  const wobbleRotation = useSharedValue(0);
  const mainContentOpacity = useSharedValue(shouldSkip ? 1 : 0);
  const startupLogoScale = useSharedValue(1);
  
  // Background Orbs Animations
  const orb1X = useSharedValue(0);
  const orb1Y = useSharedValue(0);
  const orb2X = useSharedValue(0);
  const orb2Y = useSharedValue(0);
  const orb3X = useSharedValue(0);
  const orb3Y = useSharedValue(0);

  // Time state
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const dateString = currentTime.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  // Floating animation for Mascot
  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-15, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Orb Animations - random wandering
    orb1X.value = withRepeat(withTiming(-50, { duration: 6000, easing: Easing.inOut(Easing.ease) }), -1, true);
    orb1Y.value = withRepeat(withTiming(80, { duration: 7500, easing: Easing.inOut(Easing.ease) }), -1, true);
    
    orb2X.value = withRepeat(withTiming(70, { duration: 8000, easing: Easing.inOut(Easing.ease) }), -1, true);
    orb2Y.value = withRepeat(withTiming(-60, { duration: 6500, easing: Easing.inOut(Easing.ease) }), -1, true);
    
    orb3X.value = withRepeat(withTiming(90, { duration: 9000, easing: Easing.inOut(Easing.ease) }), -1, true);
    orb3Y.value = withRepeat(withTiming(40, { duration: 8500, easing: Easing.inOut(Easing.ease) }), -1, true);

  }, []);

  // Startup Sequence
  useEffect(() => {
    if (!shouldSkip) {
      startupLogoScale.value = withRepeat(
        withSequence(withTiming(1.05, { duration: 800 }), withTiming(1, { duration: 800 })),
        -1, true
      );

      const logs = [
        '🔄 Kiểm tra phần cứng...',
        '🌐 Kết nối máy chủ AI...',
        '🚀 Tải hệ thống bản đồ 2D...',
        '✅ Sẵn sàng phục vụ!'
      ];
      
      let step = 0;
      const logInterval = setInterval(() => {
        if (step < logs.length) {
          setStartupLog(logs[step]);
          step++;
        }
      }, 700);

      const finishTimer = setTimeout(() => {
        clearInterval(logInterval);
        setIsStarting(false);
        mainContentOpacity.value = withTiming(1, { duration: 800 });
      }, 3500);

      return () => {
        clearInterval(logInterval);
        clearTimeout(finishTimer);
      };
    }
  }, [shouldSkip]);

  // TTS Greeting on Mount (Exactly Once)
  useEffect(() => {
    if (!isStarting && !hasSpokenWelcome.current) {
      speak('Xin chào, tôi là trợ lý thông minh. Hãy chạm vào màn hình để bắt đầu.');
      hasSpokenWelcome.current = true;
    }
  }, [isStarting]);

  const handleStart = () => {
    router.push('/role-selection');
  };

  const handleRobotTap = () => {
    // Wobble effect
    wobbleRotation.value = withSequence(
      withTiming(-10, { duration: 100 }),
      withTiming(10, { duration: 100 }),
      withTiming(-10, { duration: 100 }),
      withTiming(10, { duration: 100 }),
      withTiming(0, { duration: 100 })
    );
    speak('Xin chào! Tôi có thể giúp gì cho bạn?');
  };

  // Reanimated Styles
  const animatedRobotStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatY.value },
      { rotateZ: `${wobbleRotation.value}deg` }
    ],
  }));

  const animatedStartupLogo = useAnimatedStyle(() => ({
    transform: [{ scale: startupLogoScale.value }],
  }));

  const animatedMainContent = useAnimatedStyle(() => ({
    opacity: mainContentOpacity.value,
  }));

  const animatedOrb1 = useAnimatedStyle(() => ({ transform: [{ translateX: orb1X.value }, { translateY: orb1Y.value }] }));
  const animatedOrb2 = useAnimatedStyle(() => ({ transform: [{ translateX: orb2X.value }, { translateY: orb2Y.value }] }));
  const animatedOrb3 = useAnimatedStyle(() => ({ transform: [{ translateX: orb3X.value }, { translateY: orb3Y.value }] }));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View flex={1} backgroundColor="#0B132B"> {/* Deep dark blue base */}
        
        {isStarting ? (
          // STARTUP SCREEN
          <Animated.View style={[styles.startupContainer, { backgroundColor: '#0B132B' }]} entering={FadeIn} exiting={FadeOut}>
            <Animated.View style={[styles.startupLogoWrapper, animatedStartupLogo]}>
              <Image source={require('../../../assets/images/robot-avatar.png')} style={{ width: 100, height: 100 }} resizeMode="contain" />
            </Animated.View>
            <YStack alignItems="center" marginTop={40} gap={16}>
              <ActivityIndicator size="large" color="#00FFCC" />
              <Text color="#00FFCC" fontSize={16} fontWeight="600" fontFamily="$body" letterSpacing={1}>
                {startupLog}
              </Text>
            </YStack>
          </Animated.View>
        ) : (
          // MAIN IDLE SCREEN
          <TouchableWithoutFeedback onPress={handleStart}>
            <Animated.View style={[StyleSheet.absoluteFill, animatedMainContent]}>
              
              {/* ANIMATED BACKGROUND ORBS */}
              <Animated.View style={[styles.orb, { backgroundColor: '#00FFCC', width: 300, height: 300, top: -50, left: -50 }, animatedOrb1]} />
              <Animated.View style={[styles.orb, { backgroundColor: '#7B2CBF', width: 400, height: 400, bottom: 100, right: -100 }, animatedOrb2]} />
              <Animated.View style={[styles.orb, { backgroundColor: '#3A0CA3', width: 350, height: 350, top: '30%', left: '10%' }, animatedOrb3]} />
              <LinearGradient colors={['rgba(11, 19, 43, 0.4)', 'rgba(11, 19, 43, 0.8)']} style={StyleSheet.absoluteFill} />

              <View flex={1} paddingHorizontal={24} paddingVertical={40} justifyContent="space-between">
                
                {/* TOP HEADER (GLASSMORPHISM) */}
                <YStack alignItems="center" zIndex={10}>
                  <View style={styles.glassCard} padding={20} borderRadius={24} width="100%" alignItems="center">
                    <XStack alignItems="center" gap={8} marginBottom={10}>
                      <View width={10} height={10} borderRadius={5} backgroundColor="#00FFCC" style={styles.neonGlow} />
                      <Text color="#E2E8F0" fontSize={16} fontWeight="700" letterSpacing={2}>SMART SUPERMARKET</Text>
                    </XStack>
                    <Text color="#FFFFFF" fontSize={72} fontWeight="900" style={styles.timeText}>{timeString}</Text>
                    <Text color="#94A3B8" fontSize={18} fontWeight="600" marginTop={-5}>{dateString}</Text>
                  </View>
                </YStack>

                {/* CENTER MASCOT */}
                <YStack alignItems="center" justifyContent="center" zIndex={20}>
                  <TouchableWithoutFeedback onPress={handleRobotTap}>
                    <Animated.View style={[styles.robotContainer, animatedRobotStyle]}>
                      <View style={[styles.glassCircle, { width: 260, height: 260, borderRadius: 130 }]} justifyContent="center" alignItems="center">
                        <Image source={{ uri: "https://media.giphy.com/media/3og0IUzdgwVczU67eg/giphy.gif" }} style={{ width: 180, height: 180 }} resizeMode="contain" />
                      </View>
                    </Animated.View>
                  </TouchableWithoutFeedback>

                  <View style={styles.hintGlassBadge} marginTop={30}>
                    <Sparkles size={16} color="#00FFCC" />
                    <Text color="#FFFFFF" fontSize={14} fontWeight="bold" letterSpacing={1.5} marginLeft={8}>CHẠM VÀO MÀN HÌNH ĐỂ BẮT ĐẦU</Text>
                  </View>
                </YStack>

                {/* FOOTER (PROMOTIONS BUTTON) */}
                <View width="100%" alignItems="center" zIndex={30}>
                  <TouchableWithoutFeedback onPress={() => {
                    speak('Đang mở trang khuyến mãi hôm nay. Mời bạn xem các ưu đãi hấp dẫn!');
                    router.push('/guest-campaign');
                  }}>
                    <View style={[styles.glassCard, styles.promoButton]}>
                      <Gift size={24} color="#00FFCC" />
                      <Text color="#FFFFFF" fontWeight="800" fontSize={18} letterSpacing={1} marginLeft={12}>
                        KHUYẾN MÃI HÔM NAY
                      </Text>
                    </View>
                  </TouchableWithoutFeedback>
                </View>

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
    backgroundColor: '#0B132B'
  },
  startupContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startupLogoWrapper: {
    width: 160,
    height: 160,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#00FFCC',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.5,
    // Note: react-native on Android/iOS might not support filter: blur out of the box in simple views,
    // so opacity and gradient is usually the fallback. Let's keep it clean.
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  glassCircle: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 255, 204, 0.4)',
    shadowColor: '#00FFCC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 15,
  },
  neonGlow: {
    shadowColor: '#00FFCC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  timeText: {
    textShadowColor: 'rgba(0, 255, 204, 0.3)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 15,
  },
  robotContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintGlassBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  promoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '90%',
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0, 255, 204, 0.15)',
    borderColor: 'rgba(0, 255, 204, 0.5)',
  }
});
