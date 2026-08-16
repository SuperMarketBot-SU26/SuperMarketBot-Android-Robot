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
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  Dimensions, ScrollView, Pressable
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS, FadeIn, FadeInDown
} from 'react-native-reanimated';
import {
  MapPin, Zap, Tag, Clock, Volume2, ShoppingBag, ArrowRight, Sparkles
} from 'lucide-react-native';
import { AdService, AdPlaylistItemDto } from '../../services/AdService';
import { useGeofencing } from '../../context/GeofencingContext';
import { useRobotVoice } from '../../hooks/useRobotVoice';

const { width: SW, height: SH } = Dimensions.get('window');
const ROBOT_ID = Number(process.env.EXPO_PUBLIC_ROBOT_ID ?? '1');

function mediaForProduct(ad: AdPlaylistItemDto, type: 'VOICE_TEXT' | 'IMAGE') {
  const resources = ad.mediaContents?.filter(item => item.resourceType === type) ?? [];
  const productName = ad.productName.trim().toLocaleLowerCase('vi-VN');
  return resources.find(item => item.contentText?.toLocaleLowerCase('vi-VN').includes(productName))
    ?? resources[0];
}

function buildSpeech(ad: AdPlaylistItemDto, index: number, total: number, location?: string) {
  const voiceText = mediaForProduct(ad, 'VOICE_TEXT')?.contentText;
  const introductions = ['Ưu đãi nổi bật', 'Gợi ý tiếp theo', 'Đừng bỏ lỡ sản phẩm cuối'];
  const intro = introductions[index % introductions.length];
  const position = total > 1 ? `, quảng cáo ${index + 1} trên ${total}` : '';
  const zone = location ? ` tại ${location}` : '';
  const price = ad.productPrice > 0
    ? ` Giá hôm nay chỉ ${ad.productPrice.toLocaleString('vi-VN')} đồng.`
    : '';
  const core = voiceText || `${ad.productName} đang có ưu đãi hấp dẫn${zone}.`;
  return `${intro}${position}. ${core}${price} Chạm màn hình để xem chi tiết.`;
}

