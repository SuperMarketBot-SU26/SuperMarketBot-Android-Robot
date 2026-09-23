import * as Speech from 'expo-speech';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useRouter, usePathname } from 'expo-router';
import {
  MapPin,
  Navigation,
  ShoppingCart,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  Tag,
  ArrowRight,
  Search,
  Layers,
  Camera,
  UserCheck,
  Clock,
  Volume2,
  Flame,
  Zap,
} from 'lucide-react-native';
import { CartService } from '../../services/CartService';
import { useRobotAuth } from '../../context/RobotAuthContext';
import { useCustomerSession } from '../../context/CustomerSessionContext';
import { AdService } from '../../services/AdService';
import { AdInterruptionService } from '../../services/AdInterruptionService';
import { useRobotVoice } from '../../hooks/useRobotVoice';
import { VoiceService } from '../../services/RobotVoiceService';

const ROBOT_ID = Number(process.env.EXPO_PUBLIC_ROBOT_ID ?? '1');
const { width: SW, height: SH } = Dimensions.get('window');

export interface AdMissionOverlayProps {
  mission: any;
  status: string;
  activeWaypoint: any;
  activePlaylist: any[];
  onStartGuide?: (item: any) => void | Promise<void>;
  onSearchOther?: () => void | Promise<void>;
  onOpenCatalog?: (currentPlaylist?: any[]) => void;
  onDismiss?: () => void;
}

