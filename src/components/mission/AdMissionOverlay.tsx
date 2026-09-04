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
} from 'lucide-react-native';
import { CartService } from '../../services/CartService';
import { useRobotAuth } from '../../context/RobotAuthContext';

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
  const isArrived = status === 'ARRIVED';
  if (!isArrived || !activePlaylist || activePlaylist.length === 0) return null;

  return (
    <Modal visible animationType="fade" statusBarTranslucent transparent>
      <View style={styles.root}>
        <AdInteractiveCarousel
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
  playlist,
  activeWaypoint,
  onStartGuide,
  onSearchOther,
  onDismiss,
}: {
  playlist: any[];
  activeWaypoint: any;
  onStartGuide?: (item: any) => void | Promise<void>;
  onSearchOther?: () => void | Promise<void>;
  onDismiss?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [isStartingGuide, setIsStartingGuide] = useState(false);
  const [isAddingCart, setIsAddingCart] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);
  const [cartNotice, setCartNotice] = useState<string | null>(null);
  const { token } = useRobotAuth();

  const total = playlist.length;
  const currentItem = playlist[index % Math.max(total, 1)];

  // Auto rotate qua các sản phẩm trong playlist nếu có nhiều hơn 1 sản phẩm
  useEffect(() => {
    if (total <= 1 || isStartingGuide) return;
    const duration = (currentItem?.durationSeconds ?? currentItem?.displayDurationSeconds ?? 12) * 1000;
    const timer = setTimeout(() => {
      setIndex((curr) => (curr + 1) % total);
      setCartSuccess(false);
      setCartNotice(null);
    }, duration);
    return () => clearTimeout(timer);
  }, [index, total, currentItem, isStartingGuide]);

  const handleNext = () => {
    setIndex((curr) => (curr + 1) % total);
    setCartSuccess(false);
    setCartNotice(null);
  };

  const handlePrev = () => {
    setIndex((curr) => (curr - 1 + total) % total);
    setCartSuccess(false);
    setCartNotice(null);
  };

  const handleGuide = async () => {
    if (isStartingGuide || !onStartGuide || !currentItem) return;
    setIsStartingGuide(true);
    try {
      await onStartGuide(currentItem);
    } catch (err) {
      console.warn('[AdMissionOverlay] handleGuide error:', err);
      setIsStartingGuide(false);
    }
  };

  const handleSearchOther = async () => {
    if (onSearchOther) {
      await onSearchOther();
    } else if (onDismiss) {
      onDismiss();
    }
  };

  const handleAddToCart = async () => {
    if (isAddingCart || !currentItem) return;
    const pId = currentItem.productId || currentItem.id;
    if (!pId) {
      setCartNotice('Không xác định được mã sản phẩm.');
      setTimeout(() => setCartNotice(null), 3000);
      return;
    }

    if (!token) {
      setCartNotice('Chưa quét thẻ thành viên. Chạm "Dẫn tôi mua món này" để xem tại kệ!');
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
      {/* Visual background / media */}
      <AdCreativeMedia type={type} url={mediaUrl} />

      {/* Dark gradient shadow overlay */}
      <View style={styles.backdropLayer} />

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
      <View style={styles.bottomCard}>
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

        {/* Product Title */}
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
          {/* PRIMARY BUTTON: Dẫn tôi mua món này */}
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
                Tạm dừng QC · Robot sẽ dẫn bạn đến kệ
              </Text>
            </View>
            <ArrowRight size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          {/* SECONDARY BUTTONS ROW */}
          <View style={styles.secondaryRow}>
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
    </View>
  );
}

function AdCreativeMedia({ type, url }: { type: string; url: string }) {
  const isVideo = type.includes('VIDEO') || /\.(mp4|webm|mov)(\?|$)/i.test(url);
  const player = useVideoPlayer(isVideo && url ? url : null, (instance) => {
    instance.loop = true;
    instance.play();
  });

  if (isVideo && url) {
    return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />;
  }

  if (url) {
    return <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />;
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
  navLeft: {
    position: 'absolute',
    left: 16,
    top: SH * 0.35,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  navRight: {
    position: 'absolute',
    right: 16,
    top: SH * 0.35,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
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
});
