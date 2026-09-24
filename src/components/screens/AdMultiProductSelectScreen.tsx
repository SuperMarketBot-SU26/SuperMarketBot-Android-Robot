import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import {
  ChevronLeft,
  Navigation,
  CheckCircle2,
  Circle,
  MapPin,
  Tag,
  Sparkles,
  ShoppingBag,
  Package,
  ArrowRight,
  Check,
  RotateCcw,
  Search,
  AlertCircle,
  Clock,
  X,
} from 'lucide-react-native';
import { useRobotAuth } from '../../context/RobotAuthContext';
import { useRobotGuide } from '../../context/RobotGuideContext';
import { useRobotMissionRuntime, PlaylistItem } from '../../context/RobotMissionRuntimeContext';
import { ROBOT_CODE, useRobotRealtime } from '../../context/RobotRealtimeContext';
import { AdInterruptionService } from '../../services/AdInterruptionService';
import { RobotControlService } from '../../services/RobotControlService';

const { width: SW } = Dimensions.get('window');
const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

interface CustomerNotice {
  visible: boolean;
  type: 'warning' | 'info' | 'error';
  title: string;
  message: string;
  primaryBtnText?: string;
  secondaryBtnText?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
}

export default function AdMultiProductSelectScreen() {
  const router = useRouter();
  const { member } = useRobotAuth();
  const { dispatchCart } = useRobotGuide();
  const { activePlaylist, mission, activeWaypoint } = useRobotMissionRuntime();
  const { subscribeNavigationStatus } = useRobotRealtime();

  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const hasExitedRef = useRef(false);
  const isSubmittingRef = useRef(false);

  // Modal thông báo lịch sự, thân thiện cho khách hàng (không hiện lỗi dev)
  const [notice, setNotice] = useState<CustomerNotice>({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  // Tự động thoát về màn hình chờ khi phiên quảng cáo kết thúc hoặc bị hủy trên Web Admin
  const handleAutoExit = useCallback((reason: string) => {
    if (hasExitedRef.current || isSubmittingRef.current) return;
    hasExitedRef.current = true;
    console.log(`[AdMultiProductSelectScreen] Tự động thoát màn hình (${reason})`);

    AdInterruptionService.clear();

    try {
      Speech.speak('Phiên quảng cáo đã kết thúc. Robot xin phép quay về màn hình chờ nhé!', {
        language: 'vi-VN',
        rate: 0.9,
      });
    } catch {}

    try {
      router.replace('/' as any);
    } catch (e) {
      console.warn('[AdMultiProductSelectScreen] router.replace failed:', e);
    }
  }, [router]);

  // 1. Lắng nghe trạng thái hủy / hoàn tất qua SignalR realtime (ngay khi Admin bấm dừng hoặc hết giờ)
  useEffect(() => {
    const unsubscribe = subscribeNavigationStatus((payload: any) => {
      const robotCode = payload?.robotCode || payload?.RobotCode;
      if (robotCode) {
        const inc = String(robotCode).toUpperCase();
        const cur = ROBOT_CODE.toUpperCase();
        const isMatch = inc === cur || (inc === 'RB001' && cur === 'RB0001') || (inc === 'RB0001' && cur === 'RB001');
        if (!isMatch) return;
      }

      const navStatus = String(payload?.navStatus || payload?.NavStatus || '').toUpperCase();
      console.log('[AdMultiProductSelectScreen] Realtime navStatus:', navStatus);

      if (['CANCELLED', 'COMPLETED', 'STOPPED', 'FAILED', 'ESTOP', 'IDLE'].includes(navStatus)) {
        handleAutoExit(`SignalR navStatus: ${navStatus}`);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [subscribeNavigationStatus, handleAutoExit]);

  // 2. Bộ đếm thời gian thực thời lượng quảng cáo (Ad Session Countdown)
  const interrupted = AdInterruptionService.getInterruptedMission();
  const isShelfAd = Boolean(
    interrupted?.isPerShelfAd ||
    (!mission?.isFreeRoam && (mission?.adMode === 'shelf' || activeWaypoint?.shelfId || interrupted?.currentShelfId))
  );
  const currentShelfId = interrupted?.currentShelfId ?? activeWaypoint?.shelfId;
  const displayShelfName = interrupted?.currentShelfName || activeWaypoint?.shelfName || (currentShelfId ? `Kệ #${currentShelfId}` : '');
  const totalDurationSec = useMemo(() => {
    if (interrupted?.estimatedDurationSeconds && interrupted.estimatedDurationSeconds > 0) {
      return interrupted.estimatedDurationSeconds;
    }
    if (interrupted?.durationMinutes && interrupted.durationMinutes > 0) {
      return interrupted.durationMinutes * 60;
    }
    if (mission?.estimatedDurationSeconds && mission.estimatedDurationSeconds > 0) {
      return mission.estimatedDurationSeconds;
    }
    return 180; // Fallback 3 phút
  }, [interrupted?.estimatedDurationSeconds, interrupted?.durationMinutes, mission?.estimatedDurationSeconds]);

  const missionStartTime = useMemo(() => {
    if (mission?.dispatchedAt) {
      const ms = new Date(mission.dispatchedAt).getTime();
      if (!isNaN(ms) && ms > 0) return ms;
    }
    if (interrupted?.savedTimestamp) {
      return interrupted.savedTimestamp;
    }
    return Date.now();
  }, [mission?.dispatchedAt, interrupted?.savedTimestamp]);

  const [remainingSec, setRemainingSec] = useState<number>(() => {
    const elapsed = Math.floor((Date.now() - missionStartTime) / 1000);
    return Math.max(0, totalDurationSec - elapsed);
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - missionStartTime) / 1000);
      const remaining = Math.max(0, totalDurationSec - elapsed);
      setRemainingSec(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        handleAutoExit('Hết thời lượng phiên quảng cáo (duration countdown)');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [totalDurationSec, missionStartTime, handleAutoExit]);

  // 3. Polling dự phòng kiểm tra trạng thái máy chủ Backend
  useEffect(() => {
    if (!API_BASE) return;
    let isMounted = true;

    const checkServerStatus = async () => {
      if (isSubmittingRef.current || hasExitedRef.current) return;
      try {
        const res = await fetch(`${API_BASE}/api/v1/robot-operations/missions/${ROBOT_CODE}/active`, {
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });
        if (res.ok) {
          const activeMission = await res.json();
          if (
            !activeMission ||
            !activeMission.missionId ||
            activeMission.flowType !== 'ad' ||
            ['COMPLETED', 'CANCELLED', 'STOPPED', 'FAILED'].includes(activeMission.status)
          ) {
            console.log('[AdMultiProductSelectScreen] Máy chủ xác nhận ad mission đã kết thúc:', activeMission);
            if (isMounted) {
              handleAutoExit('Máy chủ đã kết thúc phiên quảng cáo');
            }
          }
        }
      } catch {}
    };

    const interval = setInterval(checkServerStatus, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [handleAutoExit]);

  // 4. Kiosk Inactivity Guard (60 giây nếu khách không thao tác)
  const inactivityTimerRef = useRef<any>(null);
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (!isSubmittingRef.current && !hasExitedRef.current) {
      inactivityTimerRef.current = setTimeout(() => {
        handleAutoExit('Không có thao tác trong 60 giây');
      }, 60000);
    }
  }, [handleAutoExit]);

  useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [resetInactivityTimer]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // 1. Thu thập và khử trùng lặp sản phẩm trong phiên quảng cáo, sắp xếp theo thứ tự ưu tiên
  const products = useMemo(() => {
    const cached = (AdInterruptionService.getCachedAdPlaylist() ?? []) as PlaylistItem[];
    const active = activePlaylist ?? [];

    let merged: PlaylistItem[] = [];

    if (isShelfAd) {
      // QUẢNG CÁO THEO KỆ: CHỈ hiển thị các mặt hàng trên kệ hiện tại
      // 1. Ưu tiên số 1: Lấy trực tiếp từ waypoint của kệ hiện tại
      if (activeWaypoint?.playlist && activeWaypoint.playlist.length > 0) {
        merged = [...activeWaypoint.playlist];
      } else if (currentShelfId && mission?.waypoints) {
        const matchingWp = mission.waypoints.find((w) => w.shelfId === currentShelfId);
        if (matchingWp?.playlist && matchingWp.playlist.length > 0) {
          merged = [...matchingWp.playlist];
        }
      }

      // 2. Nếu chưa có, lấy từ cached hoặc active nhưng lọc CHÍNH XÁC theo currentShelfId
      if (merged.length === 0) {
        const pool = cached.length > 0 ? cached : active;
        if (currentShelfId) {
          const filtered = pool.filter((item) => item.shelfId === currentShelfId);
          merged = filtered.length > 0 ? filtered : pool;
        } else {
          merged = pool;
        }
      }
    } else {
      // QUẢNG CÁO TỰ DO (FREE ROAM): Thu thập toàn bộ sản phẩm quảng cáo trong siêu thị
      const waypointsAds =
        mission?.waypoints?.flatMap((w) =>
          (w.playlist || []).map((p) => ({
            ...p,
            shelfName: w.shelfName || p.shelfName,
            aisleName: w.aisleName || p.aisleName,
            zoneName: w.zoneName || p.zoneName,
          }))
        ) ?? [];

      merged = [...cached, ...active, ...waypointsAds];
    }

    const uniqueMap = new Map<number | string, PlaylistItem>();

    for (const item of merged) {
      const pId = item.productId || item.id;
      const key = pId ?? item.productName ?? item.name;
      if (key && !uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    }

    const result = Array.from(uniqueMap.values());
    result.sort((a, b) => {
      const scoreA = Number(a.adScore ?? a.packageScore ?? 0);
      const scoreB = Number(b.adScore ?? b.packageScore ?? 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      const prioA = Number(a.priority ?? 0);
      const prioB = Number(b.priority ?? 0);
      return prioB - prioA;
    });

    return result;
  }, [activePlaylist, mission, activeWaypoint, isShelfAd, currentShelfId]);

  // 2. Mặc định chọn tất cả sản phẩm khi vừa mở màn hình
  useEffect(() => {
    setIsLoading(true);
    if (products.length > 0) {
      const initialSet = new Set<number | string>();
      products.forEach((p) => {
        const key = p.productId || p.id || p.productName || p.name;
        if (key) initialSet.add(key);
      });
      setSelectedIds(initialSet);

      const customerName = member?.fullName ? `${member.fullName}` : 'quý khách';
      Speech.speak(
        isShelfAd
          ? `Chào ${customerName}! Dưới đây là các sản phẩm đang quảng cáo tại ${displayShelfName || 'kệ này'}. Mời bạn xem qua nhé!`
          : `Chào ${customerName}! Dưới đây là tất cả các sản phẩm đang có chương trình khuyến mãi quảng cáo. Mời bạn xem qua nhé!`,
        { language: 'vi-VN', rate: 0.9 }
      );
    }
    setIsLoading(false);
  }, [products.length, isShelfAd, displayShelfName, member?.fullName]);

  // Chọn / Bỏ chọn 1 sản phẩm
  const toggleSelect = (key: number | string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Chọn tất cả
  const selectAll = () => {
    const next = new Set<number | string>();
    products.forEach((p) => {
      const key = p.productId || p.id || p.productName || p.name;
      if (key) next.add(key);
    });
    setSelectedIds(next);
  };

  // Bỏ chọn tất cả
  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Danh sách các sản phẩm đang được chọn
  const selectedProducts = useMemo(() => {
    return products.filter((p) => {
      const key = p.productId || p.id || p.productName || p.name;
      return key ? selectedIds.has(key) : false;
    });
  }, [products, selectedIds]);

  // 3. HAPPY CASE: Khách bấm "Bắt đầu dẫn đường"
  const handleStartGuide = async () => {
    // UNHAPPY CASE 1: Khách chưa chọn món nào
    if (selectedProducts.length === 0) {
      Speech.speak('Quý khách vui lòng chọn ít nhất một sản phẩm trên màn hình nhé!', {
        language: 'vi-VN',
        rate: 0.9,
      });
      setNotice({
        visible: true,
        type: 'warning',
        title: 'Chưa Chọn Sản Phẩm',
        message:
          'Quý khách vui lòng chạm vào các món hàng trên màn hình để chọn sản phẩm trước khi bắt đầu dẫn đường nhé!',
        primaryBtnText: 'Tôi Đã Hiểu',
        onPrimary: () => setNotice((prev) => ({ ...prev, visible: false })),
      });
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);
    isSubmittingRef.current = true;
    try {
      // 3.1 Dừng động cơ robot để đảm bảo an toàn tuyệt đối
      RobotControlService.sendMove(0, 0, 0);

      // 3.2 Lưu trạng thái quảng cáo dở dang vào AdInterruptionService
      if (!AdInterruptionService.hasInterruptedMission() && mission && mission.flowType === 'ad') {
        const waypoints = mission.waypoints ?? [];
        const remainingNodeIds = waypoints.map((w) => w.nodeId).filter((id) => id > 0);
        const remainingShelfIds = waypoints
          .map((w) => w.shelfId)
          .filter((id): id is number => typeof id === 'number' && id > 0);
        const isFreeRoam = Boolean(mission.isFreeRoam || mission.adMode === 'freeroam');

        AdInterruptionService.saveInterruptedMission({
          originalMissionId: mission.missionId,
          robotCode: mission.robotCode || ROBOT_CODE,
          remainingNodeIds,
          remainingShelfIds: remainingShelfIds.length > 0 ? remainingShelfIds : undefined,
          currentShelfId: (activeWaypoint?.shelfId && activeWaypoint.shelfId > 0) ? activeWaypoint.shelfId : (currentShelfId ?? undefined),
          currentShelfName: activeWaypoint?.shelfName || activeWaypoint?.nodeName || (displayShelfName || undefined),
          isPerShelfAd: !isFreeRoam,
          isFreeRoam,
          floorId: mission.floorId ?? 1,
          campaignId: isFreeRoam ? null : (mission.campaignId ?? null),
          interruptedAtWaypointIndex: 0,
          totalWaypoints: waypoints.length,
          savedTimestamp: Date.now(),
        });
      }

      // 3.3 Hủy mission ad hiện tại trên Backend để tránh xung đột
      await fetch(
        `${API_BASE}/api/v1/navigation/robots/${ROBOT_CODE}/cancel?reason=${encodeURIComponent(
          'Customer started multi-guide from ad'
        )}`,
        { method: 'POST', headers: { 'ngrok-skip-browser-warning': 'true' } }
      ).catch(() => undefined);

      // 3.4 Lọc mã sản phẩm hợp lệ
      const cartItems = selectedProducts
        .map((p) => ({
          productId: p.productId || p.id || 0,
          productName: p.productName || p.name || 'Sản phẩm',
        }))
        .filter((it) => it.productId > 0);

      if (cartItems.length === 0) {
        setNotice({
          visible: true,
          type: 'warning',
          title: 'Sản Phẩm Chưa Sẵn Sàng',
          message:
            'Các sản phẩm bạn chọn chưa có thông tin mã hàng phù hợp để dẫn đường. Quý khách vui lòng chọn sản phẩm khác nhé!',
          primaryBtnText: 'Chọn Món Khác',
          onPrimary: () => setNotice((prev) => ({ ...prev, visible: false })),
        });
        setIsSubmitting(false);
        isSubmittingRef.current = false;
        return;
      }

      // 3.5 Phát giọng nói tiếng Việt tự nhiên
      const names = cartItems.map((it) => it.productName);
      const spokenSummary =
        names.slice(0, 2).join(', ') +
        (names.length > 2 ? ` cùng ${names.length - 2} món khác` : '');
      Speech.speak(
        `Dạ vâng! Robot sẽ dẫn quý khách lần lượt đến các quầy bán ${spokenSummary} theo lộ trình tối ưu nhất. Xin mời quý khách đi theo tôi!`,
        { language: 'vi-VN', rate: 0.9 }
      );

      // 3.6 Phát lệnh lập tuyến TSP dẫn đường
      await dispatchCart(cartItems);

      // 3.7 Chuyển sang màn hình bản đồ dẫn đường
      router.push('/cart-guide-map' as any);
    } catch (err: any) {
      console.warn('[AdMultiProductSelectScreen] Start guide error:', err);
      isSubmittingRef.current = false;
      setIsSubmitting(false);

      // UNHAPPY CASE 2 & 3: Xử lý lỗi một cách lịch sự, ấm áp (KHÔNG VĂNG LỖI DEV)
      const errText = String(err?.message || '');
      let friendlyTitle = 'Thông Báo Vị Trí Kệ Hàng';
      let friendlyMsg =
        'Dạ sản phẩm bạn chọn hiện chưa có vị trí trưng bày trên quầy kệ hoặc đang tạm hết hàng. Quý khách vui lòng liên hệ nhân viên tại quầy để được phục vụ chu đáo nhé!';

      if (errText.includes('tạm hết hàng') || errText.includes('ngưng phục vụ')) {
        friendlyTitle = 'Sản Phẩm Tạm Hết Hàng';
        friendlyMsg =
          'Dạ sản phẩm này hiện đang tạm hết trên quầy kệ siêu thị. Quý khách có thể chọn các sản phẩm tương tự khác nhé!';
      } else if (errText.includes('kết nối') || errText.includes('mạng')) {
        friendlyTitle = 'Kết Nối Chưa Ổn Định';
        friendlyMsg =
          'Hệ thống đang gặp gián đoạn kết nối tạm thời. Quý khách vui lòng thử bấm lại sau vài giây nhé!';
      }

      Speech.speak('Dạ sản phẩm bạn chọn hiện chưa có vị trí trên quầy kệ, quý khách thông cảm nhé!', {
        language: 'vi-VN',
        rate: 0.9,
      });

      setNotice({
        visible: true,
        type: 'warning',
        title: friendlyTitle,
        message: friendlyMsg,
        primaryBtnText: 'Chọn Sản Phẩm Khác',
        secondaryBtnText: 'Quay Lại Quảng Cáo',
        onPrimary: () => setNotice((prev) => ({ ...prev, visible: false })),
        onSecondary: () => {
          setNotice((prev) => ({ ...prev, visible: false }));
          handleBackToAd();
        },
      });
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  // 4. HAPPY CASE 2: Khách bấm "Quay lại quảng cáo"
  const handleBackToAd = async () => {
    hasExitedRef.current = true;
    if (AdInterruptionService.hasInterruptedMission()) {
      const interrupted = AdInterruptionService.getInterruptedMission()!;
      AdInterruptionService.clear();
      Speech.speak('Robot xin phép tiếp tục hành trình quảng cáo. Chúc quý khách mua sắm vui vẻ!', {
        language: 'vi-VN',
        rate: 0.9,
      });
      try {
        await RobotControlService.dispatchAutonomous({
          robotCode: ROBOT_CODE,
          flowType: 'ad',
          shelfIds: interrupted.remainingShelfIds,
          nodeIds: interrupted.remainingNodeIds,
          floorId: interrupted.floorId ?? 1,
          campaignId: interrupted.isPerShelfAd ? undefined : (interrupted.campaignId ?? undefined),
          fullZoneMap: interrupted.isFreeRoam ? true : undefined,
          durationMinutes: interrupted.durationMinutes,
        });
      } catch (e) {
        console.warn('[AdMultiProductSelectScreen] Resume ad warning:', e);
      }
    }
    router.replace('/' as any);
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'left', 'right']}
      onTouchStart={resetInactivityTimer}
      onTouchMove={resetInactivityTimer}
    >
      <View style={styles.container}>
        {/* ==================== 1. TOP HEADER (TWO-ROW CLEAN LAYOUT) ==================== */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackToAd}
              activeOpacity={0.7}
            >
              <ChevronLeft size={18} color="#0f172a" />
              <Text style={styles.backButtonText}>Quay lại</Text>
            </TouchableOpacity>

            <View style={styles.headerPill}>
              <Sparkles size={13} color="#d97706" />
              <Text style={styles.headerPillText}>ƯU ĐÃI QUẢNG CÁO</Text>
            </View>

            {remainingSec !== null && remainingSec > 0 && (
              <View style={[styles.timerBadge, remainingSec <= 30 && styles.timerBadgeUrgent]}>
                <Clock size={13} color={remainingSec <= 30 ? '#ef4444' : '#64748b'} />
                <Text style={[styles.timerText, remainingSec <= 30 && styles.timerTextUrgent]}>
                  {formatTime(remainingSec)}
                </Text>
              </View>
            )}

            <View style={styles.memberBadge}>
              <View style={styles.memberDot} />
              <Text style={styles.memberText} numberOfLines={1}>
                {member?.fullName || 'Thành viên'}
              </Text>
            </View>
          </View>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>
              {isShelfAd
                ? (displayShelfName ? `Sản Phẩm Tại ${displayShelfName}` : 'Sản Phẩm Tại Kệ Này')
                : 'Tất Cả Sản Phẩm Đang Quảng Cáo'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {isShelfAd
                ? 'Các mặt hàng đang được trưng bày trên quầy kệ ngay trước mặt quý khách'
                : 'Chọn các món bạn muốn để Robot dẫn đường gom hàng theo lộ trình tối ưu nhất'}
            </Text>
          </View>
        </View>

        {/* ==================== 2. TOOLBAR THAO TÁC ==================== */}
        {products.length > 0 && (
          <View style={styles.toolbar}>
            <View style={styles.toolbarLeft}>
              <Text style={styles.toolbarLabel}>
                Đang chọn: <Text style={styles.toolbarCount}>{selectedProducts.length}</Text> / {products.length} sản phẩm
              </Text>
            </View>

            <View style={styles.toolbarRight}>
              <TouchableOpacity
                style={styles.toolbarBtnSelectAll}
                onPress={selectAll}
                activeOpacity={0.75}
              >
                <Check size={16} color="#10b981" />
                <Text style={styles.toolbarBtnSelectAllText}>Chọn tất cả</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toolbarBtnDeselect}
                onPress={deselectAll}
                activeOpacity={0.75}
              >
                <RotateCcw size={15} color="#94a3b8" />
                <Text style={styles.toolbarBtnDeselectText}>Bỏ chọn</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ==================== 3. PRODUCT GRID / LIST ==================== */}
        {isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>Đang tải danh sách sản phẩm khuyến mãi...</Text>
          </View>
        ) : products.length === 0 ? (
          /* UNHAPPY CASE 4: Danh sách sản phẩm rỗng */
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <ShoppingBag size={56} color="#10b981" />
            </View>
            <Text style={styles.emptyTitle}>Chưa có sản phẩm nào trong phiên này</Text>
            <Text style={styles.emptyDesc}>
              Robot hiện chưa tìm thấy sản phẩm quảng cáo nào được xếp lên quầy kệ. Bạn có thể tìm kiếm sản phẩm khác trên bản đồ siêu thị!
            </Text>
            <View style={styles.emptyActionRow}>
              <TouchableOpacity
                style={styles.emptyPrimaryBtn}
                onPress={() => router.push('/product-search' as any)}
                activeOpacity={0.8}
              >
                <Search size={18} color="white" />
                <Text style={styles.emptyPrimaryBtnText}>Tìm kiếm sản phẩm khác</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.emptySecondaryBtn}
                onPress={handleBackToAd}
                activeOpacity={0.8}
              >
                <Text style={styles.emptySecondaryBtnText}>Quay lại màn hình chính</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.gridContainer}>
              {products.map((item, idx) => {
                const key = item.productId || item.id || item.productName || item.name || idx;
                const isSelected = selectedIds.has(key);
                const price = Number(item.productPrice ?? item.unitPrice ?? 0);
                const promoPrice = item.promotionPrice ? Number(item.promotionPrice) : null;
                const imageUrl = item.imageUrl || item.mediaContents?.[0]?.resourceUrl;
                const name = item.productName || item.name || 'Sản phẩm khuyến mãi';
                
                // Vị trí quầy kệ gọn gàng, không lấy tên chiến dịch dài ngoằng
                const shelfLocation =
                  item.shelfName || (item.aisleName ? `Dãy ${item.aisleName}` : 'Quầy kệ siêu thị');

                return (
                  <TouchableOpacity
                    key={String(key)}
                    style={[
                      styles.productCard,
                      isSelected ? styles.productCardSelected : styles.productCardUnselected,
                    ]}
                    onPress={() => toggleSelect(key)}
                    activeOpacity={0.85}
                  >
                    {/* HÌNH ẢNH SẢN PHẨM */}
                    <View style={styles.cardImageContainer}>
                      {imageUrl ? (
                        <Image
                          source={{ uri: imageUrl }}
                          style={styles.productImage}
                          contentFit="contain"
                          transition={200}
                        />
                      ) : (
                        <View style={styles.imageFallback}>
                          <Package size={44} color="#475569" />
                        </View>
                      )}

                      {/* BADGE ƯU ĐÃI GÓC TRÊN TRÁI */}
                      <View style={styles.cardPromoBadge}>
                        <Tag size={11} color="white" />
                        <Text style={styles.cardPromoBadgeText}>ƯU ĐÃI</Text>
                      </View>

                      {/* NÚT CHECKBOX TRÒN GÓC TRÊN PHẢI */}
                      <View style={[styles.checkboxWrap, isSelected && styles.checkboxWrapActive]}>
                        {isSelected ? (
                          <CheckCircle2 size={26} color="#10b981" />
                        ) : (
                          <Circle size={26} color="#64748b" />
                        )}
                      </View>
                    </View>

                    {/* THÔNG TIN CHI TIẾT */}
                    <View style={styles.cardContent}>
                      {/* TÊN SẢN PHẨM (2 DÒNG ĐỀU ĐẶN) */}
                      <Text style={styles.productTitle} numberOfLines={2}>
                        {name}
                      </Text>

                      {/* GIÁ TIỀN RÕ RÀNG */}
                      <View style={styles.priceRow}>
                        {promoPrice && promoPrice < price ? (
                          <>
                            <Text style={styles.promoPriceText}>
                              {promoPrice.toLocaleString('vi-VN')} đ
                            </Text>
                            <Text style={styles.originalPriceText}>
                              {price.toLocaleString('vi-VN')} đ
                            </Text>
                          </>
                        ) : (
                          <Text style={styles.regularPriceText}>
                            {price > 0 ? `${price.toLocaleString('vi-VN')} đ` : 'Giá ưu đãi tại quầy'}
                          </Text>
                        )}
                      </View>

                      {/* VỊ TRÍ KỆ HÀNG */}
                      <View style={styles.locationChip}>
                        <MapPin size={13} color="#10b981" />
                        <Text style={styles.locationChipText} numberOfLines={1}>
                          {shelfLocation}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* ==================== 4. BOTTOM ACTION BAR ==================== */}
        {products.length > 0 && (
          <View style={styles.bottomBar}>
            <View style={styles.bottomSummary}>
              <View style={styles.bottomIconCircle}>
                <Navigation size={18} color="#16a34a" />
              </View>
              <View style={styles.bottomTextColumn}>
                <Text style={styles.bottomMainTitle} numberOfLines={1}>
                  Đã chọn <Text style={styles.bottomBoldCount}>{selectedProducts.length}</Text> món
                </Text>
                <Text style={styles.bottomSubTitle} numberOfLines={1}>
                  Lộ trình gom hàng tối ưu
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.dispatchBtn,
                selectedProducts.length === 0 && styles.dispatchBtnDisabled,
              ]}
              onPress={handleStartGuide}
              disabled={selectedProducts.length === 0 || isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <View style={styles.btnContentRow}>
                  <ActivityIndicator size="small" color="white" />
                  <Text style={styles.dispatchBtnText}>Đang lập tuyến...</Text>
                </View>
              ) : (
                <View style={styles.btnContentRow}>
                  <Navigation size={16} color="white" />
                  <Text style={styles.dispatchBtnText}>
                    Dẫn đường ({selectedProducts.length})
                  </Text>
                  <ArrowRight size={16} color="white" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ==================== 5. MODAL THÔNG BÁO KHÁCH HÀNG THÂN THIỆN ==================== */}
        <Modal
          visible={notice.visible}
          transparent
          animationType="fade"
          onRequestClose={() => setNotice((prev) => ({ ...prev, visible: false }))}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setNotice((prev) => ({ ...prev, visible: false }))}
                activeOpacity={0.7}
              >
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>

              <View style={styles.modalIconBox}>
                <AlertCircle size={40} color="#f59e0b" />
              </View>

              <Text style={styles.modalTitle}>{notice.title}</Text>
              <Text style={styles.modalMessage}>{notice.message}</Text>

              <View style={styles.modalActionRow}>
                {notice.secondaryBtnText && (
                  <TouchableOpacity
                    style={styles.modalSecondaryBtn}
                    onPress={notice.onSecondary}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalSecondaryBtnText}>{notice.secondaryBtnText}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.modalPrimaryBtn}
                  onPress={notice.onPrimary}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalPrimaryBtnText}>
                    {notice.primaryBtnText || 'Tôi Đã Hiểu'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },

  // 1. Header
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  backButtonText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  headerPillText: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  timerBadgeUrgent: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  timerText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '800',
  },
  timerTextUrgent: {
    color: '#ef4444',
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dcfce7',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  memberDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#16a34a',
  },
  memberText: {
    color: '#15803d',
    fontSize: 12,
    fontWeight: '800',
    maxWidth: 120,
  },
  headerTitleWrap: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  headerTitle: {
    color: '#0f172a',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  headerSubtitle: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 17,
  },

  // 2. Toolbar
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  toolbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolbarLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  toolbarCount: {
    color: '#16a34a',
    fontWeight: '900',
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolbarBtnSelectAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  toolbarBtnSelectAllText: {
    color: '#15803d',
    fontSize: 12,
    fontWeight: '700',
  },
  toolbarBtnDeselect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  toolbarBtnDeselectText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },

  // 3. Grid & Cards
  scrollContent: {
    padding: 16,
    paddingBottom: 110,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  productCard: {
    width: (SW - 32 - 12) / 2 > 350 ? (SW - 32 - 24) / 3 : (SW - 32 - 12) / 2,
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  productCardUnselected: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  productCardSelected: {
    backgroundColor: '#f0fdf4',
    borderColor: '#16a34a',
  },
  cardImageContainer: {
    width: '100%',
    height: 140,
    backgroundColor: '#f8fafc',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImage: {
    width: '85%',
    height: '85%',
  },
  imageFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardPromoBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ef4444',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  cardPromoBadgeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  checkboxWrap: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 999,
    padding: 2,
  },
  checkboxWrapActive: {
    backgroundColor: '#ffffff',
  },
  cardContent: {
    padding: 12,
    gap: 4,
  },
  productTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
    minHeight: 38,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
  },
  promoPriceText: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '900',
  },
  originalPriceText: {
    color: '#94a3b8',
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  regularPriceText: {
    color: '#16a34a',
    fontSize: 15,
    fontWeight: '900',
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    backgroundColor: '#f1f5f9',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  locationChipText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
  },

  // 4. Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    paddingRight: 8,
  },
  bottomIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  bottomTextColumn: {
    flex: 1,
  },
  bottomMainTitle: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
  },
  bottomBoldCount: {
    color: '#16a34a',
    fontWeight: '900',
    fontSize: 15,
  },
  bottomSubTitle: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 1,
  },
  dispatchBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  dispatchBtnDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
    elevation: 0,
  },
  dispatchBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  // 5. Loading & Empty
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyDesc: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 440,
    marginBottom: 20,
  },
  emptyActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  emptyPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16a34a',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  emptyPrimaryBtnText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 13,
  },
  emptySecondaryBtn: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptySecondaryBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 13,
  },

  // 6. Notice Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    padding: 6,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
  },
  modalIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalMessage: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  modalPrimaryBtn: {
    flex: 1,
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '800',
  },
  modalSecondaryBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalSecondaryBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
});
