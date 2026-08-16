import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronLeft,
  CircleDot,
  CornerDownRight,
  Flame,
  Home,
  MapPin,
  Navigation,
  OctagonX,
  Package,
  PackageCheck,
  Radio,
  Sparkles,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useRobotGuide } from '../../context/RobotGuideContext';

const STATUS_LABELS: Record<string, string> = {
  IDLE: 'Đang ở trạm chờ',
  DISPATCHING: 'Đang khởi động lộ trình...',
  NAVIGATING: 'Đang tính toán tuyến đường tối ưu...',
  MOVING: 'Robot đang di chuyển dẫn đường...',
  ARRIVED: 'Đã đến kệ hàng — Vui lòng lấy sản phẩm',
  PAUSED: 'Robot đang tạm dừng chờ bạn',
  RESUMED: 'Đang tiếp tục di chuyển...',
  WAYPOINT_COMPLETED: 'Đã lấy xong — Đang đến kệ tiếp theo',
  COMPLETED: 'Đã hoàn thành toàn bộ giỏ hàng 🎉',
  FAILED: 'Không thể hoàn thành lộ trình',
  CANCELLED: 'Đã dừng dẫn đường',
  ESTOP: 'Robot dừng khẩn cấp',
  TIMEOUT: 'Robot không phản hồi',
};

