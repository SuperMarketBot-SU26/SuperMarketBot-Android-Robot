import React from 'react';
import { Alert, ScrollView } from 'react-native';
import { Button, Card, Text, View, XStack, YStack } from 'tamagui';
import { Bot, MapPin, OctagonX, Volume2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useRobotVoice } from '../../hooks/useRobotVoice';
import { useRobotGuide } from '../../context/RobotGuideContext';

export default function RobotKioskScreen() {
  const router = useRouter();
  const { speak } = useRobotVoice();
  const { status, productName, destination, error, isBusy, isHubConnected, cancelGuide } = useRobotGuide();
  const statusText = status === 'IDLE'
    ? 'Đang chờ quý khách chọn sản phẩm'
    : status === 'ARRIVED'
      ? 'Đã đến kệ sản phẩm'
      : error || `${status}${productName ? ` • ${productName}` : ''}`;

  return (
    <View flex={1} backgroundColor="#07111f" padding="$4">
      <XStack justifyContent="space-between" alignItems="center" marginBottom="$4">
        <XStack alignItems="center" gap="$2"><Bot color="#2dd4bf" /><Text color="white" fontSize={20} fontWeight="900">Robot Kiosk</Text></XStack>
        <Button chromeless onPress={() => router.back()}><Text color="#94a3b8">Đóng</Text></Button>
      </XStack>
      <Card backgroundColor="#101d2e" borderColor="#1e3a4b" borderWidth={1} padding="$4" borderRadius={18}>
        <XStack alignItems="center" gap="$3"><View width={12} height={12} borderRadius={8} backgroundColor={isHubConnected ? '#22c55e' : '#ef4444'} /><YStack><Text color="#94a3b8" fontSize={12}>RB001 • REAL ROBOT</Text><Text color="white" fontSize={18} fontWeight="800">{statusText}</Text></YStack></XStack>
        <Text color="#64748b" marginTop="$3">SignalR: {isHubConnected ? 'đã kết nối' : 'mất kết nối'}</Text>
        {destination && <Text color="#2dd4bf" marginTop="$2">{[destination.zoneName, destination.aisleName, destination.shelfName].filter(Boolean).join(' • ')}</Text>}
      </Card>
      <ScrollView contentContainerStyle={{ paddingVertical: 16, gap: 12 }}>
        <Button size="$5" backgroundColor="#00a550" onPress={() => router.push('/product-search' as any)} icon={<MapPin color="white" size={20} />}>
          <Text color="white" fontWeight="900">Tìm sản phẩm & dẫn robot</Text>
        </Button>
        <Button size="$5" backgroundColor="#dc2626" disabled={!isBusy} opacity={isBusy ? 1 : 0.45} onPress={async () => {
          try { await cancelGuide(); } catch (e: any) { Alert.alert('Không thể hủy', e?.message); }
        }} icon={<OctagonX color="white" size={20} />}>
          <Text color="white" fontWeight="900">Hủy yêu cầu dẫn đường</Text>
        </Button>
        <Button chromeless onPress={() => speak(statusText)} icon={<Volume2 color="#2dd4bf" size={18} />}>
          <Text color="#2dd4bf">Đọc trạng thái bằng giọng nói</Text>
        </Button>
      </ScrollView>
    </View>
  );
}
