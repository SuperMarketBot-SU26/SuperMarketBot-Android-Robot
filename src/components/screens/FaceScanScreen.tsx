import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Button, YStack, XStack } from 'tamagui';
/* eslint-disable react-hooks/immutability */
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Header } from '../layout/Header';
import { useRobotVoice } from '../../hooks/useRobotVoice';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Alert, useWindowDimensions, Modal, Pressable } from 'react-native';
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
import { ShieldCheck, Gift, RotateCcw, UserX, Camera, Smartphone, RefreshCw, User, QrCode } from 'lucide-react-native';
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
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [showFallbackModal, setShowFallbackModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const { width: windowWidth } = useWindowDimensions();
  const cameraSize = Math.min(Math.round(windowWidth * 0.68), 270);
  const outerRingSize = cameraSize + 24;
  const scanRange = Math.round(cameraSize * 0.36);

  const scannerLineY = useSharedValue(-scanRange);
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

  const params = useLocalSearchParams<{ returnUrl?: string }>();

  const handleSuccessNavigation = () => {
    screenOpacity.value = withTiming(0, { duration: 400 });
    setTimeout(() => {
      if (params.returnUrl) {
        router.replace(params.returnUrl as any);
      } else {
        router.replace('/member-home' as any);
      }
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
            withTiming(scanRange, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
            withTiming(-scanRange, { duration: 1500, easing: Easing.inOut(Easing.ease) })
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
  }, [permission, scanStatus, scanRange]);

  // Initial capture start
  useEffect(() => {
    if (permission?.granted && isCameraReady && scanStatus === 'scanning' && !captureTimer.current && !retryTimer.current) {
      startCapture(1000);
    }
  }, [permission, isCameraReady]);

  useEffect(() => () => stopTimers(), []);

  const handleCapture = async () => {
    if (!cameraRef.current) return;

    setScanStatus('processing');
    console.log('[FaceScanScreen] Bắt đầu chụp ảnh khuôn mặt...');

    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.35, shutterSound: false });

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
        setFailCount((prev) => {
          const next = prev + 1;
          if (next >= 2) {
            stopTimers();
            setShowFallbackModal(true);
            speak('Chưa nhận diện được thành viên. Bạn vui lòng thử quét lại hoặc đăng ký tài khoản trên ứng dụng nhé.');
          } else {
            startCapture(2500);
          }
          return next;
        });
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

      // Reset fail count on success
      setFailCount(0);

      // Save session
      console.log(`[FaceScanScreen] Lưu session và chuyển hướng...`);
      setSession(data.token.accessToken, {
        memberId: data.member?.memberId || data.token.userId,
        fullName: data.token.fullName,
        email: data.token.email,
        membershipLevel: data.member?.membershipLevel ?? null,
        shoppingBudget: data.member?.shoppingBudget ?? 1000000,
        avatarUrl: data.member?.avatarUrl || data.token?.avatarUrl || undefined,
      });

      const welcomeMsg = data.greeting || `Chào mừng ${data.token.fullName || 'bạn'} đến với Smart Market Bot!`;
      setGreeting(welcomeMsg);
      setScanStatus('success');

      // Soft white flash — nhẹ nhàng như AI scan
      flashOpacity.value = withSequence(
        withTiming(0.55, { duration: 100, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 650, easing: Easing.in(Easing.quad) }),
      );

      // Chờ đọc xong toàn bộ lời chào mới chuyển trang (có fallback tối đa 7.5s phòng lỗi âm thanh)
      let hasNavigated = false;
      const doNavigate = () => {
        if (hasNavigated) return;
        hasNavigated = true;
        handleSuccessNavigation();
      };

      const maxWaitTime = Math.max(4000, Math.min(welcomeMsg.length * 80, 7500));
      const fallbackTimer = setTimeout(doNavigate, maxWaitTime);

      speak(welcomeMsg, () => {
        clearTimeout(fallbackTimer);
        setTimeout(doNavigate, 400);
      });

    } catch (error: any) {
      console.warn('[FaceScanScreen] Đã có lỗi xảy ra trong catch block:', error.message || error);
      setScanStatus('fail');
      setFailCount((prev) => {
        const next = prev + 1;
        if (next >= 2) {
          stopTimers();
          setShowFallbackModal(true);
        } else {
          startCapture(2500);
        }
        return next;
      });
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

      <YStack flex={1} paddingBottom="$8" paddingTop="$3" paddingHorizontal="$4" alignItems="center" justifyContent="space-between" width="100%">

        {/* Status messages */}
        <YStack gap="$1.5" alignItems="center" width="100%">
          {(isScanning || isProcessing) && (
            <>
              <Text fontSize={24} fontWeight="bold" color="$textPrimary" textAlign="center">Xin chào!</Text>
              <Text fontSize={13.5} color="$textSecondary" textAlign="center" paddingHorizontal="$2" lineHeight={19}>
                {isProcessing ? 'Đang nhận diện khuôn mặt...' : 'Đứng trước máy ảnh để bắt đầu hành trình mua sắm thông minh.'}
              </Text>
            </>
          )}
          {isSuccess && (
            <>
              <Text fontSize={24} fontWeight="bold" color="#00A550" textAlign="center">Thành công!</Text>
              <Text fontSize={13.5} color="$textSecondary" textAlign="center" paddingHorizontal="$2" lineHeight={19}>{greeting || 'Chúc bạn mua sắm vui vẻ.'}</Text>
            </>
          )}
          {isFail && (
            <>
              <Text fontSize={24} fontWeight="bold" color="#dc2626" textAlign="center">Thất bại</Text>
              <Text fontSize={13.5} color="$textSecondary" textAlign="center" paddingHorizontal="$2" lineHeight={19}>Không thể nhận diện. Vui lòng thử lại.</Text>
            </>
          )}
        </YStack>

        {/* Camera View */}
        <Animated.View style={shakeStyle}>
          <View position="relative" width={outerRingSize} height={outerRingSize} justifyContent="center" alignItems="center">

            <Animated.View style={[{ position: 'absolute', width: outerRingSize, height: outerRingSize, borderRadius: outerRingSize / 2, borderWidth: 3, borderColor: ringBorderColor, borderTopColor: primaryColor }, ringStyle]} />

            <View width={cameraSize} height={cameraSize} borderRadius={cameraSize / 2} overflow="hidden" position="relative" backgroundColor="black" shadowColor={primaryColor} shadowOffset={{ width: 0, height: 8 }} shadowOpacity={0.3} shadowRadius={16}>

              {/* Camera always rendered as background */}
              <CameraView 
                ref={cameraRef} 
                style={{ flex: 1 }} 
                facing="front" 
                onCameraReady={() => setIsCameraReady(true)}
              />

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
              <View position="absolute" top={-12} backgroundColor="white" paddingHorizontal="$3.5" paddingVertical="$1.5" borderRadius={20} shadowColor="black" shadowOpacity={0.1} shadowRadius={8} style={{ elevation: 3 }}>
                <XStack alignItems="center" gap="$1.5">
                  <ShieldCheck size={14} color="#00A550" />
                  <Text fontSize={11} color="$textSecondary" fontWeight="600">Bảo mật tuyệt đối</Text>
                </XStack>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Action buttons */}
        <YStack width="100%" gap="$3" alignItems="center">
          {isScanning && (
            <>
              <Button variant="outlined" borderRadius={30} paddingHorizontal="$5" size="$3.5" onPress={() => { stopTimers(); router.back(); }}>
                <Text color="$textSecondary" fontSize={13}>Hủy &amp; Quay lại</Text>
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

      {/* Modal hướng dẫn khi Face ID thất bại nhiều lần */}
      <Modal
        visible={showFallbackModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFallbackModal(false)}
      >
        <View
          flex={1}
          backgroundColor="rgba(0,0,0,0.6)"
          justifyContent="center"
          alignItems="center"
          paddingHorizontal="$4"
        >
          <View
            backgroundColor="white"
            borderRadius={24}
            paddingVertical="$5"
            paddingHorizontal="$5"
            width="100%"
            maxWidth={360}
            alignItems="center"
            shadowColor="#000"
            shadowOffset={{ width: 0, height: 10 }}
            shadowOpacity={0.25}
            shadowRadius={20}
            style={{ elevation: 10 }}
          >
            <View
              width={64}
              height={64}
              borderRadius={32}
              backgroundColor="#fee2e2"
              justifyContent="center"
              alignItems="center"
              marginBottom="$3"
            >
              <UserX size={32} color="#dc2626" />
            </View>

            <Text fontSize={18} fontWeight="800" color="#0f172a" textAlign="center" marginBottom="$1.5">
              Chưa Nhận Diện Được
            </Text>
            <Text fontSize={13} color="#64748b" textAlign="center" lineHeight={19} marginBottom="$5">
              Khuôn mặt chưa khớp với tài khoản thành viên nào. Bạn đã đăng ký tài khoản trên ứng dụng di động chưa?
            </Text>

            <YStack width="100%" gap="$2.5">
              <Button
                backgroundColor="#00A550"
                pressStyle={{ opacity: 0.85 }}
                borderRadius={14}
                height={46}
                icon={<RefreshCw size={17} color="white" />}
                onPress={() => {
                  setShowFallbackModal(false);
                  setFailCount(0);
                  startCapture(500);
                }}
              >
                <Text color="white" fontWeight="700" fontSize={14}>Thử quét lại</Text>
              </Button>

              <Button
                backgroundColor="#f1f5f9"
                pressStyle={{ opacity: 0.85 }}
                borderRadius={14}
                height={46}
                borderWidth={1}
                borderColor="#e2e8f0"
                icon={<Smartphone size={17} color="#0f172a" />}
                onPress={() => {
                  setShowFallbackModal(false);
                  setShowQrModal(true);
                }}
              >
                <Text color="#0f172a" fontWeight="700" fontSize={14}>Đăng ký thành viên mới</Text>
              </Button>

              <Button
                backgroundColor="transparent"
                pressStyle={{ opacity: 0.7 }}
                borderRadius={14}
                height={42}
                icon={<User size={16} color="#64748b" />}
                onPress={() => {
                  stopTimers();
                  setShowFallbackModal(false);
                  router.replace('/guest-home');
                }}
              >
                <Text color="#64748b" fontWeight="600" fontSize={13.5}>Tiếp tục là Khách Vãng Lai</Text>
              </Button>
            </YStack>
          </View>
        </View>
      </Modal>

      {/* Modal hướng dẫn đăng ký qua Mobile App */}
      <Modal
        visible={showQrModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQrModal(false)}
      >
        <View
          flex={1}
          backgroundColor="rgba(0,0,0,0.6)"
          justifyContent="center"
          alignItems="center"
          paddingHorizontal="$4"
        >
          <View
            backgroundColor="white"
            borderRadius={24}
            paddingVertical="$5"
            paddingHorizontal="$5"
            width="100%"
            maxWidth={360}
            alignItems="center"
            shadowColor="#000"
            shadowOffset={{ width: 0, height: 10 }}
            shadowOpacity={0.25}
            shadowRadius={20}
            style={{ elevation: 10 }}
          >
            <View
              width={60}
              height={60}
              borderRadius={30}
              backgroundColor="#e0f2fe"
              justifyContent="center"
              alignItems="center"
              marginBottom="$3"
            >
              <Smartphone size={30} color="#0284c7" />
            </View>

            <Text fontSize={18} fontWeight="800" color="#0f172a" textAlign="center" marginBottom="$1.5">
              Đăng Ký Trên Di Động
            </Text>
            <Text fontSize={13} color="#64748b" textAlign="center" lineHeight={19} marginBottom="$4">
              Để bảo mật thông tin cá nhân và chụp ảnh khuôn mặt đa góc độ, bạn vui lòng mở ứng dụng di động Smart Market để đăng ký nhé.
            </Text>

            <View
              backgroundColor="#f8fafc"
              borderRadius={16}
              padding="$3.5"
              width="100%"
              borderWidth={1}
              borderColor="#e2e8f0"
              marginBottom="$4"
            >
              <YStack gap="$2">
                <XStack gap="$2" alignItems="flex-start">
                  <Text fontSize={13} fontWeight="700" color="#00A550">1.</Text>
                  <Text fontSize={12.5} color="#334155" flex={1}>Mở App Smart Market trên điện thoại</Text>
                </XStack>
                <XStack gap="$2" alignItems="flex-start">
                  <Text fontSize={13} fontWeight="700" color="#00A550">2.</Text>
                  <Text fontSize={12.5} color="#334155" flex={1}>Chọn Đăng Ký và điền thông tin cá nhân</Text>
                </XStack>
                <XStack gap="$2" alignItems="flex-start">
                  <Text fontSize={13} fontWeight="700" color="#00A550">3.</Text>
                  <Text fontSize={12.5} color="#334155" flex={1}>Chụp Face ID để đăng nhập tự động tại Robot</Text>
                </XStack>
              </YStack>
            </View>

            <YStack width="100%" gap="$2">
              <Button
                backgroundColor="#00A550"
                borderRadius={14}
                height={46}
                onPress={() => {
                  setShowQrModal(false);
                  setFailCount(0);
                  startCapture(500);
                }}
              >
                <Text color="white" fontWeight="700" fontSize={14}>Tôi đã có tài khoản, quét lại</Text>
              </Button>

              <Button
                backgroundColor="#f1f5f9"
                borderRadius={14}
                height={44}
                onPress={() => {
                  stopTimers();
                  setShowQrModal(false);
                  router.replace('/guest-home');
                }}
              >
                <Text color="#475569" fontWeight="600" fontSize={13.5}>Mua sắm là Khách</Text>
              </Button>
            </YStack>
          </View>
        </View>
      </Modal>

    </Animated.View>
  );
}
