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
  ActivityIndicator,
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
  ListOrdered,
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
  Square,
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
import { AdInterruptionService } from '../../services/AdInterruptionService';
import { RobotControlService } from '../../services/RobotControlService';

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

/**
 * Phân giải danh sách sản phẩm cần lấy tại một waypoint / kệ cụ thể trong hành trình
 */
function getProductsForDestination(
  dest: GuideDestination | null | undefined,
  fallbackNames: string[] = [],
  destIndex: number = 0,
  totalDestinations: number = 1
): string[] {
  if (dest?.productNames && dest.productNames.length > 0) {
    return dest.productNames;
  }
  if (fallbackNames.length > 0) {
    if (totalDestinations <= 1) {
      return fallbackNames;
    }
    const perDest = Math.ceil(fallbackNames.length / totalDestinations);
    const slice = fallbackNames.slice(destIndex * perDest, (destIndex + 1) * perDest);
    if (slice.length > 0) return slice;
  }
  const shelf = getShelfData(dest);
  return shelf.products && shelf.products.length > 0 ? shelf.products.slice(0, 2) : [shelf.name];
}

const getProductKey = (shelfIdx: number, pName: string) => `${shelfIdx}__${(pName || '').trim().toLowerCase()}`;

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
    dispatchCart(items, { fromAd: params.fromAd === '1' }).catch(err => {
      console.warn('[CartGuideMapScreen] Auto-dispatch thất bại:', err);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.productId, params.productIds, params.productName, status, params.fromAd]);


  // Trích xuất danh sách sản phẩm từ URL params
  const adImages = useMemo(() => (params.productImages ? params.productImages.split('||') : params.productImage ? [params.productImage] : []), [params.productImages, params.productImage]);
  const adNames = useMemo(() => (params.productNames ? params.productNames.split('||') : params.productName ? [params.productName] : []), [params.productNames, params.productName]);
  const adPrices = useMemo(() => (params.productPrices ? params.productPrices.split(',').map(Number) : params.productPrice ? [Number(params.productPrice)] : []), [params.productPrices, params.productPrice]);

  // Chế độ xem: 'timeline' (Lộ trình & Sản phẩm) | 'map' (Sơ đồ 2D siêu thị)
  const [viewMode, setViewMode] = useState<'timeline' | 'map'>('timeline');

  // Trạng thái đánh dấu đã lấy từng sản phẩm theo khóa: ${shelfIdx}__${productName}
  const [pickedProductKeys, setPickedProductKeys] = useState<Record<string, boolean>>({});

  // Telemetry tọa độ Robot thời gian thực cho bản đồ 2D
  const [mapPose, setMapPose] = useState<RobotPoseState>({
    x: SUPERMARKET_NODES[7].mapX,
    y: SUPERMARKET_NODES[7].mapY,
    headingDeg: SUPERMARKET_NODES[7].headingDeg,
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

  // Phân tích danh sách toàn bộ các chặng dừng và sản phẩm tương ứng trong toàn bộ lộ trình
  const allStopsProducts = useMemo(() => {
    if (destinations.length > 0) {
      return destinations.map((dest, idx) => ({
        stopIndex: idx,
        dest,
        shelf: getShelfData(dest),
        products: getProductsForDestination(dest, adNames, idx, destinations.length),
      }));
    }
    if (destination) {
      return [{
        stopIndex: 0,
        dest: destination,
        shelf: currentShelf,
        products: getProductsForDestination(destination, adNames, 0, 1),
      }];
    }
    return [];
  }, [destinations, destination, adNames, currentShelf]);

  // Danh sách sản phẩm cụ thể của kệ hiện tại
  const currentShelfProducts = useMemo(() => {
    if (allStopsProducts.length > 0 && currentWaypointIndex < allStopsProducts.length) {
      return allStopsProducts[currentWaypointIndex].products;
    }
    return getProductsForDestination(destination, adNames, currentWaypointIndex, totalStops);
  }, [allStopsProducts, currentWaypointIndex, destination, adNames, totalStops]);

  // Số lượng sản phẩm đã xác nhận lấy trên kệ hiện tại
  const pickedCountOnCurrentShelf = useMemo(() => {
    return currentShelfProducts.filter(p => pickedProductKeys[getProductKey(currentWaypointIndex, p)]).length;
  }, [currentShelfProducts, pickedProductKeys, currentWaypointIndex]);

  // Đã lấy đủ toàn bộ sản phẩm trên kệ hiện tại chưa?
  const isAllCurrentShelfProductsPicked = currentShelfProducts.length > 0
    && pickedCountOnCurrentShelf === currentShelfProducts.length;

  // Tổng số lượng sản phẩm trên toàn bộ hành trình
  const totalProductsCount = useMemo(() => {
    return allStopsProducts.reduce((sum, stop) => sum + stop.products.length, 0);
  }, [allStopsProducts]);

  // Tổng số sản phẩm đã lấy trên toàn bộ hành trình
  const totalProductsPicked = useMemo(() => {
    let count = 0;
    allStopsProducts.forEach(stop => {
      stop.products.forEach(p => {
        if (pickedProductKeys[getProductKey(stop.stopIndex, p)]) count++;
      });
    });
    return count;
  }, [allStopsProducts, pickedProductKeys]);

  // Hàm chuyển đổi trạng thái đã lấy của sản phẩm trên kệ hiện tại
  const toggleProductPicked = (pName: string) => {
    const key = getProductKey(currentWaypointIndex, pName);
    setPickedProductKeys((prev) => {
      const nextVal = !prev[key];
      if (nextVal) {
        speak(`Đã lấy ${pName}.`);
      }
      return { ...prev, [key]: nextVal };
    });
  };

  // Bộ đếm ngược 30 giây tự động khi đã đến kệ
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);

  // Quản lý giai đoạn dẫn khách ra quầy thu ngân và tự động về trạm sau khi thanh toán
  const [cashierPhase, setCashierPhase] = useState<'idle' | 'moving_to_cashier' | 'at_cashier'>('idle');
  const cashierPhaseRef = useRef<'idle' | 'moving_to_cashier' | 'at_cashier'>('idle');
  const [cashierCountdown, setCashierCountdown] = useState<number | null>(null);

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

        // Bổ sung kiểm tra theo khoảng cách toạ độ tới Quầy Thu Ngân Node 8 (x: 0.23, y: 0.42)
        if (cashierPhaseRef.current === 'moving_to_cashier') {
          const distToCashier = Math.hypot(resolved.x - SUPERMARKET_NODES[8].mapX, resolved.y - SUPERMARKET_NODES[8].mapY);
          if (distToCashier < 0.3) {
            console.log('[CartGuideMapScreen] Robot đã đến sát Quầy Thu Ngân theo toạ độ SLAM!');
            cashierPhaseRef.current = 'at_cashier';
            setCashierPhase('at_cashier');
            setCashierCountdown(10);
            speak('Đã đến quầy thu ngân. Cảm ơn quý khách đã mua sắm và sử dụng dịch vụ của tôi! Robot xin phép tự động quay về trạm sạc sau 10 giây.');
          }
        }

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
      const navStat = String(payload?.navStatus ?? payload?.NavStatus ?? payload?.status ?? payload?.Status ?? '').toUpperCase();
      const nodeRole = String(payload?.nodeRole ?? payload?.NodeRole ?? '').toLowerCase();
      const targetNodeId = Number(payload?.targetNodeId ?? payload?.TargetNodeId ?? payload?.nodeId ?? payload?.NodeId ?? 0);

      // Nhận diện khi robot đến Quầy Thu Ngân (Node 8) qua SignalR
      if (cashierPhaseRef.current === 'moving_to_cashier') {
        const isArrivedOrCompleted = navStat === 'ARRIVED' || navStat === 'COMPLETED';
        const isCashierTarget = targetNodeId === 8 || nodeRole === 'cashier' || targetNodeId === 0;
        if (isArrivedOrCompleted && isCashierTarget) {
          console.log('[CartGuideMapScreen] Đã đến Quầy Thu Ngân (Node 8) qua navigationStatus!');
          cashierPhaseRef.current = 'at_cashier';
          setCashierPhase('at_cashier');
          setCashierCountdown(10);
          speak('Đã đến quầy thu ngân. Cảm ơn quý khách đã mua sắm và sử dụng dịch vụ của tôi! Robot xin phép tự động quay về trạm sạc sau 10 giây.');
        }
      }

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
  }, [subscribeTelemetry, subscribeNavigationStatus, speak]);

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

  // Tự động chuyển kệ khi hết 30s (chỉ khi ĐÃ LẤY ĐỦ SẢN PHẨM tại kệ hiện tại)
  useEffect(() => {
    if (autoCountdown === 0 && awaitingPickup) {
      if (isAllCurrentShelfProductsPicked) {
        handleConfirmPickup();
      } else {
        // Chưa lấy đủ các món tại kệ này -> Tiếp tục chờ khách, không tự ý chuyển kệ
        setAutoCountdown(30);
        speak('Quý khách vẫn còn sản phẩm chưa lấy tại kệ này. Robot sẽ tiếp tục chờ nhé!');
      }
    }
  }, [autoCountdown, awaitingPickup, isAllCurrentShelfProductsPicked]);

  // Giọng nói thông báo thân thiện
  const lastVoiceRef = useRef<string>('');
  useEffect(() => {
    if (status === 'ARRIVED' && awaitingPickup && destination) {
      const voiceKey = `ARRIVED-${destination.nodeId}-${currentWaypointIndex}`;
      if (lastVoiceRef.current !== voiceKey) {
        lastVoiceRef.current = voiceKey;
        const pCount = currentShelfProducts.length;
        const pListStr = currentShelfProducts.join(', ');
        if (pCount > 1) {
          speak(`Robot đã đến ${currentShelf.name}. Kệ này có ${pCount} sản phẩm cần lấy là: ${pListStr}. Quý khách vui lòng lấy và chạm xác nhận từng món trên màn hình nhé!`);
        } else if (pCount === 1) {
          speak(`Robot đã đến ${currentShelf.name}. Mời quý khách lấy ${pListStr} và chạm xác nhận trên màn hình nhé!`);
        } else {
          speak(`Robot đã đến ${currentShelf.name}. Mời quý khách lấy sản phẩm nhé!`);
        }
      }
    } else if (status === 'COMPLETED') {
      if (lastVoiceRef.current !== 'COMPLETED') {
        lastVoiceRef.current = 'COMPLETED';
        if (!AdInterruptionService.hasInterruptedMission()) {
          speak('Hành trình dẫn đường mua sắm đã hoàn tất. Quý khách muốn robot dẫn đến quầy thu ngân hay kết thúc mua sắm?');
        } else {
          speak('Hành trình dẫn đường mua sắm đã hoàn tất. Cảm ơn quý khách!');
        }
      }
    }
  }, [status, awaitingPickup, destination, currentWaypointIndex, currentShelf, currentShelfProducts, speak]);

  // Tự động chuyển về Home sau khi hoàn tất & Lưu lịch sử mua sắm / Hóa đơn cho Member
  useEffect(() => {
    if (status === 'COMPLETED' && token && !hasClearedCartRef.current) {
      hasClearedCartRef.current = true;
      console.log('[CartGuideMapScreen] Dẫn đường hoàn tất -> Ghi nhận lịch sử mua sắm (InvoiceHistory) cho Member');

      if (params.productId) {
        // Dẫn đường 1 sản phẩm cụ thể từ bất kỳ trang nào (Chi tiết, Ưu đãi, Trang chủ, Tìm kiếm, v.v.)
        const singleId = Number(params.productId);
        const singlePrice = params.productPrice ? Number(params.productPrice) : undefined;
        CartService.recordShoppingTrip(
          {
            fromCart: false,
            items: [{ productId: singleId, quantity: 1, unitPrice: singlePrice }],
          },
          token
        ).catch((e) => console.warn('[CartGuideMapScreen] recordShoppingTrip single error:', e));
      } else if (params.productIds) {
        // Dẫn đường danh sách nhiều sản phẩm từ giỏ hàng hoặc trang chọn sản phẩm
        const ids = params.productIds.split(',').map((s) => Number(s.trim())).filter((n) => n > 0);
        const prices = params.productPrices ? params.productPrices.split(',').map(Number) : [];
        CartService.recordShoppingTrip(
          {
            fromCart: params.from === 'cart',
            items: ids.map((id, i) => ({ productId: id, quantity: 1, unitPrice: prices[i] || undefined })),
          },
          token
        ).catch((e) => console.warn('[CartGuideMapScreen] recordShoppingTrip multi error:', e));
      } else {
        // Dẫn đường từ Giỏ hàng (nhiều sản phẩm trong giỏ) -> Lưu toàn bộ giỏ hàng thành hóa đơn và dọn giỏ
        CartService.recordShoppingTrip(
          {
            fromCart: true,
          },
          token
        ).catch((e) => console.warn('[CartGuideMapScreen] recordShoppingTrip cart error:', e));
      }
    }

    if (status === 'COMPLETED' || status === 'CANCELLED') {
      if (status === 'CANCELLED' || AdInterruptionService.hasInterruptedMission()) {
        const timer = setTimeout(async () => {
          if (status === 'COMPLETED' && AdInterruptionService.hasInterruptedMission()) {
            const interrupted = AdInterruptionService.getInterruptedMission()!;
            console.log('[CartGuideMapScreen] Hoàn tất dẫn đường, khôi phục phiên quảng cáo dở dang:', interrupted);
            try {
              speak('Cảm ơn quý khách đã mua sắm cùng robot. Robot xin phép tiếp tục phiên quảng cáo nhé!');
            } catch {}

            const estDuration = interrupted.pausedRemainingSeconds ?? interrupted.estimatedDurationSeconds;
            await RobotControlService.dispatchAutonomous({
              robotCode: interrupted.robotCode || ROBOT_CODE,
              flowType: 'ad',
              nodeIds: interrupted.remainingNodeIds,
              shelfIds: interrupted.remainingShelfIds,
              floorId: interrupted.floorId || 1,
              campaignId: interrupted.campaignId ?? undefined,
              isFreeRoam: interrupted.isFreeRoam,
              adMode: interrupted.isFreeRoam ? 'freeroam' : 'shelf',
              durationMinutes: estDuration ? Math.max(1, Math.ceil(estDuration / 60)) : (interrupted.durationMinutes ?? 3),
              estimatedDurationSeconds: estDuration,
              source: 'RobotKiosk',
              dispatchedBy: 'Khôi phục tự động sau khi dẫn đường',
              targetSummary: `Tiếp tục quảng cáo (${interrupted.isFreeRoam ? 'Tự do' : 'Theo kệ'})`,
            }).catch((err) => console.warn('[CartGuideMapScreen] Khôi phục quảng cáo thất bại:', err));

            AdInterruptionService.clear();
            router.replace('/' as any);
          } else {
            router.replace(returnRoute as any);
          }
        }, status === 'CANCELLED' ? 1500 : 3500);
        return () => clearTimeout(timer);
      } else {
        // Trường hợp B: Dẫn đường độc lập — cho khách 60 giây lựa chọn trước khi tự động quay về trạm
        if (cashierPhase !== 'idle') return;

        const idleTimer = setTimeout(async () => {
          console.log('[CartGuideMapScreen] Hết thời gian chờ lựa chọn (60s), tự động quay về vị trí chờ...');
          try {
            await RobotControlService.dispatchAutonomous({
              robotCode: ROBOT_CODE,
              flowType: 'return',
              nodeIds: [7],
              floorId: 1,
              source: 'RobotKiosk',
              dispatchedBy: 'Tự động quay về sau 60s',
              targetSummary: 'Quay về vị trí robot / Dock (Node 7)',
            });
          } catch {}
          router.replace('/' as any);
        }, 60000);
        return () => clearTimeout(idleTimer);
      }
    }
  }, [status, router, token, params.fromAd, params.productId, params.productIds, returnRoute, speak, cashierPhase]);

  const handleConfirmPickup = async () => {
    if (!isAllCurrentShelfProductsPicked) {
      const remaining = currentShelfProducts.filter(p => !pickedProductKeys[getProductKey(currentWaypointIndex, p)]);
      Alert.alert(
        'Chưa xác nhận đủ sản phẩm',
        `Tại kệ này (${currentShelf.name}) còn ${remaining.length} món chưa xác nhận lấy:\n\n• ${remaining.join('\n• ')}\n\nQuý khách đã lấy đủ các món này vào giỏ chưa?`,
        [
          { text: 'Chờ lấy thêm', style: 'cancel' },
          {
            text: 'Đã lấy hết, đi tiếp',
            onPress: async () => {
              // Tự động đánh dấu tất cả các món trên kệ này là đã lấy
              setPickedProductKeys((prev) => {
                const updated = { ...prev };
                currentShelfProducts.forEach(p => {
                  updated[getProductKey(currentWaypointIndex, p)] = true;
                });
                return updated;
              });
              try {
                await confirmPickup();
              } catch (err: any) {
                Alert.alert('Chưa thể tiếp tục', err?.message || 'Không gửi được tín hiệu tiếp tục đến Robot.');
              }
            },
          },
        ]
      );
      return;
    }

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
            try {
              await RobotControlService.dispatchAutonomous({
                robotCode: ROBOT_CODE,
                flowType: 'return',
                nodeIds: [7],
                floorId: 1,
                source: 'RobotKiosk',
                dispatchedBy: 'CustomerCancelledGuide',
              });
            } catch (err) {
              console.warn('[CartGuideMapScreen] Return on cancel warning:', err);
            }
            router.replace(returnRoute as any);
          },
        },
      ],
    );
  };

  // Trạng thái đang gửi lệnh tự hành sau khi dẫn đường (Về thu ngân hoặc Về trạm sạc)
  const [isDispatchingPostGuide, setIsDispatchingPostGuide] = useState(false);

  // 1. Dẫn khách đến Quầy Thu Ngân (Node 8)
  const handleGoToCashier = async () => {
    if (isDispatchingPostGuide) return;
    setIsDispatchingPostGuide(true);
    try {
      speak('Robot đang dẫn quý khách đến quầy thu ngân để thanh toán. Mời quý khách đi theo robot nhé!');
      const res = await RobotControlService.dispatchAutonomous({
        robotCode: ROBOT_CODE,
        flowType: 'return',
        nodeIds: [8],
        floorId: 1,
        source: 'RobotKiosk',
        dispatchedBy: 'Khách chọn đến quầy thu ngân',
        targetSummary: 'Dẫn khách tới Quầy Thu Ngân (Node 8)',
      });
      if (!res.ok) {
        throw new Error(res.data?.detail || 'Không thể gửi lệnh tới robot');
      }
      cashierPhaseRef.current = 'moving_to_cashier';
      setCashierPhase('moving_to_cashier');
    } catch (e: any) {
      Alert.alert('Chưa thể dẫn đường', e?.message || 'Không gửi được tín hiệu dẫn tới quầy thu ngân.');
    } finally {
      setIsDispatchingPostGuide(false);
    }
  };

  // 1.1 Tự động quay về trạm sạc sau khi hoàn tất tại quầy thu ngân
  const handleAutoReturnFromCashier = useCallback(async () => {
    try {
      speak('Cảm ơn quý khách đã sử dụng dịch vụ của tôi. Robot xin phép quay về trạm sạc. Hẹn gặp lại quý khách!');
      await RobotControlService.dispatchAutonomous({
        robotCode: ROBOT_CODE,
        flowType: 'return',
        nodeIds: [7],
        floorId: 1,
        source: 'RobotKiosk',
        dispatchedBy: 'Tự động quay về sau khi hoàn tất tại thu ngân',
        targetSummary: 'Quay về vị trí robot / Dock (Node 7)',
      });
    } catch (e) {
      console.warn('[CartGuideMapScreen] Lỗi tự động về trạm từ thu ngân:', e);
    } finally {
      router.replace('/' as any);
    }
  }, [router, speak]);

  // Đếm ngược 10 giây tại quầy thu ngân trước khi robot tự động lăn bánh về Node 7
  useEffect(() => {
    if (cashierPhase === 'at_cashier' && cashierCountdown !== null) {
      if (cashierCountdown <= 0) {
        void handleAutoReturnFromCashier();
        return;
      }
      const timer = setTimeout(() => {
        setCashierCountdown((prev) => (prev !== null ? prev - 1 : null));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cashierPhase, cashierCountdown, handleAutoReturnFromCashier]);

  // 2. Kết thúc mua sắm - Robot tự động quay về Vị trí robot / Trạm sạc (Node 7)
  const handleFinishShopping = async () => {
    if (isDispatchingPostGuide) return;
    setIsDispatchingPostGuide(true);
    try {
      speak('Cảm ơn quý khách đã mua sắm cùng robot. Robot xin phép quay về vị trí ban đầu.');
      const res = await RobotControlService.dispatchAutonomous({
        robotCode: ROBOT_CODE,
        flowType: 'return',
        nodeIds: [7],
        floorId: 1,
        source: 'RobotKiosk',
        dispatchedBy: 'Khách kết thúc mua sắm',
        targetSummary: 'Quay về vị trí robot / Dock (Node 7)',
      });
      if (!res.ok) {
        throw new Error(res.data?.detail || 'Không thể gửi lệnh tới robot');
      }
      router.replace('/' as any);
    } catch (e: any) {
      Alert.alert('Chưa thể kết thúc', e?.message || 'Không gửi được tín hiệu quay về vị trí robot.');
    } finally {
      setIsDispatchingPostGuide(false);
    }
  };


  // ─── Derive product display info ───────────────────────────────────
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
              cashierPhase === 'at_cashier' ? { color: '#059669' } :
              cashierPhase === 'moving_to_cashier' ? { color: '#0284c7' } :
              awaitingPickup   ? { color: '#15803d' } :
              status === 'COMPLETED' ? { color: '#059669' } :
              { color: '#0284c7' },
            ]}>
              {cashierPhase === 'moving_to_cashier'
                ? '💳 Đang đến quầy thu ngân…'
                : cashierPhase === 'at_cashier'
                ? '🎉 Đã đến quầy thu ngân'
                : awaitingPickup
                ? '📍 Đã đến điểm hẹn'
                : status === 'COMPLETED'
                ? '✅ Hoàn tất mua sắm!'
                : '🚀 Robot đang di chuyển…'}
            </Text>
          </View>
        </View>

        {/* ── TRẠNG THÁI DẪN ĐƯỜNG ĐẾN THU NGÂN / TẠI THU NGÂN / HOÀN TẤT ── */}
        {cashierPhase === 'moving_to_cashier' ? (
          <View style={s.completedBox}>
            <View style={s.actionIconWrapCashier}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
            <Text style={s.completedTitle}>Đang Dẫn Đến Quầy Thu Ngân</Text>
            <Text style={s.completedSub}>
              Xin mời quý khách tiếp tục đi cùng robot đến quầy thanh toán POS (Node 8). Robot sẽ dẫn quý khách đến tận nơi!
            </Text>
            <View style={[s.actionCard, s.cashierCard, { width: '100%', marginTop: 8 }]}>
              <Bot size={28} color="#059669" />
              <View style={{ flex: 1 }}>
                <Text style={s.actionCardTitle}>Robot Đang Di Chuyển</Text>
                <Text style={s.actionCardSub}>Điểm đến: Quầy Thu Ngân (Node 8)</Text>
              </View>
            </View>
          </View>
        ) : cashierPhase === 'at_cashier' ? (
          <View style={s.completedBox}>
            <Text style={s.completedEmoji}>🎉</Text>
            <Text style={s.completedTitle}>Cảm Ơn Quý Khách Đã Sử Dụng Dịch Vụ Của Tôi!</Text>
            <Text style={s.completedSub}>
              Đã đến Quầy Thu Ngân an toàn. Chúc quý khách thanh toán thuận tiện và có một ngày mua sắm thật vui vẻ!
            </Text>

            <View style={[s.countdownBox, { width: '100%', marginTop: 8 }]}>
              <Text style={s.countdownLabel}>
                Robot sẽ tự động quay về trạm sạc sau: <Text style={s.countdownNum}>{cashierCountdown ?? 10}s</Text>
              </Text>
              <View style={s.countdownTrack}>
                <View
                  style={[
                    s.countdownFill,
                    {
                      width: `${Math.max(0, Math.min(100, ((cashierCountdown ?? 10) / 10) * 100))}%` as any,
                      backgroundColor: '#4f46e5',
                    },
                  ]}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[s.homeBtn, { backgroundColor: '#4f46e5', width: '100%', marginTop: 8 }]}
              onPress={handleAutoReturnFromCashier}
              activeOpacity={0.85}
            >
              <Home size={18} color="#fff" />
              <Text style={s.homeBtnText}>Quay Về Trạm Sạc Ngay</Text>
            </TouchableOpacity>
          </View>
        ) : status === 'COMPLETED' ? (
          <View style={s.completedBox}>
            <Text style={s.completedEmoji}>🎉</Text>
            <Text style={s.completedTitle}>Đã hoàn thành lộ trình mua sắm!</Text>
            <Text style={s.completedSub}>
              Mời quý khách kiểm tra và lấy sản phẩm trên quầy kệ. Quý khách muốn robot tiếp tục dẫn đến quầy thanh toán hay kết thúc chuyến đi?
            </Text>

            {/* ── 2 NÚT HÀNH ĐỘNG TỰ HÀNH: THU NGÂN (NODE 8) & VỀ TRẠM (NODE 7) ── */}
            <View style={s.completedActionGrid}>
              <TouchableOpacity
                style={[s.actionCard, s.cashierCard, isDispatchingPostGuide && { opacity: 0.6 }]}
                onPress={handleGoToCashier}
                disabled={isDispatchingPostGuide}
                activeOpacity={0.85}
              >
                <View style={s.actionIconWrapCashier}>
                  {isDispatchingPostGuide ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <CreditCard size={26} color="#fff" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.actionCardTitle}>Đến Quầy Thu Ngân</Text>
                  <Text style={s.actionCardSub}>Robot sẽ dẫn quý khách đến quầy POS tính tiền (Node 8)</Text>
                </View>
                <ArrowRight size={22} color="#059669" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.actionCard, s.finishCard, isDispatchingPostGuide && { opacity: 0.6 }]}
                onPress={handleFinishShopping}
                disabled={isDispatchingPostGuide}
                activeOpacity={0.85}
              >
                <View style={s.actionIconWrapFinish}>
                  {isDispatchingPostGuide ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Home size={26} color="#fff" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.actionCardTitle}>Kết Thúc Mua Sắm</Text>
                  <Text style={s.actionCardSub}>Robot tự động quay về trạm sạc / vị trí ban đầu (Node 7)</Text>
                </View>
                <ArrowRight size={22} color="#4f46e5" />
              </TouchableOpacity>
            </View>

            {/* ── NÚT PHỤ: QUAY LẠI GIỎ HÀNG / TRA CỨU TIẾP ── */}
            <View style={{ width: '100%', gap: 10, marginTop: 12 }}>
              <TouchableOpacity
                style={[s.homeBtn, { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' }]}
                onPress={() => router.replace(returnRoute as any)}
                activeOpacity={0.85}
              >
                {returnRoute === '/member-cart' ? (
                  <ShoppingBag size={18} color="#475569" />
                ) : (
                  <Search size={18} color="#475569" />
                )}
                <Text style={[s.homeBtnText, { color: '#475569' }]}>
                  {returnRoute === '/member-cart' ? 'Quay Lại Giỏ Hàng' : 'Tiếp Tục Tra Cứu Hàng Hóa'}
                </Text>
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

            {/* ── SHELF PICKUP CHECKLIST (khi robot dừng chờ khách lấy hàng) ── */}
            {awaitingPickup && (
              <View style={s.shelfChecklistBox}>
                <View style={s.shelfChecklistHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <PackageCheck size={20} color={isAllCurrentShelfProductsPicked ? '#16a34a' : '#d97706'} />
                    <Text style={s.shelfChecklistTitle}>
                      Món cần lấy tại kệ ({pickedCountOnCurrentShelf}/${currentShelfProducts.length})
                    </Text>
                  </View>
                  <View style={[
                    s.shelfChecklistBadge,
                    isAllCurrentShelfProductsPicked ? s.badgeSuccess : s.badgeWarning
                  ]}>
                    <Text style={[
                      s.shelfChecklistBadgeText,
                      isAllCurrentShelfProductsPicked ? s.badgeTextSuccess : s.badgeTextWarning
                    ]}>
                      {isAllCurrentShelfProductsPicked ? '✓ Đã đủ' : 'Chưa đủ'}
                    </Text>
                  </View>
                </View>

                <Text style={s.shelfChecklistSub}>
                  Quý khách vui lòng chạm vào từng món bên dưới để xác nhận đã lấy vào giỏ:
                </Text>

                <View style={s.shelfItemsList}>
                  {currentShelfProducts.map((pName, pIdx) => {
                    const isPicked = Boolean(pickedProductKeys[getProductKey(currentWaypointIndex, pName)]);
                    return (
                      <TouchableOpacity
                        key={pIdx}
                        style={[s.shelfItemRow, isPicked && s.shelfItemRowPicked]}
                        onPress={() => toggleProductPicked(pName)}
                        activeOpacity={0.7}
                      >
                        <View style={[s.shelfItemCheck, isPicked && s.shelfItemCheckPicked]}>
                          {isPicked ? (
                            <CheckCircle2 size={24} color="#16a34a" />
                          ) : (
                            <Square size={22} color="#94a3b8" />
                          )}
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={[s.shelfItemName, isPicked && s.shelfItemNamePicked]}>
                            {pName}
                          </Text>
                          <Text style={[s.shelfItemHint, isPicked && s.shelfItemHintPicked]}>
                            {isPicked ? '✓ Đã lấy vào giỏ hàng' : 'Chạm để xác nhận đã lấy món này'}
                          </Text>
                        </View>
                        <View style={[s.shelfItemPill, isPicked && s.shelfItemPillPicked]}>
                          <Text style={[s.shelfItemPillText, isPicked && s.shelfItemPillTextPicked]}>
                            {isPicked ? 'Đã lấy' : 'Cần lấy'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── HÀNG ĐỢI DẪN ĐƯỜNG MUA SẮM (SHOPPING QUEUE) ── */}
            <View style={s.queueContainer}>
              <View style={s.queueHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <ListOrdered size={20} color="#1e293b" />
                  <Text style={s.queueTitle}>Hàng Đợi Dẫn Đường Mua Sắm</Text>
                </View>
                <View style={s.queueCounterBadge}>
                  <Text style={s.queueCounterText}>
                    {totalProductsPicked}/{totalProductsCount} món
                  </Text>
                </View>
              </View>

              <View style={s.queueTimeline}>
                {allStopsProducts.map((stop, sIdx) => {
                  const isPast = sIdx < currentWaypointIndex;
                  const isCurrent = sIdx === currentWaypointIndex;
                  const isUpcoming = sIdx > currentWaypointIndex;
                  const stopPickedCount = stop.products.filter(p => pickedProductKeys[getProductKey(stop.stopIndex, p)]).length;
                  const isStopAllPicked = stop.products.length > 0 && stopPickedCount === stop.products.length;

                  return (
                    <View key={sIdx} style={[s.queueStopCard, isCurrent && s.queueStopCardActive, isPast && s.queueStopCardDone]}>
                      <View style={s.queueStopHeader}>
                        <View style={s.queueStopIconWrap}>
                          <Text style={{ fontSize: 16 }}>{stop.shelf.icon || '📍'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={s.queueStopShelfName} numberOfLines={1}>{stop.shelf.name}</Text>
                            <Text style={s.queueStopAisleText}>({stop.shelf.aisleCode || `Chặng ${sIdx + 1}`})</Text>
                          </View>
                          <Text style={s.queueStopCategoryText}>{stop.shelf.category}</Text>
                        </View>
                        <View style={[
                          s.queueStopBadge,
                          isPast || isStopAllPicked ? s.stopBadgeDone :
                          isCurrent ? (awaitingPickup ? s.stopBadgeArrived : s.stopBadgeMoving) :
                          s.stopBadgeUpcoming
                        ]}>
                          <Text style={[
                            s.queueStopBadgeText,
                            isPast || isStopAllPicked ? s.stopBadgeTextDone :
                            isCurrent ? (awaitingPickup ? s.stopBadgeTextArrived : s.stopBadgeTextMoving) :
                            s.stopBadgeTextUpcoming
                          ]}>
                            {isPast || isStopAllPicked
                              ? '✓ Đã xong'
                              : isCurrent
                              ? (awaitingPickup ? '📍 Đang dừng' : '➡ Đang tới')
                              : '⏳ Chờ lấy'}
                          </Text>
                        </View>
                      </View>

                      {/* Danh sách sản phẩm của từng chặng trong hàng đợi */}
                      <View style={s.queueStopProductsList}>
                        {stop.products.map((pName, pIdx) => {
                          const isPicked = Boolean(pickedProductKeys[getProductKey(stop.stopIndex, pName)]);
                          return (
                            <View key={pIdx} style={[s.queueProductRow, isPicked && s.queueProductRowPicked]}>
                              <View style={s.queueProductBullet}>
                                {isPicked ? (
                                  <Check size={14} color="#16a34a" />
                                ) : isCurrent ? (
                                  <View style={s.bulletCurrent} />
                                ) : (
                                  <View style={s.bulletUpcoming} />
                                )}
                              </View>
                              <Text style={[s.queueProductName, isPicked && s.queueProductNamePicked]} numberOfLines={1}>
                                {pName}
                              </Text>
                              <View style={[s.queueProductStatusPill, isPicked && s.queueProductStatusPillPicked]}>
                                <Text style={[s.queueProductStatusText, isPicked && s.queueProductStatusTextPicked]}>
                                  {isPicked ? '✓ Đã lấy' : isCurrent ? 'Cần lấy' : 'Chờ lấy'}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* ── MULTI-PRODUCT THUMBNAILS (if > 1 item) ── */}
            {isMultiProduct && adNames.length > 1 && (
              <View style={s.multiRow}>
                <Text style={s.multiLabel}>Ảnh các sản phẩm trong chuyến đi:</Text>
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

            {/* ── COUNTDOWN when awaiting pickup ── */}
            {awaitingPickup && autoCountdown !== null && (
              <View style={s.countdownBox}>
                <Text style={s.countdownLabel}>
                  {isAllCurrentShelfProductsPicked
                    ? `Tự động tiếp tục sau ${autoCountdown}s`
                    : `Đang chờ quý khách lấy đủ sản phẩm (${autoCountdown}s)`}
                </Text>
                <View style={s.countdownTrack}>
                  <View style={[
                    s.countdownFill,
                    {
                      width: `${(autoCountdown / 30) * 100}%` as any,
                      backgroundColor: isAllCurrentShelfProductsPicked ? '#16a34a' : '#f59e0b',
                    }
                  ]} />
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── FIXED BOTTOM CONFIRM BUTTON (only when awaiting pickup) ── */}
      {awaitingPickup && (
        <View style={s.bottomBar}>
          <TouchableOpacity
            style={[
              s.confirmBtn,
              !isAllCurrentShelfProductsPicked && s.confirmBtnIncomplete,
            ]}
            onPress={handleConfirmPickup}
            activeOpacity={0.88}
          >
            {isAllCurrentShelfProductsPicked ? (
              <CheckCircle2 size={24} color="#fff" />
            ) : (
              <PackageCheck size={22} color="#fff" />
            )}
            <View style={{ alignItems: 'center' }}>
              <Text style={s.confirmBtnText}>
                {isAllCurrentShelfProductsPicked
                  ? (isFinalStop
                      ? `Đã lấy xong ${currentShelfProducts.length} món — Hoàn tất ✓${autoCountdown !== null ? ` (${autoCountdown}s)` : ''}`
                      : `Đã lấy đủ ${currentShelfProducts.length} món — Đi tiếp ➜${autoCountdown !== null ? ` (${autoCountdown}s)` : ''}`)
                  : `Lấy đủ sản phẩm để tiếp tục (${pickedCountOnCurrentShelf}/${currentShelfProducts.length})${autoCountdown !== null ? ` · ${autoCountdown}s` : ''}`}
              </Text>
              {!isAllCurrentShelfProductsPicked && (
                <Text style={s.confirmBtnSubText}>
                  (Chạm tick chọn các món đã lấy vào giỏ ở danh sách phía trên)
                </Text>
              )}
            </View>
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
  completedBox:        { alignItems: 'center', paddingVertical: 24, gap: 12 },
  completedEmoji:      { fontSize: 52 },
  completedTitle:      { fontSize: 22, fontWeight: '900', color: '#0f172a', textAlign: 'center' },
  completedSub:        { fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 21, paddingHorizontal: 12 },
  completedActionGrid: { width: '100%', gap: 12, marginTop: 14 },
  actionCard:          { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, borderWidth: 1.5, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  cashierCard:         { borderColor: '#a7f3d0', backgroundColor: '#f0fdf4' },
  finishCard:          { borderColor: '#c7d2fe', backgroundColor: '#eef2ff' },
  actionIconWrapCashier:{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  actionIconWrapFinish: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center' },
  actionCardTitle:     { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  actionCardSub:       { fontSize: 12, fontWeight: '500', color: '#64748b', marginTop: 2 },
  homeBtn:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4, backgroundColor: '#16a34a', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
  homeBtnText:         { color: '#fff', fontWeight: '800', fontSize: 14 },

  /* Bottom confirm bar */
  bottomBar:  { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 24, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -2 }, elevation: 10 },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#16a34a', borderRadius: 18, paddingVertical: 15, paddingHorizontal: 20 },
  confirmBtnIncomplete: { backgroundColor: '#d97706' },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  confirmBtnSubText: { color: '#fff', fontSize: 11, fontWeight: '500', opacity: 0.9, marginTop: 2, textAlign: 'center' },

  /* Shelf Checklist */
  shelfChecklistBox: { backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1.5, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2, gap: 10 },
  shelfChecklistHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shelfChecklistTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  shelfChecklistBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeSuccess: { backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac' },
  badgeWarning: { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fcd34d' },
  shelfChecklistBadgeText: { fontSize: 11, fontWeight: '800' },
  badgeTextSuccess: { color: '#15803d' },
  badgeTextWarning: { color: '#b45309' },
  shelfChecklistSub: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  shelfItemsList: { gap: 8, marginTop: 2 },
  shelfItemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0' },
  shelfItemRowPicked: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  shelfItemCheck: { width: 26, alignItems: 'center', justifyContent: 'center' },
  shelfItemCheckPicked: {},
  shelfItemName: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  shelfItemNamePicked: { color: '#15803d', textDecorationLine: 'line-through' },
  shelfItemHint: { fontSize: 11, color: '#64748b' },
  shelfItemHintPicked: { color: '#16a34a', fontWeight: '600' },
  shelfItemPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#f1f5f9' },
  shelfItemPillPicked: { backgroundColor: '#dcfce7' },
  shelfItemPillText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  shelfItemPillTextPicked: { color: '#15803d' },

  /* Shopping Queue Container */
  queueContainer: { backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2, gap: 12 },
  queueHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  queueTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  queueCounterBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe' },
  queueCounterText: { fontSize: 11, fontWeight: '700', color: '#1d4ed8' },
  queueTimeline: { gap: 10 },
  queueStopCard: { borderRadius: 16, padding: 12, backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', gap: 8 },
  queueStopCardActive: { borderColor: '#3b82f6', backgroundColor: '#f0f9ff' },
  queueStopCardDone: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  queueStopHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  queueStopIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  queueStopShelfName: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  queueStopAisleText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  queueStopCategoryText: { fontSize: 11, color: '#64748b' },
  queueStopBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  stopBadgeDone: { backgroundColor: '#dcfce7' },
  stopBadgeArrived: { backgroundColor: '#fef3c7' },
  stopBadgeMoving: { backgroundColor: '#dbeafe' },
  stopBadgeUpcoming: { backgroundColor: '#f1f5f9' },
  queueStopBadgeText: { fontSize: 10, fontWeight: '800' },
  stopBadgeTextDone: { color: '#15803d' },
  stopBadgeTextArrived: { color: '#b45309' },
  stopBadgeTextMoving: { color: '#1d4ed8' },
  stopBadgeTextUpcoming: { color: '#64748b' },
  queueStopProductsList: { paddingLeft: 8, gap: 6, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 8 },
  queueProductRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  queueProductRowPicked: { opacity: 0.85 },
  queueProductBullet: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  bulletCurrent: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6' },
  bulletUpcoming: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#cbd5e1' },
  queueProductName: { fontSize: 12, fontWeight: '600', color: '#334155', flex: 1 },
  queueProductNamePicked: { color: '#15803d', textDecorationLine: 'line-through' },
  queueProductStatusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: '#f1f5f9' },
  queueProductStatusPillPicked: { backgroundColor: '#dcfce7' },
  queueProductStatusText: { fontSize: 10, fontWeight: '700', color: '#64748b' },
  queueProductStatusTextPicked: { color: '#15803d' },
});
