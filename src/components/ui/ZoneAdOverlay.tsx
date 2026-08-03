/**
 * ZoneAdOverlay.tsx
 *
 * Modal slide-up hiển thị quảng cáo / gợi ý sản phẩm
 * khi Robot di chuyển vào gần 1 kệ hàng (zoneEntered).
 *
 * - Auto-dismiss sau displayDurationSeconds của ad đầu tiên (hoặc 8s mặc định)
 * - Nút đóng thủ công
 * - Gọi logInteraction('Impression') khi hiển thị
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  Dimensions, ScrollView, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated';
import { X, MapPin, Zap, Tag } from 'lucide-react-native';
import { AdService, AdPlaylistItemDto } from '../../services/AdService';
import { useGeofencing } from '../../context/GeofencingContext';

const { width: SW, height: SH } = Dimensions.get('window');
const ROBOT_ID = Number(process.env.EXPO_PUBLIC_ROBOT_ID ?? '1');

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ZoneAdOverlay() {
  const { isInZone, currentZone, currentPlaylist, isLoadingPlaylist, clearZone } = useGeofencing();

  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animated slide-up
  const translateY = useSharedValue(SH);
  const overlayOpacity = useSharedValue(0);

  const animatedSheet = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const animatedOverlay = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  // Ghi log impression
  const logImpression = useCallback(async (ad: AdPlaylistItemDto) => {
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
      console.warn('[ZoneAdOverlay] logInteraction failed:', e);
    }
  }, [currentZone]);

  // Mở overlay khi vào zone
  useEffect(() => {
    if (isInZone && currentPlaylist.length > 0) {
      setCurrentAdIndex(0);
      setVisible(true);
      translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
      overlayOpacity.value = withTiming(1, { duration: 300 });

      // Log impression cho ad đầu tiên
      logImpression(currentPlaylist[0]);

      // Auto-dismiss
      const duration = (currentPlaylist[0].displayDurationSeconds || 8) * 1000;
      dismissTimer.current = setTimeout(() => handleClose(), duration);
    }

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [isInZone, currentPlaylist]);

  const handleClose = useCallback(() => {
    translateY.value = withTiming(SH, { duration: 350 }, () => {
      runOnJS(setVisible)(false);
      runOnJS(clearZone)();
    });
    overlayOpacity.value = withTiming(0, { duration: 300 });
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
  }, [clearZone, translateY, overlayOpacity]);

  const handleAdClick = useCallback(async (ad: AdPlaylistItemDto) => {
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

  if (!visible && !isInZone) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, animatedOverlay]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[styles.sheet, animatedSheet]}>
        {/* Handle bar */}
        <View style={styles.handleBar} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.zoneBadge}>
            <MapPin size={14} color="#00A550" style={{ marginRight: 4 }} />
            <Text style={styles.zoneBadgeText} numberOfLines={1}>
              {currentZone?.objectName ?? 'Khu vực'}
            </Text>
          </View>

          <View style={styles.headerCenter}>
            <Zap size={18} color="#EAB308" />
            <Text style={styles.headerTitle}>Sản phẩm nổi bật tại đây</Text>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <X size={20} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Loading state */}
        {isLoadingPlaylist ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00A550" />
            <Text style={styles.loadingText}>Đang tải gợi ý sản phẩm...</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.productList}
          >
            {currentPlaylist.map((ad, idx) => (
              <TouchableOpacity
                key={`zone-ad-${ad.sponsoredId}-${idx}`}
                style={styles.productCard}
                activeOpacity={0.85}
                onPress={() => handleAdClick(ad)}
              >
                {/* Product image */}
                <View style={styles.imageWrapper}>
                  <Image
                    source={{ uri: ad.imageUrl }}
                    style={styles.productImage}
                    contentFit="cover"
                  />
                  {/* Sponsored badge */}
                  <View style={styles.sponsoredBadge}>
                    <Tag size={9} color="white" />
                    <Text style={styles.sponsoredText}>Tài trợ</Text>
                  </View>
                </View>

                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>
                    {ad.productName}
                  </Text>
                  <Text style={styles.campaignName} numberOfLines={1}>
                    {ad.campaignName}
                  </Text>
                  <Text style={styles.productPrice}>
                    {ad.productPrice.toLocaleString('vi-VN')} đ
                  </Text>

                  {/* Score indicator */}
                  <View style={styles.scoreRow}>
                    <View style={[styles.scoreBar, { width: `${Math.min(100, ad.adScore)}%` }]} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Footer info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            💡 Chạm vào sản phẩm để xem chi tiết hoặc thêm vào giỏ hàng
          </Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const SHEET_HEIGHT = SH * 0.42;

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: 'white',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 20,
  },
  handleBar: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  zoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    maxWidth: SW * 0.3,
  },
  zoneBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  productList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  productCard: {
    width: 180,
    backgroundColor: 'white',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginRight: 4,
  },
  imageWrapper: {
    position: 'relative',
    height: 120,
    backgroundColor: '#F8FAFC',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  sponsoredBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAB308',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
  },
  sponsoredText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '700',
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
    lineHeight: 18,
  },
  campaignName: {
    fontSize: 10,
    color: '#94A3B8',
    marginBottom: 6,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '900',
    color: '#00A550',
    marginBottom: 8,
  },
  scoreRow: {
    height: 3,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  scoreBar: {
    height: '100%',
    backgroundColor: '#00A550',
    borderRadius: 2,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