export default function ZoneAdOverlay() {
  const { isInZone, currentZone, currentPlaylist, clearZone } = useGeofencing();
  const { speak, stop, isSpeaking } = useRobotVoice();
  const speakRef = useRef(speak);
  const stopRef = useRef(stop);

  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(12);
  const [totalDuration, setTotalDuration] = useState(12);

  useEffect(() => {
    speakRef.current = speak;
    stopRef.current = stop;
  }, [speak, stop]);

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

  // Ghi log impression
  const logImpression = useCallback(async (ad: AdPlaylistItemDto) => {
    if (ad.adCampaignId <= 0 || ad.sponsoredId <= 0) {
      console.warn('[ZoneAdOverlay] Bỏ qua impression vì playlist thiếu AdCampaignId/SponsoredId thật.');
      return;
    }
    try {
      await AdService.logInteraction({
        adCampaignId: ad.adCampaignId,
        actionType: 'Impression',
        sponsoredId: ad.sponsoredId,
        productId: ad.productId,
        robotId: ROBOT_ID,
        semanticObjectId: currentZone?.semanticObjectId,
        zoneId: currentZone?.zoneId,
      });
    } catch (e) {
      console.warn('[ZoneAdOverlay] logImpression failed:', e);
    }
  }, [currentZone]);

  const handleClose = useCallback(() => {
    void stopRef.current();
    translateY.value = withTiming(SH, { duration: 300 }, () => {
      runOnJS(setVisible)(false);
      runOnJS(clearZone)();
    });
    overlayOpacity.value = withTiming(0, { duration: 250 });
  }, [clearZone, translateY, overlayOpacity]);

  const handleAdClick = useCallback(async (ad: AdPlaylistItemDto) => {
    if (ad.adCampaignId <= 0 || ad.sponsoredId <= 0) {
      console.warn('[ZoneAdOverlay] Bỏ qua click log vì playlist thiếu AdCampaignId/SponsoredId thật.');
      return;
    }
    try {
      await AdService.logInteraction({
        adCampaignId: ad.adCampaignId,
        actionType: 'Click',
        sponsoredId: ad.sponsoredId,
        productId: ad.productId,
        robotId: ROBOT_ID,
        semanticObjectId: currentZone?.semanticObjectId,
        zoneId: currentZone?.zoneId,
      });
    } catch (e) {
      console.warn('[ZoneAdOverlay] Click log failed:', e);
    }
  }, [currentZone]);

  // Mở overlay khi có zone/playlist mới
  useEffect(() => {
    if (isInZone && currentPlaylist.length > 0) {
      console.log(`[ZoneAdOverlay] Mở màn hình Kiosk Ad cho ${currentPlaylist.length} quảng cáo`);
      setCurrentAdIndex(0);
      setVisible(true);
      translateY.value = 0;
      overlayOpacity.value = 1;
    } else if (!isInZone) {
      void stopRef.current();
      setVisible(false);
    }
  }, [isInZone, currentPlaylist]);

  const lastSpokenKeyRef = useRef<string | null>(null);
  // Khi chuyển sang ad mới
  useEffect(() => {
    if (!visible || !currentAd) {
      lastSpokenKeyRef.current = null;
      return;
    }

    const currentKey = `${currentAd.sponsoredId}-${currentAdIndex}`;

    const isRouteContinuous = Boolean(currentZone?.isRouteAd || Number(currentZone?.dwellTimeSeconds) === 0);
    const eventDwell = Number(currentZone?.dwellTimeSeconds ?? 0);
    const dwellTime = eventDwell > 0 ? eventDwell : 30;
    const baseDuration = Math.floor(dwellTime / currentPlaylist.length);
    const remainder = dwellTime % currentPlaylist.length;
    const duration = isRouteContinuous
      ? Math.max(8, Number(currentAd.displayDurationSeconds) || 12)
      : Math.max(1, baseDuration + (currentAdIndex < remainder ? 1 : 0));

    setTotalDuration(duration);
    setTimeLeft(duration);

    // Chỉ phát voice và log impression 1 LẦN DUY NHẤT cho mỗi quảng cáo, không bị ngắt khi re-render
    if (lastSpokenKeyRef.current !== currentKey) {
      lastSpokenKeyRef.current = currentKey;
      logImpression(currentAd);

      // Phát âm thanh TTS tiếng Việt
      void speakRef.current(buildSpeech(
        currentAd, currentAdIndex, currentPlaylist.length, currentZone?.objectName));
    }

    // Đếm ngược từng giây và tự động nhảy sản phẩm
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (currentAdIndex < currentPlaylist.length - 1) {
            console.log(`[ZoneAdOverlay] Hết ${duration}s -> Tự động chuyển sang sản phẩm tiếp theo (${currentAdIndex + 2}/${currentPlaylist.length})`);
            setCurrentAdIndex(idx => idx + 1);
          } else {
            if (isRouteContinuous) {
              console.log('[ZoneAdOverlay] Lộ trình quảng cáo: xoay vòng lại từ đầu playlist');
              setCurrentAdIndex(0);
            } else {
              console.log(`[ZoneAdOverlay] Đã phát xong playlist trong dwell ${dwellTime}s -> Đóng quảng cáo`);
              handleClose();
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
  }, [currentAd, currentAdIndex, currentPlaylist, currentZone?.dwellTimeSeconds, currentZone?.isRouteAd, currentZone?.objectName, handleClose, logImpression, visible]);

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
          <View style={[styles.progressBarFill, { width: `${100 - progressPercent}%` }]} />
        </View>

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
            <View style={styles.timerPill}>
              <Clock size={13} color="#DC2626" />
              <Text style={styles.timerText}>{timeLeft}s {currentPlaylist.length > 1 ? `(${currentAdIndex + 1}/${currentPlaylist.length})` : ''}</Text>
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
                {`“${sloganText}”`}
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

            {/* NÚT TƯƠNG TÁC LỚN: XEM SẢN PHẨM / MUA NGAY */}
            <Pressable
              style={({ pressed }) => [
                styles.ctaButton,
                pressed && styles.ctaButtonPressed
              ]}
              onPress={() => handleAdClick(currentAd)}
            >
              <ShoppingBag size={20} color="white" />
              <Text style={styles.ctaButtonText}>Chạm để xem chi tiết</Text>
              <ArrowRight size={18} color="white" />
            </Pressable>
          </View>

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
                  {isSpeaking ? '🎙️ Đang giới thiệu...' : 'Sẵn sàng dẫn đường'}
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
  timerText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#DC2626',
    fontVariant: ['tabular-nums'],
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
    fontSize: 24,
    fontWeight: '900',
    color: '#00A550',
  },
  hotDealBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  hotDealText: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: '900',
  },
  ctaButton: {
    backgroundColor: '#00A550',
    borderRadius: 16,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#00A550',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  ctaButtonPressed: {
    backgroundColor: '#007A3B',
    transform: [{ scale: 0.98 }],
  },
  ctaButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  robotAssistantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 8,
    gap: 8,
    flex: 1,
  },
  robotMiniAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#00A550',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistantTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  assistantStatus: {
    fontSize: 11,
    fontWeight: '600',
    color: '#00A550',
  },
  playlistSection: {
    marginTop: 4,
  },
  playlistLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
  },
  thumbnailList: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  thumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 8,
    gap: 6,
    maxWidth: 180,
  },
  thumbItemActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#00A550',
  },
  thumbImg: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  thumbText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    flex: 1,
  },
  thumbTextActive: {
    color: '#007036',
    fontWeight: '800',
  },
});
