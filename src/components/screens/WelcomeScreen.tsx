import { useRouter, useLocalSearchParams } from 'expo-router';
import { Sparkles, Gift } from 'lucide-react-native';
import { TouchableWithoutFeedback, Dimensions, StyleSheet } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Image } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
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
  
  const hasSpokenWelcome = useRef(false);

  // Animations
  const floatY = useSharedValue(0);
  const wobbleRotation = useSharedValue(0);
  const mainContentOpacity = useSharedValue(shouldSkip ? 1 : 0);
  const startupLogoScale = useSharedValue(1);

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
        withTiming(-12, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
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

  // TTS Greeting on Mount
  useEffect(() => {
    if (!isStarting && !hasSpokenWelcome.current) {
      speak('Xin chào, tôi là trợ lý thông minh. Hãy chạm vào màn hình để bắt đầu.');
      hasSpokenWelcome.current = true;
    }
  }, [isStarting]);

  const handleStart = () => {
    router.replace('/role-selection');
  };

  const handleRobotTap = () => {
    wobbleRotation.value = withSequence(
      withTiming(-10, { duration: 100 }),
      withTiming(10, { duration: 100 }),
      withTiming(-10, { duration: 100 }),
      withTiming(10, { duration: 100 }),
      withTiming(0, { duration: 100 })
    );
    speak('Xin chào! Tôi có thể giúp gì cho bạn?');
  };

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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View flex={1} backgroundColor="#F8FAFC">
        
        {isStarting ? (
          <Animated.View style={[styles.startupContainer, { backgroundColor: '#F8FAFC' }]} entering={FadeIn} exiting={FadeOut}>
            <Animated.View style={[styles.startupLogoWrapper, animatedStartupLogo]}>
              <Image source={require('../../../assets/images/logocute.png')} style={{ width: 100, height: 100 }} resizeMode="contain" />
            </Animated.View>
            <YStack alignItems="center" marginTop={40} gap={16}>
              <ActivityIndicator size="large" color="#00A550" />
              <Text color="#0F5132" fontSize={16} fontWeight="600" fontFamily="$body" letterSpacing={1}>
                {startupLog}
              </Text>
            </YStack>
          </Animated.View>
        ) : (
          <TouchableWithoutFeedback onPress={handleStart}>
            <Animated.View style={[StyleSheet.absoluteFill, animatedMainContent]}>
              
              {/* Background gradient decorative shapes */}
              <View position="absolute" top={-150} left={-100} width={400} height={400} borderRadius={200} backgroundColor="rgba(16, 185, 129, 0.05)" />
              <View position="absolute" bottom={-100} right={-50} width={300} height={300} borderRadius={150} backgroundColor="rgba(16, 185, 129, 0.08)" />

              <View flex={1} paddingHorizontal={32} paddingVertical={60} justifyContent="space-between">
                
                {/* TOP HEADER CARD */}
                <YStack alignItems="center" zIndex={10}>
                  <View style={styles.card} padding={30} borderRadius={32} width="100%" alignItems="center">
                    <XStack alignItems="center" gap={10} marginBottom={16}>
                      <View width={12} height={12} borderRadius={6} backgroundColor="#10B981" />
                      <Text color="#64748B" fontSize={16} fontWeight="800" letterSpacing={2}>SMART SUPERMARKET</Text>
                    </XStack>
                    <Text color="#0F172A" fontSize={80} fontWeight="900" style={styles.timeText}>{timeString}</Text>
                    <Text color="#475569" fontSize={20} fontWeight="700" marginTop={-5}>{dateString}</Text>
                  </View>
                </YStack>

                {/* CENTER MASCOT */}
                <YStack alignItems="center" justifyContent="center" zIndex={20} flex={1}>
                  <TouchableWithoutFeedback onPress={handleRobotTap}>
                    <Animated.View style={[styles.robotContainer, animatedRobotStyle]}>
                      <View style={[styles.avatarCircle, { width: 280, height: 280, borderRadius: 140 }]} justifyContent="center" alignItems="center">
                        <Image source={require('../../../assets/images/logocute.png')} style={{ width: 210, height: 210 }} resizeMode="contain" />
                      </View>
                    </Animated.View>
                  </TouchableWithoutFeedback>

                  <View style={styles.hintBadge} marginTop={40}>
                    <Sparkles size={18} color="#10B981" />
                    <Text color="#0F5132" fontSize={16} fontWeight="900" letterSpacing={1.5} marginLeft={10}>CHẠM VÀO MÀN HÌNH ĐỂ BẮT ĐẦU</Text>
                  </View>
                </YStack>

                {/* FOOTER PROMOTIONS BUTTON */}
                <View width="100%" alignItems="center" zIndex={30} paddingBottom={20}>
                  <TouchableWithoutFeedback onPress={() => {
                    speak('Đang mở trang khuyến mãi hôm nay. Mời bạn xem các ưu đãi hấp dẫn!');
                    router.push('/guest-campaign');
                  }}>
                    <View style={styles.promoButton}>
                      <View style={styles.promoIconWrapper}>
                        <Gift size={28} color="#FFFFFF" />
                      </View>
                      <Text color="#FFFFFF" fontWeight="900" fontSize={20} letterSpacing={1} marginLeft={16}>
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
    backgroundColor: '#F8FAFC'
  },
  startupContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startupLogoWrapper: {
    width: 160,
    height: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    shadowColor: 'rgba(16, 185, 129, 0.15)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 8,
  },
  avatarCircle: {
    backgroundColor: '#FFFFFF',
    shadowColor: 'rgba(16, 185, 129, 0.2)',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 12,
    borderWidth: 4,
    borderColor: '#F1F5F9',
  },
  timeText: {
    textShadowColor: 'rgba(0, 0, 0, 0.05)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  robotContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4', // Very light green
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    shadowColor: 'rgba(16, 185, 129, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  promoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 85,
    borderRadius: 42.5,
    backgroundColor: '#10B981', // Fresh Green
    shadowColor: 'rgba(16, 185, 129, 0.4)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 10,
  },
  promoIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  }
});
