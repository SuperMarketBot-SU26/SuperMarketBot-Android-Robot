import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Button, YStack, XStack } from 'tamagui';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Header } from '../layout/Header';
import { useRobotVoice } from '../../hooks/useRobotVoice';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  cancelAnimation,
  ZoomIn
} from 'react-native-reanimated';
import { ShieldCheck, Gift, RotateCcw, UserX, Camera } from 'lucide-react-native';
import { loginFace } from '../../services/AuthService';
import { useRobotAuth } from '../../context/RobotAuthContext';

export default function FaceScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const { speak } = useRobotVoice();
  const router = useRouter();
  const { setSession } = useRobotAuth();
  const cameraRef = useRef<CameraView>(null);

  const [scanStatus, setScanStatus] = useState<'scanning' | 'processing' | 'success' | 'fail'>('scanning');
  const [greeting, setGreeting] = useState<string>('');

  const scannerLineY = useSharedValue(-130);
  const ringRotation = useSharedValue(0);
  const screenOpacity = useSharedValue(1);
  const shakeOffset = useSharedValue(0);
  const flashOpacity = useSharedValue(0);

  const captureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTimers = useCallback(() => {
    if (captureTimer.current) { clearTimeout(captureTimer.current); captureTimer.current = null; }
    if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null; }
  }, []);

  const hasSpokenGreeting = useRef(false);

  const startCapture = useCallback((delay = 0) => {
    const run = () => {
      setScanStatus('scanning');
      captureTimer.current = setTimeout(() => {
        captureTimer.current = null;
        handleCapture();
      }, 1200);
    };
    if (delay > 0) {
      retryTimer.current = setTimeout(run, delay);
    } else {
      run();
    }
  }, []);

  const handleSuccessNavigation = () => {
    screenOpacity.value = withTiming(0, { duration: 400 });
    setTimeout(() => {
      router.replace('/member-home' as any);
    }, 400);
  };

  // Start scan animations when camera is ready
  useEffect(() => {
    if (permission?.granted) {
      if (!hasSpokenGreeting.current) {
        speak('Xin chào! Vui lòng nhìn thẳng vào máy ảnh để nhận diện.');
        hasSpokenGreeting.current = true;
      }

      if (scanStatus === 'scanning' || scanStatus === 'processing') {
        scannerLineY.value = withRepeat(
          withSequence(
            withTiming(130, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
            withTiming(-130, { duration: 1500, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        );

        ringRotation.value = withRepeat(
          withTiming(360, { duration: 4000, easing: Easing.linear }),
          -1,
          false
        );
      } else {
        cancelAnimation(scannerLineY);
        cancelAnimation(ringRotation);
      }
    }
  }, [permission, scanStatus]);

  // Initial capture start
  useEffect(() => {
    if (permission?.granted && scanStatus === 'scanning' && !captureTimer.current && !retryTimer.current) {
      startCapture(1000);
    }
  }, [permission]);

  useEffect(() => () => stopTimers(), []);

  const handleCapture = async () => {
    if (!cameraRef.current) return;

    setScanStatus('processing');
    console.log('[FaceScanScreen] Bắt đầu chụp ảnh khuôn mặt...');

    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.6, shutterSound: false });

      if (!photo?.base64) {
        console.error('[FaceScanScreen] Lỗi: Không thể chụp ảnh từ Camera');
        throw new Error('Không thể chụp ảnh');
      }

      console.log(`[FaceScanScreen] Đã chụp ảnh xong (Base64 length: ${photo.base64.length}). Gọi AuthService.loginFace...`);
      const data = await loginFace(photo.base64);

      if (!data.success || !data.token) {
        // Face not recognized
        console.warn('[FaceScanScreen] Đăng nhập thất bại: Model không nhận ra khuôn mặt hoặc token rỗng');
        setScanStatus('fail');
        startCapture(2500);
        shakeOffset.value = withSequence(
          withTiming(15, { duration: 50 }),
          withTiming(-15, { duration: 50 }),
          withTiming(15, { duration: 50 }),
          withTiming(-15, { duration: 50 }),
          withTiming(10, { duration: 50 }),
          withTiming(-10, { duration: 50 }),
          withTiming(0, { duration: 50 })
        );
        return;
      }

      // Check role — chỉ cho phép 'Member'
      const roles: string[] = data.token.roles || [];
      console.log(`[FaceScanScreen] Đăng nhập thành công! User roles: ${JSON.stringify(roles)}`);
      
      if (!roles.includes('Member')) {
        console.error(`[FaceScanScreen] Lỗi phân quyền: Không có role Member. Roles hiện tại: ${roles.join(', ')}`);
        setScanStatus('fail');
        speak('Tài khoản này không có quyền truy cập.');
        startCapture(2500);
        return;
      }

      // Save session
      console.log(`[FaceScanScreen] Lưu session và chuyển hướng...`);
      setSession(data.token.accessToken, {
        memberId: data.token.userId,
        fullName: data.token.fullName,
        email: data.token.email,
        membershipLevel: data.member?.membershipLevel ?? null,
      });

      const welcomeMsg = data.greeting || `Chào mừng ${data.token.fullName || 'bạn'} đến với Smart Market Bot!`;
      setGreeting(welcomeMsg);
      setScanStatus('success');
      speak(welcomeMsg);

      // Soft white flash — nhẹ nhàng như AI scan
      flashOpacity.value = withSequence(
        withTiming(0.55, { duration: 100, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 650, easing: Easing.in(Easing.quad) }),
      );

      setTimeout(() => {
        handleSuccessNavigation();
      }, 1800);

    } catch (error: any) {
      console.warn('[FaceScanScreen] Đã có lỗi xảy ra trong catch block:', error.message || error);
      setScanStatus('fail');
      startCapture(2500);
    }
  };

  const scannerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scannerLineY.value }]
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringRotation.value}deg` }]
  }));

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeOffset.value }]
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#fcfdfd'
  }));

  if (!permission) {
    return <View flex={1} backgroundColor="white" />;
  }

  if (!permission.granted) {
    return (
      <View flex={1} justifyContent="center" alignItems="center" backgroundColor="white">
        <Text fontSize={18} marginBottom="$4">Chúng tôi cần quyền truy cập Camera để nhận diện</Text>
        <Button onPress={requestPermission} backgroundColor="#00A550" color="white">
          Cấp quyền Camera
        </Button>
      </View>
    );
  }

  const isFail = scanStatus === 'fail';
  const isSuccess = scanStatus === 'success';
  const isScanning = scanStatus === 'scanning';
  const isProcessing = scanStatus === 'processing';

  const primaryColor = isFail ? '#ff3b30' : '#00A550';
  const ringBorderColor = isFail ? 'rgba(255, 59, 48, 0.3)' : 'rgba(0, 165, 80, 0.3)';

  return (
    <Animated.View style={containerStyle}>

      <View position="absolute" top={0} left={0} right={0} bottom={0} backgroundColor={isFail ? "#ffe6e6" : "#e6f0eb"} opacity={0.3} zIndex={0} />

      <Header />

      <YStack flex={1} paddingBottom="$10" paddingTop="$4" paddingHorizontal="$4" alignItems="center" justifyContent="space-between" width="100%">

        {/* Status messages */}
        <YStack gap="$2" alignItems="center">
          {(isScanning || isProcessing) && (
            <>
              <Text fontSize={28} fontWeight="bold" color="$textPrimary" textAlign="center">Xin chào!</Text>
              <Text fontSize={15} color="$textSecondary" textAlign="center">
                {isProcessing ? 'Đang nhận diện khuôn mặt...' : 'Đứng trước máy ảnh để bắt đầu hành trình mua sắm thông minh.'}
              </Text>
            </>
          )}
          {isSuccess && (
            <>
              <Text fontSize={28} fontWeight="bold" color="#00A550" textAlign="center">Thành công!</Text>
              <Text fontSize={15} color="$textSecondary" textAlign="center">{greeting || 'Chúc bạn mua sắm vui vẻ.'}</Text>
            </>
          )}
          {isFail && (
            <>
              <Text fontSize={28} fontWeight="bold" color="#3a3333ff" textAlign="center">Thất bại</Text>
              <Text fontSize={15} color="$textSecondary" textAlign="center">Không thể nhận diện. Vui lòng thử lại.</Text>
            </>
          )}
        </YStack>

        {/* Camera View */}
        <Animated.View style={shakeStyle}>
          <View position="relative" width={360} height={360} justifyContent="center" alignItems="center">

            <Animated.View style={[{ position: 'absolute', width: 380, height: 380, borderRadius: 190, borderWidth: 3, borderColor: ringBorderColor, borderTopColor: primaryColor }, ringStyle]} />

            <View width={340} height={340} borderRadius={170} overflow="hidden" position="relative" backgroundColor="black" shadowColor={primaryColor} shadowOffset={{ width: 0, height: 10 }} shadowOpacity={0.3} shadowRadius={20}>

              {/* Camera always rendered as background */}
              <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />

              {(isScanning || isProcessing) && (
                <>
                  <View position="absolute" top={0} left={0} right={0} bottom={0} backgroundColor="rgba(0,0,0,0.1)" />
                  {isScanning && (
                    <Animated.View style={[{ position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#00A550', shadowColor: '#00A550', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 10, elevation: 5 }, scannerStyle]} />
                  )}
                  {isProcessing && (
                    <View position="absolute" top={0} left={0} right={0} bottom={0} backgroundColor="rgba(0,165,80,0.15)" justifyContent="center" alignItems="center" />
                  )}
                </>
              )}

              {isSuccess && (
                <View position="absolute" top={0} left={0} right={0} bottom={0} backgroundColor="rgba(0,165,80,0.25)" justifyContent="center" alignItems="center" />
              )}

              {isFail && (
                <View position="absolute" top={0} left={0} right={0} bottom={0} backgroundColor="rgba(255,59,48,0.25)" justifyContent="center" alignItems="center" />
              )}

              {/* Soft white flash overlay */}
              <Animated.View
                style={[
                  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white' },
                  flashStyle
                ]}
                pointerEvents="none"
              />
            </View>

            {isScanning && (
              <View position="absolute" top={-15} backgroundColor="white" paddingHorizontal="$4" paddingVertical="$2" borderRadius={20} shadowColor="black" shadowOpacity={0.1} shadowRadius={10} style={{ elevation: 3 }}>
                <XStack alignItems="center" gap="$2">
                  <ShieldCheck size={16} color="#00A550" />
                  <Text fontSize={12} color="$textSecondary" fontWeight="600">Bảo mật tuyệt đối</Text>
                </XStack>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Action buttons */}
        <YStack width="100%" gap="$4" alignItems="center">
          {isScanning && (
            <>
              <Button variant="outlined" borderRadius={30} paddingHorizontal="$6" size="$4" onPress={() => { stopTimers(); router.back(); }}>
                <Text color="$textSecondary">Hủy &amp; Quay lại</Text>
              </Button>
            </>
          )}

          {isProcessing && (
            <Button disabled borderRadius={30} paddingHorizontal="$6" size="$4" backgroundColor="#00A550" opacity={0.6}>
              <Text color="white">Đang xử lý...</Text>
            </Button>
          )}

          {isSuccess && (
            <Button backgroundColor="#00A550" borderRadius={30} paddingHorizontal="$6" size="$4" iconAfter={<Gift size={18} color="white" />} onPress={handleSuccessNavigation}>
              <Text color="white" fontWeight="bold">Bắt đầu mua sắm</Text>
            </Button>
          )}

          {isFail && (
            <>
              <Button backgroundColor="transparent" borderRadius={30} paddingHorizontal="$6" onPress={() => { stopTimers(); router.back(); }}>
                <Text color="$textSecondary">Hủy thao tác</Text>
              </Button>
            </>
          )}
        </YStack>

      </YStack>

    </Animated.View>
  );
}
