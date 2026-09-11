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
import { useRouter } from 'expo-router';
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
} from 'lucide-react-native';
import { CartService } from '../../services/CartService';
import { useRobotAuth } from '../../context/RobotAuthContext';
import { useCustomerSession } from '../../context/CustomerSessionContext';
import { AdService } from '../../services/AdService';
import { AdInterruptionService } from '../../services/AdInterruptionService';

const ROBOT_ID = Number(process.env.EXPO_PUBLIC_ROBOT_ID ?? '1');
const { width: SW, height: SH } = Dimensions.get('window');

export interface AdMissionOverlayProps {
  mission: any;
  status: string;
  activeWaypoint: any;
  activePlaylist: any[];
  onStartGuide?: (item: any) => void | Promise<void>;
  onSearchOther?: () => void | Promise<void>;
  onDismiss?: () => void;
}

export function AdMissionOverlay({
  mission,
  status,
  activeWaypoint,
  activePlaylist,
  onStartGuide,
  onSearchOther,
  onDismiss,
}: AdMissionOverlayProps) {
  if (!mission || mission.flowType !== 'ad') return null;

  const isFreeRoam = mission.isFreeRoam
    || mission.adMode === 'freeroam'
    || mission.waypoints?.every((w: any) => (w.dwellTimeSeconds ?? 0) === 0 || w.nodeRole === 'transit');
  const shouldShow = isFreeRoam
    ? ['NAVIGATING', 'MOVING', 'ARRIVED', 'PLAYLIST_PLAYING'].includes(status)
    : (status === 'ARRIVED' || status === 'PLAYLIST_PLAYING');

  if (!shouldShow || !activePlaylist || activePlaylist.length === 0) return null;

  return (
    <Modal visible animationType="fade" statusBarTranslucent transparent>
      <View style={styles.root}>
        <AdInteractiveCarousel
          mission={mission}
          isFreeRoam={Boolean(isFreeRoam)}
          playlist={activePlaylist}
          activeWaypoint={activeWaypoint}
          onStartGuide={onStartGuide}
          onSearchOther={onSearchOther}
          onDismiss={onDismiss}
        />
      </View>
    </Modal>
  );
}

