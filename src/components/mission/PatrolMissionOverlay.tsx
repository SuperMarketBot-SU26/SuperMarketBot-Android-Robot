import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import {
  ShieldAlert,
  ShieldCheck,
  Scan,
  MapPin,
  Lock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  X,
  Radio,
  Sparkles,
} from 'lucide-react-native';
import {
  MissionStatus,
  MissionWaypoint,
  RobotMission,
  ScanResult,
} from '../../context/RobotMissionRuntimeContext';

interface PatrolMissionOverlayProps {
  mission: RobotMission | null;
  status: MissionStatus;
  activeWaypoint: MissionWaypoint | null;
  activeWaypointIndex: number;
  pendingScans: number;
  completedScans: number;
  failedScans: number;
  lastScan: ScanResult | null;
  onResumeNext?: () => void;
  onDismiss: () => void;
}

export function PatrolMissionOverlay({
  mission,
  status,
  activeWaypoint,
  activeWaypointIndex,
  pendingScans,
  completedScans,
  failedScans,
  lastScan,
  onResumeNext,
  onDismiss,
}: PatrolMissionOverlayProps) {
  // Chỉ hiển thị khi đang có nhiệm vụ tuần tra (patrol flow)
  const isPatrol = mission !== null && mission.flowType === 'patrol' && status !== 'ESTOP';

  // Animation: Radar Pulse & Glow
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // Auto-countdown 6s to next shelf when AI scan is done
  const [countdownToNext, setCountdownToNext] = useState<number | null>(null);

  useEffect(() => {
    if (!isPatrol) return;

    // Pulse animation
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // Rotate radar beam
    const rotateLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    rotateLoop.start();

    // Scan line vertical animation
    const scanLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    scanLoop.start();

    return () => {
      pulseLoop.stop();
      rotateLoop.stop();
      scanLoop.stop();
    };
  }, [isPatrol, pulseAnim, rotateAnim, scanLineAnim]);

  // Countdown timer to next shelf after scan
  useEffect(() => {
    if (lastScan && pendingScans === 0 && status === 'ARRIVED') {
      setCountdownToNext(6);
      const timer = setInterval(() => {
        setCountdownToNext((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            onResumeNext?.();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setCountdownToNext(null);
    }
  }, [lastScan, pendingScans, status, onResumeNext]);

  if (!isPatrol) return null;

  const totalWaypoints = mission.waypoints?.length ?? 1;
  const currentStep = Math.min(Math.max(activeWaypointIndex + 1, 1), totalWaypoints);
  const progressPercent = Math.round((currentStep / totalWaypoints) * 100);

  const isArrived = status === 'ARRIVED';
  const isEnRoute = status === 'MOVING' || status === 'NAVIGATING';

  const rotateDeg = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const scanTranslateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, 30],
  });

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        {/* Background Ambient Glows */}
        <View style={styles.ambientGlowTop} />
        <View style={styles.ambientGlowBottom} />

        {/* TOP STATUS BAR */}
        <View style={styles.topBar}>
          <View style={styles.systemStatusChip}>
            <View style={styles.liveIndicatorDot} />
            <Text style={styles.systemStatusText}>
              AUTONOMOUS PATROL HUD · {mission.robotCode || 'RB0001'}
            </Text>
          </View>

          {/* Admin Exit / Stop button (Subtle, top-right) */}
          <TouchableOpacity
            style={styles.staffExitBtn}
            onPress={onDismiss}
            activeOpacity={0.7}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <X size={18} color="#94a3b8" />
            <Text style={styles.staffExitText}>Dừng ca</Text>
          </TouchableOpacity>
        </View>

        {/* CENTER VISUAL: HIGH-TECH AI RADAR & LOCKOUT ICON */}
        <View style={styles.centerSection}>
          <View style={styles.radarContainer}>
            {/* Outer Pulsing Ring */}
            <Animated.View
              style={[
                styles.radarOuterRing,
                { transform: [{ scale: pulseAnim }] },
              ]}
            />
            {/* Middle Rotating Radar Beam */}
            <Animated.View
              style={[
                styles.radarRotatingBeam,
                { transform: [{ rotate: rotateDeg }] },
              ]}
            />
            {/* Inner Glowing Core */}
            <View style={styles.radarCore}>
              {lastScan?.needsRestock ? (
                <AlertTriangle size={48} color="#f59e0b" />
              ) : isArrived ? (
                <Scan size={48} color="#38bdf8" />
              ) : (
                <ShieldCheck size={52} color="#10b981" />
              )}
            </View>

            {/* Laser Scanning Indicator */}
            {isArrived && (
              <Animated.View
                style={[
                  styles.laserScanBar,
                  { transform: [{ translateY: scanTranslateY }] },
                ]}
              />
            )}
          </View>

          {/* LOCKOUT MAIN NOTICE FOR SHOPPERS */}
          <View style={styles.lockoutBadge}>
            <Lock size={15} color="#f59e0b" />
            <Text style={styles.lockoutBadgeText}>MÀN HÌNH TẠM KHÓA TƯƠNG TÁC</Text>
          </View>

          <Text style={styles.mainTitle}>
            ROBOT ĐANG THỰC HIỆN CA KIỂM KÊ KỆ HÀNG
          </Text>

          <Text style={styles.mainSubtitle}>
            Hệ thống AI Vision đang tự động quét kiểm tra tồn kho & đo mật độ hàng hóa.
            {'\n'}Quý khách vui lòng giữ khoảng cách an toàn (1m).
          </Text>
        </View>

        {/* BOTTOM SECTION: REALTIME PATROL PROGRESS & SHELF TELEMETRY */}
        <View style={styles.bottomCard}>
          {/* Progress Header */}
          <View style={styles.progressHeaderRow}>
            <View style={styles.progressLabelWrap}>
              <Radio size={16} color="#38bdf8" />
              <Text style={styles.progressTitle}>TIẾN ĐỘ TUẦN TRA</Text>
            </View>
            <Text style={styles.stepCounterText}>
              Kệ {currentStep} / {totalWaypoints} ({progressPercent}%)
            </Text>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>

          {/* Current Target Shelf Info */}
          <View style={styles.shelfInfoCard}>
            <View style={styles.shelfIconBox}>
              <MapPin size={24} color="#10b981" />
            </View>
            <View style={styles.shelfTextWrap}>
              <Text style={styles.shelfAisleTag}>
                {activeWaypoint?.zoneName || 'Khu Vực Siêu Thị'} • {activeWaypoint?.aisleName || 'Dãy Kệ Hàng'}
              </Text>
              <Text style={styles.shelfNameText} numberOfLines={1}>
                {activeWaypoint?.shelfName || activeWaypoint?.nodeName || 'Đang tới kệ tiếp theo...'}
              </Text>
            </View>

            {/* Current Realtime Status Pill */}
            <View
              style={[
                styles.statusPill,
                isArrived
                  ? styles.statusPillScanning
                  : isEnRoute
                  ? styles.statusPillMoving
                  : styles.statusPillIdle,
              ]}
            >
              {isArrived && pendingScans > 0 ? (
                <ActivityIndicator size="small" color="#38bdf8" />
              ) : isArrived ? (
                <Scan size={14} color="#38bdf8" />
              ) : (
                <Radio size={14} color="#10b981" />
              )}
              <Text style={styles.statusPillText}>
                {isArrived && pendingScans > 0
                  ? 'ĐANG PHÂN TÍCH AI'
                  : isArrived
                  ? 'TẠI KỆ HÀNG'
                  : 'ĐANG DI CHUYỂN'}
              </Text>
            </View>
          </View>

          {/* AI Scan Result Snapshot (If available for current shelf) */}
          {lastScan ? (
            <View
              style={[
                styles.scanResultCard,
                lastScan.needsRestock ? styles.scanResultWarning : styles.scanResultSuccess,
              ]}
            >
              <View style={styles.scanResultLeft}>
                {lastScan.needsRestock ? (
                  <AlertTriangle size={20} color="#f59e0b" />
                ) : (
                  <CheckCircle2 size={20} color="#10b981" />
                )}
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.scanResultTitle}>
                    {lastScan.needsRestock
                      ? `Phát hiện ${lastScan.emptySlotCount ?? 1} vị trí hết hàng`
                      : 'Kệ hàng đã đầy đủ (Đạt chuẩn)'}
                  </Text>
                  <Text style={styles.scanResultSub}>
                    Mật độ lấp đầy: {lastScan.occupancyRatePct ?? 100}% • Đã lưu vào hệ thống
                  </Text>
                </View>
              </View>

              {/* Countdown or Resume button */}
              {countdownToNext !== null && (
                <TouchableOpacity
                  style={styles.resumeNextBtn}
                  onPress={onResumeNext}
                  activeOpacity={0.8}
                >
                  <Text style={styles.resumeNextText}>
                    Kế tiếp ({countdownToNext}s)
                  </Text>
                  <ArrowRight size={14} color="white" />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            /* Live Mission Metrics Strip */
            <View style={styles.metricsStrip}>
              <View style={styles.metricItem}>
                <Text style={styles.metricNum}>{completedScans}</Text>
                <Text style={styles.metricLabel}>Đã kiểm tra</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={[styles.metricNum, { color: '#38bdf8' }]}>
                  {pendingScans}
                </Text>
                <Text style={styles.metricLabel}>Đang xử lý AI</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text
                  style={[
                    styles.metricNum,
                    { color: failedScans > 0 ? '#ef4444' : '#94a3b8' },
                  ]}
                >
                  {failedScans}
                </Text>
                <Text style={styles.metricLabel}>Cảnh báo lỗi</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#030712', // Ultra-deep cyber navy
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
  },
  ambientGlowTop: {
    position: 'absolute',
    top: -100,
    left: '20%',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  ambientGlowBottom: {
    position: 'absolute',
    bottom: -80,
    right: '10%',
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  systemStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  liveIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 3,
  },
  systemStatusText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  staffExitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  staffExitText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  radarContainer: {
    width: 170,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
  },
  radarOuterRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    backgroundColor: 'rgba(14, 165, 233, 0.05)',
  },
  radarRotatingBeam: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderTopColor: '#38bdf8',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  radarCore: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(56, 189, 248, 0.6)',
    shadowColor: '#38bdf8',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  laserScanBar: {
    position: 'absolute',
    width: 120,
    height: 2,
    backgroundColor: '#38bdf8',
    shadowColor: '#38bdf8',
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  lockoutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    marginBottom: 14,
  },
  lockoutBadgeText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  mainTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.3,
    lineHeight: 32,
    marginBottom: 10,
    maxWidth: 420,
  },
  mainSubtitle: {
    color: '#94a3b8',
    fontSize: 14.5,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 400,
  },
  bottomCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressTitle: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  stepCounterText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#38bdf8',
    borderRadius: 3,
  },
  shelfInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  shelfIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  shelfTextWrap: {
    flex: 1,
  },
  shelfAisleTag: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  shelfNameText: {
    color: '#ffffff',
    fontSize: 16.5,
    fontWeight: '800',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusPillScanning: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38bdf8',
  },
  statusPillMoving: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
  },
  statusPillIdle: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    borderColor: '#64748b',
  },
  statusPillText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scanResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  scanResultSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  scanResultWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  scanResultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  scanResultTitle: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800',
  },
  scanResultSub: {
    color: '#94a3b8',
    fontSize: 11.5,
    marginTop: 2,
  },
  resumeNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  resumeNextText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  metricsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricNum: {
    color: '#10b981',
    fontSize: 20,
    fontWeight: '900',
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
});
