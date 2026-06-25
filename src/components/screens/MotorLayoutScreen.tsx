/**
 * MotorLayoutScreen.tsx
 *
 * Cấu hình sơ đồ động cơ (Motor Mapping) + đảo chiều (Invert)
 * cho robot 4 bánh Mecanum.
 *
 * Mỗi bánh xe (FL / RL / FR / RR) có thể chọn slot driver (0-3)
 * và bật/tắt đảo chiều.
 *
 * Khi nhấn giữ nút "Test", bánh tương ứng chạy ở 40% tốc độ.
 * Nhả ra → dừng.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft, Wifi, WifiOff, Save, RefreshCw,
} from 'lucide-react-native';

import { useRobotControl } from '../../context/RobotControlContext';
import { RobotControlService } from '../../services/RobotControlService';

const WHEEL_LABELS = ['FL – Trái Trước', 'RL – Trái Sau', 'FR – Phải Trước', 'RR – Phải Sau'];
const WHEEL_KEYS = ['FL', 'RL', 'FR', 'RR'] as const;
const SLOT_OPTIONS = [0, 1, 2, 3];

// ─── Component ────────────────────────────────────────────────────────────────

export default function MotorLayoutScreen() {
  const router = useRouter();
  const { isConnected, motorLayout, setMotorLayout } = useRobotControl();

  // Local copy for editing before saving
  const [localLayout, setLocalLayout] = useState({
    mapMot: [...motorLayout.mapMot],
    motInv: [...motorLayout.motInv],
  });
  const [testingSlot, setTestingSlot] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSlotChange = useCallback((wheelIdx: number, slot: number) => {
    setLocalLayout(prev => {
      const mapMot = [...prev.mapMot];
      mapMot[wheelIdx] = slot;
      return { ...prev, mapMot };
    });
    setSaved(false);
  }, []);

  const handleInvToggle = useCallback((wheelIdx: number) => {
    setLocalLayout(prev => {
      const motInv = [...prev.motInv];
      motInv[wheelIdx] = motInv[wheelIdx] === 1 ? 0 : 1;
      return { ...prev, motInv };
    });
    setSaved(false);
  }, []);

  const handleSave = useCallback(() => {
    setMotorLayout(localLayout);
    RobotControlService.sendMotorLayout(localLayout.mapMot, localLayout.motInv);
    setSaved(true);
    Alert.alert('Đã lưu!', 'Cấu hình bánh xe đã được gửi xuống Robot.');
  }, [localLayout, setMotorLayout]);

  const handleTestStart = useCallback((slot: number) => {
    setTestingSlot(slot);
    RobotControlService.sendMotorTest(slot, 40);
  }, []);

  const handleTestEnd = useCallback(() => {
    if (testingSlot !== null) {
      RobotControlService.sendMotorTest(testingSlot, 0);
      setTestingSlot(null);
    }
  }, [testingSlot]);

  const handleReset = useCallback(() => {
    const defaults = { mapMot: [0, 1, 2, 3], motInv: [0, 0, 0, 0] };
    setLocalLayout(defaults);
    setSaved(false);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#e8edf4" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Cấu Hình Bánh Xe</Text>
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

        {/* ── Info Card ── */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            Cấu hình sơ đồ động cơ cho bánh xe Mecanum 4 bánh.
            Mỗi bánh chọn slot driver tương ứng trên mạch ESP32-S3.
            Nhấn giữ nút "Test" để chạy thử bánh ở 40%.
          </Text>
        </View>

        {/* ── Motor Cards ── */}
        {WHEEL_KEYS.map((key, idx) => (
          <MotorCard
            key={key}
            label={WHEEL_LABELS[idx]}
            wheelIdx={idx}
            selectedSlot={localLayout.mapMot[idx]}
            inverted={localLayout.motInv[idx] === 1}
            isTesting={testingSlot === localLayout.mapMot[idx]}
            onSlotChange={(slot) => handleSlotChange(idx, slot)}
            onInvToggle={() => handleInvToggle(idx)}
            onTestStart={() => handleTestStart(localLayout.mapMot[idx])}
            onTestEnd={handleTestEnd}
          />
        ))}

        {/* ── Action Buttons ── */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
            <RefreshCw size={16} color="#8a97ab" />
            <Text style={styles.resetBtnText}>Khôi phục mặc định</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveBtn, saved && styles.saveBtnSaved]}
            onPress={handleSave}
          >
            <Save size={16} color="#ffffff" />
            <Text style={styles.saveBtnText}>
              {saved ? 'Đã lưu!' : 'Lưu cấu hình'}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-component: Motor Card ─────────────────────────────────────────────────

