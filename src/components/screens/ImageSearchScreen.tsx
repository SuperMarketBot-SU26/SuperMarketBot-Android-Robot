import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Camera, History, Scan, Settings as SettingsIcon, Sparkles, X, Zap } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Image, Text, View, XStack, YStack } from 'tamagui';
import { isRobotVoiceSpeaking, useRobotVoice } from '../../hooks/useRobotVoice';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Ảnh kệ siêu thị nước giải khát sang trọng và chân thực
const SHELF_IMAGE = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&q=80';
const LOGO_CUTE = require('../../../assets/images/logocute.png');

export default function ImageSearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { speak, stop, isSpeaking } = useRobotVoice();

  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    // Tự động yêu cầu quyền camera khi vào màn hình
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  // Trạng thái của kịch bản demo
  // 'idle' | 'scanning' | 'detected' | 'navigating'
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'detected' | 'navigating'>('idle');
  const [detectedProduct, setDetectedProduct] = useState<string>('');
  const [accuracy, setAccuracy] = useState<number>(0);
  const [flashOn, setFlashOn] = useState<boolean>(false);

  // Animation values
  const laserY = useSharedValue(0.15); // Chiều cao laser từ 15% đến 85%
  const boxOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  // Lưu trữ trạng thái tiến trình
  const scanTimerRef = useRef<any>(null);
  const navTimerRef = useRef<any>(null);
  const speakingStarted = useRef(false);

  useEffect(() => {
    // Bắt đầu chạy kịch bản quét tự động khi vào trang
    handleStartScanning();

    // Loop pulsing ring on the scan button
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );

    return () => {
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
      stop();
    };
  }, []);

  // Lắng nghe voice kết thúc để tự động chuyển sang trang tìm kiếm khi đã nhận diện thành công
  useEffect(() => {
    if (scanState === 'detected') {
      if (isSpeaking) {
        speakingStarted.current = true;
      } else if (speakingStarted.current) {
        // Voice hướng dẫn đã phát xong hoàn toàn -> Chuyển sang kết quả tìm kiếm sản phẩm
        setScanState('navigating');
        speakingStarted.current = false;
        router.replace('/member-search?query=cam' as any);
      }
    }
  }, [isSpeaking, scanState]);

  // Bắt đầu hoặc khởi động lại tiến trình quét AI
  const handleStartScanning = async () => {
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    if (navTimerRef.current) clearTimeout(navTimerRef.current);

    setScanState('scanning');
    setDetectedProduct('Đang nhận diện kệ hàng...');
    setAccuracy(0);
    boxOpacity.value = 0;

    // Chạy laser lên xuống liên tục
    laserY.value = 0.15;
    laserY.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.15, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Phát âm thanh Robot hướng dẫn
    speak('Chào mừng bạn đến với Camera AI nhận diện sản phẩm. Vui lòng giữ chắc thiết bị trước kệ hàng để tôi quét nhé!');

    // Kịch bản demo: sau 4.5 giây nhận diện được sản phẩm Coca-Cola
    scanTimerRef.current = setTimeout(() => {
      setScanState('detected');
      setDetectedProduct('Coca Cola Original');
      setAccuracy(98);
      boxOpacity.value = withTiming(1, { duration: 500 });

      // Robot phát tiếng nói tìm thấy sản phẩm
      speak('Tuyệt vời! Tôi đã nhận diện được Nước ép cam nguyên chất. Tôi sẽ mở chi tiết sản phẩm!');
    }, 4500);
  };

  // Nút đóng thủ công
  const handleClose = () => {
    stop();
    router.back();
  };

  // Laser style
  const laserAnimatedStyle = useAnimatedStyle(() => {
    return {
      top: `${laserY.value * 100}%`,
    };
  });

  // Bounding box style
  const boxAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: boxOpacity.value,
    };
  });

  const buttonPulseStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulseScale.value }],
    };
  });

  return (
    <View flex={1} backgroundColor="black">
      {/* 1. CAMERA BACKGROUND (Thực tế hoặc Mô phỏng) */}
      {permission?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="front"
          enableTorch={flashOn}
        />
      ) : (
        <Image
          source={{ uri: SHELF_IMAGE }}
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT}
          position="absolute"
          resizeMode="cover"
          opacity={0.85}
        />
      )}

      {/* 2. GLASSMORPHISM TOP HEADER BAR */}
      <XStack
        position="absolute"
        top={insets.top + 16}
        left={24}
        right={24}
        height={60}
        alignItems="center"
        justifyContent="space-between"
        backgroundColor="rgba(10, 30, 20, 0.65)"
        borderWidth={1}
        borderColor="rgba(16, 185, 129, 0.2)"
        borderRadius={20}
        paddingHorizontal="$4"
        zIndex={100}
        style={{ backdropFilter: 'blur(20px)' }}
      >
        <XStack gap="$3" alignItems="center">
          <Scan size={24} color="#22c55e" />
          <YStack gap="$0.5">
            <Text fontSize={16} fontWeight="bold" color="white">Tìm kiếm bằng Hình ảnh</Text>
            <Text fontSize={11} color="rgba(255,255,255,0.6)">SmartMarketBot Camera AI v2.5</Text>
          </YStack>
        </XStack>

        <XStack gap="$3">
          <Button
            size="$3.5"
            circular
            backgroundColor={flashOn ? 'rgba(34, 197, 94, 0.25)' : 'rgba(255, 255, 255, 0.08)'}
            borderWidth={1}
            borderColor={flashOn ? '#22c55e' : 'rgba(255, 255, 255, 0.1)'}
            icon={<Zap size={18} color={flashOn ? '#22c55e' : 'white'} />}
            onPress={() => setFlashOn(!flashOn)}
          />
          <Button
            size="$3.5"
            circular
            backgroundColor="rgba(255, 255, 255, 0.08)"
            borderWidth={1}
            borderColor="rgba(255, 255, 255, 0.1)"
            icon={<SettingsIcon size={18} color="white" />}
          />
        </XStack>
      </XStack>

      {/* 3. CLOSE/EXIT BUTTON AT TOP LEFT CAMERA VIEWPORT */}
      <Button
        position="absolute"
        top={insets.top + 90}
        left={32}
        size="$3.5"
        circular
        backgroundColor="rgba(0,0,0,0.5)"
        borderWidth={1}
        borderColor="rgba(255,255,255,0.2)"
        icon={<X size={18} color="white" />}
        onPress={handleClose}
        zIndex={100}
      />

      {/* 4. SCANNING VIEWPORT LAYOVER & TARGET BOUNDING BOX */}
      <View flex={1} justifyContent="center" alignItems="center">
        {/* Lớp lưới Grid mô phỏng Camera chuẩn mực */}
        <View style={StyleSheet.absoluteFill} opacity={0.15} pointerEvents="none">
          <View flex={1} borderLeftWidth={1} borderRightWidth={1} borderColor="white" marginHorizontal={SCREEN_WIDTH / 3} />
          <View flex={1} borderTopWidth={1} borderBottomWidth={1} borderColor="white" marginVertical={SCREEN_HEIGHT / 3} position="absolute" width="100%" height="100%" />
        </View>

        {/* Cửa sổ Quét trung tâm */}
        <View width={SCREEN_WIDTH * 0.7} height={SCREEN_HEIGHT * 0.65} borderWidth={2} borderColor="rgba(255,255,255,0.3)" borderRadius={24} overflow="hidden" position="relative">

          {/* Laser quét màu xanh lá neon sang trọng */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: 0,
                right: 0,
                height: 4,
                backgroundColor: '#22c55e',
                shadowColor: '#22c55e',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 1,
                shadowRadius: 15,
                elevation: 10,
              },
              laserAnimatedStyle,
            ]}
          />

          {/* Hộp Bounding Box Nhận diện Sản phẩm mô phỏng */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: '25%',
                top: '30%',
                width: '50%',
                height: '40%',
                borderWidth: 2,
                borderColor: '#22c55e',
                borderRadius: 16,
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                justifyContent: 'flex-start',
                alignItems: 'center',
                padding: 10,
              },
              boxAnimatedStyle,
            ]}
          >
            {/* Góc định hình Bounding Box */}
            <View position="absolute" top={-2} left={-2} width={15} height={15} borderLeftWidth={4} borderTopWidth={4} borderColor="#22c55e" />
            <View position="absolute" top={-2} right={-2} width={15} height={15} borderRightWidth={4} borderTopWidth={4} borderColor="#22c55e" />
            <View position="absolute" bottom={-2} left={-2} width={15} height={15} borderLeftWidth={4} borderBottomWidth={4} borderColor="#22c55e" />
            <View position="absolute" bottom={-2} right={-2} width={15} height={15} borderRightWidth={4} borderBottomWidth={4} borderColor="#22c55e" />

            {/* Nhãn nhận diện nổi bật */}
            <XStack backgroundColor="#22c55e" paddingHorizontal="$3" paddingVertical="$1.5" borderRadius={30} alignItems="center" gap="$1.5" marginTop={-22} shadowColor="#22c55e" shadowRadius={10} shadowOpacity={0.4}>
              <Sparkles size={12} color="white" />
              <Text fontSize={12} fontWeight="bold" color="white">
                {scanState === 'detected' ? `Đã nhận diện: ${detectedProduct}` : 'Đang quét sản phẩm...'}
              </Text>
            </XStack>
          </Animated.View>
        </View>
      </View>

      {/* 5. ROBOT ASSISTANT AI BUBBLE */}
      <View position="absolute" top={insets.top + 90} right={24} zIndex={100}>
        <YStack gap="$3" alignItems="flex-end">
          {/* Float Avatar Robot Cute */}
          <Card
            width={64}
            height={64}
            borderRadius={32}
            backgroundColor="rgba(255, 255, 255, 0.95)"
            justifyContent="center"
            alignItems="center"
            borderWidth={3}
            borderColor={scanState === 'detected' ? '#22c55e' : '#3b82f6'}
            shadowColor="black"
            shadowRadius={15}
            shadowOpacity={0.1}
            style={{ elevation: 6 }}
          >
            <Image
              source={LOGO_CUTE}
              width={48}
              height={48}
              resizeMode="contain"
            />
          </Card>

          {scanState === 'detected' && (
            <Animated.View entering={ZoomIn.duration(400)} exiting={FadeOutUp}>
              <Card
                backgroundColor="white"
                borderRadius={16}
                paddingHorizontal="$4"
                paddingVertical="$3"
                shadowColor="black"
                shadowRadius={10}
                shadowOpacity={0.15}
                style={{ elevation: 5 }}
                position="relative"
              >
                <Text fontSize={13} fontWeight="bold" color="#005b2b">Tìm thấy sản phẩm rồi! ✨</Text>
                {/* Mũi tên trỏ bong bóng (chỉ lên trên) */}
                <View
                  position="absolute"
                  top={-6}
                  right={20}
                  width={0}
                  height={0}
                  borderStyle="solid"
                  borderLeftWidth={6}
                  borderRightWidth={6}
                  borderBottomWidth={6}
                  borderLeftColor="transparent"
                  borderRightColor="transparent"
                  borderBottomColor="white"
                />
              </Card>
            </Animated.View>
          )}
        </YStack>
      </View>

      {/* 6. STANDARD CAMERA BOTTOM CONTROLS */}
      <View
        position="absolute"
        bottom={40}
        left={0}
        right={0}
        alignItems="center"
        justifyContent="center"
        zIndex={100}
      >
        <XStack width="100%" px="$6" justifyContent="space-between" alignItems="center">

        {/* Left: History Button */}
        <YStack alignItems="center" gap="$2" width={80}>
          <Button
            size="$4"
            circular
            backgroundColor="rgba(0, 0, 0, 0.5)"
            borderWidth={1}
            borderColor="rgba(255, 255, 255, 0.2)"
            pressStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', scale: 0.95 }}
            icon={<History size={20} color="white" />}
          />
          <Text color="white" fontSize={12} fontWeight="600" textShadowColor="black" textShadowRadius={4}>Lịch sử</Text>
        </YStack>

        {/* Center: Main Scan / Refresh Button */}
        <View position="relative" alignItems="center" justifyContent="center">
          {scanState !== 'detected' && (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: -8,
                  left: -8,
                  right: -8,
                  bottom: -8,
                  borderRadius: 50,
                  borderWidth: 3,
                  borderColor: '#22c55e',
                  opacity: 0.4,
                },
                buttonPulseStyle,
              ]}
            />
          )}
          <Button
            width={72}
            height={72}
            circular
            backgroundColor={scanState === 'scanning' ? 'transparent' : '#22c55e'}
            borderWidth={4}
            borderColor={scanState === 'scanning' ? '#22c55e' : 'white'}
            pressStyle={{ scale: 0.9 }}
            icon={<Camera size={28} color={scanState === 'scanning' ? '#22c55e' : 'white'} />}
            onPress={() => {
              if (isRobotVoiceSpeaking()) return;
              handleStartScanning();
            }}
          />
        </View>

        {/* Right: Accuracy/Status Glass Widget */}
        <YStack alignItems="center" gap="$2" width={80}>
          <Card
            backgroundColor="rgba(0,0,0,0.5)"
            borderWidth={1}
            borderColor="rgba(255,255,255,0.2)"
            borderRadius={22}
            width={44}
            height={44}
            justifyContent="center"
            alignItems="center"
          >
            <Text fontSize={14} fontWeight="900" color={scanState === 'detected' ? '#22c55e' : '#3b82f6'}>
              {scanState === 'detected' ? `${accuracy}` : '--'}
            </Text>
          </Card>
          <Text color="white" fontSize={12} fontWeight="600" textShadowColor="black" textShadowRadius={4}>
            {scanState === 'detected' ? 'Độ chính xác' : 'AI Status'}
          </Text>
        </YStack>
      </XStack>
      </View>
    </View>
  );
}
