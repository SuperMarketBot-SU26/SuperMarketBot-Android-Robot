import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import { View, Text, XStack, YStack, Button, Image, Card } from 'tamagui';
import { Camera, X, Zap, Settings as SettingsIcon, Sparkles, Scan, History } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  FadeOutUp,
  ZoomIn,
} from 'react-native-reanimated';
import { useRobotVoice, isRobotVoiceSpeaking } from '../../hooks/useRobotVoice';
import { useRouter } from 'expo-router';

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
      speak('Tuyệt vời! Tôi đã nhận diện được Nước ép cam nguyên chất tại Kệ số 2 dãy C, có giá ưu đãi là 38.000 đồng. Tôi sẽ mở chi tiết sản phẩm và bản đồ dẫn đường cho bạn ngay đây!');
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
          facing="back"
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

      {/* 5. ROBOT ASSISTANT AI BUBBLE ON BOTTOM RIGHT */}
      <View position="absolute" bottom={110} right={40} zIndex={100}>
        <XStack gap="$3" alignItems="center">
          {scanState === 'detected' && (
            <Animated.View entering={ZoomIn.duration(400)} exiting={FadeOutUp}>
              <Card
                backgroundColor="white"
                borderRadius={16}
                paddingHorizontal="$4"
                paddingVertical="$2"
                shadowColor="black"
                shadowRadius={10}
                shadowOpacity={0.15}
                style={{ elevation: 5 }}
                position="relative"
              >
                <Text fontSize={13} fontWeight="bold" color="#005b2b">Tìm thấy sản phẩm rồi! ✨</Text>
                {/* Mũi tên trỏ bong bóng */}
                <View
                  position="absolute"
                  bottom={12}
                  right={-8}
                  width={0}
                  height={0}
                  borderStyle="solid"
                  borderLeftWidth={8}
                  borderTopWidth={6}
                  borderBottomWidth={6}
                  borderLeftColor="white"
                  borderTopColor="transparent"
                  borderBottomColor="transparent"
                />
              </Card>
            </Animated.View>
          )}

          {/* Float Avatar Robot Cute */}
          <Card
            width={72}
            height={72}
            borderRadius={36}
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
              width={54}
              height={54}
              resizeMode="contain"
            />
          </Card>
        </XStack>
      </View>

      {/* 6. GLASSMORPHISM BOTTOM CONTROL PANEL */}
      <XStack
        position="absolute"
        bottom={24}
        left={24}
        right={24}
        height={84}
        alignItems="center"
        justifyContent="space-between"
        backgroundColor="rgba(10, 25, 15, 0.7)"
        borderWidth={1}
        borderColor="rgba(16, 185, 129, 0.2)"
        borderRadius={24}
        paddingHorizontal="$6"
        zIndex={100}
        style={{ backdropFilter: 'blur(20px)' }}
      >
        {/* Left: History Button */}
        <Button
          size="$4"
          backgroundColor="rgba(255, 255, 255, 0.08)"
          borderWidth={1}
          borderColor="rgba(255, 255, 255, 0.12)"
          borderRadius={30}
          paddingHorizontal="$5"
          pressStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', scale: 0.95 }}
          icon={<History size={18} color="white" />}
        >
          <Text color="white" fontWeight="bold" fontSize={13}>Lịch sử quét</Text>
        </Button>

        {/* Center: Main Scan / Refresh Button */}
        <View position="relative">
          {scanState !== 'detected' && (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: -6,
                  left: -6,
                  right: -6,
                  bottom: -6,
                  borderRadius: 36,
                  borderWidth: 2,
                  borderColor: '#22c55e',
                  opacity: 0.4,
                },
                buttonPulseStyle,
              ]}
            />
          )}
          <Button
            size="$5"
            backgroundColor="#22c55e"
            borderRadius={30}
            paddingHorizontal="$7"
            pressStyle={{ backgroundColor: '#16a34a', scale: 0.95 }}
            icon={<Camera size={22} color="white" />}
            onPress={() => {
              if (isRobotVoiceSpeaking()) return; // Khóa điều hướng/click khi giọng đang chạy
              handleStartScanning();
            }}
          >
            <Text color="white" fontWeight="bold" fontSize={15}>
              {scanState === 'scanning' ? 'Đang phân tích...' : 'Chụp/Quét lại'}
            </Text>
          </Button>
        </View>

        {/* Right: Accuracy/Status Glass Widget */}
        <Card
          backgroundColor="rgba(255,255,255,0.06)"
          borderWidth={1}
          borderColor="rgba(255,255,255,0.1)"
          borderRadius={18}
          paddingHorizontal="$4"
          paddingVertical="$2"
          alignItems="center"
          gap="$1"
        >
          <Text fontSize={10} color="rgba(255,255,255,0.5)" fontWeight="bold">AI CONFIDENCE</Text>
          <Text fontSize={16} fontWeight="bold" color={scanState === 'detected' ? '#22c55e' : '#3b82f6'}>
            {scanState === 'detected' ? `${accuracy}% ACC` : 'SCANNING'}
          </Text>
        </Card>
      </XStack>
    </View>
  );
}
