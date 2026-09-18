/**
 * CartGuideMapScreen.tsx
 *
 * Màn hình Robot Dẫn Đường Mua Sắm (Đồng hành cùng khách hàng).
 * Redesign toàn diện:
 * 1. Xóa bỏ hoàn toàn ngôn ngữ debug kỹ thuật: "Waypoint 7", "Hồi vị", "NodeId", "Mission GUID".
 * 2. Ngôn ngữ thân thiện với người tiêu dùng: "Điểm Khởi Hành (Trạm đón khách)", "Kệ hàng & Sản phẩm cần lấy", "Quầy Thu Ngân & Hoàn Tất".
 * 3. Tích hợp Sơ Đồ Siêu Thị 2D (Store2DMapCanvas) trực quan hiển thị vị trí Robot AMR thời gian thực.
 * 4. Bảng điều hướng sống động (Hero Live Status) phản ánh tức thì: Đang di chuyển / Đã đến nơi / Hoàn tất.
 * 5. Checklist sản phẩm thông minh có thể chạm tick [✓ Đã nhặt] trực tiếp trên màn hình robot.
 * 6. Thanh đếm ngược 30s êm ái kèm nút xác nhận to bản, dễ bấm bằng một tay khi đang đẩy giỏ.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  BatteryCharging,
  Bot,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleDot,
  Compass,
  CreditCard,
  Flame,
  Home,
  Map as MapIcon,
  MapPin,
  Navigation,
  OctagonX,
  Package,
  PackageCheck,
  Radio,
  ShoppingBag,
  Sparkles,
  Store,
  Zap,
} from 'lucide-react-native';

import { useRobotGuide, GuideDestination } from '../../context/RobotGuideContext';
import { useRobotRealtime, ROBOT_CODE } from '../../context/RobotRealtimeContext';
import { Store2DMapCanvas, RobotPoseState } from '../map/Store2DMapCanvas';
import {
  SHELVES_6,
  StoreShelf,
  SUPERMARKET_NODES,
  resolveRobotPosition,
} from '../map/StoreLayoutConstants';
import { useRobotVoice } from '../../hooks/useRobotVoice';

/**
 * Trợ giúp phân giải thông tin kệ hàng thân thiện từ destination
 */
function getShelfData(item?: GuideDestination | null) {
  if (!item) {
    return {
      shelfId: 1,
      name: 'Kệ hàng siêu thị',
      category: 'Hàng hóa',
      icon: '📦',
      aisleCode: 'Dãy A01',
      themeColor: '#2563eb',
      themeBg: 'rgba(37, 99, 235, 0.12)',
      products: [] as string[],
    };
  }

  let sId = item.nodeId;
  if (item.shelfName) {
    const match = item.shelfName.match(/(\d+)/);
    if (match) sId = parseInt(match[1], 10);
  }
  if (!sId || sId < 1 || sId > 6) {
    if (item.nodeId >= 1 && item.nodeId <= 6) sId = item.nodeId;
  }

  const foundShelf = SHELVES_6.find((s) => s.shelfId === sId);
  return {
    shelfId: sId,
    name: foundShelf?.name || item.shelfName || item.nodeName || `Kệ ${sId}`,
    category: foundShelf?.category || item.zoneName || 'Sản phẩm',
    icon: foundShelf?.icon || '📦',
    aisleCode: foundShelf?.aisleCode || item.aisleName || 'Dãy hàng',
    themeColor: foundShelf?.themeColor || '#16a34a',
    themeBg: foundShelf?.themeBg || 'rgba(22, 163, 74, 0.12)',
    products:
      item.productNames && item.productNames.length > 0
        ? item.productNames
        : foundShelf?.sampleProducts?.slice(0, 3) || ['Sản phẩm trong giỏ'],
  };
}

