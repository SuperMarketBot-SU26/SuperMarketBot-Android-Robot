import React, { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { Button, Card, Text, View, XStack, YStack } from 'tamagui';
import { Bot, MapPin, OctagonX, Volume2, ShieldAlert } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useRobotVoice } from '../../hooks/useRobotVoice';
import { robotSimulation, SimulationEvent } from '../../services/RobotSimulationService';

export default function RobotKioskSimulationScreen() {
  const router = useRouter();
  const { speak } = useRobotVoice();
  const [status, setStatus] = useState('Đang chờ nhiệm vụ');
  const [lastEvent, setLastEvent] = useState('Kiosk sẵn sàng');
  const [progress, setProgress] = useState({ index: 0, total: 0 });

  useEffect(() => {
    robotSimulation.onEvent((event: SimulationEvent) => {
      setLastEvent(event.type);
      if (event.type === 'dispatching') setStatus(`Đang lập lộ trình${event.productName ? ` tới ${event.productName}` : ''}`);
      if (event.type === 'moving') {
        setProgress({ index: event.index, total: event.total });
        setStatus(`Đang ở ${event.nodeName || `node ${event.nodeId}`}`);
      }
      if (event.type === 'obstacle') { setStatus('Tạm dừng vì vật cản'); speak(event.message); }
      if (event.type === 'arrived') { setStatus(`Đã tới ${event.nodeName || 'điểm đích'}`); speak('Robot đã tới nơi. Xin mời quý khách lấy sản phẩm.'); }
      if (event.type === 'stopped') setStatus(event.message);
    });
    return () => robotSimulation.stop('Kiosk đóng');
  }, []);

  const dispatchMap = async () => {
    try { await robotSimulation.dispatchFullMap(); speak('Robot bắt đầu tuần tra toàn bộ bản đồ.'); }
    catch (e: any) { Alert.alert('Dispatch thất bại', e?.message || 'Không thể gửi RB001'); }
  };

  return (
    <View flex={1} backgroundColor="#07111f" padding="$4">
      <XStack justifyContent="space-between" alignItems="center" marginBottom="$4">
        <XStack alignItems="center" gap="$2"><Bot color="#2dd4bf" /><Text color="white" fontSize={20} fontWeight="900">Robot Kiosk</Text></XStack>
        <Button chromeless onPress={() => router.back()}><Text color="#94a3b8">Đóng</Text></Button>
      </XStack>
      <Card backgroundColor="#101d2e" borderColor="#1e3a4b" borderWidth={1} padding="$4" borderRadius={18}>
        <XStack alignItems="center" gap="$3"><View width={12} height={12} borderRadius={8} backgroundColor="#22c55e" /><YStack><Text color="#94a3b8" fontSize={12}>RB001 • SIMULATION</Text><Text color="white" fontSize={18} fontWeight="800">{status}</Text></YStack></XStack>
        <Text color="#64748b" marginTop="$3">Sự kiện cuối: {lastEvent}</Text>
        {progress.total > 0 && <Text color="#2dd4bf" marginTop="$2">Waypoint {progress.index}/{progress.total}</Text>}
      </Card>
      <ScrollView contentContainerStyle={{ paddingVertical: 16, gap: 12 }}>
        <Button size="$5" backgroundColor="#00a550" onPress={() => router.push('/product-search' as any)} icon={<MapPin color="white" size={20} />}>
          <Text color="white" fontWeight="900">Tìm sản phẩm & dẫn robot</Text>
        </Button>
        <Button size="$5" backgroundColor="#2563eb" onPress={dispatchMap} icon={<Bot color="white" size={20} />}>
          <Text color="white" fontWeight="900">Chạy toàn bộ map (4 zone)</Text>
        </Button>
        <Button size="$5" backgroundColor="#b45309" onPress={() => robotSimulation.simulateObstacle()} icon={<ShieldAlert color="white" size={20} />}>
          <Text color="white" fontWeight="900">Mô phỏng vật cản + xin nhường đường</Text>
        </Button>
        <Button size="$5" backgroundColor="#0e7490" onPress={() => robotSimulation.resume()} icon={<Bot color="white" size={20} />}>
          <Text color="white" fontWeight="900">Đã thông đường — cho robot đi tiếp</Text>
        </Button>
        <Button size="$5" backgroundColor="#dc2626" onPress={() => robotSimulation.stop('Đã dừng khẩn cấp')} icon={<OctagonX color="white" size={20} />}>
          <Text color="white" fontWeight="900">Dừng robot</Text>
        </Button>
        <Button chromeless onPress={() => speak(status)} icon={<Volume2 color="#2dd4bf" size={18} />}>
          <Text color="#2dd4bf">Đọc trạng thái bằng giọng nói</Text>
        </Button>
      </ScrollView>
    </View>
  );
}
