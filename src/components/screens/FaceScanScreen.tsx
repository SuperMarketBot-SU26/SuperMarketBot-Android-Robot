import React, { useState, useEffect } from 'react';
import { View, Text, Button, YStack, XStack } from 'tamagui';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Header } from '../layout/Header';
import { useRobotVoice } from '../../hooks/useRobotVoice';
import { useRouter } from 'expo-router';
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
import { ShieldCheck, Gift, KeySquare, RotateCcw, Check, X } from 'lucide-react-native';

export default function FaceScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const { speak } = useRobotVoice();
  const router = useRouter();

  const [scanStatus, setScanStatus] = useState<'scanning' | 'success' | 'fail'>('scanning');

  const scannerLineY = useSharedValue(-130);
  const ringRotation = useSharedValue(0);
  const screenOpacity = useSharedValue(1);

  const handleSuccessNavigation = () => {
    screenOpacity.value = withTiming(0, { duration: 400 });
    setTimeout(() => {
      router.replace('/member-home' as any);
    }, 400);
  };

  useEffect(() => {
    if (permission?.granted && scanStatus === 'scanning') {
      speak('Xin chào! Vui lòng nhìn thẳng vào máy ảnh để nhận diện.');

      // Scanner line animation
      scannerLineY.value = withRepeat(
        withSequence(
          withTiming(130, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(-130, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );

      // Ring rotation animation
      ringRotation.value = withRepeat(
        withTiming(360, { duration: 4000, easing: Easing.linear }),
        -1,
        false
      );

      const timer = setTimeout(() => {
        const isSuccess = Math.random() > 0.5;
        if (isSuccess) {
          setScanStatus('success');
          speak('Nhận diện thành công. Chào mừng bạn đến với Smart Market Bot!');
          setTimeout(() => {
            handleSuccessNavigation();
          }, 1500);
        } else {
          setScanStatus('fail');
          speak('Không thể nhận diện khuôn mặt. Vui lòng thử lại.');
        }
      }, 4000);

      return () => clearTimeout(timer);
    } else {
      // Dừng animation để tránh kẹt CPU gây ANR (App Not Responding)
      cancelAnimation(scannerLineY);
      cancelAnimation(ringRotation);
    }
  }, [permission, scanStatus]);

  const scannerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scannerLineY.value }]
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringRotation.value}deg` }]
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

  const primaryColor = isFail ? '#ff3b30' : '#00A550';
  const ringBorderColor = isFail ? 'rgba(255, 59, 48, 0.3)' : 'rgba(0, 165, 80, 0.3)';

  return (
    <Animated.View style={containerStyle}>

      <View position="absolute" top={0} left={0} right={0} bottom={0} backgroundColor={isFail ? "#ffe6e6" : "#e6f0eb"} opacity={0.3} zIndex={0} />

      <Header />

      {/* Layout chia 3 cột để Camera nằm chính giữa (Center Focus) */}
      <XStack flex={1} paddingHorizontal="$4" alignItems="center" justifyContent="space-between" width="100%">

        {/* CỘT TRÁI: NỘI DUNG CHÀO MỪNG / THÔNG BÁO */}
        <YStack flex={1} gap="$2" alignItems="flex-end" paddingRight="$6">
          {isScanning && (
            <>
              <Text fontSize={28} fontWeight="bold" color="$textPrimary" textAlign="right">Xin chào!</Text>
              <Text fontSize={15} color="$textSecondary" textAlign="right">Đứng trước máy ảnh để bắt đầu hành trình mua sắm thông minh của bạn.</Text>
            </>
          )}
          {isSuccess && (
            <>
              <Text fontSize={28} fontWeight="bold" color="#00A550" textAlign="right">Thành công!</Text>
              <Text fontSize={15} color="$textSecondary" textAlign="right">Khuôn mặt của bạn đã được nhận diện. Chúc bạn mua sắm vui vẻ.</Text>
            </>
          )}
          {isFail && (
            <>
              <Text fontSize={28} fontWeight="bold" color="#3a3333ff" textAlign="right">Thất bại</Text>
              <Text fontSize={15} color="$textSecondary" textAlign="right">Không thể nhận diện khuôn mặt. Vui lòng thử lại hoặc dùng mã PIN.</Text>
            </>
          )}
        </YStack>

        {/* CỘT GIỮA: CAMERA VIEW */}
        <View position="relative" width={280} height={280} justifyContent="center" alignItems="center">

          <Animated.View style={[{ position: 'absolute', width: 300, height: 300, borderRadius: 150, borderWidth: 3, borderColor: ringBorderColor, borderTopColor: primaryColor }, ringStyle]} />

          <View width={260} height={260} borderRadius={130} overflow="hidden" position="relative" backgroundColor="black" shadowColor={primaryColor} shadowOffset={{ width: 0, height: 10 }} shadowOpacity={0.3} shadowRadius={20}>

            {/* Render Camera liên tục để làm background */}
            <CameraView style={{ flex: 1 }} facing="front" />

            {isScanning && (
              <>
                <View position="absolute" top={0} left={0} right={0} bottom={0} backgroundColor="rgba(0,0,0,0.1)" />
                <Animated.View style={[{ position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#00A550', shadowColor: '#00A550', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 10, elevation: 5 }, scannerStyle]} />
              </>
            )}

            {isSuccess && (
              <View position="absolute" top={0} left={0} right={0} bottom={0} backgroundColor="transparent" justifyContent="center" alignItems="center">
                <Animated.View entering={ZoomIn.duration(500).springify()}>
                  <View width={90} height={90} borderRadius={45} backgroundColor="white" justifyContent="center" alignItems="center" shadowColor="#00A550" shadowOpacity={0.3} shadowRadius={20} style={{ elevation: 5 }}>
                    <Check size={50} color="#00A550" strokeWidth={3} />
                  </View>
                </Animated.View>
              </View>
            )}

            {isFail && (
              <View position="absolute" top={0} left={0} right={0} bottom={0} backgroundColor="transparent" justifyContent="center" alignItems="center">
                <Animated.View entering={ZoomIn.duration(500).springify()}>
                  <View width={90} height={90} borderRadius={45} backgroundColor="white" justifyContent="center" alignItems="center" shadowColor="#ff3b30" shadowOpacity={0.3} shadowRadius={20} style={{ elevation: 5 }}>
                    <X size={50} color="#ff3b30" strokeWidth={3} />
                  </View>
                </Animated.View>
              </View>
            )}
          </View>

          {isScanning && (
            <>
              <View position="absolute" top={-15} backgroundColor="white" paddingHorizontal="$4" paddingVertical="$2" borderRadius={20} shadowColor="black" shadowOpacity={0.1} shadowRadius={10} style={{ elevation: 3 }}>
                <XStack alignItems="center" gap="$2">
                  <ShieldCheck size={16} color="#00A550" />
                  <Text fontSize={12} color="$textSecondary" fontWeight="600">Bảo mật tuyệt đối</Text>
                </XStack>
              </View>
            </>
          )}
        </View>

        {/* CỘT PHẢI: NÚT BẤM ĐIỀU HƯỚNG */}
        <YStack flex={1} gap="$4" alignItems="flex-start" paddingLeft="$6">
          {isScanning && (
            <>
              <Button variant="outlined" borderRadius={30} paddingHorizontal="$6" size="$4" onPress={() => router.back()}>
                <Text color="$textSecondary">Hủy & Quay lại</Text>
              </Button>
            </>
          )}

          {isSuccess && (
            <Button backgroundColor="#00A550" borderRadius={30} paddingHorizontal="$6" size="$4" iconAfter={<Gift size={18} color="white" />} onPress={handleSuccessNavigation}>
              <Text color="white" fontWeight="bold">Bắt đầu mua sắm</Text>
            </Button>
          )}

          {isFail && (
            <>
              <Button backgroundColor="#ff3b30" borderRadius={30} paddingHorizontal="$6" size="$4" iconAfter={<RotateCcw size={18} color="white" />} onPress={() => setScanStatus('scanning')}>
                <Text color="white" fontWeight="bold">Quét lại ngay</Text>
              </Button>
              <Button variant="outlined" borderColor="#00A550" borderRadius={30} paddingHorizontal="$6" size="$4" iconAfter={<KeySquare size={18} color="#00A550" />} onPress={() => { }}>
                <Text color="#00A550" fontWeight="bold">Dùng mã PIN</Text>
              </Button>
              <Button backgroundColor="transparent" borderRadius={30} paddingHorizontal="$6" onPress={() => router.back()}>
                <Text color="$textSecondary">Hủy thao tác</Text>
              </Button>
            </>
          )}
        </YStack>

      </XStack>

    </Animated.View>
  );
}