export function AdMissionOverlay({
  mission,
  status,
  activeWaypoint,
  activePlaylist,
  onStartGuide,
  onSearchOther,
  onOpenCatalog,
  onDismiss,
}: AdMissionOverlayProps) {
  const [isDismissed, setIsDismissed] = React.useState(false);

  // Khi robot di chuyển đến waypoint mới, hiển thị lại overlay quảng cáo
  React.useEffect(() => {
    setIsDismissed(false);
  }, [activeWaypoint?.nodeId]);

  const pathname = usePathname();
  if (!mission || mission.flowType !== 'ad' || pathname === '/ad-multi-select' || pathname?.includes('ad-multi-select')) return null;

  const isFreeRoam = mission.isFreeRoam
    || mission.adMode === 'freeroam'
    || (mission.isFreeRoam === undefined && mission.adMode === undefined && mission.waypoints?.every((w: any) => (w.dwellTimeSeconds ?? 0) === 0 || w.nodeRole === 'transit'));

  // Với quảng cáo tuần tra tự do (free-roam): phát liên tục khi di chuyển.
  // Với dẫn đường đến kệ (adMode='shelf' hoặc !isFreeRoam):
  // - Khi robot đang di chuyển (MOVING/NAVIGATING): ẨN quảng cáo để khách quan sát bản đồ 2D và hướng dẫn "Mời bạn đi theo tôi".
  // - Khi robot ĐÃ ĐẾN KỆ (ARRIVED hoặc PLAYLIST_PLAYING): MỚI HIỂN THỊ banner quảng cáo của kệ đó!
  const isArrivedAtShelf = status === 'ARRIVED' || status === 'PLAYLIST_PLAYING';
  const shouldShow = status !== 'ESTOP' && !isDismissed && (isFreeRoam || isArrivedAtShelf);

  // Luôn đảm bảo playlist có sản phẩm (nếu activePlaylist tạm thời rỗng thì lấy từ cache hoặc từ waypoint kệ hiện tại)
  const rawPlaylist = (activePlaylist && activePlaylist.length > 0)
    ? activePlaylist
    : (activeWaypoint?.playlist && activeWaypoint.playlist.length > 0
        ? activeWaypoint.playlist
        : (AdInterruptionService.getCachedAdPlaylist()?.length
            ? AdInterruptionService.getCachedAdPlaylist()
            : (!isFreeRoam ? [] : (mission.waypoints?.flatMap((w: any) => w.playlist || []) ?? []))));

  // Khử trùng lặp và sắp xếp theo thứ tự ưu tiên: AdScore gói (VIP > Pro > Standard) -> Điểm ưu tiên chiến dịch (Priority)
  const effectivePlaylist = React.useMemo(() => {
    const seen = new Set<string | number>();
    const res: any[] = [];
    for (const item of (rawPlaylist || [])) {
      const key = item.productId || item.id || item.sponsoredId || item.productName;
      if (key && !seen.has(key)) {
        seen.add(key);
        res.push(item);
      }
    }
    return res.sort((a, b) => {
      const scoreA = Number(a.adScore ?? a.packageScore ?? 0);
      const scoreB = Number(b.adScore ?? b.packageScore ?? 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      const prioA = Number(a.priority ?? 0);
      const prioB = Number(b.priority ?? 0);
      return prioB - prioA;
    });
  }, [rawPlaylist]);

  const handleDismiss = React.useCallback(() => {
    setIsDismissed(true);
    if (onDismiss) onDismiss();
  }, [onDismiss]);

  if (!shouldShow || !effectivePlaylist || effectivePlaylist.length === 0) return null;

  return (
    <Modal visible animationType="fade" statusBarTranslucent transparent>
      <View style={styles.root}>
        <AdInteractiveCarousel
          mission={mission}
          status={status}
          isFreeRoam={Boolean(isFreeRoam)}
          playlist={effectivePlaylist}
          activeWaypoint={activeWaypoint}
          onStartGuide={onStartGuide}
          onSearchOther={onSearchOther}
          onOpenCatalog={onOpenCatalog}
          onDismiss={handleDismiss}
        />
      </View>
    </Modal>
  );
}

function AdInteractiveCarousel({
  mission,
  status,
  isFreeRoam,
  playlist,
  activeWaypoint,
  onStartGuide,
  onSearchOther,
  onOpenCatalog,
  onDismiss,
}: {
  mission?: any;
  status?: string;
  isFreeRoam: boolean;
  playlist: any[];
  activeWaypoint: any;
  onStartGuide?: (item: any) => void | Promise<void>;
  onSearchOther?: () => void | Promise<void>;
  onOpenCatalog?: (currentPlaylist?: any[]) => void;
  onDismiss?: () => void;
}) {
  const router = useRouter();
  const { token, member } = useRobotAuth();
  const { sessionId, refreshSession, markProductFraud, isProductFraud } = useCustomerSession();
  const { speak, stop } = useRobotVoice();
  const [index, setIndex] = useState(0);
  const [isStartingGuide, setIsStartingGuide] = useState(false);
  const [isAddingCart, setIsAddingCart] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);
  const [cartNotice, setCartNotice] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedDetailProduct, setSelectedDetailProduct] = useState<any | null>(null);
  const [bottomCardHeight, setBottomCardHeight] = useState(330);

  const total = playlist.length;
  const currentItem = playlist[index % Math.max(total, 1)];
  const lastSpokenKeyRef = useRef<string | null>(null);
  const lastLoggedImpressionKeyRef = useRef<string | null>(null);
  const isClickDebouncedRef = useRef(false);
  const prevStatusRef = useRef<string | null>(null);
  const currentWaypointKey = `${activeWaypoint?.nodeId ?? ''}_${activeWaypoint?.shelfId ?? ''}`;
  const lastWaypointKeyRef = useRef<string | null>(null);

  const safeSpeak = useCallback((text: string) => {
    void stop();
    setTimeout(() => {
      void speak(text);
    }, 250);
  }, [speak, stop]);

  // Reset index về 0 khi robot chuyển sang kệ mới trong chế độ quảng cáo theo kệ (KHÔNG RESET KHI ĐANG QUẢNG CÁO TỰ DO)
  useEffect(() => {
    if (!isFreeRoam && activeWaypoint && currentWaypointKey !== lastWaypointKeyRef.current) {
      lastWaypointKeyRef.current = currentWaypointKey;
      setIndex(0);
      lastSpokenKeyRef.current = null;
    }
  }, [isFreeRoam, activeWaypoint, currentWaypointKey]);

  // 1. Ghi nhận Lượt Hiển Thị (Impression) khi màn hình bắt đầu phát banner/video quảng cáo
  useEffect(() => {
    if (!currentItem) return;
    const campaignId = currentItem.adCampaignId || currentItem.campaignId;
    const productId = currentItem.productId || currentItem.id;
    if (!campaignId) return;

    const logKey = `${campaignId}-${productId}-${index}`;
    if (lastLoggedImpressionKeyRef.current === logKey) return;
    lastLoggedImpressionKeyRef.current = logKey;

    AdService.logInteraction({
      adCampaignId: campaignId,
      actionType: 'Impression',
      productId: productId,
      robotId: ROBOT_ID,
      sessionId,
      shelfId: activeWaypoint?.shelfId,
    }).catch((err) => {
      console.warn('[AdMissionOverlay] log Impression error:', err);
    });
  }, [currentItem, index, sessionId, activeWaypoint]);

  // 1.5. Preload toàn bộ playlist audio ngay khi nhận danh sách
  useEffect(() => {
    if (!playlist || playlist.length === 0) return;
    const texts = playlist.map((item, i) => {
      const rawPrice = item.productPrice ?? item.unitPrice ?? item.promotionPrice ?? 0;
      const numericPrice = Math.round(Number(rawPrice));
      const priceText = numericPrice > 0 ? `, giá ưu đãi chỉ ${numericPrice.toLocaleString('vi-VN')} đồng.` : '.';
      const pName = item.productName || item.name || 'Sản phẩm';
      const targetShelf = activeWaypoint?.shelfName || activeWaypoint?.nodeName;
      if (!isFreeRoam && targetShelf && i === 0) {
        return `Xin chào quý khách! Tôi đang ở ${targetShelf}. Xin giới thiệu ${pName}${priceText} Mời quý khách chạm màn hình để xem thêm nhé!`;
      }
      return `Tiếp theo là ${pName}${priceText}`;
    });
    void VoiceService.preload(texts);
  }, [playlist, isFreeRoam, activeWaypoint]);

  // 2. Đồng bộ thời gian phiên quảng cáo với Web Admin (theo estimatedDurationSeconds)
  const sessionTotalSec = mission?.estimatedDurationSeconds ?? (isFreeRoam ? 120 : 257);
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState<number>(sessionTotalSec);

  useEffect(() => {
    if (!mission) return;
    const durSec = mission.estimatedDurationSeconds;
    if (!durSec || durSec <= 0) return;

    const dispatchedMs = mission.dispatchedAt
      ? new Date(mission.dispatchedAt).getTime()
      : Date.now();

    const updateSessionTimer = () => {
      const elapsedSec = Math.floor((Date.now() - dispatchedMs) / 1000);
      const remaining = Math.max(0, durSec - elapsedSec);
      setSessionSecondsLeft(remaining);
    };

    updateSessionTimer();
    const interval = setInterval(updateSessionTimer, 1000);
    return () => clearInterval(interval);
  }, [mission?.missionId, mission?.estimatedDurationSeconds, mission?.dispatchedAt]);

  const slideAdvanceTimerRef = useRef<any>(null);
  const fallbackAdvanceTimerRef = useRef<any>(null);

  // 3. TTS & Chuyển slide thông minh: Chờ ĐỌC XONG CÂU HẾT THỨ CẦN ĐỌC + 2 giây nghỉ mới chuyển (có Fallback hẹn giờ bảo vệ)
  useEffect(() => {
    if (!currentItem || isStartingGuide) return;

    if (slideAdvanceTimerRef.current) {
      clearTimeout(slideAdvanceTimerRef.current);
      slideAdvanceTimerRef.current = null;
    }
    if (fallbackAdvanceTimerRef.current) {
      clearTimeout(fallbackAdvanceTimerRef.current);
      fallbackAdvanceTimerRef.current = null;
    }

    const rawPrice = currentItem.productPrice ?? currentItem.unitPrice ?? currentItem.promotionPrice ?? 0;
    const numericPrice = Math.round(Number(rawPrice));
    const priceText = numericPrice > 0 ? `, giá ưu đãi chỉ ${numericPrice.toLocaleString('vi-VN')} đồng.` : '.';
    const pName = currentItem.productName || currentItem.name || 'Sản phẩm';
    const targetShelf = activeWaypoint?.shelfName || activeWaypoint?.nodeName;

    let speechText = '';
    if (!isFreeRoam && targetShelf && index === 0) {
      speechText = `Xin chào quý khách! Tôi đang ở ${targetShelf}. Xin giới thiệu ${pName}${priceText} Mời quý khách chạm màn hình để tôi dẫn đường hoặc thêm vào giỏ hàng nhé!`;
    } else {
      speechText = `Tiếp theo là ${pName}${priceText}`;
    }

    const baseDuration = currentItem?.durationSeconds ?? currentItem?.displayDurationSeconds ?? (isFreeRoam ? 10 : 12);
    setItemSecondsLeft(baseDuration);

    const advanceSlide = () => {
      if (!selectedDetailProduct && !showLoginModal && !isAddingCart) {
        if (total > 1) {
          setIndex((curr: number) => (curr + 1) % total);
        }
        setCartSuccess(false);
        setCartNotice(null);
      }
    };

    // Fallback bảo vệ: Tối đa sau baseDuration + 2 giây robot bắt buộc chuyển banner tiếp theo kể cả khi TTS bị ngắt
    fallbackAdvanceTimerRef.current = setTimeout(advanceSlide, (baseDuration + 2) * 1000);

    // Phát giọng nói FPT banmai (hoặc fallback Android TTS)
    void speak(speechText, () => {
      // ĐÃ ĐỌC XONG HOÀN TOÀN! Nghỉ 2 giây để khách kịp nhìn màn hình rồi mới lật trang
      if (fallbackAdvanceTimerRef.current) {
        clearTimeout(fallbackAdvanceTimerRef.current);
        fallbackAdvanceTimerRef.current = null;
      }
      slideAdvanceTimerRef.current = setTimeout(advanceSlide, 2000);
    });

    return () => {
      if (slideAdvanceTimerRef.current) {
        clearTimeout(slideAdvanceTimerRef.current);
        slideAdvanceTimerRef.current = null;
      }
      if (fallbackAdvanceTimerRef.current) {
        clearTimeout(fallbackAdvanceTimerRef.current);
        fallbackAdvanceTimerRef.current = null;
      }
    };
  }, [currentItem, index, isStartingGuide, isFreeRoam, activeWaypoint, speak, total, selectedDetailProduct, showLoginModal, isAddingCart]);

  useEffect(() => {
    return () => {
      if (slideAdvanceTimerRef.current) {
        clearTimeout(slideAdvanceTimerRef.current);
        slideAdvanceTimerRef.current = null;
      }
      void stop();
    };
  }, [stop]);

  // 4. Thời lượng hiển thị sản phẩm & đếm giây đỗ tại kệ
  const rawSec = currentItem?.durationSeconds ?? currentItem?.displayDurationSeconds ?? (isFreeRoam ? 10 : 12);
  const [itemSecondsLeft, setItemSecondsLeft] = useState<number>(rawSec > 0 ? rawSec : 12);

  const shelfDwell = activeWaypoint?.dwellTimeSeconds ?? activeWaypoint?.effectiveDwellTimeSeconds ?? 20;
  const [shelfDwellLeft, setShelfDwellLeft] = useState<number>(shelfDwell);

  useEffect(() => {
    const dwell = activeWaypoint?.dwellTimeSeconds ?? activeWaypoint?.effectiveDwellTimeSeconds ?? 20;
    setShelfDwellLeft(dwell);
  }, [activeWaypoint, currentWaypointKey]);

  useEffect(() => {
    if (isFreeRoam) return;
    const interval = setInterval(() => {
      setShelfDwellLeft((prev: number) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isFreeRoam, activeWaypoint, currentWaypointKey]);

  // Đếm ngược giây sản phẩm để thanh tiến độ chuyển động mượt mà (không ép lật trang khi chưa đọc xong)
  useEffect(() => {
    const interval = setInterval(() => {
      setItemSecondsLeft((prev: number) => (prev > 1 ? prev - 1 : 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [index, currentItem]);

  const handleNext = () => {
    refreshSession();
    if (slideAdvanceTimerRef.current) clearTimeout(slideAdvanceTimerRef.current);
    void stop();
    setIndex((curr) => (curr + 1) % total);
    setCartSuccess(false);
    setCartNotice(null);
  };

  const handlePrev = () => {
    refreshSession();
    if (slideAdvanceTimerRef.current) clearTimeout(slideAdvanceTimerRef.current);
    void stop();
    setIndex((curr) => (curr - 1 + total) % total);
    setCartSuccess(false);
    setCartNotice(null);
  };

  // Ghi nhận Lượt Chạm Sản Phẩm (Click) & Client Debounce & Server Fraud Handling
  const handleProductClick = async (e?: any) => {
    refreshSession();
    if (!currentItem) return;

    const campaignId = currentItem.adCampaignId || currentItem.campaignId;
    const productId = currentItem.productId || currentItem.id;

    // Client Debounce (Chống chạm đúp): vô hiệu hóa touch trên sản phẩm đó trong 1.5 giây
    if (isClickDebouncedRef.current) return;
    isClickDebouncedRef.current = true;
    setTimeout(() => {
      isClickDebouncedRef.current = false;
    }, 1500);

    // Mở popup thông tin chi tiết sản phẩm
    setSelectedDetailProduct(currentItem);

    // Nếu server đã báo spam (isFraud) cho sản phẩm này trong session hiện tại, không gửi thêm request
    if (productId && isProductFraud(productId)) {
      console.log(`[AdMissionOverlay] Product ${productId} already marked fraud in session - skipping Click request.`);
      return;
    }

    if (campaignId) {
      const xCoord = Math.round(e?.nativeEvent?.pageX ?? e?.nativeEvent?.locationX ?? 0);
      const yCoord = Math.round(e?.nativeEvent?.pageY ?? e?.nativeEvent?.locationY ?? 0);

      try {
        const res = await AdService.logInteraction({
          adCampaignId: campaignId,
          actionType: 'Click',
          productId: productId,
          robotId: ROBOT_ID,
          sessionId,
          shelfId: activeWaypoint?.shelfId,
          xCoord,
          yCoord,
        });

        console.log('[AdMissionOverlay] Click response:', res);
        if (res?.isFraud && productId) {
          markProductFraud(productId);
          console.warn(`[AdMissionOverlay] Server flagged spam click (${res.fraudReason}) - blocked further clicks for product ${productId} in this session.`);
        }
      } catch (err) {
        console.warn('[AdMissionOverlay] log Click error:', err);
      }
    }
  };

  const handleGuide = async () => {
    refreshSession();
    if (isStartingGuide || !onStartGuide || !currentItem) return;
    setIsStartingGuide(true);
    // Safety timeout: reset spinner after 5s in case the component unmounts before catch fires
    const safetyTimer = setTimeout(() => setIsStartingGuide(false), 5000);
    try {
      await onStartGuide(currentItem);
    } catch (err) {
      console.warn('[AdMissionOverlay] handleGuide error:', err);
      setIsStartingGuide(false);
    } finally {
      clearTimeout(safetyTimer);
    }
  };

  const handleMultiProductGuide = () => {
    refreshSession();
    // 1. Dừng ngay toàn bộ giọng nói TTS để không phát đè
    void stop();
    VoiceService.stop();
    Speech.stop();
    if (slideAdvanceTimerRef.current) clearTimeout(slideAdvanceTimerRef.current);
    if (fallbackAdvanceTimerRef.current) clearTimeout(fallbackAdvanceTimerRef.current);

    // 2. Lưu toàn bộ danh sách sản phẩm quảng cáo vào cache
    if (playlist && playlist.length > 0) {
      AdInterruptionService.setCachedAdPlaylist(playlist);
    }

    // 3. Mở màn hình chọn nhiều sản phẩm
    if (onOpenCatalog) {
      onOpenCatalog(playlist);
    } else {
      router.push('/ad-multi-select' as any);
    }
  };

  const handleSearchOther = async () => {
    refreshSession();
    if (onSearchOther) {
      await onSearchOther();
    } else if (onDismiss) {
      onDismiss();
    }
  };

  const handleAddToCart = async () => {
    refreshSession();
    if (isAddingCart || !currentItem) return;
    const pId = currentItem.productId || currentItem.id;
    if (!pId) {
      setCartNotice('Không xác định được mã sản phẩm.');
      setTimeout(() => setCartNotice(null), 3000);
      return;
    }

    if (!token) {
      setCartNotice('Quý khách vui lòng đăng nhập thành viên để lưu vào giỏ hàng!');
      setShowLoginModal(true);
      safeSpeak('Quý khách vui lòng đăng nhập thành viên để lưu sản phẩm vào giỏ hàng nhé!');
      setTimeout(() => setCartNotice(null), 4000);
      return;
    }

    setIsAddingCart(true);
    try {
      await CartService.addItem(pId, 1, token);
      setCartSuccess(true);
      setCartNotice('Đã thêm vào giỏ hàng thành công!');
      const pName = currentItem.productName || currentItem.name || 'sản phẩm';
      safeSpeak(`Đã thêm ${pName} vào giỏ hàng thành công!`);
      setTimeout(() => {
        setCartSuccess(false);
        setCartNotice(null);
      }, 3500);
    } catch (err: any) {
      console.warn('[AdMissionOverlay] Add to cart failed:', err);
      setCartNotice(err?.message || 'Không thể thêm vào giỏ hàng.');
      setTimeout(() => setCartNotice(null), 3500);
    } finally {
      setIsAddingCart(false);
    }
  };

  const media = currentItem?.mediaContents?.[0];
  const type = String(media?.resourceType ?? '').toUpperCase();
  const mediaUrl = media?.resourceUrl || currentItem?.imageUrl || '';
  const title = currentItem?.name || currentItem?.productName || 'Ưu đãi đặc biệt';
  const price = currentItem?.productPrice ?? currentItem?.unitPrice ?? 0;
  const description = media?.contentText || currentItem?.description || 'Chương trình khuyến mãi nổi bật tại siêu thị hôm nay.';
  const campaign = currentItem?.campaignName;
  const isEnRoute = status === 'MOVING' || status === 'NAVIGATING';
  const targetShelfName = activeWaypoint?.shelfName || activeWaypoint?.nodeName || 'Kệ hàng';
  const shelfLabel = isEnRoute
    ? `Đang tới: ${targetShelfName}`
    : (isFreeRoam ? 'Quảng cáo toàn siêu thị' : `Đang tại: ${targetShelfName}`);

  return (
    <View style={styles.container}>
      {/* Top product duration progress bar */}
      <View style={styles.progressBarTrack}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${Math.min(100, Math.max(0, ((rawSec - itemSecondsLeft) / rawSec) * 100))}%` },
          ]}
        />
      </View>

      {/* Visual background & uncropped hero product showcase - Chạm để xem chi tiết & ghi nhận Click */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleProductClick}>
        <AdCreativeMedia type={type} url={mediaUrl} bottomSpace={bottomCardHeight} />

        {/* Floating Promotion Pill */}
        <View style={styles.floatingDealTag} pointerEvents="none">
          <Flame size={14} color="#f97316" />
          <Text style={styles.floatingDealText}>ƯU ĐÃI ĐẶC QUYỀN HÔM NAY</Text>
        </View>

        {/* Floating Touch To Explore Hint */}
        <View style={styles.floatingTouchHint} pointerEvents="none">
          <Sparkles size={13} color="#38bdf8" />
          <Text style={styles.floatingTouchText}>Chạm vào ảnh để xem chi tiết</Text>
        </View>
      </Pressable>

      {/* TOP HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.locationChip, isEnRoute && { backgroundColor: 'rgba(14, 116, 144, 0.85)', borderColor: '#38bdf8' }]}>
            {isEnRoute ? (
              <Navigation size={15} color="#38bdf8" />
            ) : (
              <MapPin size={15} color="#10b981" />
            )}
            <Text style={styles.locationText}>{shelfLabel}</Text>
          </View>
          {/* Live countdown timer chip: Hiển thị đồng bộ với Web Admin */}
          <View style={styles.timerChip}>
            <Clock size={14} color="#ea580c" />
            <Text style={styles.timerText}>
              {sessionSecondsLeft > 0
                ? `Phiên: ${Math.floor(sessionSecondsLeft / 60)}:${String(sessionSecondsLeft % 60).padStart(2, '0')}${!isFreeRoam ? ` (Kệ: ${shelfDwellLeft}s)` : ''}`
                : (isFreeRoam ? `${itemSecondsLeft}s` : `Kệ: ${shelfDwellLeft}s`)}
            </Text>
          </View>
          {campaign && (
            <View style={styles.campaignChip}>
              <Tag size={13} color="#f59e0b" />
              <Text style={styles.campaignText} numberOfLines={1}>{campaign}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onDismiss}
          activeOpacity={0.7}
        >
          <X size={20} color="#cbd5e1" />
        </TouchableOpacity>
      </View>

      {/* NAVIGATION CONTROLS (IF MULTIPLE PRODUCTS) */}
      {total > 1 && (
        <>
          <TouchableOpacity style={styles.navLeft} onPress={handlePrev} activeOpacity={0.7}>
            <ChevronLeft size={28} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navRight} onPress={handleNext} activeOpacity={0.7}>
            <ChevronRight size={28} color="white" />
          </TouchableOpacity>
        </>
      )}

      {/* BOTTOM PRODUCT INFORMATION & INTERACTIVE ACTION CARD */}
      <View
        style={styles.bottomCard}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 150) {
            setBottomCardHeight(h);
          }
        }}
      >
        {/* Pagination indicator */}
        {total > 1 && (
          <View style={styles.dotsRow}>
            {playlist.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === index % total && styles.activeDot,
                ]}
              />
            ))}
          </View>
        )}

        {/* Live Voice Assistant Banner: Visual sound equalizer showing robot is actively speaking */}
        <View style={styles.voiceAssistantBanner}>
          <View style={styles.voiceIconBox}>
            <Volume2 size={14} color="#10b981" />
          </View>
          <Text style={styles.voiceAssistantText} numberOfLines={1}>
            {isEnRoute
              ? 'Robot đang tuần tra & phát sóng ưu đãi...'
              : `Robot đang giới thiệu: ${title}`}
          </Text>
          <View style={styles.equalizerWrap}>
            <View style={[styles.eqBar, { height: 10 }]} />
            <View style={[styles.eqBar, { height: 16 }]} />
            <View style={[styles.eqBar, { height: 12 }]} />
            <View style={[styles.eqBar, { height: 18 }]} />
          </View>
        </View>

        {/* Product Title & Price - Có thể nhấn để xem chi tiết */}
        <TouchableOpacity activeOpacity={0.88} onPress={handleProductClick}>
          <Text style={styles.productTitle} numberOfLines={2}>
            {title}
          </Text>

          {/* Price and Badges */}
          <View style={styles.priceRow}>
            {price > 0 ? (
              <View style={styles.priceContainer}>
                <View style={styles.priceBox}>
                  <Text style={styles.priceNumber}>
                    {price.toLocaleString('vi-VN')}
                  </Text>
                  <Text style={styles.priceCurrency}>₫</Text>
                </View>
                <Text style={styles.originalPrice}>
                  {Math.round(price * 1.25).toLocaleString('vi-VN')}₫
                </Text>
              </View>
            ) : (
              <View style={styles.freeDealBox}>
                <Sparkles size={16} color="#10b981" />
                <Text style={styles.freeDealText}>ƯU ĐÃI NỔI BẬT</Text>
              </View>
            )}

            <View style={styles.promoBadge}>
              <Zap size={11} color="#f87171" style={{ marginRight: 3 }} />
              <Text style={styles.promoBadgeText}>GIẢM 20% HÔM NAY</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Description / Text */}
        {!!description && (
          <Text style={styles.productDescription} numberOfLines={2}>
            {description}
          </Text>
        )}

        {/* Cart notice / feedback */}
        {cartNotice && (
          <View style={[styles.noticeBox, cartSuccess ? styles.noticeSuccess : styles.noticeInfo]}>
            {cartSuccess ? (
              <CheckCircle2 size={16} color="#10b981" />
            ) : (
              <Sparkles size={16} color="#38bdf8" />
            )}
            <Text style={styles.noticeText}>{cartNotice}</Text>
          </View>
        )}

        {/* INTERACTIVE ACTION BUTTONS */}
        <View style={styles.actionsContainer}>
          {isFreeRoam ? (
            /* PRIMARY BUTTON: Dẫn tôi mua món này (CHỈ HIỂN THỊ TRONG CHẾ ĐỘ QUẢNG CÁO TỰ DO) */
            <TouchableOpacity
              style={[styles.guideButton, isStartingGuide && styles.disabledButton]}
              onPress={handleGuide}
              disabled={isStartingGuide}
              activeOpacity={0.85}
            >
              {isStartingGuide ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Navigation size={22} color="white" />
              )}
              <View style={styles.guideButtonTextWrap}>
                <Text style={styles.guideButtonTitle}>
                  {isStartingGuide ? 'ĐANG KHỞI TẠO LỘ TRÌNH...' : 'DẪN TÔI MUA MÓN NÀY'}
                </Text>
                <Text style={styles.guideButtonSub}>
                  Dẫn đến 1 sản phẩm đang hiển thị · Tạm dừng QC
                </Text>
              </View>
              <ArrowRight size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          ) : (
            /* QUẢNG CÁO THEO KỆ: ĐÃ ĐỖ TRƯỚC KỆ HÀNG, KHÔNG CẦN DẪN ĐƯỜNG MÀ HIỂN THỊ BANNER TẠI CHỖ */
            <View style={styles.atShelfBanner}>
              <View style={styles.atShelfIconBox}>
                <MapPin size={22} color="#10b981" />
              </View>
              <View style={styles.atShelfTextWrap}>
                <Text style={styles.atShelfTitle}>SẢN PHẨM CÓ TẠI KỆ NÀY</Text>
                <Text style={styles.atShelfSub}>
                  Vị trí ngay trước mặt bạn · Quý khách có thể chọn lấy trên quầy
                </Text>
              </View>
              <CheckCircle2 size={20} color="#10b981" />
            </View>
          )}

          {/* HÀNG NÚT PHỤ: 2 NÚT CÂN ĐỐI 50% - 50% RỘNG RÃI, DỄ CHẠM */}
          <View style={styles.secondaryRow}>
            {/* XEM CÁC MÓN ĐANG ĐƯỢC QUẢNG CÁO */}
            <TouchableOpacity
              style={styles.multiSelectButton}
              onPress={handleMultiProductGuide}
              activeOpacity={0.75}
            >
              <Layers size={18} color="#c084fc" />
              <Text style={styles.multiSelectButtonText} numberOfLines={1}>
                {!isFreeRoam ? 'Xem món tại kệ' : 'Xem tất cả món'}
              </Text>
            </TouchableOpacity>

            {/* TIẾP TỤC XEM / LẬT BANNER TIẾP THEO */}
            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleNext}
              activeOpacity={0.75}
            >
              <Text style={styles.skipButtonText}>Tiếp tục xem ❯</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* MODAL YÊU CẦU ĐĂNG NHẬP THÀNH VIÊN ĐỂ DẪN ĐƯỜNG NHIỀU MÓN */}
      <Modal
        visible={showLoginModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowLoginModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowLoginModal(false)}
              activeOpacity={0.7}
            >
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>

            <View style={styles.modalIconWrap}>
              <Sparkles size={36} color="#f59e0b" />
            </View>

            <Text style={styles.modalTitle}>Dành Riêng Cho Thành Viên</Text>
            <Text style={styles.modalMessage}>
              Tính năng chọn nhiều sản phẩm và lập lộ trình mua sắm thông minh tối ưu dành riêng cho Khách hàng Thành viên.
            </Text>
            <Text style={styles.modalSubMessage}>
              Quý khách vui lòng quét khuôn mặt hoặc đăng nhập tài khoản để robot phục vụ gom hàng chu đáo nhất!
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={() => {
                  AdInterruptionService.setCachedAdPlaylist(playlist);
                  setShowLoginModal(false);
                  if (onDismiss) onDismiss();
                  router.push({ pathname: '/face-scan', params: { returnUrl: '/ad-multi-select' } } as any);
                }}
                activeOpacity={0.85}
              >
                <Camera size={20} color="white" />
                <Text style={styles.modalPrimaryBtnText}>Quét Khuôn Mặt (Face ID)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSecondaryBtn}
                onPress={() => {
                  AdInterruptionService.setCachedAdPlaylist(playlist);
                  setShowLoginModal(false);
                  if (onDismiss) onDismiss();
                  router.push({ pathname: '/login', params: { returnUrl: '/ad-multi-select' } } as any);
                }}
                activeOpacity={0.85}
              >
                <UserCheck size={18} color="#e2e8f0" />
                <Text style={styles.modalSecondaryBtnText}>Đăng Nhập Tài Khoản</Text>
              </TouchableOpacity>

              {isFreeRoam && (
                <TouchableOpacity
                  style={styles.modalSingleGuideBtn}
                  onPress={() => {
                    setShowLoginModal(false);
                    void handleGuide();
                  }}
                  activeOpacity={0.85}
                >
                  <Navigation size={16} color="#10b981" />
                  <Text style={styles.modalSingleGuideBtnText}>
                    Chỉ dẫn 1 món này (Không cần đăng nhập)
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowLoginModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelBtnText}>Để sau</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL CHI TIẾT SẢN PHẨM KHI KHÁCH CHẠM VÀO SẢN PHẨM */}
      <Modal
        visible={!!selectedDetailProduct}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSelectedDetailProduct(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.detailCard}>
            {/* Header: Location Tag + Nút đóng */}
            <View style={styles.detailHeaderRow}>
              <View style={styles.detailLocationChip}>
                <MapPin size={15} color="#10b981" />
                <Text style={styles.detailLocationText}>
                  {activeWaypoint?.shelfName || activeWaypoint?.nodeName || 'Kệ hàng siêu thị'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.detailCloseBtn}
                onPress={() => setSelectedDetailProduct(null)}
                activeOpacity={0.7}
              >
                <X size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Khung ảnh sản phẩm nền trắng bo góc sang trọng */}
            {Boolean(selectedDetailProduct?.imageUrl || selectedDetailProduct?.mediaContents?.[0]?.resourceUrl) && (
              <View style={styles.detailImageWrapper}>
                <Image
                  source={{ uri: selectedDetailProduct?.imageUrl || selectedDetailProduct?.mediaContents?.[0]?.resourceUrl }}
                  style={styles.detailProductImage}
                  contentFit="contain"
                />
                <View style={styles.detailPromoTag}>
                  <Sparkles size={13} color="#f59e0b" />
                  <Text style={styles.detailPromoTagText}>ƯU ĐÃI ĐẶC BIỆT</Text>
                </View>
              </View>
            )}

            {/* Tên sản phẩm */}
            <Text style={styles.detailTitle} numberOfLines={2}>
              {selectedDetailProduct?.productName || selectedDetailProduct?.name || 'Chi tiết sản phẩm'}
            </Text>

            {/* Giá sản phẩm */}
            <View style={styles.detailPriceRow}>
              {Number(selectedDetailProduct?.productPrice ?? selectedDetailProduct?.unitPrice ?? 0) > 0 ? (
                <View style={styles.priceBox}>
                  <Text style={styles.detailPriceNumber}>
                    {Number(selectedDetailProduct?.productPrice ?? selectedDetailProduct?.unitPrice ?? 0).toLocaleString('vi-VN')}
                  </Text>
                  <Text style={styles.detailPriceCurrency}>₫</Text>
                </View>
              ) : (
                <View style={styles.freeDealBox}>
                  <Sparkles size={16} color="#10b981" />
                  <Text style={styles.freeDealText}>GIÁ ĐẶC BIỆT HÔM NAY</Text>
                </View>
              )}
            </View>

            {/* Mô tả sản phẩm */}
            <Text style={styles.detailDescription} numberOfLines={3}>
              {selectedDetailProduct?.description || selectedDetailProduct?.mediaContents?.[0]?.contentText || 'Sản phẩm chính hãng với mức giá ưu đãi đặc biệt hôm nay tại siêu thị.'}
            </Text>

            {/* Thông báo vị trí kệ hàng thực tế (khi robot đang đỗ tại kệ) */}
            {!isFreeRoam && (
              <View style={styles.detailAtShelfBanner}>
                <MapPin size={17} color="#10b981" />
                <Text style={styles.detailAtShelfBannerText}>
                  Sản phẩm đang có sẵn trên Kệ trước mặt bạn · Quý khách có thể chọn lấy ngay!
                </Text>
              </View>
            )}

            {/* Hàng nút hành động cân đối, không bị đè */}
            <View style={styles.detailActionsRow}>
              {isFreeRoam ? (
                <>
                  <TouchableOpacity
                    style={styles.detailPrimaryGuideBtn}
                    onPress={() => {
                      setSelectedDetailProduct(null);
                      void handleGuide();
                    }}
                    activeOpacity={0.85}
                  >
                    <Navigation size={18} color="white" />
                    <Text style={styles.detailPrimaryGuideBtnText}>Dẫn tôi đến kệ này</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.detailSecondaryCatalogBtn}
                    onPress={() => {
                      setSelectedDetailProduct(null);
                      handleMultiProductGuide();
                    }}
                    activeOpacity={0.85}
                  >
                    <Layers size={17} color="#c084fc" />
                    <Text style={styles.detailSecondaryCatalogBtnText}>
                      {!isFreeRoam ? 'Xem món tại kệ' : 'Xem tất cả món'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.detailPrimaryCatalogBtn}
                    onPress={() => {
                      setSelectedDetailProduct(null);
                      handleMultiProductGuide();
                    }}
                    activeOpacity={0.85}
                  >
                    <Layers size={18} color="white" />
                    <Text style={styles.detailPrimaryCatalogBtnText}>
                      {!isFreeRoam
                        ? (targetShelfName ? `Xem các món tại ${targetShelfName}` : 'Xem các món tại kệ này')
                        : 'Xem tất cả món đang quảng cáo'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.detailCloseActionBtn}
                    onPress={() => setSelectedDetailProduct(null)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.detailCloseActionBtnText}>Tiếp tục xem ❯</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function AdCreativeMedia({
  type,
  url,
  bottomSpace = 330,
}: {
  type: string;
  url: string;
  bottomSpace?: number;
}) {
  const isVideo = (type.includes('VIDEO') || /\.(mp4|webm|mov)(\?|$)/i.test(url)) && Boolean(url);
  const player = useVideoPlayer(isVideo ? url : null, (instance) => {
    if (isVideo) {
      instance.loop = true;
      instance.play();
    }
  });

  if (isVideo && url) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#020617' }]} />
        <View style={[styles.mediaShowcaseContainer, { bottom: bottomSpace + 12 }]}>
          <VideoView player={player} style={styles.showcaseMedia} contentFit="contain" nativeControls={false} />
        </View>
      </View>
    );
  }

  if (url) {
    return (
      <View style={StyleSheet.absoluteFill}>
        {/* Ambient blurred backdrop: fills screen and creates soft product color glow */}
        <Image
          source={{ uri: url }}
          style={[StyleSheet.absoluteFill, { opacity: 0.3 }]}
          contentFit="cover"
          blurRadius={28}
        />
        {/* Soft vignette overlay for contrast */}
        <View style={styles.ambientVignette} />

        {/* Foreground hero product showcase: uncropped, perfectly proportioned */}
        <View style={[styles.mediaShowcaseContainer, { bottom: bottomSpace + 12 }]}>
          <Image
            source={{ uri: url }}
            style={styles.showcaseMedia}
            contentFit="contain"
            transition={250}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#090d16', justifyContent: 'center', alignItems: 'center' }]}>
      <Sparkles size={80} color="#1e293b" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020617',
  },
  container: {
    flex: 1,
  },
  backdropLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(2, 6, 23, 0.45)',
  },
  header: {
    position: 'absolute',
    top: 36,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  locationText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
  },
  timerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(234, 88, 12, 0.7)',
  },
  timerText: {
    color: '#fdba74',
    fontSize: 13,
    fontWeight: '800',
  },
  progressBarTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 99,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ea580c',
    borderRadius: 2,
  },
  campaignChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    maxWidth: 200,
  },
  campaignText: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '600',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaShowcaseContainer: {
    position: 'absolute',
    top: 90,
    left: 16,
    right: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  showcaseMedia: {
    width: '100%',
    height: '100%',
  },
  ambientVignette: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
  },
  navLeft: {
    position: 'absolute',
    left: 16,
    top: SH * 0.35,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  navRight: {
    position: 'absolute',
    right: 16,
    top: SH * 0.35,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(3, 7, 18, 0.94)',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    padding: 24,
    paddingBottom: 36,
    borderTopWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  floatingDealTag: {
    position: 'absolute',
    top: 96,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.6)',
    shadowColor: '#f97316',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  floatingDealText: {
    color: '#ffedd5',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  floatingTouchHint: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  floatingTouchText: {
    color: '#bae6fd',
    fontSize: 12,
    fontWeight: '700',
  },
  voiceAssistantBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    marginBottom: 10,
  },
  voiceIconBox: {
    marginRight: 8,
  },
  voiceAssistantText: {
    flex: 1,
    color: '#6ee7b7',
    fontSize: 12.5,
    fontWeight: '700',
  },
  equalizerWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    marginLeft: 8,
  },
  eqBar: {
    width: 3,
    backgroundColor: '#10b981',
    borderRadius: 1.5,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  originalPrice: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '700',
    textDecorationLine: 'line-through',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  activeDot: {
    width: 24,
    backgroundColor: '#10b981',
  },
  productTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 34,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  priceBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceNumber: {
    color: '#10b981',
    fontSize: 32,
    fontWeight: '900',
  },
  priceCurrency: {
    color: '#10b981',
    fontSize: 20,
    fontWeight: '800',
    marginLeft: 3,
  },
  freeDealBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  freeDealText: {
    color: '#10b981',
    fontWeight: '800',
    fontSize: 14,
  },
  promoBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  promoBadgeText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  productDescription: {
    color: '#94a3b8',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  noticeSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  noticeInfo: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  noticeText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  actionsContainer: {
    gap: 10,
  },
  guideButton: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 18,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#34d399',
  },
  disabledButton: {
    opacity: 0.6,
  },
  guideButtonTextWrap: {
    flex: 1,
    marginLeft: 14,
  },
  guideButtonTitle: {
    color: '#ffffff',
    fontSize: 16.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  guideButtonSub: {
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 12,
    marginTop: 2,
  },
  secondaryGrid: {
    gap: 8,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  multiSelectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: 'rgba(168, 85, 247, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.5)',
    paddingVertical: 12,
    borderRadius: 14,
  },
  multiSelectButtonText: {
    color: '#c084fc',
    fontSize: 13.5,
    fontWeight: '700',
  },
  cartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.45)',
    paddingVertical: 12,
    borderRadius: 14,
  },
  cartButtonText: {
    color: '#38bdf8',
    fontSize: 13.5,
    fontWeight: '700',
  },
  searchOtherButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    paddingVertical: 12,
    borderRadius: 14,
  },
  searchOtherButtonText: {
    color: '#fbbf24',
    fontSize: 13.5,
    fontWeight: '700',
  },
  skipButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 12,
    borderRadius: 14,
  },
  skipButtonText: {
    color: '#e2e8f0',
    fontSize: 13.5,
    fontWeight: '600',
  },
  atShelfBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1.5,
    borderColor: '#10b981',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  atShelfIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  atShelfTextWrap: {
    flex: 1,
  },
  atShelfTitle: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  atShelfSub: {
    color: '#cbd5e1',
    fontSize: 12.5,
    marginTop: 2,
    fontWeight: '500',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#0f172a',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalMessage: {
    color: '#e2e8f0',
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 6,
  },
  modalSubMessage: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 22,
  },
  modalActions: {
    width: '100%',
    gap: 10,
  },
  modalPrimaryBtn: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#34d399',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  modalPrimaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  modalSecondaryBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  modalSecondaryBtnText: {
    color: '#e2e8f0',
    fontSize: 14.5,
    fontWeight: '700',
  },
  modalSingleGuideBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  modalSingleGuideBtnText: {
    color: '#10b981',
    fontSize: 13.5,
    fontWeight: '700',
  },
  modalCancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  detailCard: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#0f172a',
    borderRadius: 28,
    padding: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 20,
  },
  detailHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  detailCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailImageWrapper: {
    width: '100%',
    height: 185,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginBottom: 14,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  detailProductImage: {
    width: '100%',
    height: '100%',
  },
  detailPromoTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0f172a',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  detailPromoTagText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  detailLocationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignSelf: 'flex-start',
  },
  detailLocationText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '700',
  },
  detailTitle: {
    color: '#ffffff',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.3,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  detailPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  detailPriceNumber: {
    color: '#10b981',
    fontSize: 26,
    fontWeight: '900',
  },
  detailPriceCurrency: {
    color: '#10b981',
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 2,
  },
  detailDescription: {
    color: '#94a3b8',
    fontSize: 13.5,
    lineHeight: 19,
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  detailAtShelfBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 16,
  },
  detailAtShelfBannerText: {
    color: '#34d399',
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1,
    lineHeight: 17,
  },
  detailActionsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  detailPrimaryCatalogBtn: {
    flex: 1.5,
    backgroundColor: '#7c3aed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#a78bfa',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  detailPrimaryCatalogBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800',
  },
  detailCloseActionBtn: {
    flex: 0.85,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  detailCloseActionBtnText: {
    color: '#cbd5e1',
    fontSize: 13.5,
    fontWeight: '700',
  },
  detailPrimaryGuideBtn: {
    flex: 1.2,
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#34d399',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  detailPrimaryGuideBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  detailSecondaryCatalogBtn: {
    flex: 1,
    backgroundColor: 'rgba(192, 132, 252, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.35)',
  },
  detailSecondaryCatalogBtnText: {
    color: '#c084fc',
    fontSize: 13.5,
    fontWeight: '700',
  },
});