function AdInteractiveCarousel({
  mission,
  isFreeRoam,
  playlist,
  activeWaypoint,
  onStartGuide,
  onSearchOther,
  onDismiss,
}: {
  mission?: any;
  isFreeRoam: boolean;
  playlist: any[];
  activeWaypoint: any;
  onStartGuide?: (item: any) => void | Promise<void>;
  onSearchOther?: () => void | Promise<void>;
  onDismiss?: () => void;
}) {
  const router = useRouter();
  const { token, member } = useRobotAuth();
  const { sessionId, refreshSession, markProductFraud, isProductFraud } = useCustomerSession();
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

  // Đọc giọng nói đồng bộ chuẩn tự nhiên 1 lần duy nhất theo từng banner khi hiển thị
  useEffect(() => {
    if (!currentItem || isStartingGuide) return;
    const adKey = `${currentItem.id || currentItem.productId || currentItem.sponsoredId || currentItem.name}-${index}`;
    if (lastSpokenKeyRef.current === adKey) return;
    lastSpokenKeyRef.current = adKey;

    const rawPrice = currentItem.productPrice ?? currentItem.unitPrice ?? currentItem.promotionPrice ?? 0;
    const numericPrice = Math.round(Number(rawPrice));
    const priceText = numericPrice > 0 ? ` - Giá ưu đãi chỉ ${numericPrice.toLocaleString('vi-VN')} đồng.` : '.';
    const pName = currentItem.productName || currentItem.name || 'Sản phẩm';

    // Điều chỉnh nội dung giọng đọc theo chế độ:
    // - Tự do (Free roam): mời khách chạm để robot dẫn đường đến kệ hoặc thêm vào giỏ
    // - Theo kệ (Per shelf): robot đã đỗ ngay trước mặt kệ, chỉ mời xem sản phẩm hoặc thêm vào giỏ
    const speechText = isFreeRoam
      ? `${pName}${priceText} Quý khách có thể chạm vào màn hình để tôi dẫn đường hoặc thêm vào giỏ hàng nhé!`
      : `${pName}${priceText} Sản phẩm đang có sẵn tại kệ ngay trước mặt quý khách. Mời quý khách chọn mua hoặc thêm vào giỏ hàng!`;

    Speech.stop();
    Speech.speak(speechText, {
      language: 'vi-VN',
      rate: 0.9,
    });
  }, [currentItem, index, isStartingGuide, isFreeRoam]);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  // Auto rotate qua các sản phẩm trong playlist nếu có nhiều hơn 1 sản phẩm
  useEffect(() => {
    if (isStartingGuide) return;
    const rawSec = currentItem?.durationSeconds ?? currentItem?.displayDurationSeconds ?? 12;
    const duration = (rawSec > 0 ? rawSec : 12) * 1000;
    const timer = setTimeout(() => {
      if (total > 1) {
        setIndex((curr) => (curr + 1) % total);
      } else {
        lastSpokenKeyRef.current = null;
        setIndex((curr) => curr + 1);
      }
      setCartSuccess(false);
      setCartNotice(null);
    }, total > 1 ? duration : 20000);
    return () => clearTimeout(timer);
  }, [index, total, currentItem, isStartingGuide]);

  const handleNext = () => {
    refreshSession();
    setIndex((curr) => (curr + 1) % total);
    setCartSuccess(false);
    setCartNotice(null);
  };

  const handlePrev = () => {
    refreshSession();
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
    try {
      await onStartGuide(currentItem);
    } catch (err) {
      console.warn('[AdMissionOverlay] handleGuide error:', err);
      setIsStartingGuide(false);
    }
  };

  const handleMultiProductGuide = () => {
    refreshSession();
    // 1. Lưu toàn bộ danh sách sản phẩm quảng cáo vào cache
    if (playlist && playlist.length > 0) {
      AdInterruptionService.setCachedAdPlaylist(playlist);
    }

    // 2. Bảo lưu trạng thái quảng cáo dở dang vào AdInterruptionService
    if (mission && mission.flowType === 'ad') {
      const waypoints = mission.waypoints ?? [];
      const currentIdx = activeWaypoint ? waypoints.findIndex((w: any) => w.nodeId === activeWaypoint.nodeId) : 0;
      const resolvedIdx = currentIdx >= 0 ? currentIdx : 0;
      const remainingWaypoints = waypoints.slice(resolvedIdx + 1);
      const remainingNodeIds = remainingWaypoints.map((w: any) => w.nodeId).filter((id: any) => id > 0);
      const remainingShelfIds = remainingWaypoints.map((w: any) => w.shelfId).filter((id: any) => typeof id === 'number' && id > 0);
      const isPerShelf = Boolean(!isFreeRoam && (remainingShelfIds.length > 0 || mission.adMode === 'shelf'));

      AdInterruptionService.saveInterruptedMission({
        originalMissionId: mission.missionId,
        robotCode: mission.robotCode || 'RB001',
        remainingNodeIds: remainingNodeIds.length > 0 ? remainingNodeIds : waypoints.map((w: any) => w.nodeId).filter((id: any) => id > 0),
        remainingShelfIds: remainingShelfIds.length > 0 ? remainingShelfIds : undefined,
        isPerShelfAd: isPerShelf,
        isFreeRoam: Boolean(isFreeRoam),
        floorId: mission.floorId ?? 1,
        campaignId: isPerShelf ? null : (mission.campaignId ?? null),
        interruptedAtWaypointIndex: resolvedIdx,
        totalWaypoints: waypoints.length,
        savedTimestamp: Date.now(),
      });
    }

    if (!token || !member) {
      setShowLoginModal(true);
      Speech.speak(
        'Tính năng chọn nhiều sản phẩm và lập lộ trình mua sắm thông minh tối ưu dành riêng cho khách hàng thành viên. Quý khách vui lòng đăng nhập nhé!',
        { language: 'vi-VN', rate: 0.9 }
      );
      return;
    }

    Speech.speak(
      `Chào ${member.fullName || 'quý khách'}! Mời bạn chọn các sản phẩm đang quảng cáo trên màn hình để robot dẫn đường gom hàng tối ưu nhé!`,
      { language: 'vi-VN', rate: 0.9 }
    );
    if (onDismiss) onDismiss();
    router.push('/ad-multi-select' as any);
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
      Speech.speak('Quý khách vui lòng đăng nhập thành viên để lưu sản phẩm vào giỏ hàng nhé!', {
        language: 'vi-VN',
        rate: 0.9,
      });
      setTimeout(() => setCartNotice(null), 4000);
      return;
    }

    setIsAddingCart(true);
    try {
      await CartService.addItem(pId, 1, token);
      setCartSuccess(true);
      setCartNotice('Đã thêm vào giỏ hàng thành công!');
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
  const shelfLabel = activeWaypoint?.shelfName || activeWaypoint?.nodeName || 'Kệ hàng';

  return (
    <View style={styles.container}>
      {/* Visual background & uncropped hero product showcase - Chạm để xem chi tiết & ghi nhận Click */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleProductClick}>
        <AdCreativeMedia type={type} url={mediaUrl} bottomSpace={bottomCardHeight} />
      </Pressable>

      {/* TOP HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.locationChip}>
            <MapPin size={16} color="#10b981" />
            <Text style={styles.locationText}>{shelfLabel}</Text>
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

        {/* Product Title & Price - Có thể nhấn để xem chi tiết */}
        <TouchableOpacity activeOpacity={0.88} onPress={handleProductClick}>
          <Text style={styles.productTitle} numberOfLines={2}>
            {title}
          </Text>

          {/* Price and Badges */}
          <View style={styles.priceRow}>
            {price > 0 ? (
              <View style={styles.priceBox}>
                <Text style={styles.priceNumber}>
                  {price.toLocaleString('vi-VN')}
                </Text>
                <Text style={styles.priceCurrency}>₫</Text>
              </View>
            ) : (
              <View style={styles.freeDealBox}>
                <Sparkles size={16} color="#10b981" />
                <Text style={styles.freeDealText}>ƯU ĐÃI NỔI BẬT</Text>
              </View>
            )}

            <View style={styles.promoBadge}>
              <Text style={styles.promoBadgeText}>GIÁ ĐẶC BIỆT HÔM NAY</Text>
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

          {/* SECONDARY BUTTONS ROW */}
          <View style={styles.secondaryRow}>
            {/* DẪN NHIỀU MÓN / CHỌN NHIỀU MÓN */}
            <TouchableOpacity
              style={styles.multiSelectButton}
              onPress={handleMultiProductGuide}
              activeOpacity={0.75}
            >
              <Layers size={16} color="#c084fc" />
              <Text style={styles.multiSelectButtonText}>Dẫn nhiều món</Text>
            </TouchableOpacity>

            {/* Tìm món khác */}
            <TouchableOpacity
              style={styles.searchOtherButton}
              onPress={handleSearchOther}
              activeOpacity={0.75}
            >
              <Search size={16} color="#f59e0b" />
              <Text style={styles.searchOtherButtonText}>Tìm món khác</Text>
            </TouchableOpacity>

            {/* Thêm vào giỏ */}
            <TouchableOpacity
              style={[styles.cartButton, isAddingCart && styles.disabledButton]}
              onPress={handleAddToCart}
              disabled={isAddingCart}
              activeOpacity={0.75}
            >
              {isAddingCart ? (
                <ActivityIndicator color="#38bdf8" size="small" />
              ) : (
                <ShoppingCart size={16} color="#38bdf8" />
              )}
              <Text style={styles.cartButtonText}>Vào giỏ</Text>
            </TouchableOpacity>

            {/* Bỏ qua / Tiếp tục đi */}
            <TouchableOpacity
              style={styles.skipButton}
              onPress={onDismiss}
              activeOpacity={0.75}
            >
              <Text style={styles.skipButtonText}>Bỏ qua ❯</Text>
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
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSelectedDetailProduct(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.detailCard}>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setSelectedDetailProduct(null)}
              activeOpacity={0.7}
            >
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>

            {/* Product Image */}
            {Boolean(selectedDetailProduct?.imageUrl || selectedDetailProduct?.mediaContents?.[0]?.resourceUrl) && (
              <Image
                source={{ uri: selectedDetailProduct?.imageUrl || selectedDetailProduct?.mediaContents?.[0]?.resourceUrl }}
                style={styles.detailProductImage}
                contentFit="contain"
              />
            )}

            {/* Shelf Location Tag */}
            <View style={styles.detailLocationChip}>
              <MapPin size={16} color="#10b981" />
              <Text style={styles.detailLocationText}>
                {activeWaypoint?.shelfName || activeWaypoint?.nodeName || 'Kệ hàng siêu thị'}
              </Text>
            </View>

            {/* Title */}
            <Text style={styles.detailTitle} numberOfLines={2}>
              {selectedDetailProduct?.productName || selectedDetailProduct?.name || 'Chi tiết sản phẩm'}
            </Text>

            {/* Price */}
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
                  <Text style={styles.freeDealText}>ƯU ĐÃI NỔI BẬT</Text>
                </View>
              )}
            </View>

            {/* Description */}
            <Text style={styles.detailDescription} numberOfLines={4}>
              {selectedDetailProduct?.description || selectedDetailProduct?.mediaContents?.[0]?.contentText || 'Sản phẩm chính hãng với mức giá ưu đãi đặc biệt hôm nay tại siêu thị.'}
            </Text>

            {/* Action Buttons */}
            <View style={styles.detailActionsRow}>
              {isFreeRoam ? (
                <TouchableOpacity
                  style={styles.detailGuideBtn}
                  onPress={() => {
                    setSelectedDetailProduct(null);
                    void handleGuide();
                  }}
                  activeOpacity={0.85}
                >
                  <Navigation size={18} color="white" />
                  <Text style={styles.detailGuideBtnText}>Dẫn tôi đến kệ này</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.detailAtShelfNote}>
                  <MapPin size={16} color="#10b981" />
                  <Text style={styles.detailAtShelfNoteText}>Sản phẩm có sẵn tại kệ trước mặt bạn</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.detailCartBtn}
                onPress={() => {
                  void handleAddToCart();
                }}
                activeOpacity={0.85}
              >
                <ShoppingCart size={18} color="#38bdf8" />
                <Text style={styles.detailCartBtnText}>Thêm vào giỏ</Text>
              </TouchableOpacity>
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
  const isVideo = type.includes('VIDEO') || /\.(mp4|webm|mov)(\?|$)/i.test(url);
  const player = useVideoPlayer(isVideo && url ? url : null, (instance) => {
    instance.loop = true;
    instance.play();
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
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    gap: 12,
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
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  guideButtonSub: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchOtherButton: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    paddingVertical: 14,
    borderRadius: 16,
  },
  searchOtherButtonText: {
    color: '#fbbf24',
    fontSize: 13.5,
    fontWeight: '700',
  },
  cartButton: {
    flex: 0.9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    paddingVertical: 14,
    borderRadius: 16,
  },
  cartButtonText: {
    color: '#38bdf8',
    fontSize: 13.5,
    fontWeight: '700',
  },
  skipButton: {
    flex: 0.9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    paddingVertical: 14,
    borderRadius: 16,
  },
  skipButtonText: {
    color: '#cbd5e1',
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
  multiSelectButton: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(168, 85, 247, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.45)',
    paddingVertical: 14,
    borderRadius: 16,
  },
  multiSelectButtonText: {
    color: '#c084fc',
    fontSize: 13,
    fontWeight: '700',
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
    maxWidth: 480,
    backgroundColor: '#0f172a',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  detailProductImage: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    backgroundColor: 'rgba(2, 6, 23, 0.5)',
    marginBottom: 16,
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
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  detailLocationText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '700',
  },
  detailTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  detailPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'flex-start',
    marginBottom: 10,
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
    fontSize: 14,
    lineHeight: 20,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  detailActionsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  detailGuideBtn: {
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
  detailGuideBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '800',
  },
  detailAtShelfNote: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  detailAtShelfNoteText: {
    color: '#10b981',
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1,
  },
  detailCartBtn: {
    flex: 1,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  detailCartBtnText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '700',
  },
});
