/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect */
/**
 * ZoneAdOverlay.tsx
 *
 * Giao diện Toàn Màn Hình Kiosk Phát Quảng Cáo Điểm Dừng (Navigation Node Ad Broadcast)
 * - Tự động đẩy màn hình (Slide-up Full Screen) khi Robot đến trạm dừng có quảng cáo
 * - Kết hợp hài hòa với màn hình Welcome (có Mini Robot Assistant ở góc phát biểu cảm TTS)
 * - Hero Banner 16:9 chất lượng cao kèm Slogan chiến dịch
 * - Thanh tiến trình Countdown trực quan (Progress Bar)
 * - Nút Mua ngay / Xem chi tiết tương tác lớn
 * - Tự động chuyển tuần tự các Banner trong Playlist của Trạm dừng
 *
 * v2: FIX impression/click spam + inline add-to-cart + guide-during-ad
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  Dimensions, ScrollView, Pressable, ActivityIndicator
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS, FadeInDown
} from 'react-native-reanimated';
import {
  MapPin, Zap, Tag, Clock, Volume2, ShoppingBag, ArrowRight, Sparkles,
  Navigation, CheckCircle, ShoppingCart, X
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { AdService, AdPlaylistItemDto } from '../../services/AdService';
import { CartService } from '../../services/CartService';
import { useGeofencing } from '../../context/GeofencingContext';
import { useRobotVoice } from '../../hooks/useRobotVoice';
import { useRobotAuth } from '../../context/RobotAuthContext';
import { useRobotGuide } from '../../context/RobotGuideContext';

const { width: SW, height: SH } = Dimensions.get('window');
const ROBOT_ID = Number(process.env.EXPO_PUBLIC_ROBOT_ID ?? '1');
/** Khoảng thời gian tối thiểu (ms) giữa 2 lần log Click cùng sponsoredId */
const CLICK_COOLDOWN_MS = 5_000;

function mediaForProduct(ad: AdPlaylistItemDto, type: 'VOICE_TEXT' | 'IMAGE') {
  const resources = ad.mediaContents?.filter(item => item.resourceType === type) ?? [];
  const productName = ad.productName.trim().toLocaleLowerCase('vi-VN');
  return resources.find(item => item.contentText?.toLocaleLowerCase('vi-VN').includes(productName))
    ?? resources[0];
}

function buildSpeech(ad: AdPlaylistItemDto, index: number, total: number, location?: string) {
  const voiceText = mediaForProduct(ad, 'VOICE_TEXT')?.contentText;
  if (voiceText) return voiceText;
  const zone = location ? ` tại ${location}` : '';
  const price = ad.productPrice > 0
    ? ` Giá chỉ ${ad.productPrice.toLocaleString('vi-VN')} đồng.`
    : '';
  return `Ưu đãi hôm nay: ${ad.productName}${zone}.${price} Chạm màn hình để xem chi tiết.`;
}

