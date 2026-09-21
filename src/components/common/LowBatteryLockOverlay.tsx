import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {
  BatteryWarning,
  Zap,
  Lock,
  Radio,
  ArrowRight,
  ShieldAlert,
  RotateCcw,
} from 'lucide-react-native';
import { useRobotRealtime, ROBOT_CODE } from '../../context/RobotRealtimeContext';
import { VoiceService } from '../../services/RobotVoiceService';
import { BASE_URL } from '../../services/AuthService';

export function LowBatteryLockOverlay() {
  const { isLowBatteryLocked, lowBatteryInfo, clearLowBatteryLock } = useRobotRealtime();

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Speak voice announcement when lock activates
  useEffect(() => {
    if (isLowBatteryLocked) {
      const timer = setTimeout(() => {
        try {
          VoiceService.speak(
            'Cảnh báo: Dung lượng pin dưới mười lăm phần trăm. Robot tạm dừng mọi tương tác và đang tự động quay về trạm sạc. Quý khách vui lòng giữ khoảng cách an toàn.',
            { interrupt: true }
          );
        } catch {
          // ignore audio error on simulator
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLowBatteryLocked]);

  // Pulse & Glow animation loop
  useEffect(() => {
    if (!isLowBatteryLocked) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.9,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.35,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const spin = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    pulse.start();
    glow.start();
    spin.start();

    return () => {
      pulse.stop();
      glow.stop();
      spin.stop();
    };
  }, [isLowBatteryLocked, glowAnim, pulseAnim, rotateAnim]);

  if (!isLowBatteryLocked) return null;

  const batteryPct = lowBatteryInfo?.batteryPct ?? 12;
  const dockNodeId = lowBatteryInfo?.dockNodeId ?? 8;
  const robotCode = lowBatteryInfo?.robotCode ?? ROBOT_CODE;

  const handleManualReset = async () => {
    try {
      clearLowBatteryLock();
      await fetch(`${BASE_URL}/api/v1/robots/${robotCode}/reset-battery`, {
        method: 'POST',
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
    } catch (e) {
      console.warn('[LowBatteryLockOverlay] Reset battery API failed:', e);
    }
  };

  const spinInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Modal visible animationType="fade" statusBarTranslucent transparent={false}>
      <View style={styles.container} pointerEvents="auto">
        {/* Background Radial Glow */}
        <Animated.View
          style={[
            styles.ambientGlow,
            {
              opacity: glowAnim,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />

        {/* ── TOP STATUS PILL ── */}
        <View style={styles.topHeader}>
          <View style={styles.livePill}>
            <View style={styles.redDot} />
            <Text style={styles.livePillText}>CẢNH BÁO KHẨN CẤP · SMARTMARKETBOT</Text>
          </View>
          <Text style={styles.robotCodeText}>{robotCode}</Text>
        </View>

        {/* ── CENTER LOCK HERO CARD ── */}
        <View style={styles.centerContent}>
          {/* Pulsing Battery Warning Icon */}
          <View style={styles.iconContainer}>
            <Animated.View
              style={[
                styles.iconHalo,
                {
                  opacity: glowAnim,
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            />
            <View style={styles.iconCircle}>
              <BatteryWarning size={82} color="#EF4444" />
            </View>
          </View>

          {/* Battery Level Badge */}
          <View style={styles.batteryBadge}>
            <Zap size={20} color="#F59E0B" />
            <Text style={styles.batteryBadgeText}>PIN: {batteryPct}% (&lt; 15% NGƯỠNG NGUY CẤP)</Text>
          </View>

          {/* Main Title & Explanation */}
          <Text style={styles.title}>ROBOT ĐANG TỰ ĐỘNG QUAY VỀ TRẠM SẠC</Text>
          <Text style={styles.subtitle}>
            Dung lượng pin đã giảm xuống mức tối thiểu an toàn ({batteryPct}%). Để bảo vệ bộ nguồn và đảm bảo an toàn cho khách hàng, toàn bộ hệ thống tương tác và dẫn đường đã tạm thời đóng băng.
          </Text>

          {/* Navigation Detail Card */}
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={styles.cardIconBox}>
                <Radio size={20} color="#38BDF8" />
              </View>
              <View style={styles.cardTextBox}>
                <Text style={styles.cardLabel}>Điểm đến tự hành:</Text>
                <Text style={styles.cardValue}>Trạm Sạc Tự Động (Charging Dock #{dockNodeId})</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.cardRow}>
              <View style={styles.cardIconBox}>
                <Lock size={20} color="#EF4444" />
              </View>
              <View style={styles.cardTextBox}>
                <Text style={styles.cardLabel}>Màn hình tương tác:</Text>
                <Text style={[styles.cardValue, { color: '#F87171' }]}>
                  Khóa cảm ứng hoàn toàn — Vui lòng không chạm vào màn hình
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.cardRow}>
              <View style={styles.cardIconBox}>
                <ShieldAlert size={20} color="#F59E0B" />
              </View>
              <View style={styles.cardTextBox}>
                <Text style={styles.cardLabel}>Lưu ý an toàn:</Text>
                <Text style={styles.cardValue}>
                  Robot đang di chuyển tự động. Quý khách vui lòng đứng lùi lại và giữ khoảng cách an toàn.
                </Text>
              </View>
            </View>
          </View>

          {/* Moving Radar Indicator */}
          <View style={styles.radarStatusRow}>
            <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
              <Radio size={18} color="#22C55E" />
            </Animated.View>
            <Text style={styles.radarStatusText}>
              Đang dò tuyến Dijkstra về Trạm sạc qua LiDAR &amp; Cảm biến an toàn...
            </Text>
          </View>
        </View>

        {/* ── BOTTOM DEMO RECOVERY BUTTON ── */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.demoResetBtn}
            onPress={handleManualReset}
            activeOpacity={0.8}
          >
            <RotateCcw size={16} color="#94A3B8" />
            <Text style={styles.demoResetText}>Khôi Phục Demo (Mở Khóa Màn Hình)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  ambientGlow: {
    position: 'absolute',
    top: '20%',
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
  },
  topHeader: {
    width: '100%',
    maxWidth: 720,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  livePillText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  robotCodeText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  centerContent: {
    width: '100%',
    maxWidth: 680,
    alignItems: 'center',
    zIndex: 2,
    marginVertical: 'auto',
  },
  iconContainer: {
    width: 150,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconHalo: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(239, 68, 68, 0.35)',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1C151B',
    borderWidth: 2,
    borderColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
  },
  batteryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 24,
    marginBottom: 16,
  },
  batteryBadgeText: {
    color: '#FBBF24',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.4,
    lineHeight: 32,
    marginBottom: 10,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.8)',
    padding: 16,
    marginBottom: 20,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTextBox: {
    flex: 1,
  },
  cardLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardValue: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(51, 65, 85, 0.5)',
    marginVertical: 12,
  },
  radarStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radarStatusText: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomBar: {
    width: '100%',
    alignItems: 'center',
    zIndex: 2,
  },
  demoResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  demoResetText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
});
