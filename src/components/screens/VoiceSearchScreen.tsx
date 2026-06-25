import { useRouter } from 'expo-router';
import { Info, MapPin, Mic, ShoppingBag, Sparkles, Volume2, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Text, View, XStack, YStack } from 'tamagui';
import { isRobotVoiceSpeaking, useRobotVoice } from '../../hooks/useRobotVoice';

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

  // Ref để quản lý các timeout của giả lập gõ chữ thời gian thực
  const voiceTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearVoiceTimeouts = () => {
    voiceTimeouts.current.forEach(clearTimeout);
    voiceTimeouts.current = [];
  };

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
      clearVoiceTimeouts();
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
    clearVoiceTimeouts();
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

    // Giả lập nhận diện thời gian thực bám sát nhịp độ nói (Voice-paced Typewriter Effect)
    const simulatedSpeechSequence = [
      { word: 'Nước', delay: 400 },
      { word: 'ép', delay: 250 },
      { word: 'cam', delay: 300 },
      { word: 'nguyên', delay: 600 }, // Ngập ngừng nhẹ mô phỏng người nói suy nghĩ
      { word: 'chất', delay: 350 },
    ];
    let currentText = '';
    let accumulatedTime = 1500; // Đợi 1.5s sau khi hiện 'Đang lắng nghe...'
    
    simulatedSpeechSequence.forEach((item, index) => {
      accumulatedTime += item.delay;
      const timeoutId = setTimeout(() => {
        currentText += (index === 0 ? '' : ' ') + item.word;
        setTranscript(currentText);
      }, accumulatedTime);
      voiceTimeouts.current.push(timeoutId);
    });

    // Sau khi chữ hiện ra hết, tự động chuyển sang xử lý sau một nhịp chờ
    const finalTimeoutId = setTimeout(() => {
      simulateVoiceRecognition();
    }, accumulatedTime + 500);
    voiceTimeouts.current.push(finalTimeoutId);
  };

  // Giả lập nhận diện thành công
  const simulateVoiceRecognition = () => {
    setStatus('processing');
    setTranscript('Nước ép cam nguyên chất');

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

      {/* MAIN VERTICAL DASHBOARD (Môi trường siêu thị thực tế - Portrait Mobile) */}
      <YStack
        flex={1}
        paddingTop={Math.max(insets.top, 20) + 50}
        paddingBottom={Math.max(insets.bottom, 24)}
        paddingHorizontal="$6"
        gap="$4"
        zIndex={10}
        alignItems="center"
        justifyContent="space-between"
      >
        {/* TOP: Transcript & Status */}
        <YStack width="100%" alignItems="center" gap="$4" flex={1} justifyContent="center">
          <Animated.View entering={FadeInDown.duration(450).springify()} style={{ width: '100%', alignItems: 'center' }}>
            <Text fontSize={28} fontWeight="900" color="#0C3823" textAlign="center" lineHeight={40} style={styles.transcriptText}>
              {transcript ? `“ ${transcript} ”` : 'Hãy nói tên sản phẩm bạn muốn tìm...'}
            </Text>
          </Animated.View>

          {/* AI Shelf Position Guide */}
          {aiResponse ? (
            <Animated.View entering={ZoomIn.duration(400)} style={{ width: '100%' }}>
              <Card
                backgroundColor="#FFFFFF"
                borderWidth={1.5}
                borderColor="#10B981"
                borderRadius={16}
                paddingHorizontal="$4"
                paddingVertical="$3"
                style={styles.supermarketNotification}
              >
                <XStack gap="$3" alignItems="center">
                  <View width={36} height={36} borderRadius={18} backgroundColor="rgba(16, 185, 129, 0.15)" justifyContent="center" alignItems="center">
                    <MapPin size={16} color="#10B981" />
                  </View>
                  <YStack flex={1}>
                    <Text fontSize={11} fontWeight="900" color="#10B981" letterSpacing={0.5}>ĐÃ XÁC ĐỊNH KỆ HÀNG</Text>
                    <Text fontSize={13} color="#0C3823" fontWeight="700" lineHeight={18}>
                      {aiResponse}
                    </Text>
                  </YStack>
                </XStack>
              </Card>
            </Animated.View>
          ) : (
            <Animated.View key={status} entering={ZoomIn.duration(300)}>
              {status === 'listening' && (
                <XStack backgroundColor="rgba(16, 185, 129, 0.15)" borderWidth={1} borderColor="rgba(16, 185, 129, 0.4)" borderRadius={20} paddingHorizontal="$4" paddingVertical="$1.5" gap="$2" alignItems="center">
                  <Volume2 size={12} color="#0F5132" />
                  <Text fontSize={10} color="#0F5132" fontWeight="900" letterSpacing={1.2}>AI LISTENING ACTIVE</Text>
                </XStack>
              )}
              {status === 'processing' && (
                <XStack backgroundColor="rgba(234,179,8,0.15)" borderWidth={1} borderColor="rgba(234,179,8,0.4)" borderRadius={20} paddingHorizontal="$4" paddingVertical="$1.5" gap="$2" alignItems="center">
                  <Sparkles size={12} color="#b45309" />
                  <Text fontSize={10} color="#b45309" fontWeight="900" letterSpacing={1.2}>PROCESSING AUDIO...</Text>
                </XStack>
              )}
            </Animated.View>
          )}
        </YStack>

        {/* MIDDLE: Robot Avatar */}
        <YStack width="100%" justifyContent="center" alignItems="center" flex={1.2}>
          <Animated.View style={[styles.robotContainer, robotAnimatedStyle]}>
            {/* Glowing Aura Ring */}
            <View position="absolute" width={180} height={180} borderRadius={90} borderWidth={3} borderColor="rgba(16, 185, 129, 0.35)" style={styles.shieldRing} />

            {/* Inner Avatar */}
            <View width={130} height={130} borderRadius={65} backgroundColor="#FFFFFF" borderWidth={3} borderColor="#10B981" justifyContent="center" alignItems="center" style={[styles.avatarInner, { overflow: 'hidden' }]}>
              <Image source={logoCuteSource} style={{ width: 140, height: 140, resizeMode: 'contain' }} />
            </View>

            {/* Glowing tech corners */}
            <View position="absolute" top={-15} left={-15} width={24} height={24} borderTopWidth={4} borderLeftWidth={4} borderColor="#10B981" />
            <View position="absolute" top={-15} right={-15} width={24} height={24} borderTopWidth={4} borderRightWidth={4} borderColor="#10B981" />
            <View position="absolute" bottom={-15} left={-15} width={24} height={24} borderBottomWidth={4} borderLeftWidth={4} borderColor="#10B981" />
            <View position="absolute" bottom={-15} right={-15} width={24} height={24} borderBottomWidth={4} borderRightWidth={4} borderColor="#10B981" />
          </Animated.View>
        </YStack>

        {/* BOTTOM: Equalizer, Mic, Suggestions */}
        <YStack width="100%" alignItems="center" gap="$5" flex={1.5} justifyContent="flex-end">
          
          {/* Equalizer Visualizer & Core Mic Row */}
          <XStack width="100%" justifyContent="center" alignItems="center" gap="$8" height={100}>
            {/* Sound waves (Left) */}
            <XStack gap={6} height={80} alignItems="center">
              <Animated.View style={[styles.waveBar, barStyle1]} />
              <Animated.View style={[styles.waveBar, barStyle2]} />
            </XStack>

            {/* Microphone Button */}
            <View position="relative" width={100} height={100} justifyContent="center" alignItems="center">
              <Animated.View style={[styles.ripple, rippleStyle1, { width: 90, height: 90, borderRadius: 45 }]} />
              <Animated.View style={[styles.ripple, rippleStyle2, { width: 90, height: 90, borderRadius: 45 }]} />

              <Pressable
                onPress={() => {
                  if (status === 'listening') {
                    clearVoiceTimeouts();
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
                    width: 80, height: 80, borderRadius: 40,
                    backgroundColor: status === 'listening' ? '#10B981' : '#FFFFFF',
                    borderColor: status === 'listening' ? '#059669' : 'rgba(16, 185, 129, 0.35)',
                    transform: [{ scale: pressed ? 0.92 : 1 }],
                  }
                ]}
              >
                <Mic size={32} color={status === 'listening' ? '#FFFFFF' : '#10B981'} style={styles.micIcon} />
              </Pressable>
            </View>

            {/* Sound waves (Right) */}
            <XStack gap={6} height={80} alignItems="center">
              <Animated.View style={[styles.waveBar, barStyle4]} />
              <Animated.View style={[styles.waveBar, barStyle5]} />
            </XStack>
          </XStack>

          {/* Tips / Suggestions Box to fill bottom space nicely */}
          {status !== 'success' && (
            <Animated.View entering={FadeInUp.delay(300).duration(450)} style={{ width: '100%', marginTop: 10 }}>
              <Card
                backgroundColor="#FFFFFF"
                borderWidth={1}
                borderColor="rgba(16, 185, 129, 0.25)"
                borderRadius={16}
                padding="$4"
                style={styles.tipCard}
              >
                <XStack gap="$3" alignItems="flex-start">
                  <Info size={16} color="#10B981" style={{ marginTop: 2 }} />
                  <YStack flex={1} gap="$2">
                    <Text fontSize={12} color="#0F5132" fontWeight="bold" letterSpacing={0.5}>MẸO MUA SẮM</Text>
                    <Text fontSize={12} color="#4A5568" lineHeight={18} fontWeight="500">
                      Hãy nói to tên sản phẩm bạn cần tìm, ví dụ: "Sữa tươi Vinamilk", hoặc bấm vào các gợi ý bên dưới.
                    </Text>
                    
                    <XStack gap="$2" flexWrap="wrap" marginTop="$2">
                      {[
                        { text: 'Súp lơ xanh 🥦', query: 'súp lơ' },
                        { text: 'Nước cam ép 🍊', query: 'cam' },
                        { text: 'Thịt bò Kobe 🥩', query: 'thịt bò' },
                      ].map((chip, idx) => (
                        <Button
                          key={idx}
                          size="$3"
                          backgroundColor="#f0fdf4"
                          borderRadius={20}
                          paddingHorizontal="$3.5"
                          pressStyle={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', scale: 0.95 }}
                          onPress={() => {
                            if (isRobotVoiceSpeaking()) return;
                            stop();
                            router.replace(`/member-search?query=${encodeURIComponent(chip.query)}` as any);
                          }}
                        >
                          <Text color="#0F5132" fontSize={12} fontWeight="700">
                            {chip.text}
                          </Text>
                        </Button>
                      ))}
                    </XStack>
                  </YStack>
                </XStack>
              </Card>
            </Animated.View>
          )}

        </YStack>
      </YStack>
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
    width: 125,
    height: 125,
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
