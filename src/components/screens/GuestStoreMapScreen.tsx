/**
 * GuestStoreMapScreen.tsx
 *
 * Màn hình Sơ Đồ Quầy Kệ 2D dành riêng cho Khách Vãng Lai (Mobile-First / Redmi Note 13 Pro).
 * Tích hợp chuẩn xác bản đồ 3.0m x 3.0m từ Web Staff (media_1789716323696.png) vào luồng Kiosk.
 * Hỗ trợ:
 * 1. Xem vị trí 6 kệ hàng, Quầy thu ngân, Trạm sạc, Cửa vào.
 * 2. Theo dõi vị trí và hướng xoay của Robot AMR (RB0001) thời gian thực qua SignalR.
 * 3. Chạm kệ hàng mở Card chi tiết -> Bấm [🚀 DẪN TÔI ĐẾN KỆ NÀY] để robot dẫn đường ngay!
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Bot,
  MapPin,
  Navigation,
  Plus,
  Minus,
  Maximize2,
  Sparkles,
  CheckCircle2,
  X,
  BatteryCharging,
} from 'lucide-react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

import { Store2DMapCanvas, RobotPoseState } from '../map/Store2DMapCanvas';
import {
  SHELVES_6,
  StoreShelf,
  resolveRobotPosition,
  SUPERMARKET_NODES,
} from '../map/StoreLayoutConstants';
import { useRobotRealtime, ROBOT_CODE } from '../../context/RobotRealtimeContext';
import { RobotControlService } from '../../services/RobotControlService';
import { useRobotVoice } from '../../hooks/useRobotVoice';
import { useNotification } from '../../context/NotificationContext';
import { useRobotAuth } from '../../context/RobotAuthContext';

export default function GuestStoreMapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { speak } = useRobotVoice();
  const { showNotification } = useNotification();
  const { isConnected, subscribeTelemetry, subscribeNavigationStatus } = useRobotRealtime();
  const { member } = useRobotAuth();
  const isMember = Boolean(member);

  // State vị trí & thông số Robot AMR
  const [robotPose, setRobotPose] = useState<RobotPoseState>({
    x: SUPERMARKET_NODES[8].mapX,
    y: SUPERMARKET_NODES[8].mapY,
    headingDeg: SUPERMARKET_NODES[8].headingDeg,
    batteryPct: 80,
    statusText: 'Trạm sạc (Dock)',
    isOnline: true,
  });

  const [selectedShelf, setSelectedShelf] = useState<StoreShelf | null>(null);
  const [activeGuidedShelf, setActiveGuidedShelf] = useState<StoreShelf | null>(null);
  const [isGuiding, setIsGuiding] = useState(false);

  // Pan & Zoom controls
  const mapScale = useSharedValue(1);
  const mapTranslateX = useSharedValue(0);
  const mapTranslateY = useSharedValue(0);

  // Subcribe realtime telemetry từ SignalR Hub
  useEffect(() => {
    const unsubTelemetry = subscribeTelemetry((payload) => {
      if (!payload) return;
      setRobotPose((prev) => {
        const resolved = resolveRobotPosition(payload, {
          x: prev.x,
          y: prev.y,
          headingDeg: prev.headingDeg,
          nodeName: prev.statusText || '',
        });
        return {
          x: resolved.x,
          y: resolved.y,
          headingDeg: resolved.headingDeg,
          batteryPct: Number(payload.batteryPct ?? payload.BatteryPct ?? prev.batteryPct ?? 80),
          statusText: resolved.nodeName || 'Đang di chuyển',
          isOnline: true,
        };
      });
    });

    const unsubNav = subscribeNavigationStatus((payload) => {
      if (!payload) return;
      const status = String(payload.navStatus ?? payload.NavStatus ?? '').toUpperCase();
      if (status === 'ARRIVED' || status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') {
        setActiveGuidedShelf(null);
      }
      setRobotPose((prev) => {
        const resolved = resolveRobotPosition(payload, {
          x: prev.x,
          y: prev.y,
          headingDeg: prev.headingDeg,
          nodeName: prev.statusText || '',
        });
        return {
          ...prev,
          x: resolved.x,
          y: resolved.y,
          headingDeg: resolved.headingDeg,
          statusText: status === 'ARRIVED' ? 'Đã đến kệ' : status === 'NAVIGATING' || status === 'MOVING' ? 'Đang dẫn đường' : resolved.nodeName,
        };
      });
    });

    // Robot chào khi vào xem sơ đồ
    speak('Sơ đồ siêu thị với 6 kệ hàng chính. Chạm vào kệ bất kỳ để tôi dẫn đường cho bạn nhé!');

    return () => {
      unsubTelemetry();
      unsubNav();
    };
  }, []);

  // Zoom helpers
  const handleZoomIn = () => {
    mapScale.value = withSpring(Math.min(2.5, mapScale.value + 0.35));
  };

  const handleZoomOut = () => {
    mapScale.value = withSpring(Math.max(0.75, mapScale.value - 0.35));
  };

  const handleResetZoom = () => {
    mapScale.value = withSpring(1);
    mapTranslateX.value = withSpring(0);
    mapTranslateY.value = withSpring(0);
  };

  const mapAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: mapTranslateX.value },
      { translateY: mapTranslateY.value },
      { scale: mapScale.value },
    ],
  }));

  // Xử lý chọn kệ
  const handleSelectShelf = (shelf: StoreShelf) => {
    setSelectedShelf(shelf);
    speak(`Kệ ${shelf.shelfId}, ${shelf.category}. Bạn có muốn tôi dẫn đường đến đây không?`);
  };

  // Phát lệnh Robot dẫn đường đến kệ đã chọn & tự động phát quảng cáo theo kệ khi tới nơi
  const handleStartGuide = async () => {
    if (!selectedShelf || isGuiding) return;
    const targetShelf = selectedShelf;
    setIsGuiding(true);

    try {
      speak(`Dạ vâng! Robot sẽ dẫn bạn đến ${targetShelf.name} và giới thiệu các ưu đãi hấp dẫn. Xin mời đi theo robot!`);
      showNotification({
        title: '🤖 KHỞI HÀNH DẪN ĐƯỜNG',
        message: `Đang di chuyển đến Kệ ${targetShelf.shelfId} (${targetShelf.category}). Đến nơi robot sẽ phát ưu đãi.`,
        type: 'info',
      });

      await RobotControlService.dispatchAutonomous({
        robotCode: ROBOT_CODE,
        flowType: 'ad',
        shelfIds: [targetShelf.shelfId],
        floorId: 1,
        adMode: 'shelf',
        dwellTimeSeconds: 30,
        source: 'RobotKiosk',
        dispatchedBy: isMember ? `${member?.fullName || 'Thành viên'} (VIP)` : 'Khách vãng lai tại Robot',
        targetSummary: `Kệ ${targetShelf.shelfId} (${targetShelf.category})`,
      });

      setActiveGuidedShelf(targetShelf);
      setSelectedShelf(null);
    } catch (err: any) {
      speak('Không thể khởi tạo dẫn đường. Vui lòng thử lại sau.');
      showNotification({
        title: 'LỖI DẪN ĐƯỜNG',
        message: err?.message || 'Không thể phát lệnh đến Robot',
        type: 'error',
      });
    } finally {
      setIsGuiding(false);
    }
  };

  // Dừng dẫn đường
  const handleCancelGuide = async () => {
    try {
      await RobotControlService.cancelAutonomous(ROBOT_CODE);
      speak('Đã dừng dẫn đường.');
      setActiveGuidedShelf(null);
      showNotification({
        title: 'ĐÃ DỪNG DẪN ĐƯỜNG',
        message: 'Robot đã dừng lộ trình di chuyển.',
        type: 'info',
      });
    } catch (err: any) {
      console.warn('Cancel guide error:', err);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── 1. TOP HEADER BAR ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Sơ Đồ Quầy Kệ 2D</Text>
          <Text style={styles.headerSubtitle}>
            {isMember ? `Chào ${member?.fullName || 'Thành viên'} · 6 Kệ hàng chính` : 'Siêu thị 3m × 3m · 6 Kệ hàng chính'}
          </Text>
        </View>

        {/* Robot Status Badge */}
        <View style={styles.robotStatusBadge}>
          <View style={[styles.statusDot, { backgroundColor: isConnected ? '#10B981' : '#F59E0B' }]} />
          <Bot size={13} color="#00A550" />
          <Text style={styles.robotStatusText}>
            {`${robotPose.batteryPct}%`}
          </Text>
        </View>
      </View>

      {/* ── 2. CATEGORY QUICK FILTER CAROUSEL (Cuộn ngang tiện lợi) ── */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          <TouchableOpacity
            style={[styles.filterChip, !selectedShelf && styles.filterChipActive]}
            onPress={() => setSelectedShelf(null)}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterChipText, !selectedShelf && styles.filterChipTextActive]}>
              Tất cả (6)
            </Text>
          </TouchableOpacity>

          {SHELVES_6.map((shelf) => {
            const isSelected = selectedShelf?.shelfId === shelf.shelfId;
            return (
              <TouchableOpacity
                key={`chip-${shelf.shelfId}`}
                style={[
                  styles.filterChip,
                  isSelected && {
                    backgroundColor: shelf.themeColor,
                    borderColor: shelf.themeColor,
                  },
                ]}
                onPress={() => handleSelectShelf(shelf)}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: 13, marginRight: 4 }}>{shelf.icon}</Text>
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && { color: '#ffffff', fontWeight: '900' },
                  ]}
                >
                  {`Kệ ${shelf.shelfId}: ${shelf.category}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── 3. INTERACTIVE 2D MAP VIEWPORT (Tối ưu màn hình Mobile) ── */}
      <View style={styles.mapViewport}>
        <Animated.View style={[styles.canvasContainer, mapAnimatedStyle]}>
          <Store2DMapCanvas
            robotPose={robotPose}
            selectedShelfId={selectedShelf?.shelfId}
            onShelfPress={handleSelectShelf}
            showDimensions={true}
          />
        </Animated.View>

        {/* Floating Zoom Toolbar (Góc phải dưới của map) */}
        <View style={styles.zoomToolbar}>
          <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomIn} activeOpacity={0.7}>
            <Plus size={18} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomOut} activeOpacity={0.7}>
            <Minus size={18} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity style={styles.zoomBtn} onPress={handleResetZoom} activeOpacity={0.7}>
            <Maximize2 size={16} color="#00A550" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 4. BOTTOM ACTION CARD: XEM CHI TIẾT & GỌI ROBOT DẪN ĐƯỜNG ── */}
      {activeGuidedShelf ? (
        <Animated.View
          entering={FadeInUp.duration(300)}
          style={[
            styles.bottomCard,
            {
              backgroundColor: '#F0FDF4',
              borderColor: '#BBF7D0',
              borderWidth: 1,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={styles.bottomCardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View
                style={[
                  styles.shelfIconCircle,
                  { backgroundColor: '#DCFCE7', borderColor: '#00A550' },
                ]}
              >
                <Navigation size={22} color="#00A550" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.shelfTitleText, { color: '#166534' }]} numberOfLines={1}>
                  Đang dẫn đường đến Kệ {activeGuidedShelf.shelfId}
                </Text>
                <Text style={styles.shelfMetaText} numberOfLines={1}>
                  {activeGuidedShelf.name} · Tự động phát ưu đãi khi tới nơi
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: '#FEE2E2', width: 34, height: 34, borderRadius: 17 }]}
              onPress={handleCancelGuide}
              activeOpacity={0.7}
            >
              <X size={18} color="#DC2626" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.guideBtn, { backgroundColor: '#DC2626', shadowColor: '#DC2626' }]}
            onPress={handleCancelGuide}
            activeOpacity={0.88}
          >
            <X size={18} color="white" />
            <Text style={styles.guideBtnText}>DỪNG DẪN ĐƯỜNG</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : selectedShelf ? (
        <Animated.View
          entering={FadeInUp.duration(300)}
          style={[styles.bottomCard, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          {/* Header Row */}
          <View style={styles.bottomCardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View
                style={[
                  styles.shelfIconCircle,
                  { backgroundColor: selectedShelf.themeBg, borderColor: selectedShelf.themeColor },
                ]}
              >
                <Text style={{ fontSize: 24 }}>{selectedShelf.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shelfTitleText} numberOfLines={1}>
                  {selectedShelf.name}
                </Text>
                <Text style={styles.shelfMetaText}>
                  {`Dãy ${selectedShelf.aisleCode} · ArUco #${selectedShelf.arucoTag} · Mật độ: 100%`}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setSelectedShelf(null)}
              activeOpacity={0.7}
            >
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Sample Products Chips */}
          <View style={styles.productChipsRow}>
            {selectedShelf.sampleProducts.slice(0, 3).map((prod, idx) => (
              <View key={`prod-${idx}`} style={styles.productChip}>
                <Text style={styles.productChipText} numberOfLines={1}>
                  {prod}
                </Text>
              </View>
            ))}
          </View>

          {/* 1-Tap Big CTA: Dẫn tôi đến kệ & phát quảng cáo */}
          <TouchableOpacity
            style={[styles.guideBtn, isGuiding && { opacity: 0.7 }]}
            onPress={handleStartGuide}
            disabled={isGuiding}
            activeOpacity={0.88}
          >
            {isGuiding ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Navigation size={20} color="white" />
            )}
            <Text style={styles.guideBtnText}>
              {isGuiding ? 'Đang gọi Robot dẫn đường...' : `🚀 DẪN ĐẾN KỆ & XEM ƯU ĐÃI`}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        /* Hint Bar khi chưa chọn kệ */
        <View style={[styles.hintBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Sparkles size={16} color="#00A550" />
          <Text style={styles.hintBarText}>
            Chạm vào kệ hàng trên bản đồ hoặc chọn ở danh mục trên để gọi Robot dẫn đường
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  robotStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  robotStatusText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
  },

  // Filter Bar
  filterBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 8,
  },
  filterScrollContent: {
    paddingHorizontal: 14,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#00A550',
    borderColor: '#00A550',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },

  // Map Viewport
  mapViewport: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  canvasContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomToolbar: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: 'black',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
  },
  zoomBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },

  // Bottom Detail Card
  bottomCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    shadowColor: 'black',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 12,
  },
  bottomCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shelfIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  shelfTitleText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  shelfMetaText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productChipsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  productChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  productChipText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  guideBtn: {
    backgroundColor: '#00A550',
    borderRadius: 16,
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#00A550',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  guideBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
  },

  // Hint Bar
  hintBar: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#DCFCE7',
  },
  hintBarText: {
    flex: 1,
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
    lineHeight: 16,
  },
});