export default function ZoneAdOverlay() {
  const { isInZone, currentZone, currentPlaylist, clearZone } = useGeofencing();
  const { speak, stop, isSpeaking } = useRobotVoice();
  const { member, token } = useRobotAuth();
  const { dispatchCart, status: guideStatus, isBusy: isGuideBusy } = useRobotGuide();
  const router = useRouter();

  // Stable refs for speak/stop (không gây re-run effect)
  const speakRef = useRef(speak);
  const stopRef = useRef(stop);
  useEffect(() => {
    speakRef.current = speak;
    stopRef.current = stop;
  }, [speak, stop]);

  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(12);
  const [totalDuration, setTotalDuration] = useState(12);

  // --- Inline add-to-cart state ---
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);

  // --- Guide-during-Ad state ---
  const [isGuidingCustomer, setIsGuidingCustomer] = useState(false);

  // Animations
  const translateY = useSharedValue(SH);
  const overlayOpacity = useSharedValue(0);

  const animatedSheet = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const animatedOverlay = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const currentAd = (currentPlaylist && currentPlaylist.length > 0)
    ? (currentPlaylist[currentAdIndex] || currentPlaylist[0])
    : undefined;

  // ─── FIX Spam: Stable refs thay vì deps closure ────────────────────────────

  /** Guard: không log impression cùng ad 2 lần */
  const lastSpokenKeyRef = useRef<string | null>(null);

  /** Guard: không log click cùng sponsoredId trong vòng CLICK_COOLDOWN_MS */
  const lastClickTimeRef = useRef<Map<number, number>>(new Map());

  /** Stable ref của logImpression — không cần deps closure */
  const currentZoneRef = useRef(currentZone);
  useEffect(() => { currentZoneRef.current = currentZone; }, [currentZone]);

  const logImpression = useCallback(async (ad: AdPlaylistItemDto) => {
    if (ad.adCampaignId <= 0 || ad.sponsoredId <= 0) {
      console.warn('[ZoneAdOverlay] Bỏ qua impression vì playlist thiếu AdCampaignId/SponsoredId thật.');
      return;
    }
    try {
      const zone = currentZoneRef.current;
      await AdService.logInteraction({
        adCampaignId: ad.adCampaignId,
        actionType: 'Impression',
        sponsoredId: ad.sponsoredId,
        productId: ad.productId,
        robotId: ROBOT_ID,
        semanticObjectId: zone?.semanticObjectId,
        zoneId: zone?.zoneId,
      });
    } catch (e) {
      console.warn('[ZoneAdOverlay] logImpression failed:', e);
    }
  }, []); // KHÔNG phụ thuộc currentZone để tránh re-create callback

  // Stable ref cho logImpression
  const logImpressionRef = useRef(logImpression);
  useEffect(() => { logImpressionRef.current = logImpression; }, [logImpression]);

  const handleClose = useCallback(() => {
    void stopRef.current();
    translateY.value = withTiming(SH, { duration: 300 }, () => {
      runOnJS(setVisible)(false);
      runOnJS(clearZone)();
    });
    overlayOpacity.value = withTiming(0, { duration: 250 });
  }, [clearZone, translateY, overlayOpacity]);

  // Stable ref của handleClose để effect không cần deps closure
  const handleCloseRef = useRef(handleClose);
  useEffect(() => { handleCloseRef.current = handleClose; }, [handleClose]);

  // ─── FIX click spam: cooldown per-sponsoredId ───────────────────────────────
  const handleAdClick = useCallback(async (ad: AdPlaylistItemDto) => {
    if (ad.adCampaignId <= 0 || ad.sponsoredId <= 0) {
      console.warn('[ZoneAdOverlay] Bỏ qua click log vì playlist thiếu AdCampaignId/SponsoredId thật.');
      return;
    }
    const now = Date.now();
    const lastTime = lastClickTimeRef.current.get(ad.sponsoredId) ?? 0;
    if (now - lastTime < CLICK_COOLDOWN_MS) {
      console.log(`[ZoneAdOverlay] Click cooldown active cho sponsoredId=${ad.sponsoredId} — bỏ qua.`);
      return;
    }
    lastClickTimeRef.current.set(ad.sponsoredId, now);

    try {
      const zone = currentZoneRef.current;
      await AdService.logInteraction({
        adCampaignId: ad.adCampaignId,
        actionType: 'Click',
        sponsoredId: ad.sponsoredId,
        productId: ad.productId,
        robotId: ROBOT_ID,
        semanticObjectId: zone?.semanticObjectId,
        zoneId: zone?.zoneId,
      });
      console.log(`[ZoneAdOverlay] Click logged — navigating to product/${ad.productId}`);
    } catch (e) {
      console.warn('[ZoneAdOverlay] Click log failed:', e);
    }
    // Navigate sang màn hình chi tiết sản phẩm
    router.push(`/product/${ad.productId}` as any);
  }, [router]);

  // ─── Inline Add to Cart (không cần navigate) ─────────────────────────────────
  const handleAddToCart = useCallback(async (ad: AdPlaylistItemDto) => {
    if (!token) {
      setCartError('Cần đăng nhập để thêm vào giỏ hàng.');
      setTimeout(() => setCartError(null), 3000);
      return;
    }
    if (isAddingToCart) return;
    setIsAddingToCart(true);
    setCartSuccess(false);
    setCartError(null);
    try {
      await CartService.addItem(ad.productId, 1, token);
      setCartSuccess(true);
      void speakRef.current(`Đã thêm ${ad.productName} vào giỏ hàng!`);
      setTimeout(() => setCartSuccess(false), 3000);

      // Log click khi add to cart
      const now = Date.now();
      const lastTime = lastClickTimeRef.current.get(ad.sponsoredId) ?? 0;
      if (now - lastTime >= CLICK_COOLDOWN_MS && ad.adCampaignId > 0 && ad.sponsoredId > 0) {
        lastClickTimeRef.current.set(ad.sponsoredId, now);
        const zone = currentZoneRef.current;
        AdService.logInteraction({
          adCampaignId: ad.adCampaignId,
          actionType: 'Click',
          sponsoredId: ad.sponsoredId,
          productId: ad.productId,
          robotId: ROBOT_ID,
          semanticObjectId: zone?.semanticObjectId,
          zoneId: zone?.zoneId,
        }).catch(() => undefined);
      }
    } catch (err: any) {
      const msg = err?.message || 'Thêm vào giỏ thất bại';
      setCartError(msg);
      setTimeout(() => setCartError(null), 3000);
    } finally {
      setIsAddingToCart(false);
    }
  }, [token, isAddingToCart]);

  // ─── Guide-during-Ad: dẫn đường cho khách mà không kết thúc ad mission ─────
  const handleGuideToShelf = useCallback(async (ad: AdPlaylistItemDto) => {
    if (isGuideBusy || isGuidingCustomer) {
      void speakRef.current('Robot đang bận dẫn đường. Vui lòng chờ.');
      return;
    }
    setIsGuidingCustomer(true);
    void speakRef.current(`Đang chuẩn bị dẫn bạn đến kệ ${ad.productName}. Vui lòng đi theo robot.`);
    try {
      await dispatchCart([{ productId: ad.productId, productName: ad.productName }]);
      console.log('[ZoneAdOverlay] Guide sub-mission dispatched trong khi ad đang chạy.');
    } catch (err: any) {
      console.warn('[ZoneAdOverlay] Guide dispatch failed:', err);
      setIsGuidingCustomer(false);
      void speakRef.current('Xin lỗi, robot chưa thể dẫn đường lúc này. Vui lòng thử lại.');
    }
  }, [isGuideBusy, isGuidingCustomer, dispatchCart]);

  // Khi guide hoàn tất → tắt guiding mode, resume ad
  useEffect(() => {
    if (!isGuidingCustomer) return;
    if (['COMPLETED', 'FAILED', 'CANCELLED', 'ESTOP', 'TIMEOUT'].includes(guideStatus)) {
      setIsGuidingCustomer(false);
      void speakRef.current('Robot đã hoàn thành dẫn đường. Tiếp tục giới thiệu sản phẩm cho quý khách.');
      console.log('[ZoneAdOverlay] Guide hoàn tất → resume ad flow.');
    }
  }, [guideStatus, isGuidingCustomer]);

  // ─── Mở overlay khi có zone/playlist mới ──────────────────────────────────
  useEffect(() => {
    if (isInZone && currentPlaylist.length > 0) {
      console.log(`[ZoneAdOverlay] Mở màn hình Kiosk Ad cho ${currentPlaylist.length} quảng cáo`);
      setCurrentAdIndex(0);
      setVisible(true);
      setCartSuccess(false);
      setCartError(null);
      setIsGuidingCustomer(false);
      translateY.value = 0;
      overlayOpacity.value = 1;
    } else if (!isInZone) {
      void stopRef.current();
      setVisible(false);
    }
  }, [isInZone, currentPlaylist]);

  // ─── Effect chính: TTS + Impression + Countdown ────────────────────────────
  useEffect(() => {
    if (!visible || !currentAd) {
      lastSpokenKeyRef.current = null;
      return;
    }

    const currentKey = `${currentAd.sponsoredId}-${currentAdIndex}`;

    const isRouteContinuous = Boolean(currentZone?.isRouteAd || Number(currentZone?.dwellTimeSeconds) === 0);
    const eventDwell = Number(currentZone?.dwellTimeSeconds ?? 0);
    const dwellTime = eventDwell > 0 ? eventDwell : 20;

    // Lấy thời lượng từ backend gửi xuống hoặc tự động chia đều (tối thiểu 8s cho mỗi sản phẩm)
    const backendDuration = Number(currentAd.displayDurationSeconds) || 0;
    const baseDuration = Math.floor(dwellTime / Math.max(1, currentPlaylist.length));
    const remainder = dwellTime % Math.max(1, currentPlaylist.length);
    const calculatedDuration = baseDuration + (currentAdIndex < remainder ? 1 : 0);

    const duration = isRouteContinuous
      ? Math.max(8, backendDuration || 10)
      : Math.max(8, backendDuration || calculatedDuration);

    setTotalDuration(duration);
    setTimeLeft(duration);

    // Chỉ phát voice và log impression 1 LẦN DUY NHẤT cho mỗi quảng cáo
    if (lastSpokenKeyRef.current !== currentKey) {
      lastSpokenKeyRef.current = currentKey;
      logImpressionRef.current(currentAd);

      // Dừng giọng đọc cũ (nếu có) trước khi đọc sản phẩm mới
      void stopRef.current();
      setTimeout(() => {
        void speakRef.current(buildSpeech(
          currentAd, currentAdIndex, currentPlaylist.length, currentZone?.objectName));
      }, 200);
    }

    // Đếm ngược — pause khi đang dẫn đường
    const timer = setInterval(() => {
      // Không đếm ngược khi đang dẫn đường khách
      if (isGuidingCustomer) return;

      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          void stopRef.current();
          if (currentAdIndex < currentPlaylist.length - 1) {
            console.log(`[ZoneAdOverlay] Hết ${duration}s -> Tự động chuyển sang sản phẩm tiếp theo (${currentAdIndex + 2}/${currentPlaylist.length})`);
            setCurrentAdIndex(idx => idx + 1);
          } else {
            if (isRouteContinuous) {
              console.log('[ZoneAdOverlay] Lộ trình quảng cáo: xoay vòng lại từ đầu playlist');
              setCurrentAdIndex(0);
            } else {
              console.log(`[ZoneAdOverlay] Đã phát xong playlist trong dwell ${dwellTime}s -> Đóng quảng cáo`);
              handleCloseRef.current();
            }
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  // FIX: Chỉ re-run khi cần thiết - KHÔNG bao gồm handleClose hay logImpression (dùng ref thay thế)
  }, [currentAd, currentAdIndex, currentPlaylist, currentZone?.dwellTimeSeconds, currentZone?.isRouteAd, currentZone?.objectName, visible, isGuidingCustomer]);

  if (!visible || !currentAd) return null;

  const mediaBanner = mediaForProduct(currentAd, 'IMAGE');
  const bannerImageUri = mediaBanner?.resourceUrl || currentAd.imageUrl;
  const sloganText = mediaBanner?.contentText || currentAd.campaignName;
  const progressPercent = totalDuration > 0 ? ((totalDuration - timeLeft) / totalDuration) * 100 : 0;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={() => undefined}
      statusBarTranslucent
    >
      {/* Nền làm mờ nhẹ phía sau */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, animatedOverlay]}>
        <View style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* Màn hình Kiosk đẩy lên */}
      <Animated.View style={[styles.kioskContainer, animatedSheet]}>

        {/* THANH TIẾN TRÌNH COUNTDOWN CHẠY Ở ĐỈNH MÀN HÌNH */}
        <View style={styles.progressBarTrack}>
          <View style={[
            styles.progressBarFill,
            { width: `${100 - progressPercent}%` },
            isGuidingCustomer && styles.progressBarPaused
          ]} />
        </View>

        {/* ─── GUIDE BANNER: Đang dẫn đường cho khách ─── */}
        {isGuidingCustomer && (
          <Animated.View entering={FadeInDown} style={styles.guidingBanner}>
            <Navigation size={16} color="white" />
            <Text style={styles.guidingBannerText}>
              🧭 Robot đang dẫn đường cho khách đến kệ {currentAd.productName}
            </Text>
            <Text style={styles.guidingBannerSub}>Quảng cáo tạm dừng đếm ngược</Text>
          </Animated.View>
        )}

        {/* 1. TOP HEADER: THÔNG TIN ĐIỂM DỪNG & ĐẾM NGƯỢC */}
        <View style={styles.topHeader}>
          <View style={styles.locationPill}>
            <MapPin size={16} color="#00A550" />
            <Text style={styles.locationText} numberOfLines={1}>
              {currentZone?.objectName ? `Điểm dừng tại kệ • ${currentZone.objectName}` : 'Điểm dừng tại kệ quảng cáo'}
            </Text>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.voiceReplayButton}
              onPress={() => void speakRef.current(buildSpeech(
                currentAd, currentAdIndex, currentPlaylist.length, currentZone?.objectName))}
              accessibilityLabel="Nghe lại quảng cáo"
            >
              <Volume2 size={15} color="#0369A1" />
              <Text style={styles.voiceReplayText}>Nghe lại</Text>
            </TouchableOpacity>
            <View style={[styles.timerPill, isGuidingCustomer && styles.timerPillPaused]}>
              <Clock size={13} color={isGuidingCustomer ? '#64748B' : '#DC2626'} />
              <Text style={[styles.timerText, isGuidingCustomer && styles.timerTextPaused]}>
                {isGuidingCustomer ? '⏸ TẠM DỪNG' : `${timeLeft}s ${currentPlaylist.length > 1 ? `(${currentAdIndex + 1}/${currentPlaylist.length})` : ''}`}
              </Text>
            </View>

          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* 2. HERO BANNER KHỔNG LỒ (16:9 HD) */}
          <View style={styles.bannerFrame}>
            <Image
              source={{ uri: bannerImageUri }}
              style={styles.bannerImage}
              contentFit="cover"
              transition={300}
            />

            {/* Nhãn Tài Trợ */}
            <View style={styles.sponsoredTag}>
              <Sparkles size={12} color="white" />
              <Text style={styles.sponsoredTagText}>ƯU ĐÃI NỔI BẬT</Text>
            </View>

            {/* Điểm Score */}
            {currentAd.adScore > 0 && (
              <View style={styles.scoreTag}>
                <Zap size={11} color="#EAB308" />
                <Text style={styles.scoreTagText}>Top #{currentAd.priority || 1}</Text>
              </View>
            )}
          </View>

          {/* 3. HỘP SLOGAN / THÔNG ĐIỆP CHIẾN DỊCH */}
          {sloganText && (
            <View style={styles.sloganCard}>
              <Text style={styles.sloganText} numberOfLines={2}>
                {`"${sloganText}"`}
              </Text>
            </View>
          )}

          {/* 4. CHI TIẾT SẢN PHẨM & GIÁ */}
          <View style={styles.productCard}>
            <View style={styles.productMeta}>
              <Text style={styles.productTitle} numberOfLines={2}>
                {currentAd.productName}
              </Text>
              <Text style={styles.campaignSubtitle} numberOfLines={1}>
                {currentAd.campaignName}
              </Text>

              <View style={styles.priceRow}>
                <Text style={styles.priceHighlight}>
                  {currentAd.productPrice > 0
                    ? `${currentAd.productPrice.toLocaleString('vi-VN')} đ`
                    : 'Giá siêu tốt'}
                </Text>
                <View style={styles.hotDealBadge}>
                  <Tag size={11} color="#DC2626" />
                  <Text style={styles.hotDealText}>GIẢM GIÁ HÔM NAY</Text>
                </View>
              </View>
            </View>

            {/* ─── CART SUCCESS / ERROR FEEDBACK ─── */}
            {cartSuccess && (
              <Animated.View entering={FadeInDown} style={styles.feedbackSuccess}>
                <CheckCircle size={16} color="#059669" />
                <Text style={styles.feedbackSuccessText}>Đã thêm vào giỏ hàng!</Text>
              </Animated.View>
            )}
            {cartError && (
              <View style={styles.feedbackError}>
                <X size={14} color="#DC2626" />
                <Text style={styles.feedbackErrorText}>{cartError}</Text>
              </View>
            )}

            {/* ─── ACTION BUTTONS: 2 nút inline ─── */}
            <View style={styles.actionRow}>
              {/* Nút Thêm vào giỏ — không cần navigate */}
              <TouchableOpacity
                style={[styles.cartButton, (isAddingToCart || cartSuccess) && styles.cartButtonDisabled]}
                onPress={() => handleAddToCart(currentAd)}
                disabled={isAddingToCart || cartSuccess}
                activeOpacity={0.8}
              >
                {isAddingToCart
                  ? <ActivityIndicator size={16} color="white" />
                  : cartSuccess
                    ? <CheckCircle size={16} color="white" />
                    : <ShoppingCart size={16} color="white" />
                }
                <Text style={styles.cartButtonText}>
                  {cartSuccess ? 'Đã thêm!' : 'Thêm giỏ hàng'}
                </Text>
              </TouchableOpacity>

              {/* Nút Dẫn đường đến kệ */}
              <TouchableOpacity
                style={[styles.guideButton, (isGuidingCustomer || isGuideBusy) && styles.guideButtonDisabled]}
                onPress={() => handleGuideToShelf(currentAd)}
                disabled={isGuidingCustomer || isGuideBusy}
                activeOpacity={0.8}
              >
                {isGuidingCustomer
                  ? <ActivityIndicator size={16} color="white" />
                  : <Navigation size={16} color="white" />
                }
                <Text style={styles.guideButtonText}>
                  {isGuidingCustomer ? 'Đang dẫn...' : 'Dẫn đường'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* NÚT TƯƠNG TÁC LỚN: XEM CHI TIẾT */}
          <Pressable
            style={({ pressed }) => [
              styles.ctaButton,
              pressed && styles.ctaButtonPressed
            ]}
            onPress={() => handleAdClick(currentAd)}
          >
            <ShoppingBag size={20} color="white" />
            <Text style={styles.ctaButtonText}>Chạm để xem chi tiết sản phẩm</Text>
            <ArrowRight size={18} color="white" />
          </Pressable>

          {/* 5. MINI ROBOT ASSISTANT & PLAYLIST CAROUSEL */}
          <View style={styles.footerRow}>
            {/* Mini Robot Assistant Indicator */}
            <View style={styles.robotAssistantBadge}>
              <View style={styles.robotMiniAvatar}>
                <Image
                  source={{ uri: "https://media.giphy.com/media/3og0IUzdgwVczU67eg/giphy.gif" }}
                  style={{ width: 28, height: 28, borderRadius: 14 }}
                  contentFit="contain"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.assistantTitle}>Robot Kiosk</Text>
                <Text style={styles.assistantStatus}>
                  {isGuidingCustomer
                    ? '🧭 Đang dẫn đường cho khách...'
                    : isSpeaking
                      ? '🎙️ Đang giới thiệu...'
                      : 'Sẵn sàng dẫn đường'}
                </Text>
              </View>
            </View>
          </View>

          {/* 6. PLAYLIST THUMBNAILS (Nếu trạm có nhiều quảng cáo) */}
          {currentPlaylist.length > 1 && (
            <View style={styles.playlistSection}>
              <Text style={styles.playlistLabel}>
                Các ưu đãi khác tại điểm dừng này ({currentAdIndex + 1}/{currentPlaylist.length}):
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailList}>
                {currentPlaylist.map((adItem, idx) => (
                  <TouchableOpacity
                    key={`ad-thumb-${adItem.sponsoredId}-${idx}`}
                    onPress={() => setCurrentAdIndex(idx)}
                    style={[
                      styles.thumbItem,
                      idx === currentAdIndex && styles.thumbItemActive
                    ]}
                  >
                    <Image
                      source={{ uri: adItem.imageUrl }}
                      style={styles.thumbImg}
                      contentFit="cover"
                    />
                    <Text
                      style={[
                        styles.thumbText,
                        idx === currentAdIndex && styles.thumbTextActive
                      ]}
                      numberOfLines={1}
                    >
                      {adItem.productName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  kioskContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SH * 0.88,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.25,
    shadowRadius: 28,
    elevation: 30,
    overflow: 'hidden',
  },
  progressBarTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#E2E8F0',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00A550',
  },
  progressBarPaused: {
    backgroundColor: '#94A3B8',
  },
  // ─── Guide Banner ──────────────────────────────────────────────────────────
  guidingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  guidingBannerText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 13,
    flex: 1,
  },
  guidingBannerSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    width: '100%',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
    maxWidth: SW * 0.58,
  },
  locationText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#007036',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voiceReplayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 14,
  },
  voiceReplayText: { color: '#0369A1', fontSize: 11, fontWeight: '900' },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  timerPillPaused: {
    backgroundColor: '#F1F5F9',
  },
  timerText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#DC2626',
    fontVariant: ['tabular-nums'],
  },
  timerTextPaused: {
    color: '#64748B',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
  },
  bannerFrame: {
    width: '100%',
    height: 200,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    position: 'relative',
    shadowColor: '#00A550',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 165, 80, 0.2)',
    marginBottom: 12,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  sponsoredTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00A550',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  sponsoredTagText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  scoreTag: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  scoreTagText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '800',
  },
  sloganCard: {
    backgroundColor: '#F0FDF4',
    borderLeftWidth: 4,
    borderLeftColor: '#00A550',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  sloganText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F5132',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 14,
  },
  productMeta: {
    marginBottom: 14,
  },
  productTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
  },
  campaignSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  priceHighlight: {
    fontSize: 22,
    fontWeight: '900',
    color: '#00A550',
  },
  hotDealBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  hotDealText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  // ─── Feedback ─────────────────────────────────────────────────────────────
  feedbackSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  feedbackSuccessText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  feedbackError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  feedbackErrorText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
    flex: 1,
  },
  // ─── Action Row (2 nút ngang) ──────────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#00A550',
    borderRadius: 14,
    paddingVertical: 13,
  },
  cartButtonDisabled: {
    backgroundColor: '#86EFAC',
  },
  cartButtonText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 13,
  },
  guideButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1D4ED8',
    borderRadius: 14,
    paddingVertical: 13,
  },
  guideButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  guideButtonText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 13,
  },
  // ─── CTA Button ────────────────────────────────────────────────────────────
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#0F172A',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 16,
    shadowColor: '#00A550',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  ctaButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  ctaButtonText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 16,
    flex: 1,
    textAlign: 'center',
  },
  // ─── Footer ────────────────────────────────────────────────────────────────
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  robotAssistantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flex: 1,
  },
  robotMiniAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  assistantTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  assistantStatus: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },
  // ─── Playlist Thumbnails ───────────────────────────────────────────────────
  playlistSection: {
    marginBottom: 8,
  },
  playlistLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  thumbnailList: {
    gap: 10,
    paddingVertical: 4,
  },
  thumbItem: {
    alignItems: 'center',
    width: 70,
    opacity: 0.7,
  },
  thumbItemActive: {
    opacity: 1,
  },
  thumbImg: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  thumbTextActive: {
    color: '#00A550',
    fontWeight: '900',
  },
});
