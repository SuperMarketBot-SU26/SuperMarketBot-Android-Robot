import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSequence, 
  Easing 
} from 'react-native-reanimated';

interface RobotFaceProps {
  size?: number;
}

export default function RobotFace({ size = 200 }: RobotFaceProps) {
  const eyeScaleY = useSharedValue(1);
  const eyeTranslateX = useSharedValue(0);
  const eyeTranslateY = useSharedValue(0);

  useEffect(() => {
    let blinkTimeout: ReturnType<typeof setTimeout>;
    let lookTimeout: ReturnType<typeof setTimeout>;

    // Chớp mắt ngẫu nhiên
    const blink = () => {
      eyeScaleY.value = withSequence(
        withTiming(0.1, { duration: 80 }),
        withTiming(1, { duration: 120 })
      );
      blinkTimeout = setTimeout(blink, Math.random() * 4000 + 1500); // 1.5s - 5.5s
    };
    blink();

    // Đảo mắt nhìn xung quanh ngẫu nhiên
    const lookAround = () => {
      const lookX = (Math.random() - 0.5) * (size * 0.15); // Di chuyển X
      const lookY = (Math.random() - 0.5) * (size * 0.08); // Di chuyển Y
      
      eyeTranslateX.value = withTiming(lookX, { duration: 400, easing: Easing.inOut(Easing.quad) });
      eyeTranslateY.value = withTiming(lookY, { duration: 400, easing: Easing.inOut(Easing.quad) });
      
      // Nhìn một lúc rồi đưa về giữa
      setTimeout(() => {
        eyeTranslateX.value = withTiming(0, { duration: 300 });
        eyeTranslateY.value = withTiming(0, { duration: 300 });
        lookTimeout = setTimeout(lookAround, Math.random() * 5000 + 2000);
      }, Math.random() * 2000 + 1000);
    };
    lookTimeout = setTimeout(lookAround, 2000);

    return () => {
      clearTimeout(blinkTimeout);
      clearTimeout(lookTimeout);
    };
  }, [size]);

  const eyeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: eyeTranslateX.value },
      { translateY: eyeTranslateY.value },
      { scaleY: eyeScaleY.value }
    ]
  }));

  const eyeWidth = size * 0.14;
  const eyeHeight = size * 0.32;
  const eyeGap = size * 0.1;

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size * 0.25 }]}>
      <Animated.View style={[styles.eye, { width: eyeWidth, height: eyeHeight, marginRight: eyeGap }, eyeStyle]} />
      <Animated.View style={[styles.eye, { width: eyeWidth, height: eyeHeight, marginLeft: eyeGap }, eyeStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A', // Màu nền màn hình mặt robot (Đen xanh đậm)
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#00A550',
    shadowColor: '#00A550',
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
    overflow: 'hidden',
  },
  eye: {
    backgroundColor: '#4ADE80', // Màu xanh lá neon
    borderRadius: 50,
    shadowColor: '#4ADE80',
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  }
});