export default function CartGuideMapScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 860;

  const {
    status,
    missionId,
    destinations,
    destination,
    currentWaypointIndex,
    error,
    isBusy,
    isHubConnected,
    awaitingPickup,
    confirmPickup,
    cancelGuide,
  } = useRobotGuide();

  const { subscribeTelemetry, subscribeNavigationStatus } = useRobotRealtime();
  const { speak } = useRobotVoice();

  // Chế độ xem: 'timeline' (Lộ trình & Sản phẩm) | 'map' (Sơ đồ 2D siêu thị)
  const [viewMode, setViewMode] = useState<'timeline' | 'map'>('timeline');

  // Trạng thái đánh dấu đã nhặt sản phẩm trên màn hình
  const [checkedProducts, setCheckedProducts] = useState<Record<string, boolean>>({});

  // Telemetry tọa độ Robot thời gian thực cho bản đồ 2D
  const [mapPose, setMapPose] = useState<RobotPoseState>({
    x: SUPERMARKET_NODES[8].mapX,
    y: SUPERMARKET_NODES[8].mapY,
    headingDeg: SUPERMARKET_NODES[8].headingDeg,
    batteryPct: 85,
    statusText: 'Đang dẫn đường',
    isOnline: true,
  });

  const totalStops = destinations.length;
  const isFinalStop = totalStops > 0 && currentWaypointIndex >= totalStops - 1;
  const currentShelf = useMemo(() => getShelfData(destination), [destination]);

  // Bộ đếm ngược 30 giây tự động khi đã đến kệ
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);

  // Subscribe SignalR Telemetry để vẽ vị trí Robot chính xác trên Bản Đồ 2D
  useEffect(() => {
    const unsubTelemetry = subscribeTelemetry((payload) => {
      if (!payload) return;
      setMapPose((prev) => {
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
          batteryPct: Number(payload.batteryPct ?? payload.BatteryPct ?? prev.batteryPct ?? 85),
          statusText: resolved.nodeName || 'Đang dẫn đường',
          isOnline: true,
        };
      });
    });

    const unsubNav = subscribeNavigationStatus((payload) => {
      if (!payload) return;
      setMapPose((prev) => {
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
          batteryPct: prev.batteryPct,
          statusText: resolved.nodeName || prev.statusText,
          isOnline: true,
        };
      });
    });

    return () => {
      unsubTelemetry();
      unsubNav();
    };
  }, [subscribeTelemetry, subscribeNavigationStatus]);

  // Bộ đếm ngược 30 giây khi robot dừng chờ khách lấy hàng
  useEffect(() => {
    if (awaitingPickup) {
      setAutoCountdown(30);
      const interval = setInterval(() => {
        setAutoCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setAutoCountdown(null);
    }
  }, [awaitingPickup]);

  // Tự động chuyển kệ khi hết 30s
  useEffect(() => {
    if (autoCountdown === 0 && awaitingPickup) {
      handleConfirmPickup();
    }
  }, [autoCountdown, awaitingPickup]);

  // Giọng nói thông báo thân thiện
  const lastVoiceRef = useRef<string>('');
  useEffect(() => {
    if (status === 'ARRIVED' && awaitingPickup && destination) {
      const voiceKey = `ARRIVED-${destination.nodeId}-${currentWaypointIndex}`;
      if (lastVoiceRef.current !== voiceKey) {
        lastVoiceRef.current = voiceKey;
        speak(`Robot đã đến ${currentShelf.name}. Mời quý khách lấy sản phẩm nhé!`);
      }
    } else if (status === 'COMPLETED') {
      if (lastVoiceRef.current !== 'COMPLETED') {
        lastVoiceRef.current = 'COMPLETED';
        speak('Hành trình dẫn đường mua sắm đã hoàn tất. Cảm ơn quý khách!');
      }
    }
  }, [status, awaitingPickup, destination, currentWaypointIndex, currentShelf, speak]);

  // Tự động chuyển về Home sau khi hoàn tất
  useEffect(() => {
    if (status === 'COMPLETED' || status === 'CANCELLED') {
      const timer = setTimeout(() => {
        router.replace('/' as any);
      }, status === 'CANCELLED' ? 1800 : 4000);
      return () => clearTimeout(timer);
    }
  }, [status, router]);

  const handleConfirmPickup = async () => {
    try {
      await confirmPickup();
    } catch (err: any) {
      Alert.alert('Chưa thể tiếp tục', err?.message || 'Không gửi được tín hiệu tiếp tục đến Robot.');
    }
  };

  const handleCancelGuide = () => {
    Alert.alert(
      'Dừng dẫn đường?',
      'Quý khách có chắc chắn muốn kết thúc sớm hành trình dẫn đường này không?',
      [
        { text: 'Tiếp tục đi cùng Robot', style: 'cancel' },
        {
          text: 'Dừng dẫn đường',
          style: 'destructive',
          onPress: async () => {
            await cancelGuide().catch(() => undefined);
            router.replace('/' as any);
          },
        },
      ],
    );
  };

  const toggleProductCheck = (key: string) => {
    setCheckedProducts((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── 1. Header Khách Hàng Thân Thiện ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (isBusy) {
              handleCancelGuide();
            } else {
              router.back();
            }
          }}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color="#0f172a" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <View style={styles.robotAvatar}>
            <Bot size={22} color="#16a34a" />
            <View style={styles.livePulseDot} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Robot Dẫn Đường Mua Sắm</Text>
            <Text style={styles.headerSub}>
              {totalStops > 0
                ? `Chặng ${Math.min(currentWaypointIndex + 1, totalStops)}/${totalStops} điểm dừng · Dẫn theo giỏ hàng`
                : 'Đang chuẩn bị lộ trình mua sắm...'}
            </Text>
          </View>
        </View>

        {/* Trạng thái Pin & Kết nối */}
        <View style={styles.statusPillGroup}>
          <View style={[styles.statusPill, { backgroundColor: isHubConnected ? '#dcfce7' : '#fee2e2' }]}>
            <Radio size={13} color={isHubConnected ? '#15803d' : '#dc2626'} />
            <Text style={[styles.statusPillText, { color: isHubConnected ? '#15803d' : '#dc2626' }]}>
              {isHubConnected ? 'Trực tuyến' : 'Mất mạng'}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: '#f1f5f9' }]}>
            <Zap size={13} color="#f59e0b" />
            <Text style={[styles.statusPillText, { color: '#334155' }]}>{mapPose.batteryPct}%</Text>
          </View>
        </View>
      </View>

      {/* Progress Bar Thanh Tiến Độ Lộ Trình */}
      {totalStops > 0 && (
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${Math.min(
                  100,
                  ((status === 'COMPLETED' ? totalStops : currentWaypointIndex + (awaitingPickup ? 0.8 : 0.4)) /
                    totalStops) *
                    100
                )}%`,
              },
            ]}
          />
        </View>
      )}

      {/* ── 2. Nội dung chính: Hỗ trợ Responsive Kiosk / Tablet & Mobile ── */}
      <View style={[styles.mainContainer, isWide && styles.mainContainerWide]}>
        {/* CỘT TRÁI (HOẶC PHẦN BẢN ĐỒ KHI Ở TAB MAP TRÊN MOBILE) */}
        {(isWide || viewMode === 'map') && (
          <View style={[styles.mapColumn, isWide && styles.mapColumnWide]}>
            <View style={styles.mapCardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MapIcon size={18} color="#16a34a" />
                <Text style={styles.mapCardTitle}>Sơ Đồ Siêu Thị 2D</Text>
              </View>
              <Text style={styles.mapCardSub}>
                Robot: <Text style={{ fontWeight: '800', color: '#16a34a' }}>RB0001</Text> • Điểm đến:{' '}
                <Text style={{ fontWeight: '800', color: '#2563eb' }}>{currentShelf.name}</Text>
              </Text>
            </View>

            {/* Sơ đồ 2D SVG trực quan */}
            <View style={styles.mapCanvasWrapper}>
              <Store2DMapCanvas
                robotPose={mapPose}
                selectedShelfId={currentShelf.shelfId}
                showDimensions={false}
              />
            </View>

            {/* Chú thích bản đồ thân thiện */}
            <View style={styles.mapLegendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#15803d' }]} />
                <Text style={styles.legendText}>Robot AMR</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#2563eb' }]} />
                <Text style={styles.legendText}>Kệ đang đến</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
                <Text style={styles.legendText}>Trạm sạc</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
                <Text style={styles.legendText}>Quầy thu ngân</Text>
              </View>
            </View>
          </View>
        )}

        {/* CỘT PHẢI (HERO BANNER & LỘ TRÌNH TỪNG CHẶNG) */}
        {(isWide || viewMode === 'timeline') && (
          <ScrollView
            style={styles.scrollColumn}
            contentContainerStyle={[styles.scrollContent, awaitingPickup && { paddingBottom: 110 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* View Switcher trên Mobile (khi màn hình dọc) */}
            {!isWide && (
              <View style={styles.mobileTabSwitch}>
                <TouchableOpacity
                  style={[styles.tabButton, viewMode === 'timeline' && styles.tabButtonActive]}
                  onPress={() => setViewMode('timeline')}
                  activeOpacity={0.8}
                >
                  <Navigation size={15} color={viewMode === 'timeline' ? '#fff' : '#64748b'} />
                  <Text style={[styles.tabButtonText, viewMode === 'timeline' && styles.tabButtonTextActive]}>
                    Lộ Trình & Sản Phẩm
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabButton, viewMode === 'map' && styles.tabButtonActive]}
                  onPress={() => setViewMode('map')}
                  activeOpacity={0.8}
                >
                  <MapIcon size={15} color={viewMode === 'map' ? '#fff' : '#64748b'} />
                  <Text style={[styles.tabButtonText, viewMode === 'map' && styles.tabButtonTextActive]}>
                    Sơ Đồ Siêu Thị 2D
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── 3. HERO LIVE STATUS CARD (Bảng Điều Hướng Trực Tiếp) ── */}
            <View
              style={[
                styles.heroCard,
                awaitingPickup
                  ? styles.heroArrived
                  : status === 'COMPLETED'
                  ? styles.heroCompleted
                  : styles.heroMoving,
              ]}
            >
              <View style={styles.heroHeaderRow}>
                <View
                  style={[
                    styles.heroPill,
                    awaitingPickup && { backgroundColor: '#dcfce7' },
                    status === 'COMPLETED' && { backgroundColor: '#d1fae5' },
                  ]}
                >
                  {awaitingPickup ? (
                    <Sparkles size={16} color="#15803d" />
                  ) : status === 'COMPLETED' ? (
                    <CheckCircle2 size={16} color="#059669" />
                  ) : (
                    <Navigation size={16} color="#0284c7" />
                  )}
                  <Text
                    style={[
                      styles.heroPillText,
                      awaitingPickup && { color: '#15803d' },
                      status === 'COMPLETED' && { color: '#059669' },
                    ]}
                  >
                    {awaitingPickup
                      ? 'ĐÃ ĐẾN ĐIỂM HẸN — VUI LÒNG LẤY HÀNG'
                      : status === 'COMPLETED'
                      ? 'HOÀN TẤT HÀNH TRÌNH MUA SẮM 🎉'
                      : 'ROBOT ĐANG DẪN ĐƯỜNG...'}
                  </Text>
                </View>

                {totalStops > 0 && status !== 'COMPLETED' && (
                  <View style={styles.stopCountTag}>
                    <Text style={styles.stopCountTagText}>
                      Chặng {Math.min(currentWaypointIndex + 1, totalStops)} / {totalStops}
                    </Text>
                  </View>
                )}
              </View>

              {/* Tên Kệ & Hướng dẫn chính */}
              {status === 'COMPLETED' ? (
                <View style={styles.heroCompletedContent}>
                  <Text style={styles.heroCompletedTitle}>Mua sắm thành công!</Text>
                  <Text style={styles.heroCompletedDesc}>
                    Quý khách đã nhặt đủ toàn bộ sản phẩm trong giỏ hàng. Mời quý khách tiến về{' '}
                    <Text style={{ fontWeight: '800', color: '#0f172a' }}>Quầy Thu Ngân</Text> để thanh toán.
                  </Text>
                  <Text style={styles.heroAutoHomeNote}>
                    Robot sẽ tự động quay về trạm sạc trong vài giây tới...
                  </Text>
                  <TouchableOpacity
                    style={styles.finishHomeBtn}
                    onPress={() => router.replace('/' as any)}
                    activeOpacity={0.85}
                  >
                    <Home size={18} color="#fff" />
                    <Text style={styles.finishHomeBtnText}>Về Màn Hình Chính Ngay</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.heroTargetBlock}>
                    <Text style={styles.heroTargetSubtitle}>
                      {awaitingPickup ? '📍 Bạn đang đứng tại:' : '🚀 Điểm đến tiếp theo:'}
                    </Text>
                    <View style={styles.heroShelfTitleRow}>
                      <Text style={styles.heroShelfIcon}>{currentShelf.icon}</Text>
                      <Text style={styles.heroShelfName}>{currentShelf.name}</Text>
                    </View>
                    <Text style={styles.heroAisleText}>
                      {currentShelf.aisleCode} • Phân khu: {currentShelf.category}
                    </Text>
                  </View>

                  {/* Danh sách sản phẩm cần lấy tại kệ này */}
                  {currentShelf.products.length > 0 && (
                    <View style={styles.heroProductListCard}>
                      <View style={styles.heroProductHeaderRow}>
                        <Package size={15} color="#15803d" />
                        <Text style={styles.heroProductHeaderTitle}>
                          {awaitingPickup
                            ? 'Sản phẩm cần nhặt vào giỏ (Chạm để đánh dấu):'
                            : 'Món hàng sẽ lấy tại kệ này:'}
                        </Text>
                      </View>

                      <View style={styles.heroProductsWrap}>
                        {currentShelf.products.map((pName, pIdx) => {
                          const itemKey = `${destination?.nodeId || 0}-${pIdx}-${pName}`;
                          const isChecked = !!checkedProducts[itemKey];

                          return (
                            <TouchableOpacity
                              key={pIdx}
                              style={[
                                styles.productCheckChip,
                                isChecked && styles.productCheckChipDone,
                                awaitingPickup && styles.productCheckChipInteractive,
                              ]}
                              onPress={() => toggleProductCheck(itemKey)}
                              activeOpacity={awaitingPickup ? 0.7 : 1}
                            >
                              <View
                                style={[
                                  styles.checkboxBox,
                                  isChecked && styles.checkboxBoxDone,
                                ]}
                              >
                                {isChecked ? (
                                  <Check size={12} color="#fff" strokeWidth={3} />
                                ) : (
                                  <View style={styles.checkboxInnerDot} />
                                )}
                              </View>
                              <Text
                                style={[
                                  styles.productChipText,
                                  isChecked && styles.productChipTextDone,
                                ]}
                              >
                                {pName}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* Khi robot đã đến kệ: Thanh đếm ngược & Nút hành động trực tiếp */}
                  {awaitingPickup && (
                    <View style={styles.heroPickupSection}>
                      {autoCountdown !== null && (
                        <View style={styles.countdownRow}>
                          <Text style={styles.countdownText}>
                            Tự động tiếp tục sau: <Text style={styles.countdownNumber}>{autoCountdown}s</Text>
                          </Text>
                          <View style={styles.countdownTrack}>
                            <View
                              style={[
                                styles.countdownFill,
                                { width: `${(autoCountdown / 30) * 100}%` },
                              ]}
                            />
                          </View>
                        </View>
                      )}

                      <TouchableOpacity
                        style={styles.heroPickupButton}
                        onPress={handleConfirmPickup}
                        activeOpacity={0.88}
                      >
                        <CheckCircle2 size={22} color="#fff" />
                        <Text style={styles.heroPickupButtonText}>
                          {isFinalStop
                            ? 'Tôi Đã Lấy Xong — Hoàn Tất Mua Sắm ✓'
                            : 'Tôi Đã Lấy Hàng — Đi Kệ Tiếp Theo ➜'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>

            {/* ── 4. HÀNH TRÌNH TỪNG CHẶNG (Shopping Journey Stepper) ── */}
            <View style={styles.stepperSection}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Hành Trình Mua Sắm Của Bạn</Text>
                  <Text style={styles.sectionSub}>
                    Robot đồng hành qua từng chặng để bạn thong thả nhặt sản phẩm
                  </Text>
                </View>
              </View>

              {/* 🟢 BƯỚC 1: Điểm Khởi Hành (Trạm đón khách) */}
              <View style={styles.stepItem}>
                <View style={styles.stepRail}>
                  <View style={[styles.stepDot, styles.stepDotDone]}>
                    <Check size={14} color="#fff" strokeWidth={3} />
                  </View>
                  <View style={[styles.stepLine, styles.stepLineDone]} />
                </View>
                <View style={styles.stepCardWrap}>
                  <View style={styles.stepCard}>
                    <View style={styles.stepHeaderRow}>
                      <View style={styles.stepTitleGroup}>
                        <Text style={styles.stepCategoryTag}>ĐIỂM XUẤT PHÁT</Text>
                        <Text style={styles.stepTitleText}>Trạm Đón Khách Trung Tâm</Text>
                        <Text style={styles.stepMetaText}>Robot nhận yêu cầu và bắt đầu dẫn đường</Text>
                      </View>
                      <View style={styles.stepBadgeDone}>
                        <Text style={styles.stepBadgeDoneText}>Đã xuất phát ✓</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              {/* 🛒 CÁC CHẶNG KỆ HÀNG TRONG GIỎ */}
              {destinations.length === 0 ? (
                <View style={styles.emptyCartCard}>
                  <ShoppingBag size={32} color="#94a3b8" />
                  <Text style={styles.emptyCartTitle}>Chưa có điểm dừng nào</Text>
                  <Text style={styles.emptyCartSub}>
                    Hãy chọn sản phẩm vào giỏ hàng và chọn "Robot dẫn đường" để bắt đầu lộ trình.
                  </Text>
                </View>
              ) : (
                destinations.map((dest, idx) => {
                  const shelfInfo = getShelfData(dest);
                  const isCompleted = idx < currentWaypointIndex || status === 'COMPLETED';
                  const isCurrent =
                    idx === currentWaypointIndex && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(status);
                  const isArrived = isCurrent && awaitingPickup;

                  return (
                    <View key={`${dest.nodeId}-${idx}`} style={styles.stepItem}>
                      <View style={styles.stepRail}>
                        <View
                          style={[
                            styles.stepDot,
                            isCompleted && styles.stepDotDone,
                            isCurrent && styles.stepDotActive,
                            isArrived && styles.stepDotArrived,
                          ]}
                        >
                          {isCompleted ? (
                            <Check size={14} color="#fff" strokeWidth={3} />
                          ) : (
                            <Text style={styles.stepDotNumber}>{idx + 1}</Text>
                          )}
                        </View>
                        <View
                          style={[
                            styles.stepLine,
                            (isCompleted || (isCurrent && awaitingPickup)) && styles.stepLineDone,
                          ]}
                        />
                      </View>

                      <View style={styles.stepCardWrap}>
                        <View
                          style={[
                            styles.stepCard,
                            isCompleted && styles.stepCardDone,
                            isCurrent && styles.stepCardActive,
                            isArrived && styles.stepCardArrived,
                          ]}
                        >
                          <View style={styles.stepHeaderRow}>
                            <View style={styles.stepTitleGroup}>
                              <Text style={styles.stepCategoryTag}>
                                {shelfInfo.aisleCode} • {shelfInfo.category}
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={{ fontSize: 18 }}>{shelfInfo.icon}</Text>
                                <Text
                                  style={[
                                    styles.stepTitleText,
                                    isCurrent && { color: '#0f172a', fontWeight: '900' },
                                  ]}
                                >
                                  {shelfInfo.name}
                                </Text>
                              </View>
                            </View>

                            {/* Badge trạng thái chặng */}
                            {isCompleted && (
                              <View style={styles.stepBadgeDone}>
                                <Text style={styles.stepBadgeDoneText}>Đã lấy xong ✓</Text>
                              </View>
                            )}
                            {isArrived && (
                              <View style={styles.stepBadgeArrived}>
                                <Flame size={12} color="#15803d" />
                                <Text style={styles.stepBadgeArrivedText}>Đang dừng tại kệ</Text>
                              </View>
                            )}
                            {isCurrent && !isArrived && (
                              <View style={styles.stepBadgeMoving}>
                                <Navigation size={12} color="#0284c7" />
                                <Text style={styles.stepBadgeMovingText}>Đang di chuyển tới</Text>
                              </View>
                            )}
                            {!isCompleted && !isCurrent && (
                              <View style={styles.stepBadgeUpcoming}>
                                <Text style={styles.stepBadgeUpcomingText}>Chặng {idx + 1}</Text>
                              </View>
                            )}
                          </View>

                          {/* Sản phẩm cần lấy ở kệ này */}
                          {shelfInfo.products.length > 0 && (
                            <View style={styles.stepProductsList}>
                              <Text style={styles.stepProductsLabel}>Món hàng cần nhặt:</Text>
                              <View style={styles.stepProductBadgesRow}>
                                {shelfInfo.products.map((pName, pIdx) => {
                                  const key = `${dest.nodeId}-${pIdx}-${pName}`;
                                  const isChecked = !!checkedProducts[key];
                                  return (
                                    <View
                                      key={pIdx}
                                      style={[
                                        styles.stepProductPill,
                                        isChecked && styles.stepProductPillDone,
                                      ]}
                                    >
                                      {isChecked ? (
                                        <PackageCheck size={13} color="#15803d" />
                                      ) : (
                                        <Package size={13} color="#64748b" />
                                      )}
                                      <Text
                                        style={[
                                          styles.stepProductPillText,
                                          isChecked && styles.stepProductPillTextDone,
                                        ]}
                                      >
                                        {pName}
                                      </Text>
                                    </View>
                                  );
                                })}
                              </View>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })
              )}

              {/* 🏁 BƯỚC CUỐI: Quầy Thu Ngân & Hoàn Tất */}
              <View style={styles.stepItem}>
                <View style={styles.stepRail}>
                  <View
                    style={[
                      styles.stepDot,
                      status === 'COMPLETED' ? styles.stepDotDone : styles.stepDotEnd,
                    ]}
                  >
                    {status === 'COMPLETED' ? (
                      <Check size={14} color="#fff" strokeWidth={3} />
                    ) : (
                      <CreditCard size={14} color="#64748b" />
                    )}
                  </View>
                </View>
                <View style={styles.stepCardWrap}>
                  <View style={styles.stepCard}>
                    <View style={styles.stepHeaderRow}>
                      <View style={styles.stepTitleGroup}>
                        <Text style={styles.stepCategoryTag}>ĐÍCH ĐẾN CUỐI CÙNG</Text>
                        <Text style={styles.stepTitleText}>Quầy Thu Ngân & Hoàn Tất</Text>
                        <Text style={styles.stepMetaText}>
                          Quý khách thanh toán giỏ hàng · Robot sẽ tự động quay về trạm sạc
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.stepBadgeDone,
                          {
                            backgroundColor: status === 'COMPLETED' ? '#dcfce7' : '#f1f5f9',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.stepBadgeDoneText,
                            {
                              color: status === 'COMPLETED' ? '#15803d' : '#64748b',
                            },
                          ]}
                        >
                          {status === 'COMPLETED' ? 'Đã hoàn thành ✓' : 'Kết thúc'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Nút hủy phiên an toàn */}
            {isBusy && status !== 'COMPLETED' && (
              <TouchableOpacity
                style={styles.cancelLinkButton}
                onPress={handleCancelGuide}
                activeOpacity={0.8}
              >
                <OctagonX size={16} color="#ef4444" />
                <Text style={styles.cancelLinkText}>Tôi muốn tự đi tiếp (Dừng dẫn đường)</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
      </View>

      {/* ── 5. Fixed Bottom Action Bar khi đã đến nơi (Cho Mobile) ── */}
      {awaitingPickup && !isWide && (
        <View style={styles.bottomFixedBar}>
          <TouchableOpacity
            style={styles.bottomFixedButton}
            onPress={handleConfirmPickup}
            activeOpacity={0.88}
          >
            <CheckCircle2 size={22} color="#fff" />
            <Text style={styles.bottomFixedButtonText}>
              {isFinalStop
                ? `Đã lấy xong — Hoàn tất mua sắm ✓${autoCountdown !== null ? ` (${autoCountdown}s)` : ''}`
                : `Đã lấy sản phẩm — Đi tiếp ➜${autoCountdown !== null ? ` (${autoCountdown}s)` : ''}`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },

  /* ── Header ── */
  header: {
    minHeight: 74,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  robotAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  livePulseDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  headerTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  headerSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  statusPillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },

  /* Progress Bar */
  progressBarBg: {
    height: 4,
    width: '100%',
    backgroundColor: '#e2e8f0',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#16a34a',
  },

  /* ── Layout Container ── */
  mainContainer: {
    flex: 1,
  },
  mainContainerWide: {
    flexDirection: 'row',
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    padding: 16,
    gap: 20,
  },

  /* ── Cột Bản Đồ (Map Column) ── */
  mapColumn: {
    flex: 1,
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  mapColumnWide: {
    flex: 0.48,
    margin: 0,
    minHeight: 620,
  },
  mapCardHeader: {
    marginBottom: 12,
  },
  mapCardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  mapCardSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  mapCanvasWrapper: {
    flex: 1,
    minHeight: 380,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    backgroundColor: '#fafafa',
  },
  mapLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },

  /* ── Cột Cuộn (Scroll Column) ── */
  scrollColumn: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },

  /* ── Mobile Tab Switcher ── */
  mobileTabSwitch: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    padding: 4,
    borderRadius: 16,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: '#16a34a',
    shadowColor: '#16a34a',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  tabButtonTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },

  /* ── HERO LIVE STATUS CARD ── */
  heroCard: {
    borderRadius: 24,
    padding: 20,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  heroMoving: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1.5,
    borderColor: '#7dd3fc',
  },
  heroArrived: {
    backgroundColor: '#f0fdf4',
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  heroCompleted: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#34d399',
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#e0f2fe',
  },
  heroPillText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0369a1',
    letterSpacing: 0.3,
  },
  stopCountTag: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stopCountTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },

  heroTargetBlock: {
    gap: 4,
  },
  heroTargetSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  heroShelfTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroShelfIcon: {
    fontSize: 26,
  },
  heroShelfName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  heroAisleText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
    marginTop: 2,
  },

  /* Product Pick List in Hero */
  heroProductListCard: {
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  heroProductHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroProductHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803d',
  },
  heroProductsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  productCheckChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  productCheckChipInteractive: {
    borderColor: '#cbd5e1',
  },
  productCheckChipDone: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxBoxDone: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  checkboxInnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
  },
  productChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  productChipTextDone: {
    color: '#15803d',
    textDecorationLine: 'line-through',
  },

  /* Pickup Actions in Hero */
  heroPickupSection: {
    gap: 10,
    marginTop: 4,
  },
  countdownRow: {
    gap: 4,
  },
  countdownText: {
    fontSize: 12,
    color: '#15803d',
    fontWeight: '700',
  },
  countdownNumber: {
    fontWeight: '900',
    color: '#166534',
  },
  countdownTrack: {
    height: 4,
    width: '100%',
    backgroundColor: '#bbf7d0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  countdownFill: {
    height: '100%',
    backgroundColor: '#16a34a',
  },
  heroPickupButton: {
    backgroundColor: '#16a34a',
    borderRadius: 18,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
    shadowColor: '#16a34a',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  heroPickupButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.2,
  },

  /* Hero Completed State */
  heroCompletedContent: {
    gap: 8,
    paddingVertical: 6,
  },
  heroCompletedTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#065f46',
  },
  heroCompletedDesc: {
    fontSize: 14,
    color: '#047857',
    lineHeight: 20,
  },
  heroAutoHomeNote: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: 4,
  },
  finishHomeBtn: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  finishHomeBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },

  /* ── 4. STEPPING TIMELINE ── */
  stepperSection: {
    marginTop: 4,
    gap: 12,
  },
  sectionHeaderRow: {
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
  },
  sectionSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },

  stepItem: {
    flexDirection: 'row',
    minHeight: 70,
  },
  stepRail: {
    width: 38,
    alignItems: 'center',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stepDotDone: {
    backgroundColor: '#16a34a',
  },
  stepDotActive: {
    backgroundColor: '#0284c7',
    borderWidth: 2,
    borderColor: '#bae6fd',
  },
  stepDotArrived: {
    backgroundColor: '#16a34a',
    borderWidth: 2,
    borderColor: '#bbf7d0',
  },
  stepDotEnd: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
  },
  stepDotNumber: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
  },
  stepLine: {
    flex: 1,
    width: 2.5,
    backgroundColor: '#e2e8f0',
    marginVertical: 4,
  },
  stepLineDone: {
    backgroundColor: '#86efac',
  },

  stepCardWrap: {
    flex: 1,
    paddingBottom: 14,
  },
  stepCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  stepCardDone: {
    backgroundColor: '#f8fafc',
    opacity: 0.85,
  },
  stepCardActive: {
    backgroundColor: '#f0f9ff',
    borderColor: '#7dd3fc',
    borderWidth: 1.5,
  },
  stepCardArrived: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
    borderWidth: 1.5,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepTitleGroup: {
    flex: 1,
    gap: 2,
  },
  stepCategoryTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  stepTitleText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
  },
  stepMetaText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },

  stepBadgeDone: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  stepBadgeDoneText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803d',
  },
  stepBadgeArrived: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  stepBadgeArrivedText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803d',
  },
  stepBadgeMoving: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  stepBadgeMovingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284c7',
  },
  stepBadgeUpcoming: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  stepBadgeUpcomingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
  },

  stepProductsList: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
    gap: 6,
  },
  stepProductsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  stepProductBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  stepProductPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stepProductPillDone: {
    backgroundColor: '#dcfce7',
  },
  stepProductPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  stepProductPillTextDone: {
    color: '#15803d',
    textDecorationLine: 'line-through',
  },

  /* Empty Cart State */
  emptyCartCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    gap: 8,
    marginVertical: 8,
  },
  emptyCartTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#475569',
  },
  emptyCartSub: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },

  /* Cancel Link */
  cancelLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 6,
  },
  cancelLinkText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Fixed Bottom Bar on Mobile */
  bottomFixedBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    paddingBottom: 22,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  bottomFixedButton: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  bottomFixedButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
});
