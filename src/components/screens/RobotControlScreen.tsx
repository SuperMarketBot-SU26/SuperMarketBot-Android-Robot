/**
 * RobotControlScreen.tsx
 *
 * Màn hình lái tay trực tiếp robot qua WebSocket (port 81).
 * Độ trễ < 5ms — mượt mà như WebUI.
 *
 * Hỗ trợ:
 *   - 8 hướng di chuyển omnidirectional (Mecanum)
 *   - Xoay tại chỗ (CW / CCW)
 *   - Speed Slider (0-100%)
 *   - E-Stop
 *   - Chuyển chế độ (Manual / Auto / Waypoint)
 *   - Reset Odometry
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Dimensions, Platform, PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft, Wifi, WifiOff, OctagonX, RotateCcw,
  Navigation, MapPin, Zap, Settings,
} from 'lucide-react-native';

import { RobotControlService } from '../../services/RobotControlService';
import { useRobotControl } from '../../context/RobotControlContext';

const { width: SW } = Dimensions.get('window');
const BTN_SIZE = Math.min(SW * 0.17, 72);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STOP = { x: 0, y: 0, s: 0 };

function stopAll() {
  RobotControlService.sendMove(STOP.x, STOP.y, STOP.s);
}

type Dir8 = { x: number; y: number; s: number; label: string };

const DIRS: Dir8[] = [
  { x: 0,   y: 80,  s: 0,   label: '↑' },  // Forward
  { x: 0,   y: 80,  s: 80,  label: '↗' },  // Fwd-Right
  { x: 0,   y: 0,   s: 80,  label: '→' },  // Strafe Right
  { x: 0,   y: 80,  s: -80, label: '↖' },  // Fwd-Left
  { x: 0,   y: 0,   s: -80, label: '←' },  // Strafe Left
  { x: 0,   y: -80, s: 80,  label: '↘' },  // Bwd-Right
  { x: 0,   y: -80, s: 0,   label: '↓' },  // Backward
  { x: 0,   y: -80, s: -80, label: '↙' },  // Bwd-Left
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function RobotControlScreen() {
  const router = useRouter();
  const { isConnected } = useRobotControl();

  const [speed, setSpeed] = useState(60);
  const [activeDir, setActiveDir] = useState<string | null>(null);

  const sendDir = useCallback((dir: Dir8) => {
    RobotControlService.sendMove(dir.x, dir.y, dir.s);
  }, []);

  const handlePressIn = useCallback((dir: Dir8, key: string) => {
    setActiveDir(key);
    sendDir(dir);
  }, [sendDir]);

  const handlePressOut = useCallback(() => {
    setActiveDir(null);
    stopAll();
  }, []);

  const handleEStop = useCallback(() => {
    stopAll();
    RobotControlService.sendEstop();
  }, []);

  const handleMode = useCallback((mode: 0 | 1 | 2) => {
    RobotControlService.sendMode(mode);
  }, []);

  const handleSpeedChange = useCallback((val: number) => {
    setSpeed(Math.round(val));
  }, []);

  const handleSpeedComplete = useCallback((val: number) => {
    RobotControlService.sendSpeed(Math.round(val));
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#e8edf4" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Zap size={16} color="#f59e0b" />
          <Text style={styles.headerTitle}>Lái Tay Robot</Text>
        </View>
        <View style={styles.connBadge}>
          {isConnected
            ? <Wifi size={14} color="#22c55e" />
            : <WifiOff size={14} color="#ef4444" />}
          <Text style={[styles.connText, { color: isConnected ? '#22c55e' : '#ef4444' }]}>
            {isConnected ? 'Kết nối' : 'Mất kết nối'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* ── 8-Direction Pad ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hướng Di Chuyển</Text>
          <View style={styles.padGrid}>
            {/* Row 1: ↖ ↑ ↗ */}
            <View style={styles.padRow}>
              <DirButton
                dir={DIRS[3]}
                isActive={activeDir === '3'}
                onPressIn={() => handlePressIn(DIRS[3], '3')}
                onPressOut={handlePressOut}
              />
              <DirButton
                dir={DIRS[0]}
                isActive={activeDir === '0'}
                onPressIn={() => handlePressIn(DIRS[0], '0')}
                onPressOut={handlePressOut}
              />
              <DirButton
                dir={DIRS[1]}
                isActive={activeDir === '1'}
                onPressIn={() => handlePressIn(DIRS[1], '1')}
                onPressOut={handlePressOut}
              />
            </View>
            {/* Row 2: ← [ROTATE] → */}
            <View style={styles.padRow}>
              <DirButton
                dir={DIRS[4]}
                isActive={activeDir === '4'}
                onPressIn={() => handlePressIn(DIRS[4], '4')}
                onPressOut={handlePressOut}
              />
              {/* Rotation Buttons */}
              <View style={styles.rotateBtns}>
                <TouchableOpacity
                  style={[styles.rotateBtn, styles.rotateBtnCCW]}
                  onPressIn={() => handlePressIn({ x: -80, y: 0, s: 0, label: '↺' }, 'rotL')}
                  onPressOut={handlePressOut}
                >
                  <RotateCcw size={20} color="#c084fc" />
                  <Text style={styles.rotateLabel}>↺</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rotateBtn, styles.rotateBtnCW]}
                  onPressIn={() => handlePressIn({ x: 80, y: 0, s: 0, label: '↻' }, 'rotR')}
                  onPressOut={handlePressOut}
                >
                  <RotateCcw size={20} color="#60a5fa" style={{ transform: [{ scaleX: -1 }] }} />
                  <Text style={styles.rotateLabel}>↻</Text>
                </TouchableOpacity>
              </View>
              <DirButton
                dir={DIRS[2]}
                isActive={activeDir === '2'}
                onPressIn={() => handlePressIn(DIRS[2], '2')}
                onPressOut={handlePressOut}
              />
            </View>
            {/* Row 3: ↙ ↓ ↘ */}
            <View style={styles.padRow}>
              <DirButton
                dir={DIRS[7]}
                isActive={activeDir === '7'}
                onPressIn={() => handlePressIn(DIRS[7], '7')}
                onPressOut={handlePressOut}
              />
              <DirButton
                dir={DIRS[6]}
                isActive={activeDir === '6'}
                onPressIn={() => handlePressIn(DIRS[6], '6')}
                onPressOut={handlePressOut}
              />
              <DirButton
                dir={DIRS[5]}
                isActive={activeDir === '5'}
                onPressIn={() => handlePressIn(DIRS[5], '5')}
                onPressOut={handlePressOut}
              />
            </View>
          </View>
        </View>

        {/* ── Speed Slider ── */}
        <View style={styles.section}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sectionTitle}>Tốc Độ Lái Tay</Text>
            <View style={styles.speedBadge}>
              <Text style={styles.speedBadgeText}>{speed}%</Text>
            </View>
          </View>
          <SpeedSlider
            value={speed}
            onChange={handleSpeedChange}
            onComplete={handleSpeedComplete}
          />
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>0%</Text>
            <Text style={styles.sliderLabel}>50%</Text>
            <Text style={styles.sliderLabel}>100%</Text>
          </View>
        </View>

        {/* ── Mode Buttons ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chế Độ Hoạt Động</Text>
          <View style={styles.modeRow}>
            <ModeButton
              label="Lái Tay"
              icon={<Zap size={16} />}
              active={false}
              onPress={() => handleMode(0)}
            />
            <ModeButton
              label="Tự Hành"
              icon={<Navigation size={16} />}
              active={false}
              onPress={() => handleMode(1)}
            />
            <ModeButton
              label="Waypoint"
              icon={<MapPin size={16} />}
              active={false}
              onPress={() => handleMode(2)}
            />
          </View>
        </View>

        {/* ── Action Buttons ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thao Tác</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.odomBtn} onPress={() => RobotControlService.sendOdomReset()}>
              <RotateCcw size={18} color="#8b5cf6" />
              <Text style={styles.odomBtnText}>Reset Odometry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.odomBtn} onPress={() => router.push('/motor-layout' as any)}>
              <Settings size={18} color="#8b5cf6" />
              <Text style={styles.odomBtnText}>Cấu hình bánh</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.estopBtn} onPress={handleEStop}>
            <OctagonX size={22} color="#ffffff" />
            <Text style={styles.estopText}>DỪNG KHẨN CẤP</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Custom Speed Slider ───────────────────────────────────────────────────────

interface SpeedSliderProps {
  value: number;
  onChange: (val: number) => void;
  onComplete: (val: number) => void;
}

function SpeedSlider({ value, onChange, onComplete }: SpeedSliderProps) {
  const trackRef = useRef<View>(null);
  const [trackW, setTrackW] = useState(0);
  const pct = value / 100;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        if (trackW > 0) {
          const x = e.nativeEvent.locationX;
          const newVal = Math.max(0, Math.min(100, Math.round((x / trackW) * 100)));
          onChange(newVal);
        }
      },
      onPanResponderMove: (e) => {
        if (trackW > 0) {
          const x = e.nativeEvent.locationX;
          const newVal = Math.max(0, Math.min(100, Math.round((x / trackW) * 100)));
          onChange(newVal);
        }
      },
      onPanResponderRelease: () => {
        onComplete(value);
      },
    }),
  ).current;

  return (
    <View style={styles.sliderWrap}>
      <View
        ref={trackRef}
        style={styles.sliderTrack}
        onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
        {...pan.panHandlers}
      >
        <View style={[styles.sliderFill, { width: `${pct * 100}%` }]} />
        <View style={[styles.sliderThumb, { left: `${pct * 100}%` }]} />
      </View>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface DirButtonProps {
  dir: Dir8;
  isActive: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
}

function DirButton({ dir, isActive, onPressIn, onPressOut }: DirButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.dirBtn, isActive && styles.dirBtnActive]}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={0.7}
    >
      <Text style={[styles.dirBtnText, isActive && styles.dirBtnTextActive]}>
        {dir.label}
      </Text>
    </TouchableOpacity>
  );
}

interface ModeButtonProps {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onPress: () => void;
}

function ModeButton({ label, icon, active, onPress }: ModeButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.modeBtn, active && styles.modeBtnActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon}
      <Text style={[styles.modeBtnText, active && styles.modeBtnTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080b0f' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1e2836',
    backgroundColor: '#0d1219',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#111820', justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
  },
  headerTitle: {
    color: '#e8edf4', fontSize: 15, fontWeight: '700', letterSpacing: 0.5,
  },
  connBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
    backgroundColor: '#111820', borderWidth: 1, borderColor: '#1e2836',
  },
  connText: { fontSize: 11, fontWeight: '700' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 20, paddingBottom: 40 },

  section: {
    backgroundColor: '#111820', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: '#1e2836',
  },
  sectionTitle: {
    color: '#8a97ab', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 14,
  },

  // ── D-Pad ──
  padGrid: { alignItems: 'center', gap: 8 },
  padRow: { flexDirection: 'row', gap: 8 },
  dirBtn: {
    width: BTN_SIZE, height: BTN_SIZE,
    borderRadius: 16,
    backgroundColor: '#1e2836',
    borderWidth: 1.5, borderColor: '#2d3a4d',
    justifyContent: 'center', alignItems: 'center',
  },
  dirBtnActive: {
    backgroundColor: '#1d4ed8',
    borderColor: '#3b82f6',
    elevation: 6,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  dirBtnText: { fontSize: 24, color: '#94a3b8', fontWeight: '600' },
  dirBtnTextActive: { color: '#ffffff' },

  rotateBtns: {
    width: BTN_SIZE, height: BTN_SIZE,
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-around',
  },
  rotateBtn: {
    width: BTN_SIZE * 0.42, height: BTN_SIZE * 0.7,
    borderRadius: 12,
    backgroundColor: '#1a2235',
    borderWidth: 1.5, borderColor: '#2d3a4d',
    justifyContent: 'center', alignItems: 'center',
    gap: 2,
  },
  rotateBtnCCW: { borderColor: '#7c3aed' },
  rotateBtnCW: { borderColor: '#2563eb' },
  rotateLabel: { fontSize: 18, color: '#c4b5fd', fontWeight: '700' },

  // ── Speed ──
  sliderHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  speedBadge: {
    backgroundColor: '#1e3a5f', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, borderColor: '#2563eb',
  },
  speedBadgeText: { color: '#60a5fa', fontSize: 14, fontWeight: '700' },
  sliderWrap: { paddingHorizontal: 4 },
  sliderTrack: {
    height: 6, backgroundColor: '#1e2836',
    borderRadius: 3, overflow: 'visible',
  },
  sliderFill: {
    position: 'absolute', height: '100%',
    backgroundColor: '#3b82f6', borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute', top: -7,
    width: 20, height: 20,
    marginLeft: -10,
    backgroundColor: '#60a5fa',
    borderRadius: 10, borderWidth: 3, borderColor: '#ffffff',
    shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 6,
  },
  sliderLabels: {
    flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4,
  },
  sliderLabel: { color: '#4a5568', fontSize: 11 },

  // ── Mode ──
  modeRow: { flexDirection: 'row', gap: 10 },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
    borderRadius: 12, backgroundColor: '#1e2836',
    borderWidth: 1.5, borderColor: '#2d3a4d',
  },
  modeBtnActive: {
    backgroundColor: '#1e3a5f', borderColor: '#2563eb',
  },
  modeBtnText: { color: '#8a97ab', fontSize: 12, fontWeight: '600' },
  modeBtnTextActive: { color: '#60a5fa' },

  // ── Actions ──
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  odomBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
    borderRadius: 12, backgroundColor: '#1e2836',
    borderWidth: 1.5, borderColor: '#5b21b6',
  },
  odomBtnText: { color: '#a78bfa', fontSize: 12, fontWeight: '600' },
  estopBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#dc2626',
    borderWidth: 2, borderColor: '#f87171',
    elevation: 4,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  estopText: {
    color: '#ffffff', fontSize: 15, fontWeight: '800',
    letterSpacing: 1,
  },
});
