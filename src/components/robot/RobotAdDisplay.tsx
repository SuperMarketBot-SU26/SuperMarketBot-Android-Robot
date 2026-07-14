import React, { useEffect, useState } from 'react';
import { View, Text, XStack, YStack, Card } from 'tamagui';
import { ActivityIndicator, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { AdService, AdPlaylistItemDto } from '../../services/AdService';
import { Zap } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

interface RobotAdDisplayProps {
  robotId?: number;
  currentZoneId?: number;
  semanticObjectId?: number;
  robotCode?: string;
}

export default function RobotAdDisplay({
  robotId = 1,
  currentZoneId,
  semanticObjectId,
  robotCode = 'ROBOT01'
}: RobotAdDisplayProps) {
  const [playlist, setPlaylist] = useState<AdPlaylistItemDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlaylist();
  }, [semanticObjectId, currentZoneId]);

  const fetchPlaylist = async () => {
    try {
      setLoading(true);
      const data = await AdService.getRobotPlaylist(robotId, semanticObjectId);
      setPlaylist(data.playlist || []);

      // Giả lập ghi nhận impression cho toàn bộ ads tải về khi đang đứng ở slot/zone này
      // Trong thực tế, có thể trigger khi robot đến slot cụ thể
      if (data.playlist && data.playlist.length > 0) {
        await AdService.recordImpression(robotCode, {
          slotId: 10, // Slot giả định
          xCoord: 10,
          yCoord: 20,
          memberId: undefined // Dành cho guest
        });
      }
    } catch (e) {
      console.warn('Failed to fetch robot playlist:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAdClick = async (ad: AdPlaylistItemDto) => {
    try {
      // Ghi nhận tương tác
      await AdService.logInteraction({
        adCampaignId: ad.adCampaignId,
        actionType: 'Click',
        sponsoredId: ad.sponsoredId,
        productId: ad.productId,
        robotId,
        semanticObjectId,
        zoneId: currentZoneId,
      });
      // TODO: Điều hướng sang màn hình chi tiết sản phẩm hoặc mở map
    } catch (e) {
      console.warn('Failed to log interaction:', e);
    }
  };

  if (loading) {
    return (
      <View padding="$4" justifyContent="center" alignItems="center">
        <ActivityIndicator size="small" color="#00A550" />
      </View>
    );
  }

  if (playlist.length === 0) return null;

  return (
    <Animated.View entering={FadeIn.duration(500)}>
      <YStack paddingHorizontal="$4" marginBottom="$6">
        <XStack alignItems="center" gap="$2" marginBottom="$3">
          <Zap size={20} color="#EAB308" />
          <Text fontSize={16} fontWeight="bold" color="$textPrimary">Sản phẩm tài trợ nổi bật</Text>
        </XStack>
        
        <XStack gap="$4">
          {playlist.map((ad, idx) => (
            <TouchableOpacity key={`ad-${ad.sponsoredId}-${idx}`} onPress={() => handleAdClick(ad)}>
              <Card width={220} borderRadius={16} overflow="hidden" shadowColor="black" shadowRadius={15} shadowOpacity={0.08} style={{ elevation: 4 }}>
                <View position="relative" height={140} backgroundColor="#f9f9f9">
                  <Image source={{ uri: ad.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  <View position="absolute" top={8} left={8} backgroundColor="#EAB308" paddingHorizontal="$2" paddingVertical="$1" borderRadius={8}>
                    <Text color="white" fontSize={10} fontWeight="bold">Tài trợ</Text>
                  </View>
                </View>
                <YStack padding="$3">
                  <Text fontSize={14} fontWeight="bold" color="$textPrimary" numberOfLines={1}>{ad.productName}</Text>
                  <Text fontSize={15} fontWeight="900" color="#00A550" marginTop="$2">{ad.productPrice.toLocaleString('vi-VN')} đ</Text>
                </YStack>
              </Card>
            </TouchableOpacity>
          ))}
        </XStack>
      </YStack>
    </Animated.View>
  );
}
