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
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
  Search,
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
import { useRobotAuth } from '../../context/RobotAuthContext';
import { CartService } from '../../services/CartService';

/**
 * Trợ giúp phân giải thông tin kệ hàng thân thiện từ destination
 */
function getShelfData(item?: GuideDestination | null, fallbackShelfName?: string) {
  if (!item) {
    if (fallbackShelfName) {
      const match = fallbackShelfName.match(/(\d+)/);
      const sId = match ? parseInt(match[1], 10) : 1;
      const found = SHELVES_6.find((s) => s.shelfId === sId);
      if (found) {
        return {
          shelfId: sId,
          name: found.name,
          category: found.category,
          icon: found.icon,
          aisleCode: found.aisleCode,
          themeColor: found.themeColor,
          themeBg: found.themeBg,
          products: found.sampleProducts || [],
        };
      }
    }
    return {
      shelfId: 1,
      name: fallbackShelfName || 'Kệ hàng siêu thị',
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
    if (item.nodeId >= 10017 && item.nodeId <= 10022) {
      sId = item.nodeId - 10016; // 10017 -> 1, ..., 10022 -> 6
    } else if (item.nodeId >= 1 && item.nodeId <= 6) {
      sId = item.nodeId;
    }
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

  // Params từ màn hình quảng cáo hoặc tra cứu (khi khách tương tác "Dẫn Đường")
  const params = useLocalSearchParams<{
    fromAd?: string;
    from?: string;
    returnUrl?: string;
    productId?: string;
    productIds?: string;
    productName?: string;
    productNames?: string;
    productImage?: string;
    productImages?: string;
    productPrice?: string;
    productPrices?: string;
    shelfName?: string;
    aisleName?: string;
  }>();

  const returnRoute = useMemo(() => {
    if (params.returnUrl && typeof params.returnUrl === 'string') return params.returnUrl;
    if (params.from === 'search') return '/product-search';
    if (params.from === 'cart') return '/member-cart';
    if (params.fromAd === '1') return '/';
    return '/product-search';
  }, [params.returnUrl, params.from, params.fromAd]);

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
    dispatchCart,
  } = useRobotGuide();

  const { subscribeTelemetry, subscribeNavigationStatus } = useRobotRealtime();
  const { speak } = useRobotVoice();
  const { token } = useRobotAuth();

  // Flag dọn dẹp giỏ hàng khi hoàn tất
  const hasClearedCartRef = useRef(false);

  // Tự động dispatch guide khi có params sản phẩm mà chưa có active mission
  const hasAutoDispatchedRef = useRef(false);
  useEffect(() => {
    if (hasAutoDispatchedRef.current) return;

    // Xây dựng danh sách sản phẩm từ params
    let items: { productId: number; productName: string }[] = [];

    if (params.productIds) {
      const ids = params.productIds.split(',').map(s => Number(s.trim())).filter(n => n > 0);
      const names = params.productNames ? params.productNames.split('||') : [];
      items = ids.map((id, i) => ({ productId: id, productName: names[i] || 'Sản phẩm' }));
    } else if (params.productId) {
      const id = Number(params.productId);
      if (id > 0) items = [{ productId: id, productName: params.productName || 'Sản phẩm' }];
    }

    if (items.length === 0) return;

    // Nếu mission hiện tại đã đang điều hướng thì không dispatch đè
    if (status === 'NAVIGATING' || status === 'MOVING' || status === 'DISPATCHING') {
      return;
    }

    hasAutoDispatchedRef.current = true;
    dispatchCart(items).catch(err => {
      console.warn('[CartGuideMapScreen] Auto-dispatch thất bại:', err);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.productId, params.productIds, params.productName, status]);


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
  const currentShelf = useMemo(
    () => getShelfData(destination, params.shelfName || params.aisleName),
    [destination, params.shelfName, params.aisleName]
  );

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

  // Tự động chuyển về Home sau khi hoàn tất & Dọn dẹp các sản phẩm đã được dẫn trong giỏ hàng
  useEffect(() => {
    if (status === 'COMPLETED' && token && !hasClearedCartRef.current) {
      hasClearedCartRef.current = true;
      console.log('[CartGuideMapScreen] Dẫn đường hoàn tất -> Xóa các sản phẩm đã dẫn trong giỏ hàng');
      if (params.fromAd === '1' && params.productId) {
        CartService.removeItem(Number(params.productId), token).catch((e) =>
          console.warn('[CartGuideMapScreen] removeItem error:', e)
        );
      } else if (params.fromAd === '1' && params.productIds) {
        const ids = params.productIds.split(',').map((s) => Number(s.trim())).filter((n) => n > 0);
        ids.forEach((id) =>
          CartService.removeItem(id, token).catch((e) =>
            console.warn('[CartGuideMapScreen] removeItem error:', e)
          )
        );
      } else {
        // Dẫn đường từ Giỏ hàng (toàn bộ giỏ) -> Xóa toàn bộ giỏ hàng của thành viên
        CartService.clearCart(token).catch((e) =>
          console.warn('[CartGuideMapScreen] clearCart error:', e)
        );
      }
    }

    if (status === 'COMPLETED' || status === 'CANCELLED') {
      const timer = setTimeout(() => {
        router.replace(returnRoute as any);
      }, status === 'CANCELLED' ? 1500 : 3500);
      return () => clearTimeout(timer);
    }
  }, [status, router, token, params.fromAd, params.productId, params.productIds, returnRoute]);

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
            router.replace(returnRoute as any);
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


  // ─── Derive ad product info from params ───────────────────────────────────
  const adImages   = params.productImages  ? params.productImages.split('||')  : params.productImage  ? [params.productImage]  : [];
  const adNames    = params.productNames   ? params.productNames.split('||')   : params.productName   ? [params.productName]   : [];
  const adPrices   = params.productPrices  ? params.productPrices.split(',').map(Number)  : params.productPrice  ? [Number(params.productPrice)] : [];
  const primaryImage  = adImages[0]  || '';
  const primaryName   = adNames[0]   || (destination?.productNames?.[0] ?? currentShelf.name);
  const primaryPrice  = adPrices[0]  || 0;
  const isFromAd      = params.fromAd === '1';
  const isMultiProduct = adNames.length > 1;

  return (
    <SafeAreaView style={s.safe}>
      {/* ── Header slim ── */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => { if (isBusy) handleCancelGuide(); else router.back(); }}
          activeOpacity={0.7}
        >
          <ChevronLeft size={22} color="#0f172a" />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <View style={s.robotDot}>
            <Bot size={18} color="#16a34a" />
            <View style={[s.liveDot, { backgroundColor: isHubConnected ? '#22c55e' : '#ef4444' }]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle} numberOfLines={1}>Robot Dẫn Đường</Text>
            <Text style={s.headerSub} numberOfLines={1}>
              {totalStops > 0
                ? `Chặng ${Math.min(currentWaypointIndex + 1, totalStops)}/${totalStops} · ${isHubConnected ? 'Trực tuyến' : 'Mất kết nối'}`
                : 'Đang chuẩn bị…'}
            </Text>
          </View>
        </View>

        <View style={s.batteryPill}>
          <Zap size={12} color="#f59e0b" />
          <Text style={s.batteryText}>{mapPose.batteryPct}%</Text>
        </View>
      </View>

      {/* Progress bar */}
      {totalStops > 0 && (
        <View style={s.progressBg}>
          <View style={[s.progressFill, {
            width: `${Math.min(100,
              ((status === 'COMPLETED' ? totalStops : currentWaypointIndex + (awaitingPickup ? 0.85 : 0.3)) / totalStops) * 100
            )}%` as any,
          }]} />
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, awaitingPickup && { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── STATUS CHIP ── */}
        <View style={s.statusChipRow}>
          <View style={[
            s.statusChip,
            awaitingPickup   ? s.chipArrived   :
            status === 'COMPLETED' ? s.chipDone :
            s.chipMoving,
          ]}>
            {awaitingPickup ? (
              <Sparkles size={14} color="#15803d" />
            ) : status === 'COMPLETED' ? (
              <CheckCircle2 size={14} color="#059669" />
            ) : (
              <Navigation size={14} color="#0284c7" />
            )}
            <Text style={[
              s.statusChipText,
              awaitingPickup   ? { color: '#15803d' } :
              status === 'COMPLETED' ? { color: '#059669' } :
              { color: '#0284c7' },
            ]}>
              {awaitingPickup
                ? '📍 Đã đến điểm hẹn'
                : status === 'COMPLETED'
                ? '✅ Hoàn tất mua sắm!'
                : '🚀 Robot đang di chuyển…'}
            </Text>
          </View>
        </View>

        {/* ── COMPLETED STATE ── */}
        {status === 'COMPLETED' ? (
          <View style={s.completedBox}>
            <Text style={s.completedEmoji}>🎉</Text>
            <Text style={s.completedTitle}>Đã đến đúng vị trí sản phẩm!</Text>
            <Text style={s.completedSub}>
              Mời quý khách kiểm tra và lấy sản phẩm trên quầy kệ. Robot sẽ tự động quay lại màn hình tra cứu sau vài giây.
            </Text>
            <View style={{ width: '100%', gap: 10, marginTop: 12 }}>
              <TouchableOpacity
                style={s.homeBtn}
                onPress={() => router.replace(returnRoute as any)}
                activeOpacity={0.85}
              >
                {returnRoute === '/member-cart' ? (
                  <ShoppingBag size={18} color="#fff" />
                ) : (
                  <Search size={18} color="#fff" />
                )}
                <Text style={s.homeBtnText}>
                  {returnRoute === '/member-cart' ? 'Quay Lại Giỏ Hàng' : 'Tiếp Tục Tra Cứu Hàng'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.homeBtn, { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' }]}
                onPress={() => router.replace('/' as any)}
                activeOpacity={0.85}
              >
                <Home size={18} color="#475569" />
                <Text style={[s.homeBtnText, { color: '#475569' }]}>Về Màn Hình Chờ</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {/* ── HERO PRODUCT IMAGE (large) ── */}
            {primaryImage ? (
              <View style={s.heroImageWrap}>
                <Image
                  source={{ uri: primaryImage }}
                  style={s.heroImage}
                  resizeMode="cover"
                />
                {/* overlay gradient label */}
                <View style={s.heroImageOverlay}>
                  <View style={s.heroShelfPill}>
                    <MapPin size={11} color="#fff" />
                    <Text style={s.heroShelfPillText} numberOfLines={1}>
                      {awaitingPickup ? '📍 Đang dừng tại' : '➡ Đang đến'}: {currentShelf.name}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              /* Fallback: emoji shelf card when no image */
              <View style={s.heroFallbackCard}>
                <Text style={{ fontSize: 52 }}>{currentShelf.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.heroFallbackShelf} numberOfLines={2}>{currentShelf.name}</Text>
                  <View style={s.heroFallbackPill}>
                    <MapPin size={11} color={awaitingPickup ? '#15803d' : '#0284c7'} />
                    <Text style={[s.heroFallbackPillText, { color: awaitingPickup ? '#15803d' : '#0284c7' }]} numberOfLines={1}>
                      {awaitingPickup ? 'Đang dừng tại đây' : 'Đang di chuyển tới'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* ── PRIMARY PRODUCT NAME + PRICE ── */}
            <View style={s.productInfoBlock}>
              <Text style={s.productPrimaryName} numberOfLines={3}>{primaryName}</Text>
              {primaryPrice > 0 && (
                <Text style={s.productPrice}>
                  {primaryPrice.toLocaleString('vi-VN')}₫
                </Text>
              )}
              <Text style={s.shelfLabel}>
                {currentShelf.aisleCode} · {currentShelf.category}
              </Text>
            </View>

            {/* ── MULTI-PRODUCT THUMBNAILS (if > 1 item) ── */}
            {isMultiProduct && adNames.length > 1 && (
              <View style={s.multiRow}>
                <Text style={s.multiLabel}>Các sản phẩm trong hành trình:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.multiScroll}>
                  {adNames.map((name, i) => (
                    <View key={i} style={[s.thumbCard, i === 0 && s.thumbCardFirst]}>
                      {adImages[i] ? (
                        <Image source={{ uri: adImages[i] }} style={s.thumbImg} resizeMode="cover" />
                      ) : (
                        <View style={s.thumbImgFallback}>
                          <Text style={{ fontSize: 20 }}>🛒</Text>
                        </View>
                      )}
                      <Text style={s.thumbName} numberOfLines={2}>{name}</Text>
                      {adPrices[i] > 0 && (
                        <Text style={s.thumbPrice}>{adPrices[i].toLocaleString('vi-VN')}₫</Text>
                      )}
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ── DESTINATIONS LIST (compact chips, for multi-stop) ── */}
            {destinations.length > 1 && (
              <View style={s.destListBox}>
                <Text style={s.destListLabel}>Lộ trình dừng:</Text>
                <View style={s.destChipsRow}>
                  {destinations.map((dest, idx) => {
                    const si = getShelfData(dest);
                    const isDone    = idx < currentWaypointIndex;
                    const isCur     = idx === currentWaypointIndex && status !== 'FAILED' && status !== 'CANCELLED';
                    return (
                      <View key={idx} style={[
                        s.destChip,
                        isDone && s.destChipDone,
                        isCur  && s.destChipActive,
                      ]}>
                        <Text style={{ fontSize: 13 }}>{isDone ? '✅' : isCur ? '📍' : si.icon}</Text>
                        <Text style={[
                          s.destChipText,
                          isDone && s.destChipTextDone,
                          isCur  && s.destChipTextActive,
                        ]} numberOfLines={1}>{si.name}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── COUNTDOWN when awaiting pickup ── */}
            {awaitingPickup && autoCountdown !== null && (
              <View style={s.countdownBox}>
                <Text style={s.countdownLabel}>
                  Tự động tiếp tục sau <Text style={s.countdownNum}>{autoCountdown}s</Text>
                </Text>
                <View style={s.countdownTrack}>
                  <View style={[s.countdownFill, { width: `${(autoCountdown / 30) * 100}%` as any }]} />
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── FIXED BOTTOM CONFIRM BUTTON (only when awaiting pickup) ── */}
      {awaitingPickup && (
        <View style={s.bottomBar}>
          <TouchableOpacity style={s.confirmBtn} onPress={handleConfirmPickup} activeOpacity={0.88}>
            <CheckCircle2 size={22} color="#fff" />
            <Text style={s.confirmBtnText}>
              {isFinalStop
                ? `Đã lấy xong — Hoàn tất ✓${autoCountdown !== null ? ` (${autoCountdown}s)` : ''}`
                : `Đã lấy hàng — Đi tiếp ➜${autoCountdown !== null ? ` (${autoCountdown}s)` : ''}`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}



const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#f8fafc' },

  /* Header */
  header:       { height: 60, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  robotDot:     { width: 36, height: 36, borderRadius: 18, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  liveDot:      { position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: '#fff' },
  headerTitle:  { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  headerSub:    { fontSize: 10, color: '#64748b', fontWeight: '600' },
  batteryPill:  { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fef9c3', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  batteryText:  { fontSize: 11, fontWeight: '700', color: '#92400e' },

  /* Progress */
  progressBg:   { height: 3, backgroundColor: '#e2e8f0' },
  progressFill: { height: 3, backgroundColor: '#16a34a', borderRadius: 2 },

  /* Scroll */
  scroll: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40, gap: 14 },

  /* Status chip */
  statusChipRow: { alignItems: 'flex-start' },
  statusChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#e0f2fe' },
  chipMoving:    { backgroundColor: '#e0f2fe' },
  chipArrived:   { backgroundColor: '#dcfce7' },
  chipDone:      { backgroundColor: '#d1fae5' },
  statusChipText:{ fontSize: 12, fontWeight: '700' },

  /* Hero image */
  heroImageWrap:    { borderRadius: 20, overflow: 'hidden', height: 260, backgroundColor: '#e2e8f0' },
  heroImage:        { width: '100%', height: '100%' },
  heroImageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14, paddingTop: 40, backgroundColor: 'rgba(0,0,0,0.35)' },
  heroShelfPill:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  heroShelfPillText:{ color: '#fff', fontSize: 11, fontWeight: '700' },

  /* Fallback hero (no image) */
  heroFallbackCard:   { backgroundColor: '#fff', borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  heroFallbackShelf:  { fontSize: 17, fontWeight: '800', color: '#0f172a', marginBottom: 6 },
  heroFallbackPill:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#e0f2fe', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14 },
  heroFallbackPillText:{ fontSize: 11, fontWeight: '700' },

  /* Product info */
  productInfoBlock: { gap: 4 },
  productPrimaryName:{ fontSize: 20, fontWeight: '900', color: '#0f172a', lineHeight: 27 },
  productPrice:      { fontSize: 16, fontWeight: '800', color: '#dc2626' },
  shelfLabel:        { fontSize: 12, fontWeight: '600', color: '#64748b' },

  /* Multi-product thumbnails */
  multiRow:    { gap: 8 },
  multiLabel:  { fontSize: 12, fontWeight: '700', color: '#475569' },
  multiScroll: { gap: 10, paddingVertical: 4 },
  thumbCard:   { width: 100, backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2, padding: 0 },
  thumbCardFirst:{ borderWidth: 2, borderColor: '#16a34a' },
  thumbImg:    { width: '100%', height: 72 },
  thumbImgFallback: { width: '100%', height: 72, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  thumbName:   { fontSize: 10, fontWeight: '700', color: '#0f172a', padding: 6, lineHeight: 13 },
  thumbPrice:  { fontSize: 10, fontWeight: '800', color: '#dc2626', paddingHorizontal: 6, paddingBottom: 6 },

  /* Destinations chips */
  destListBox:   { gap: 8 },
  destListLabel: { fontSize: 12, fontWeight: '700', color: '#475569' },
  destChipsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  destChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  destChipActive:{ backgroundColor: '#dbeafe', borderColor: '#93c5fd' },
  destChipDone:  { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  destChipText:  { fontSize: 11, fontWeight: '700', color: '#475569' },
  destChipTextActive:{ color: '#1d4ed8' },
  destChipTextDone:  { color: '#15803d' },

  /* Countdown */
  countdownBox:   { backgroundColor: '#fff', borderRadius: 16, padding: 14, gap: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  countdownLabel: { fontSize: 13, fontWeight: '600', color: '#475569', textAlign: 'center' },
  countdownNum:   { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  countdownTrack: { height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
  countdownFill:  { height: 6, backgroundColor: '#16a34a', borderRadius: 3 },

  /* Completed */
  completedBox:   { alignItems: 'center', paddingVertical: 40, gap: 12 },
  completedEmoji: { fontSize: 56 },
  completedTitle: { fontSize: 22, fontWeight: '900', color: '#0f172a' },
  completedSub:   { fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 21 },
  homeBtn:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, backgroundColor: '#16a34a', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
  homeBtnText:    { color: '#fff', fontWeight: '800', fontSize: 14 },

  /* Bottom confirm bar */
  bottomBar:  { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 24, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -2 }, elevation: 10 },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#16a34a', borderRadius: 18, paddingVertical: 17, paddingHorizontal: 24 },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});