export default function CartGuideMapScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
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

  const isWide = width >= 860;
  const totalStops = destinations.length;
  const isFinalStop = totalStops > 0 && currentWaypointIndex >= totalStops - 1;

  React.useEffect(() => {
    if (status === 'COMPLETED') {
      const timer = setTimeout(() => {
        router.replace('/kiosk' as any);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [status, router]);

  const handleConfirmPickup = async () => {
    try {
      await confirmPickup();
    } catch (err: any) {
      Alert.alert('Chưa thể đi tiếp', err?.message || 'Không gửi được xác nhận lấy hàng.');
    }
  };

  const handleCancelGuide = () => {
    Alert.alert(
      'Dừng dẫn đường?',
      'Bạn có chắc chắn muốn hủy phiên dẫn đường mua sắm hiện tại không?',
      [
        { text: 'Tiếp tục đi', style: 'cancel' },
        {
          text: 'Dừng dẫn đường',
          style: 'destructive',
          onPress: () => cancelGuide().catch(() => undefined),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={24} color="#0f172a" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <View style={styles.iconCircle}>
            <Bot size={22} color="#16a34a" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Robot Dẫn Đường Mua Sắm</Text>
            <Text style={styles.headerSub}>
              {totalStops > 0
                ? `Lộ trình ${totalStops} kệ hàng · Chặng ${Math.min(currentWaypointIndex + 1, totalStops)}/${totalStops}`
                : 'Lộ trình lấy sản phẩm trong giỏ hàng'}
            </Text>
          </View>
        </View>

        <View style={[styles.connection, { backgroundColor: isHubConnected ? '#dcfce7' : '#fee2e2' }]}>
          <Radio size={14} color={isHubConnected ? '#15803d' : '#dc2626'} />
          <Text style={[styles.connectionText, { color: isHubConnected ? '#15803d' : '#dc2626' }]}>
            {isHubConnected ? 'RB001 Sẵn sàng' : 'Mất kết nối'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, isWide && styles.contentWide]}
        style={{ marginBottom: awaitingPickup ? 90 : 0 }}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO INTERACTION CARD */}
        <View
          style={[
            styles.heroCard,
            error
              ? styles.heroError
              : awaitingPickup
                ? styles.heroArrived
                : status === 'COMPLETED'
                  ? styles.heroCompleted
                  : styles.heroMoving,
          ]}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              {awaitingPickup ? (
                <Sparkles size={16} color="#15803d" />
              ) : status === 'COMPLETED' ? (
                <CheckCircle2 size={16} color="#059669" />
              ) : (
                <Navigation size={16} color="#2563eb" />
              )}
              <Text
                style={[
                  styles.heroBadgeText,
                  awaitingPickup && { color: '#15803d' },
                  status === 'COMPLETED' && { color: '#059669' },
                ]}
              >
                {awaitingPickup
                  ? 'ĐÃ ĐẾN ĐIỂM HẸN'
                  : status === 'COMPLETED'
                    ? 'HOÀN TẤT DẪN ĐƯỜNG'
                    : 'ĐANG DẪN ĐƯỜNG'}
              </Text>
            </View>
            <Text style={styles.missionTag}>
              {missionId ? `Mission: ${missionId.slice(0, 18)}...` : status === 'COMPLETED' ? 'Đã hoàn thành' : 'Sẵn sàng'}
            </Text>
          </View>

          <Text style={styles.heroTitle}>{error || STATUS_LABELS[status] || status}</Text>

          {destination && status !== 'COMPLETED' && (
            <View style={styles.heroTargetBox}>
              <Text style={styles.heroTargetLabel}>
                {awaitingPickup ? '📍 Vị trí hiện tại:' : '🚀 Điểm đến tiếp theo:'}
              </Text>
              <Text style={styles.heroTargetName}>
                {destination.shelfName || destination.nodeName}
              </Text>
              {!!destination.productNames?.length && (
                <View style={styles.heroProductsList}>
                  <Text style={styles.heroProductsHeader}>Sản phẩm cần lấy tại kệ này:</Text>
                  {destination.productNames.map((pName, pIdx) => (
                    <View key={pIdx} style={styles.heroProductItem}>
                      <Package size={14} color="#15803d" />
                      <Text style={styles.heroProductItemText}>{pName}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {status === 'COMPLETED' && (
            <View style={styles.completedBox}>
              <Sparkles size={20} color="#059669" />
              <View style={{ flex: 1, gap: 10 }}>
                <Text style={styles.completedBoxText}>
                  Robot đang tự động quay về trạm chờ (Waypoint 7). Cảm ơn quý khách đã mua sắm!
                </Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: '#10b981',
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    alignSelf: 'flex-start',
                  }}
                  onPress={() => router.replace('/kiosk' as any)}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Về màn hình chính</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {awaitingPickup && (
            <TouchableOpacity
              style={styles.heroPickupButton}
              onPress={handleConfirmPickup}
              activeOpacity={0.85}
            >
              <CheckCircle2 size={20} color="#fff" />
              <Text style={styles.heroPickupButtonText}>
                {isFinalStop
                  ? 'Tôi đã lấy xong — Hoàn tất mua sắm ✓'
                  : 'Tôi đã lấy sản phẩm — Đi kệ tiếp theo ➜'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* SCRIPT TIMELINE / CHECKLIST */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Kịch Bản Lộ Trình Mua Sắm</Text>
          <Text style={styles.sectionSub}>
            Robot sẽ lần lượt dừng lại ở từng kệ để bạn lấy sản phẩm
          </Text>
        </View>

        {/* Điểm xuất phát: Waypoint 7 */}
        <View style={styles.startStopCard}>
          <View style={styles.startIconWrap}>
            <Home size={18} color="#2563eb" />
          </View>
          <View style={styles.startInfo}>
            <Text style={styles.startTitle}>Điểm Xuất Phát (Waypoint 7 - Trạm Robot)</Text>
            <Text style={styles.startSub}>Robot bắt đầu hành trình từ điểm chờ trung tâm</Text>
          </View>
          <View style={styles.startDoneBadge}>
            <CheckCircle2 size={16} color="#16a34a" />
          </View>
        </View>

        {/* Danh sách các Kệ Hàng */}
        {destinations.length === 0 ? (
          <View style={styles.emptyCard}>
            <MapPin size={28} color="#94a3b8" />
            <Text style={styles.emptyTitle}>Chưa có lộ trình dẫn đường</Text>
            <Text style={styles.emptyText}>
              Hãy thêm sản phẩm vào giỏ hàng và nhấn "Robot dẫn theo giỏ hàng".
            </Text>
          </View>
        ) : (
          destinations.map((item, index) => {
            const isCompleted = index < currentWaypointIndex || status === 'COMPLETED';
            const isActive = index === currentWaypointIndex && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(status);
            const isArrivedHere = isActive && awaitingPickup;

            return (
              <View
                key={`${item.nodeId}-${index}`}
                style={[
                  styles.stopCard,
                  isCompleted && styles.stopCardCompleted,
                  isActive && styles.stopCardActive,
                  isArrivedHere && styles.stopCardArrived,
                ]}
              >
                {/* Badge số chặng */}
                <View
                  style={[
                    styles.stopBadge,
                    isCompleted && styles.stopBadgeDone,
                    isActive && styles.stopBadgeActive,
                    isArrivedHere && styles.stopBadgeArrived,
                  ]}
                >
                  {isCompleted ? (
                    <CheckCircle2 size={18} color="#fff" />
                  ) : (
                    <Text style={styles.stopBadgeText}>{index + 1}</Text>
                  )}
                </View>

                {/* Thông tin kệ */}
                <View style={styles.stopMain}>
                  <View style={styles.stopHeaderRow}>
                    <Text style={[styles.stopShelfName, isActive && styles.stopShelfNameActive]}>
                      {item.shelfName || item.nodeName}
                    </Text>
                    {isCompleted && (
                      <View style={styles.completedPill}>
                        <Text style={styles.completedPillText}>Đã lấy xong ✓</Text>
                      </View>
                    )}
                    {isArrivedHere && (
                      <View style={styles.waitingPill}>
                        <Flame size={12} color="#15803d" />
                        <Text style={styles.waitingPillText}>Đang chờ lấy hàng</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.stopMeta}>
                    {[item.zoneName, item.aisleName].filter(Boolean).join(' • ') || `Node ${item.nodeId}`}
                  </Text>

                  {/* Danh sách sản phẩm dạng tags */}
                  {!!item.productNames?.length && (
                    <View style={styles.productTagsWrap}>
                      {item.productNames.map((pName, pIdx) => (
                        <View
                          key={pIdx}
                          style={[
                            styles.productTag,
                            isCompleted && styles.productTagCompleted,
                            isArrivedHere && styles.productTagArrived,
                          ]}
                        >
                          <PackageCheck size={13} color={isCompleted ? '#16a34a' : isArrivedHere ? '#15803d' : '#2563eb'} />
                          <Text
                            style={[
                              styles.productTagText,
                              isCompleted && styles.productTagTextCompleted,
                              isArrivedHere && styles.productTagTextArrived,
                            ]}
                          >
                            {pName}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Khi robot đã đến kệ này: Nút tương tác nhanh */}
                  {isArrivedHere && (
                    <TouchableOpacity
                      style={styles.stopInlineConfirmButton}
                      onPress={handleConfirmPickup}
                      activeOpacity={0.8}
                    >
                      <CheckCircle2 size={16} color="#fff" />
                      <Text style={styles.stopInlineConfirmText}>
                        {isFinalStop
                          ? 'Xác nhận đã lấy — Hoàn thành mua sắm'
                          : 'Xác nhận đã lấy sản phẩm tại kệ này ➜'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}

        {/* Điểm kết thúc: Quay về Waypoint 7 */}
        <View style={styles.endStopCard}>
          <View style={styles.endIconWrap}>
            <Home size={18} color="#059669" />
          </View>
          <View style={styles.endInfo}>
            <Text style={styles.endTitle}>Kết Thúc & Hồi Vị (Waypoint 7)</Text>
            <Text style={styles.endSub}>
              Sau khi lấy xong tất cả món hàng, robot sẽ tự động quay về trạm chờ
            </Text>
          </View>
          {status === 'COMPLETED' && (
            <View style={styles.startDoneBadge}>
              <CheckCircle2 size={16} color="#16a34a" />
            </View>
          )}
        </View>

        {/* Nút hủy dẫn đường */}
        {isBusy && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelGuide}
            activeOpacity={0.8}
          >
            <OctagonX size={18} color="#dc2626" />
            <Text style={styles.cancelButtonText}>Dừng phiên dẫn đường</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Fixed Bottom CTA Bar khi Robot đã đến kệ và chờ khách lấy hàng */}
      {awaitingPickup && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.bottomButton}
            onPress={handleConfirmPickup}
            activeOpacity={0.88}
          >
            <CheckCircle2 size={24} color="#fff" />
            <Text style={styles.bottomButtonText}>
              {isFinalStop
                ? 'Tôi đã lấy xong tất cả — Hoàn tất dẫn đường ✓'
                : 'Tôi đã lấy sản phẩm tại kệ này — Đi tiếp ➜'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f1f5f9' },
  header: {
    minHeight: 76,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { color: '#0f172a', fontSize: 19, fontWeight: '900' },
  headerSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  connection: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  connectionText: { fontWeight: '800', fontSize: 12 },
  content: { padding: 18, gap: 14, paddingBottom: 40 },
  contentWide: { maxWidth: 900, alignSelf: 'center', width: '100%' },

  /* Hero Card */
  heroCard: {
    borderRadius: 22,
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  heroMoving: {
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#93c5fd',
  },
  heroArrived: {
    backgroundColor: '#f0fdf4',
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  heroCompleted: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#6ee7b7',
  },
  heroError: {
    backgroundColor: '#fff1f2',
    borderWidth: 1.5,
    borderColor: '#fda4af',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  heroBadgeText: { fontSize: 11, fontWeight: '900', color: '#2563eb' },
  missionTag: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  heroTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  heroTargetBox: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  heroTargetLabel: { fontSize: 12, color: '#64748b', fontWeight: '700' },
  heroTargetName: { fontSize: 17, color: '#0f172a', fontWeight: '900' },
  heroProductsList: { marginTop: 6, gap: 4 },
  heroProductsHeader: { fontSize: 12, fontWeight: '800', color: '#15803d' },
  heroProductItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroProductItemText: { fontSize: 14, fontWeight: '700', color: '#166534' },
  completedBox: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  completedBoxText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#065f46' },
  heroPickupButton: {
    backgroundColor: '#16a34a',
    borderRadius: 16,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  heroPickupButtonText: { color: '#fff', fontSize: 15, fontWeight: '900' },

  /* Section Header */
  sectionHeader: { marginTop: 8, marginBottom: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  sectionSub: { fontSize: 12, color: '#64748b', marginTop: 2 },

  /* Start & End Base Cards */
  startStopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  startIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startInfo: { flex: 1 },
  startTitle: { fontSize: 14, fontWeight: '900', color: '#0f172a' },
  startSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  startDoneBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  endStopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  endIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endInfo: { flex: 1 },
  endTitle: { fontSize: 14, fontWeight: '900', color: '#0f172a' },
  endSub: { fontSize: 11, color: '#64748b', marginTop: 2 },

  /* Shelf Stops */
  stopCard: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stopCardCompleted: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    opacity: 0.9,
  },
  stopCardActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
    borderWidth: 1.5,
  },
  stopCardArrived: {
    backgroundColor: '#f0fdf4',
    borderColor: '#22c55e',
    borderWidth: 2,
  },
  stopBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#64748b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBadgeDone: { backgroundColor: '#16a34a' },
  stopBadgeActive: { backgroundColor: '#f97316' },
  stopBadgeArrived: { backgroundColor: '#22c55e' },
  stopBadgeText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  stopMain: { flex: 1, gap: 6 },
  stopHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  stopShelfName: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  stopShelfNameActive: { color: '#c2410c' },
  stopMeta: { fontSize: 12, color: '#64748b' },
  completedPill: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  completedPillText: { fontSize: 11, fontWeight: '800', color: '#15803d' },
  waitingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  waitingPillText: { fontSize: 11, fontWeight: '800', color: '#15803d' },
  productTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  productTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  productTagCompleted: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  productTagArrived: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  productTagText: { fontSize: 13, fontWeight: '700', color: '#334155' },
  productTagTextCompleted: { color: '#16a34a' },
  productTagTextArrived: { color: '#15803d' },
  stopInlineConfirmButton: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  stopInlineConfirmText: { color: '#fff', fontSize: 13, fontWeight: '900' },

  /* Empty state */
  emptyCard: {
    padding: 30,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#475569' },
  emptyText: { fontSize: 13, color: '#94a3b8', textAlign: 'center' },

  /* Cancel Button */
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    marginTop: 8,
  },
  cancelButtonText: { color: '#dc2626', fontSize: 14, fontWeight: '900' },

  /* Fixed Bottom Bar */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
  },
  bottomButton: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  bottomButtonText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
