import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, MapPin, Navigation, OctagonX, Radio } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import CartGuideMap from '../guide/CartGuideMap';
import { useRobotGuide } from '../../context/RobotGuideContext';

const STATUS_LABELS: Record<string, string> = {
  IDLE: 'Đang chờ',
  DISPATCHING: 'Đang gửi nhiệm vụ',
  NAVIGATING: 'Đang tính đường',
  MOVING: 'Robot đang di chuyển',
  ARRIVED: 'Đã đến kệ — vui lòng lấy hàng',
  PAUSED: 'Nhiệm vụ đang tạm dừng',
  RESUMED: 'Đang tiếp tục',
  COMPLETED: 'Đã đi hết các kệ trong giỏ',
  FAILED: 'Không thể hoàn thành',
  CANCELLED: 'Đã dừng nhiệm vụ',
  ESTOP: 'Robot đã dừng khẩn cấp',
  TIMEOUT: 'Robot không phản hồi',
};

export default function CartGuideMapScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const {
    status, missionId, destinations, destination, currentWaypointIndex,
    robotPose, error, isBusy, isHubConnected, cancelGuide,
  } = useRobotGuide();
  const isWide = width >= 860;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={25} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Navigation size={22} color="#16a34a" />
          <View>
            <Text style={styles.headerTitle}>Hãy đi theo tôi</Text>
            <Text style={styles.headerSub}>Lộ trình lấy sản phẩm trong giỏ hàng</Text>
          </View>
        </View>
        <View style={[styles.connection, { backgroundColor: isHubConnected ? '#dcfce7' : '#fee2e2' }]}>
          <Radio size={14} color={isHubConnected ? '#15803d' : '#dc2626'} />
          <Text style={{ color: isHubConnected ? '#15803d' : '#dc2626', fontWeight: '800', fontSize: 12 }}>
            {isHubConnected ? 'RB001 online' : 'Mất kết nối'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, isWide && styles.contentWide]}>
        <View style={[styles.mapColumn, isWide && styles.mapColumnWide]}>
          <CartGuideMap
            destinations={destinations}
            currentWaypointIndex={currentWaypointIndex}
            robotPose={robotPose}
          />
          <View style={styles.legendRow}>
            <Text style={styles.legend}>🤖 Robot thật</Text>
            <Text style={styles.legend}>🔵 Điểm cần ghé</Text>
            <Text style={styles.legend}>🟠 Điểm hiện tại</Text>
            <Text style={styles.legend}>🟢 Đã ghé</Text>
          </View>
          <Text style={styles.mapNote}>
            Sơ đồ KV2/KV3/KV4. Tuyến và vị trí robot lấy từ waypoint/telemetry thật; tọa độ ROS được co giãn để vừa sơ đồ.
          </Text>
        </View>

        <View style={[styles.detailColumn, isWide && styles.detailColumnWide]}>
          <View style={[styles.statusCard, error ? styles.errorCard : undefined]}>
            <Text style={styles.statusEyebrow}>TRẠNG THÁI NHIỆM VỤ</Text>
            <Text style={styles.statusTitle}>{error || STATUS_LABELS[status] || status}</Text>
            <Text style={styles.missionText}>Mission: {missionId ?? (status === 'COMPLETED' ? 'đã hoàn tất' : 'chưa có')}</Text>
            {destination && (
              <Text style={styles.currentTarget}>
                Đang tới: {destination.shelfName || destination.nodeName}
              </Text>
            )}
          </View>

          <Text style={styles.sectionTitle}>Các vị trí cần đi ({destinations.length})</Text>
          {destinations.length === 0 ? (
            <View style={styles.emptyCard}>
              <MapPin size={24} color="#94a3b8" />
              <Text style={styles.emptyText}>Hãy mở giỏ hàng và bấm “Robot dẫn theo giỏ hàng”.</Text>
            </View>
          ) : destinations.map((item, index) => {
            const active = index === currentWaypointIndex && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(status);
            const completed = index < currentWaypointIndex || status === 'COMPLETED';
            return (
              <View key={`${item.nodeId}-${index}`} style={[styles.stopCard, active && styles.activeStopCard]}>
                <View style={[styles.orderBadge, completed && styles.doneBadge, active && styles.activeBadge]}>
                  <Text style={styles.orderText}>{completed ? '✓' : index + 1}</Text>
                </View>
                <View style={styles.stopInfo}>
                  <Text style={styles.stopTitle}>{item.shelfName || item.nodeName}</Text>
                  <Text style={styles.stopMeta}>
                    {[item.zoneName, item.aisleName].filter(Boolean).join(' • ') || item.nodeName}
                  </Text>
                  {!!item.productNames?.length && (
                    <Text style={styles.products}>{item.productNames.join(', ')}</Text>
                  )}
                  <Text style={styles.coordinates}>Node {item.nodeId} · X {item.xCoord.toFixed(2)} · Y {item.yCoord.toFixed(2)}</Text>
                </View>
              </View>
            );
          })}

          {isBusy && (
            <TouchableOpacity style={styles.cancelButton} onPress={() => cancelGuide().catch(() => undefined)}>
              <OctagonX size={18} color="#fff" />
              <Text style={styles.cancelText}>Dừng dẫn đường</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f3f7fb' },
  header: { minHeight: 76, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerTitleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { color: '#0f172a', fontSize: 21, fontWeight: '900' },
  headerSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  connection: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  contentWide: { flexDirection: 'row', alignItems: 'flex-start', padding: 22 },
  mapColumn: { width: '100%' },
  mapColumnWide: { width: '58%' },
  detailColumn: { gap: 10 },
  detailColumnWide: { flex: 1 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  legend: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: '#fff', color: '#475569', fontSize: 11, fontWeight: '700' },
  mapNote: { color: '#64748b', fontSize: 11, marginTop: 8, lineHeight: 16 },
  statusCard: { padding: 16, borderRadius: 18, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#86efac' },
  errorCard: { backgroundColor: '#fff1f2', borderColor: '#fda4af' },
  statusEyebrow: { color: '#64748b', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  statusTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900', marginTop: 5 },
  missionText: { color: '#64748b', fontSize: 11, marginTop: 5 },
  currentTarget: { color: '#15803d', fontSize: 14, fontWeight: '800', marginTop: 8 },
  sectionTitle: { color: '#0f172a', fontSize: 17, fontWeight: '900', marginTop: 5 },
  emptyCard: { minHeight: 110, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  emptyText: { color: '#64748b', textAlign: 'center', fontSize: 13 },
  stopCard: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  activeStopCard: { borderColor: '#fb923c', backgroundColor: '#fff7ed' },
  orderBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563eb' },
  activeBadge: { backgroundColor: '#f97316' },
  doneBadge: { backgroundColor: '#16a34a' },
  orderText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  stopInfo: { flex: 1 },
  stopTitle: { color: '#0f172a', fontSize: 14, fontWeight: '900' },
  stopMeta: { color: '#64748b', fontSize: 12, marginTop: 2 },
  products: { color: '#166534', fontSize: 12, fontWeight: '700', marginTop: 4 },
  coordinates: { color: '#94a3b8', fontSize: 10, marginTop: 4 },
  cancelButton: { marginTop: 8, minHeight: 48, borderRadius: 15, backgroundColor: '#dc2626', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#fff', fontWeight: '900', fontSize: 14 },
});