interface MotorCardProps {
  label: string;
  wheelIdx: number;
  selectedSlot: number;
  inverted: boolean;
  isTesting: boolean;
  onSlotChange: (slot: number) => void;
  onInvToggle: () => void;
  onTestStart: () => void;
  onTestEnd: () => void;
}

const SLOT_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'];

function MotorCard({
  label, selectedSlot, inverted, isTesting,
  onSlotChange, onInvToggle, onTestStart, onTestEnd,
}: MotorCardProps) {
  const borderColor = isTesting ? '#3b82f6' : '#1e2836';

  return (
    <View style={[styles.motorCard, { borderColor }]}>
      {/* Label + Invert Toggle */}
      <View style={styles.motorCardHeader}>
        <Text style={styles.motorLabel}>{label}</Text>
        <TouchableOpacity
          style={[styles.invToggle, inverted && styles.invToggleActive]}
          onPress={onInvToggle}
          activeOpacity={0.7}
        >
          <Text style={[styles.invToggleText, inverted && styles.invToggleTextActive]}>
            {inverted ? 'Đảo ✓' : 'Thuận'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Slot Selector */}
      <View style={styles.slotRow}>
        <Text style={styles.slotLabel}>Slot Driver:</Text>
        <View style={styles.slotBtns}>
          {SLOT_OPTIONS.map(slot => (
            <TouchableOpacity
              key={slot}
              style={[
                styles.slotBtn,
                { borderColor: SLOT_COLORS[slot] },
                selectedSlot === slot && {
                  backgroundColor: SLOT_COLORS[slot],
                  borderColor: SLOT_COLORS[slot],
                },
              ]}
              onPress={() => onSlotChange(slot)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.slotBtnText,
                selectedSlot === slot && styles.slotBtnTextActive,
              ]}>
                {slot}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Test Button */}
      <TouchableOpacity
        style={[styles.testBtn, isTesting && styles.testBtnActive]}
        onPressIn={onTestStart}
        onPressOut={onTestEnd}
        activeOpacity={0.8}
      >
        <Text style={[styles.testBtnText, isTesting && styles.testBtnTextActive]}>
          {isTesting ? '⏸ Đang chạy... (nhả để dừng)' : '▶ Test bánh này (40%)'}
        </Text>
      </TouchableOpacity>
    </View>
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
  headerCenter: { flex: 1, alignItems: 'center' },
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
  scrollContent: { padding: 16, gap: 14, paddingBottom: 40 },

  infoCard: {
    backgroundColor: '#0d2745',
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#1e3a5f',
  },
  infoText: {
    color: '#93c5fd', fontSize: 12, lineHeight: 18,
  },

  motorCard: {
    backgroundColor: '#111820',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
  },
  motorCardHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  motorLabel: {
    color: '#e8edf4', fontSize: 14, fontWeight: '700',
  },
  invToggle: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1.5, borderColor: '#2d3a4d',
    backgroundColor: '#1e2836',
  },
  invToggleActive: {
    backgroundColor: '#4c1d95',
    borderColor: '#7c3aed',
  },
  invToggleText: {
    color: '#8a97ab', fontSize: 11, fontWeight: '600',
  },
  invToggleTextActive: { color: '#c4b5fd' },

  slotRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginBottom: 12,
  },
  slotLabel: {
    color: '#8a97ab', fontSize: 12, fontWeight: '600',
    width: 100,
  },
  slotBtns: { flexDirection: 'row', gap: 8 },
  slotBtn: {
    width: 38, height: 38, borderRadius: 10,
    borderWidth: 2, backgroundColor: '#1e2836',
    justifyContent: 'center', alignItems: 'center',
  },
  slotBtnText: { color: '#8a97ab', fontSize: 14, fontWeight: '700' },
  slotBtnTextActive: { color: '#ffffff' },

  testBtn: {
    backgroundColor: '#1e2836',
    borderRadius: 10, paddingVertical: 10,
    borderWidth: 1.5, borderColor: '#2d3a4d',
    alignItems: 'center',
  },
  testBtnActive: {
    backgroundColor: '#1e3a5f',
    borderColor: '#2563eb',
  },
  testBtnText: {
    color: '#8a97ab', fontSize: 12, fontWeight: '600',
  },
  testBtnTextActive: { color: '#60a5fa' },

  actionRow: {
    flexDirection: 'row', gap: 12, marginTop: 8,
  },
  resetBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
    borderRadius: 12, backgroundColor: '#111820',
    borderWidth: 1.5, borderColor: '#2d3a4d',
  },
  resetBtnText: { color: '#8a97ab', fontSize: 13, fontWeight: '600' },
  saveBtn: {
    flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
    borderRadius: 12, backgroundColor: '#2563eb',
  },
  saveBtnSaved: { backgroundColor: '#059669' },
  saveBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
});
