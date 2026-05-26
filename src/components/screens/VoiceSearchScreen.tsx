import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Pressable, Image } from 'react-native';
import { View, Text, XStack, YStack, Button, Card } from 'tamagui';
import { Mic, X, Sparkles, Volume2, MapPin, Info, ShoppingBag } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  interpolate,
  SharedValue,
  ZoomIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { useRobotVoice, isRobotVoiceSpeaking } from '../../hooks/useRobotVoice';
import { useRouter } from 'expo-router';

// Import logo robot cute từ thư mục assets
const logoCuteSource = require('../../../assets/images/logocute.png');

export default function VoiceSearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { speak, stop, isSpeaking } = useRobotVoice();

  // Trạng thái điều hướng khi Robot nói xong
  const [shouldNavigate, setShouldNavigate] = useState(false);
  const speakingStarted = useRef(false);

  // Trạng thái của quá trình nhận diện giọng nói
  // 'initial' | 'listening' | 'processing' | 'success'
  const [status, setStatus] = useState<'initial' | 'listening' | 'processing' | 'success'>('initial');
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');

  // Animation values
  const pulseScale1 = useSharedValue(1);
  const pulseScale2 = useSharedValue(1);
  const pulseOpacity1 = useSharedValue(0.4);
  const pulseOpacity2 = useSharedValue(0.2);

  // Equalizer wave values for soundwave animation (5 bars)
  const waveHeight1 = useSharedValue(15);
  const waveHeight2 = useSharedValue(15);
  const waveHeight3 = useSharedValue(15);
  const waveHeight4 = useSharedValue(15);
  const waveHeight5 = useSharedValue(15);

  // Robot float animation
  const robotY = useSharedValue(0);
  const glowOpacity = useSharedValue(0.6);

  useEffect(() => {
    // 1. Robot tự động nổi bồng bềnh mượt mà
    robotY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // 2. Glowing aura pulsing
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 1100 }),
        withTiming(0.4, { duration: 1100 })
      ),
      -1,
      true
    );

    // Bắt đầu lắng nghe tự động sau 800ms
    const startTimer = setTimeout(() => {
      startVoiceListening();
    }, 800);

    return () => {
      clearTimeout(startTimer);
      stop();
    };
  }, []);

  // Giám sát trạng thái nói của Robot để chuyển trang khi nói xong hoàn toàn
  useEffect(() => {
    let safetyTimer: any;

    if (shouldNavigate) {
      if (isSpeaking) {
        speakingStarted.current = true;
      } else if (speakingStarted.current) {
        // Robot nói xong hoàn toàn! Thực hiện chuyển trang lập tức
        router.replace('/member-search?query=cam' as any);
      }

      // Safety fallback: Nếu loa gặp sự cố không tắt trạng thái nói, tự động chuyển trang sau 8.5 giây để tránh đơ Kiosk
      safetyTimer = setTimeout(() => {
        stop(); // Đảm bảo stop() trước để tắt cờ isSpeakingGlobal
        router.replace('/member-search?query=cam' as any);
      }, 8500);
    }

    return () => {
      clearTimeout(safetyTimer);
    };
  }, [isSpeaking, shouldNavigate]);

  // Bắt đầu lắng nghe giọng nói
  const startVoiceListening = async () => {
    setStatus('listening');
    setTranscript('Đang lắng nghe...');
    setAiResponse('');

    // Phát âm thanh robot chào qua FPT.AI
    speak('Quý khách muốn tìm sản phẩm nào? Tôi đang lắng nghe.');

    // 1. Kích hoạt hiệu ứng Ripple (Sóng tròn lan tỏa) của Mic
    pulseScale1.value = withRepeat(
      withTiming(2.4, { duration: 1500, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
    pulseOpacity1.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 0 }),
        withTiming(0, { duration: 1500, easing: Easing.out(Easing.ease) })
      ),
      -1,
      false
    );

    pulseScale2.value = withDelay(
      750,
      withRepeat(
        withTiming(2.4, { duration: 1500, easing: Easing.out(Easing.ease) }),
        -1,
        false
      )
    );
    pulseOpacity2.value = withDelay(
      750,
      withRepeat(
        withSequence(
          withTiming(0.3, { duration: 0 }),
          withTiming(0, { duration: 1500, easing: Easing.out(Easing.ease) })
        ),
        -1,
        false
      )
    );

    // 2. Kích hoạt Soundwave Equalizer (Sóng âm thanh nhấp nhô sống động)
    const animateWave = (wave: SharedValue<number>, min: number, max: number, duration: number) => {
      wave.value = withRepeat(
        withSequence(
          withTiming(max, { duration, easing: Easing.inOut(Easing.ease) }),
          withTiming(min, { duration, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    };

    animateWave(waveHeight1, 10, 42, 400);
    animateWave(waveHeight2, 16, 65, 340);
    animateWave(waveHeight3, 10, 78, 480);
    animateWave(waveHeight4, 16, 55, 370);
    animateWave(waveHeight5, 10, 32, 430);

    // Giả lập nhận diện sau 4.5 giây
    setTimeout(() => {
      simulateVoiceRecognition();
    }, 4500);
  };

  // Giả lập nhận diện thành công
  const simulateVoiceRecognition = () => {
    setStatus('processing');
    setTranscript('“ Nước ép cam nguyên chất ”');

    // Dừng ripple animation của Mic
    pulseScale1.value = withTiming(1);
    pulseOpacity1.value = withTiming(0);
    pulseScale2.value = withTiming(1);
    pulseOpacity2.value = withTiming(0);

    // Co hẹp sóng equalizer
    waveHeight1.value = withTiming(8);
    waveHeight2.value = withTiming(8);
    waveHeight3.value = withTiming(8);
    waveHeight4.value = withTiming(8);
    waveHeight5.value = withTiming(8);

    // Giả lập phản hồi AI sau 1.5 giây
    setTimeout(() => {
      setStatus('success');
      setAiResponse('Đã tìm thấy "Nước ép cam nguyên chất" tại Kệ 2, Dãy C. Đang dẫn đường...');
      speak('Đã tìm thấy nước ép cam nguyên chất tại Kệ số 2, dãy C. Đang mở kết quả tìm kiếm cho bạn.');

      // Đánh dấu sẵn sàng điều hướng khi Robot nói xong hoàn toàn
      setShouldNavigate(true);
    }, 1500);
  };

  // Style Animations
  const robotAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: robotY.value }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const rippleStyle1 = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale1.value }],
    opacity: pulseOpacity1.value,
  }));

  const rippleStyle2 = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale2.value }],
    opacity: pulseOpacity2.value,
  }));

  // Equalizer bar styles
  const barStyle1 = useAnimatedStyle(() => ({ height: waveHeight1.value }));
  const barStyle2 = useAnimatedStyle(() => ({ height: waveHeight2.value }));
  const barStyle3 = useAnimatedStyle(() => ({ height: waveHeight3.value }));
  const barStyle4 = useAnimatedStyle(() => ({ height: waveHeight4.value }));
  const barStyle5 = useAnimatedStyle(() => ({ height: waveHeight5.value }));

  return (
    <View flex={1} backgroundColor="#F3FAF6" style={styles.container}>
      
      {/* 1. FRESH LIGHT BACKGROUND GRID */}
      <View position="absolute" top={0} left={0} right={0} bottom={0} opacity={0.06} zIndex={0}>
        {[...Array(12)].map((_, i) => (
          <View key={`h-${i}`} position="absolute" top={i * 45} left={0} right={0} height={1} backgroundColor="#10B981" />
        ))}
        {[...Array(22)].map((_, i) => (
          <View key={`v-${i}`} position="absolute" left={i * 55} top={0} bottom={0} width={1} backgroundColor="#10B981" />
        ))}
      </View>

      {/* Ambient Sprout Light Theme soft orbs (Loại bỏ thuộc tính filter: blur không tương thích gây đen màn hình) */}
      <Animated.View style={[{ position: 'absolute', top: -120, left: '5%', width: 280, height: 280, borderRadius: 140, backgroundColor: '#E2F7EC', opacity: 0.75 }, glowAnimatedStyle]} />
      <View position="absolute" bottom={-120} right={-60} width={260} height={260} borderRadius={130} backgroundColor="#E2F7EC" opacity={0.8} />

      {/* TOP HEADER */}
      <XStack 
        position="absolute"
        top={0}
        left={0}
        right={0}
        justifyContent="space-between"
        alignItems="center"
        paddingTop={Math.max(insets.top, 14)}
        paddingHorizontal="$6"
        zIndex={100}
      >
        <YStack gap="$1">
          <XStack alignItems="center" gap={6}>
            <View width={8} height={8} borderRadius={4} backgroundColor="#10B981" style={styles.greenDot} />
            <Text fontSize={14} fontWeight="900" color="#0F5132" style={{ textShadowColor: 'rgba(16, 185, 129, 0.15)', textShadowRadius: 4 }} letterSpacing={1.2}>SmartMarketBot</Text>
          </XStack>
          {/* Vị trí Kiosk thực tế trong siêu thị */}
          <XStack alignItems="center" gap={6} marginLeft="$3.5">
            <MapPin size={10} color="#357A57" />
            <Text fontSize={9.5} color="#357A57" fontWeight="600">📍 Vị trí: Lối vào chính • Kiosk #01</Text>
          </XStack>
        </YStack>
        
        <Button
          size="$3"
          circular
          backgroundColor="rgba(255,255,255,0.85)"
          borderWidth={1}
          borderColor="rgba(16, 185, 129, 0.25)"
          icon={<X size={18} color="#0F5132" />}
          pressStyle={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', scale: 0.95 }}
          onPress={() => {
            stop();
            router.back();
          }}
        />
      </XStack>

      {/* MAIN TWO-COLUMN DASHBOARD (Môi trường siêu thị thực tế) */}
      <XStack
        flex={1}
        paddingTop={Math.max(insets.top, 20) + 48}
        paddingBottom={Math.max(insets.bottom, 12)}
        paddingHorizontal="$6"
        gap="$6"
        zIndex={10}
        alignItems="center"
      >

        {/* LEFT COLUMN: Cute Robot Avatar, Active Status Badge, and Supermarket AI Tips */}
        <YStack width="36%" justifyContent="center" alignItems="center" gap="$4" style={styles.leftCol}>
          <Animated.View style={[styles.robotContainer, robotAnimatedStyle]}>
            {/* Glowing Aura Ring */}
            <View position="absolute" width={150} height={150} borderRadius={75} borderWidth={2.5} borderColor="rgba(16, 185, 129, 0.35)" style={styles.shieldRing} />

            {/* Inner Avatar */}
            <View width={110} height={110} borderRadius={55} backgroundColor="#FFFFFF" borderWidth={2.5} borderColor="#10B981" justifyContent="center" alignItems="center" style={[styles.avatarInner, { overflow: 'hidden' }]}>
              {/* Tích hợp hình ảnh Robot Cute logocute.png */}
              <Image 
                source={logoCuteSource} 
                style={styles.robotImage} 
              />
            </View>

            {/* Glowing tech corners */}
            <View position="absolute" top={-5} left={-5} width={18} height={18} borderTopWidth={3} borderLeftWidth={3} borderColor="#10B981" />
            <View position="absolute" top={-5} right={-5} width={18} height={18} borderTopWidth={3} borderRightWidth={3} borderColor="#10B981" />
            <View position="absolute" bottom={-5} left={-5} width={18} height={18} borderBottomWidth={3} borderLeftWidth={3} borderColor="#10B981" />
            <View position="absolute" bottom={-5} right={-5} width={18} height={18} borderBottomWidth={3} borderRightWidth={3} borderColor="#10B981" />
          </Animated.View>

          {/* Status Badge */}
          <YStack alignItems="center" gap="$2.5" width="100%">
            <Animated.View key={status} entering={ZoomIn.duration(300)}>
              {status === 'listening' && (
                <XStack backgroundColor="rgba(16, 185, 129, 0.15)" borderWidth={1} borderColor="rgba(16, 185, 129, 0.4)" borderRadius={20} paddingHorizontal="$3.5" paddingVertical="$1" gap="$1.5" alignItems="center">
                  <Volume2 size={11} color="#0F5132" />
                  <Text fontSize={9} color="#0F5132" fontWeight="900" letterSpacing={1.2}>AI LISTENING ACTIVE</Text>
                </XStack>
              )}

              {status === 'processing' && (
                <XStack backgroundColor="rgba(234,179,8,0.15)" borderWidth={1} borderColor="rgba(234,179,8,0.4)" borderRadius={20} paddingHorizontal="$3.5" paddingVertical="$1" gap="$1.5" alignItems="center">
                  <Sparkles size={11} color="#b45309" />
                  <Text fontSize={9} color="#b45309" fontWeight="900" letterSpacing={1.2}>PROCESSING AUDIO...</Text>
                </XStack>
              )}

              {status === 'success' && (
                <XStack backgroundColor="rgba(16, 185, 129, 0.2)" borderWidth={1} borderColor="rgba(16, 185, 129, 0.5)" borderRadius={20} paddingHorizontal="$3.5" paddingVertical="$1" gap="$1.5" alignItems="center">
                  <Sparkles size={11} color="#0F5132" />
                  <Text fontSize={9} color="#0F5132" fontWeight="900" letterSpacing={1.2}>AI RECOGNIZED SUCCESS</Text>
                </XStack>
              )}
            </Animated.View>
          </YStack>

          {/* Supermarket Shopping Tip Box */}
          <Animated.View entering={FadeInUp.delay(150).duration(400)} style={{ width: '100%' }}>
            <Card
              backgroundColor="#FFFFFF"
              borderWidth={1}
              borderColor="rgba(16, 185, 129, 0.25)"
              borderRadius={14}
              padding="$3"
              style={styles.tipCard}
            >
              <XStack gap="$2" alignItems="flex-start">
                <Info size={13} color="#10B981" style={{ marginTop: 1 }} />
                <YStack flex={1} gap="$1">
                  <Text fontSize={9.5} color="#0F5132" fontWeight="bold" letterSpacing={0.5}>MẸO MUA SẮM NHANH</Text>
                  <Text fontSize={9} color="#4A5568" lineHeight={12} fontWeight="500">
                    Quý khách có thể nói to rõ: "Sữa tươi Vinamilk", "Tìm đùi gà CP", hoặc "Táo chín đỏ nằm ở đâu?" để Robot định vị ngay.
                  </Text>
                </YStack>
              </XStack>
            </Card>
          </Animated.View>
        </YStack>

        {/* RIGHT COLUMN: Transcript, Waves, Mic, Supermarket Guide & Quick Shopping Chips (Width: 64%) */}
        <YStack width="64%" justifyContent="center" alignItems="center" gap="$4" style={styles.rightCol}>

          {/* Spoken words panel */}
          <YStack width="100%" alignItems="center" gap="$2.5">
            <Animated.View key={transcript} entering={FadeInDown.duration(450).springify()} style={{ width: '100%' }}>
              <Text fontSize={24} fontWeight="900" color="#0C3823" textAlign="center" lineHeight={32} style={styles.transcriptText}>
                {transcript || 'Hãy nói tên sản phẩm bạn muốn tìm...'}
              </Text>
            </Animated.View>

            {/* AI Shelf Position Guide (Nhận diện môi trường siêu thị thực tế) */}
            {aiResponse ? (
              <Animated.View entering={ZoomIn.duration(400)} style={{ width: '100%', maxWidth: 460 }}>
                <Card
                  backgroundColor="#FFFFFF"
                  borderWidth={1.5}
                  borderColor="#10B981"
                  borderRadius={14}
                  paddingHorizontal="$3.5"
                  paddingVertical="$2.5"
                  style={styles.supermarketNotification}
                >
                  <XStack gap="$3" alignItems="center">
                    <View width={26} height={26} borderRadius={13} backgroundColor="rgba(16, 185, 129, 0.15)" justifyContent="center" alignItems="center">
                      <MapPin size={12} color="#10B981" />
                    </View>
                    <YStack flex={1}>
                      <Text fontSize={10} fontWeight="900" color="#10B981" letterSpacing={0.5}>ĐÃ XÁC ĐỊNH BẢN ĐỒ KỆ HÀNG</Text>
                      <Text fontSize={11} color="#0C3823" fontWeight="700" lineHeight={15}>
                        {aiResponse}
                      </Text>
                    </YStack>
                  </XStack>
                </Card>
              </Animated.View>
            ) : (
              /* Thể hiện cảnh báo âm thanh ở siêu thị đông người */
              <XStack gap="$2" alignItems="center" opacity={0.8} marginTop="$1">
                <Volume2 size={12} color="#357A57" />
                <Text fontSize={9.5} color="#357A57" fontWeight="600">🔊 Hệ thống loa đang phát hướng dẫn • Vui lòng lắng nghe</Text>
              </XStack>
            )}
          </YStack>

          {/* Equalizer Visualizer & Core Mic Row */}
          <XStack width="100%" justifyContent="center" alignItems="center" gap="$6" height={100}>
            {/* Sound waves (Left side of Mic) */}
            <XStack gap={5.5} height={80} alignItems="center">
              <Animated.View style={[styles.waveBar, barStyle1]} />
              <Animated.View style={[styles.waveBar, barStyle2]} />
              <Animated.View style={[styles.waveBar, barStyle3, styles.activeWaveBar]} />
              <Animated.View style={[styles.waveBar, barStyle4]} />
              <Animated.View style={[styles.waveBar, barStyle5]} />
            </XStack>

            {/* Microphone Button with Ripples */}
            <View position="relative" width={110} height={110} justifyContent="center" alignItems="center">
              <Animated.View style={[styles.ripple, rippleStyle1]} />
              <Animated.View style={[styles.ripple, rippleStyle2]} />

              <Pressable
                onPress={() => {
                  if (status === 'listening') {
                    stop();
                    setStatus('initial');
                    setTranscript('Đã tạm dừng. Nhấn nút để thử lại.');
                  } else {
                    startVoiceListening();
                  }
                }}
                style={({ pressed }) => [
                  styles.micButton,
                  {
                    backgroundColor: status === 'listening' ? '#10B981' : '#FFFFFF',
                    borderColor: status === 'listening' ? '#059669' : 'rgba(16, 185, 129, 0.35)',
                    transform: [{ scale: pressed ? 0.92 : 1 }],
                  }
                ]}
              >
                <Mic size={26} color={status === 'listening' ? '#FFFFFF' : '#10B981'} style={styles.micIcon} />
              </Pressable>
            </View>
          </XStack>

          {/* QUICK groceries Suggestion chips */}
          {status !== 'success' && (
            <Animated.View entering={FadeInUp.delay(300).duration(450)} style={{ width: '100%', marginTop: 4 }}>
              <YStack gap="$2" width="100%" alignItems="center">
                <XStack alignItems="center" gap="$1.5">
                  <ShoppingBag size={11} color="#10B981" />
                  <Text fontSize={9.5} fontWeight="bold" color="#357A57" letterSpacing={1.5}>GỢI Ý MUA SẮM HÔM NAY</Text>
                </XStack>
                
                <XStack gap="$2.5" justifyContent="center" flexWrap="wrap">
                  {[
                    { text: 'Súp lơ xanh 🥦', query: 'súp lơ' },
                    { text: 'Nước cam ép 🍊', query: 'cam' },
                    { text: 'Thịt bò Kobe 🥩', query: 'thịt bò' },
                  ].map((chip, idx) => (
                    <Button
                      key={idx}
                      size="$2.5"
                      backgroundColor="#FFFFFF"
                      borderWidth={1}
                      borderColor="rgba(16, 185, 129, 0.3)"
                      borderRadius={18}
                      paddingHorizontal="$3.5"
                      pressStyle={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', scale: 0.95 }}
                      onPress={() => {
                        if (isRobotVoiceSpeaking()) return; // Chặn điều hướng khi Robot đang nói
                        stop();
                        router.replace(`/member-search?query=${encodeURIComponent(chip.query)}` as any);
                      }}
                    >
                      <Text color="#0F5132" fontSize={11} fontWeight="700">
                        {chip.text}
                      </Text>
                    </Button>
                  ))}
                </XStack>
              </YStack>
            </Animated.View>
          )}

        </YStack>

      </XStack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  leftCol: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightCol: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  greenDot: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 3,
  },
  robotContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  shieldRing: {
    borderStyle: 'dashed',
  },
  avatarInner: {
    shadowColor: 'rgba(16, 185, 129, 0.12)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  robotImage: {
    width: 175,
    height: 175,
    resizeMode: 'contain',
  },
  transcriptText: {
    textShadowColor: 'rgba(16, 185, 129, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  supermarketNotification: {
    shadowColor: 'rgba(16, 185, 129, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  tipCard: {
    shadowColor: 'rgba(16, 185, 129, 0.06)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  waveBar: {
    width: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
  },
  activeWaveBar: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 3,
  },
  ripple: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  micButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(16, 185, 129, 0.15)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 15,
  },
  micIcon: {
    shadowColor: 'rgba(0,0,0,0.05)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
});
