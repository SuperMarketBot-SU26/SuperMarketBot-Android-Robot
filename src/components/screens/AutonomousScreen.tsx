/**
 * AutonomousScreen.tsx
 *
 * Màn hình "Chờ / Tự Hành" — hiển thị khi robot đang hoạt động tự động
 * và không có khách hàng đang tương tác.
 *
 * Tính năng:
 *  - Đồng hồ số + ngày tháng realtime
 *  - Logo siêu thị lớn + slogan
 *  - Trạng thái robot realtime (qua SignalR telemetry)
 *  - Slideshow quảng cáo fullscreen tự động (banner từ playlist hiện tại)
 *  - Animation pulse "Chạm màn hình để tương tác"
 *  - Khi user chạm → navigate /role-selection
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableWithoutFeedback,
  Dimensions, StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence,
  withTiming, runOnJS,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Bot, MapPin, Wifi, WifiOff, ChevronRight } from 'lucide-react-native';
import { useGeofencing } from '../../context/GeofencingContext';
import RobotFace from '../ui/RobotFace';

const { width: SW, height: SH } = Dimensions.get('window');

// ── Placeholder ads khi chưa có playlist từ zone ──────────────────────────────
const PROMO_SLIDES = [
  {
    id: 1,
    bg: ['#0F2027', '#203A43', '#2C5364'] as [string, string, string],
    headline: 'Ưu Đãi Hôm Nay',
    sub: 'Hàng nghìn sản phẩm giảm giá\nĐến ngay kệ Khuyến Mãi HOT',
    emoji: '🛒',
  },
  {
    id: 2,
    bg: ['#1a1a2e', '#16213e', '#0f3460'] as [string, string, string],
    headline: 'SmartMarketBot',
    sub: 'Robot thông minh phục vụ quý khách\nHỏi tôi bất cứ điều gì!',
    emoji: '🤖',
  },
  {
    id: 3,
    bg: ['#134E5E', '#71B280', '#134E5E'] as [string, string, string],
    headline: 'Tươi Sạch Mỗi Ngày',
    sub: 'Rau củ & Thực phẩm tươi sạch\nNhập hàng mỗi sáng sớm',
    emoji: '🥦',
  },
];

const SLIDE_DURATION = 5000; // 5 giây mỗi slide

// ── Component ────────────────────────────────────────────────────────────────
export default function AutonomousScreen() {
  const router = useRouter();
  const { isHubConnected, currentZone, isInZone, triggerDebugAd } = useGeofencing();

  // ── Đồng hồ ──────────────────────────────────────────────────────────────
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  // ── Slideshow ─────────────────────────────────────────────────────────────
  const [slideIndex, setSlideIndex] = useState(0);
  const slideOpacity = useSharedValue(1);
  const slideRef = useRef(slideIndex);
  slideRef.current = slideIndex;

  useEffect(() => {
    const advanceSlide = () => {
      setSlideIndex(prev => (prev + 1) % PROMO_SLIDES.length);
    };

    const timer = setInterval(() => {
      // Fade out → đổi slide → fade in
      slideOpacity.value = withTiming(0, { duration: 600 }, () => {
        runOnJS(advanceSlide)();
        slideOpacity.value = withTiming(1, { duration: 600 });
      });
    }, SLIDE_DURATION);
    return () => clearInterval(timer);
  }, []);

  const animatedSlide = useAnimatedStyle(() => ({ opacity: slideOpacity.value }));

  // ── Pulse animation "Chạm để tương tác" ──────────────────────────────────
  const pulseScale = useSharedValue(1);
  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 900 }),
        withTiming(1.0, { duration: 900 }),
      ),
      -1,
      true,
    );
  }, []);
  const animatedPulse = useAnimatedStyle(() => ({ transform: [{ scale: pulseScale.value }] }));

  // ── Robot glow ────────────────────────────────────────────────────────────
  const glowOpacity = useSharedValue(0.5);
  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500 }),
        withTiming(0.4, { duration: 1500 }),
      ),
      -1,
      true,
    );
  }, []);
  const animatedGlow = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  // ── Xử lý chạm màn hình → về role-selection ──────────────────────────────
  const handleTouch = useCallback(() => {
    router.replace('/role-selection');
  }, [router]);

  const currentSlide = PROMO_SLIDES[slideIndex];

  return (
    <TouchableWithoutFeedback onPress={handleTouch}>
      <View style={styles.root}>
        <StatusBar hidden />

        {/* ── BG theo slide ── */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.slideBg, animatedSlide, { backgroundColor: currentSlide.bg[1] }]} />

        {/* ── Overlay lưới tinh tế ── */}
        <View style={styles.gridOverlay} pointerEvents="none" />

        {/* ── HEADER: Đồng hồ + Kết nối ── */}
        <View style={styles.header}>
          <TouchableWithoutFeedback onLongPress={triggerDebugAd}>
            <View style={styles.clockBox}>
              <Text style={styles.clockTime}>{timeStr}</Text>
              <Text style={styles.clockDate}>{dateStr}</Text>
            </View>
          </TouchableWithoutFeedback>

          <View style={styles.statusBox}>
            {/* SignalR connection */}
            <View style={styles.statusPill}>
              {isHubConnected
                ? <Wifi size={14} color="#4ADE80" />
                : <WifiOff size={14} color="#F87171" />
              }
              <Text style={[styles.statusText, { color: isHubConnected ? '#4ADE80' : '#F87171' }]}>
                {isHubConnected ? 'Kết nối' : 'Offline'}
              </Text>
            </View>

            {/* Zone hiện tại */}
            {isInZone && currentZone && (
              <View style={[styles.statusPill, styles.zonePill]}>
                <MapPin size={13} color="#FCD34D" />
                <Text style={[styles.statusText, { color: '#FCD34D' }]} numberOfLines={1}>
                  {currentZone.objectName}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── TRUNG TÂM: Robot icon + slide content ── */}
        <View style={styles.center}>
          {/* Robot icon với glow */}
          <View style={styles.robotWrapper}>
            <Animated.View style={[styles.robotGlow, animatedGlow]} />
            <RobotFace size={130} />
          </View>

          {/* Tên siêu thị */}
          <Text style={styles.brandName}>SmartMarket</Text>
          <Text style={styles.brandTagline}>Robot Trợ Lý Mua Sắm Thông Minh</Text>

          {/* Slide content */}
          <Animated.View style={[styles.slideContent, animatedSlide]}>
            <Text style={styles.slideEmoji}>{currentSlide.emoji}</Text>
            <Text style={styles.slideHeadline}>{currentSlide.headline}</Text>
            <Text style={styles.slideSub}>{currentSlide.sub}</Text>
          </Animated.View>

          {/* Slide dots */}
          <View style={styles.dots}>
            {PROMO_SLIDES.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === slideIndex && styles.dotActive]}
              />
            ))}
          </View>
        </View>

        {/* ── FOOTER: CTA chạm màn hình ── */}
        <View style={styles.footer}>
          <Animated.View style={[styles.ctaBox, animatedPulse]}>
            <Text style={styles.ctaText}>Chạm màn hình để bắt đầu</Text>
            <ChevronRight size={20} color="rgba(255,255,255,0.8)" />
          </Animated.View>
          <Text style={styles.ctaHint}>Quét khuôn mặt để đăng nhập thành viên hoặc tiếp tục với vai khách</Text>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F1117',
  },
  slideBg: {
    // Background layer cho slide animation
  },
  gridOverlay: {
    ...StyleSheet.absoluteFill,
    opacity: 0.04,
    backgroundColor: 'transparent',
    // subtle dot pattern via borderWidth trick is not possible in RN,
    // but we keep this layer for potential future backgroundImage support
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 32,
    paddingTop: 32,
  },
  clockBox: {
    gap: 2,
  },
  clockTime: {
    fontSize: 42,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  clockDate: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  statusBox: {
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  zonePill: {
    backgroundColor: 'rgba(252, 211, 77, 0.12)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Center
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  robotWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  robotGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(99, 179, 237, 0.25)',
  },
  robotIconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 36,
    fontWeight: '900',
    color: 'white',
    letterSpacing: 1,
    textAlign: 'center',
  },
  brandTagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
  },
  slideContent: {
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 20,
    minHeight: 130,
  },
  slideEmoji: {
    fontSize: 48,
  },
  slideHeadline: {
    fontSize: 26,
    fontWeight: '800',
    color: 'white',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  slideSub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '400',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 20,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    width: 22,
    backgroundColor: 'white',
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingBottom: 40,
    gap: 10,
  },
  ctaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 50,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 0.3,
  },
  ctaHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
