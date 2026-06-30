/**
 * RoutePickerSheet.tsx
 *
 * Bottom-sheet Modal để chọn Fixed Route.
 * Hiển thị tên route, số waypoint, routeType badge, zoneName.
 * Có badge "MOCK" nếu dữ liệu đang từ mock fallback.
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, MapPin, Layers, CircleAlert } from 'lucide-react-native';
import { useRoute } from '../../context/RouteContext';
import { RobotRoute } from '../../services/RouteService';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function routeTypeColor(t: string): { bg: string; fg: string } {
  switch (t) {
    case 'Patrol':   return { bg: '#1e3a5f', fg: '#60a5fa' };
    case 'Delivery': return { bg: '#1f2937', fg: '#fbbf24' };
    case 'Guide':    return { bg: '#134e4a', fg: '#2dd4bf' };
    default:         return { bg: '#2d3a4d', fg: '#94a3b8' };
  }
}

function RouteItem({
  route,
  isSelected,
  onSelect,
}: {
  route: RobotRoute;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const tc = routeTypeColor(route.routeType);
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onSelect}
      style={[
        styles.item,
        isSelected && styles.itemSelected,
      ]}
    >
      <View style={styles.itemHeader}>
        <View style={styles.itemTitleRow}>
          <MapPin size={16} color={isSelected ? '#2dd4bf' : '#8a97ab'} />
          <Text
            style={[styles.itemName, isSelected && { color: '#2dd4bf' }]}
            numberOfLines={1}
          >
            {route.routeName}
          </Text>
        </View>
        <View style={[styles.typeBadge, { backgroundColor: tc.bg }]}>
          <Text style={[styles.typeBadgeText, { color: tc.fg }]}>
            {route.routeType}
          </Text>
        </View>
      </View>

      <View style={styles.itemMeta}>
        <Layers size={12} color="#8a97ab" />
        <Text style={styles.itemMetaText}>
          {route.waypoints.length} waypoint
        </Text>
        {route.zoneName ? (
          <>
            <View style={styles.metaDot} />
            <Text style={styles.itemMetaText} numberOfLines={1}>
              {route.zoneName}
            </Text>
          </>
        ) : null}
      </View>

      {route.description ? (
        <Text style={styles.itemDesc} numberOfLines={2}>
          {route.description}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RoutePickerSheet({ visible, onClose }: Props) {
  const { routes, selectedRouteId, selectRoute, isMock, isLoading } = useRoute();

  const handlePick = (id: number) => {
    selectRoute(id);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        {/* Handle bar */}
        <View style={styles.handleBar} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Chọn lộ trình cố định</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <X size={22} color="#8a97ab" />
          </TouchableOpacity>
        </View>

        {/* Mock badge */}
        {isMock ? (
          <View style={styles.mockBadge}>
            <CircleAlert size={14} color="#f59e0b" />
            <Text style={styles.mockText}>
              Đang dùng dữ liệu MOCK (BE chưa phản hồi)
            </Text>
          </View>
        ) : null}

        {/* List */}
        {isLoading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Đang tải lộ trình...</Text>
          </View>
        ) : routes.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Chưa có lộ trình nào</Text>
          </View>
        ) : (
          <FlatList
            data={routes}
            keyExtractor={(r) => String(r.robotRouteId)}
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item }) => (
              <RouteItem
                route={item}
                isSelected={selectedRouteId === item.robotRouteId}
                onSelect={() => handlePick(item.robotRouteId)}
              />
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#0d1219',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    borderTopWidth: 1,
    borderColor: '#1e2836',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2d3a4d',
    alignSelf: 'center',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  title: {
    color: '#e8edf4',
    fontSize: 17,
    fontWeight: '700',
  },
  mockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderColor: '#f59e0b',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: 10,
  },
  mockText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },

  item: {
    backgroundColor: '#111820',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e2836',
  },
  itemSelected: {
    borderColor: '#2dd4bf',
    backgroundColor: 'rgba(45,212,191,0.06)',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  itemName: {
    color: '#e8edf4',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemMetaText: {
    color: '#8a97ab',
    fontSize: 12,
  },
  metaDot: {
    width: 3, height: 3,
    borderRadius: 2,
    backgroundColor: '#4a5568',
    marginHorizontal: 4,
  },
  itemDesc: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
  },
  empty: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    color: '#8a97ab',
    fontSize: 13,
  },
});