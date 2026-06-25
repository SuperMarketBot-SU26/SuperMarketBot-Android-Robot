import React, { useState, useEffect, useRef } from 'react';
import { ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, XStack, YStack, Button, Card, Image } from 'tamagui';
import { Search, Mic, Camera, Tag, Clock, Utensils, TrendingDown, Sparkles, ArrowRight } from 'lucide-react-native';
import { MemberHeader } from '../layout/MemberHeader';
import { useVoiceRouter, useRobotVoice, isRobotVoiceSpeaking } from '../../hooks/useRobotVoice';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';

export default function MemberHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useVoiceRouter();
  const { speak, stop, isSpeaking } = useRobotVoice();

  // Trạng thái điều hướng bằng giọng nói cho Camera Quét sản phẩm
  const [shouldNavigateToImageSearch, setShouldNavigateToImageSearch] = useState(false);
  const imageSearchSpeakingStarted = useRef(false);

  useEffect(() => {
    if (shouldNavigateToImageSearch) {
      if (isSpeaking) {
        imageSearchSpeakingStarted.current = true;
      } else if (imageSearchSpeakingStarted.current) {
        setShouldNavigateToImageSearch(false);
        imageSearchSpeakingStarted.current = false;
        router.push('/image-search' as any);
      }
    }
  }, [isSpeaking, shouldNavigateToImageSearch]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, []);

  // Animated values for Card 4 (Ưu đãi cho bạn)
  const scale = useSharedValue(1);
  const borderCol = useSharedValue('#f0fcf4');
  const progressWidth = useSharedValue(0);

  // Animated values for Card 1 (Tìm kiếm sản phẩm)
  const card1Scale = useSharedValue(1);

  const animatedCardStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      borderColor: borderCol.value,
    };
  });

  const animatedCard1Style = useAnimatedStyle(() => {
    return {
      transform: [{ scale: card1Scale.value }],
    };
  });

  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      width: `${progressWidth.value}%`,
    };
  });

  const AnimatedView = Animated.createAnimatedComponent(View);

  return (
    <View flex={1} backgroundColor="#f9fbf9" paddingTop={insets.top} paddingLeft={Math.max(insets.left, 0)} paddingRight={Math.max(insets.right, 0)}>
      <MemberHeader />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24 }}>

        {/* WELCOME SECTION */}
        <YStack gap="$2" marginBottom="$6">
          <Text fontSize={16} color="$textSecondary">
            Chào Duy! Sẵn sàng mua sắm cùng <Text color="#00A550" fontWeight="bold">SmartMarketBot</Text> chứ?
          </Text>
          <Text fontSize={16} color="$textSecondary" maxWidth={600}>
            Hôm nay hệ thống đã chuẩn bị sẵn danh sách thực phẩm tươi sống nhất dành riêng cho gia đình bạn.
          </Text>
        </YStack>
        {/* QUICK ACTIONS SECTION (Lưới 2x2) */}
        <YStack gap="$4" marginBottom="$8">
          <XStack gap="$4">

          {/* Card 1: Tìm kiếm */}
          <Pressable
            style={{ flex: 1 }}
            onPressIn={() => {
              card1Scale.value = withSpring(0.93);
            }}
            onPressOut={() => {
              card1Scale.value = withSpring(1);
            }}
            onPress={() => {
              router.push('/member-search' as any);
            }}
          >
            <AnimatedView
              style={[{
                flex: 1,
                borderWidth: 1,
                borderRadius: 24,
                padding: 16,
                backgroundColor: 'white',
                borderColor: '#f0fcf4',
                shadowColor: '#00A550',
                shadowOffset: { width: 0, height: 4 },
                shadowRadius: 15,
                shadowOpacity: 0.03,
                elevation: 2,
                height: '100%',
              }, animatedCard1Style]}
            >
              <YStack justifyContent="space-between" flex={1} gap="$4">
                <XStack justifyContent="space-between" alignItems="flex-start">
                  <View width={50} height={50} borderRadius={25} backgroundColor="#f0fdf4" justifyContent="center" alignItems="center">
                    <Search size={22} color="#00A550" />
                  </View>
                </XStack>
                <YStack gap="$1.5">
                  <Text fontSize={16} fontWeight="bold" color="#333">Tìm kiếm sản phẩm</Text>
                  <Text fontSize={13} color="#888" lineHeight={18}>Nhập tên món hàng bạn cần tìm, SmartBot sẽ dẫn bạn đến đúng vị trí.</Text>
                </YStack>
                <XStack backgroundColor="white" borderWidth={1} borderColor="#e5e7eb" borderRadius={30} paddingHorizontal="$4" height={44} alignItems="center" gap="$2" marginTop="auto">
                  <Text color="#aaa" fontSize={13} flex={1} numberOfLines={1}>Tìm sản phẩm...</Text>
                  <Search size={16} color="#00A550" />
                </XStack>
              </YStack>
            </AnimatedView>
          </Pressable>

          {/* Card 2: Giọng nói */}
          <Pressable
            style={{ flex: 1 }}
            onPress={() => {
              router.push('/voice-search' as any);
            }}
          >
            <Card size="$4" borderWidth={1} borderRadius={24} flex={1} padding="$4" backgroundColor="white" borderColor="#f0fcf4" shadowColor="#00A550" shadowRadius={15} shadowOpacity={0.03} style={{ elevation: 2, height: '100%' }}>
              <YStack justifyContent="space-between" flex={1} gap="$4">
                <View width={50} height={50} borderRadius={25} backgroundColor="#22c55e" justifyContent="center" alignItems="center" shadowColor="#22c55e" shadowRadius={8} shadowOpacity={0.3}>
                  <Mic size={22} color="white" />
                </View>
                <YStack gap="$1.5">
                  <Text fontSize={16} fontWeight="bold" color="#333">Tìm bằng Giọng nói</Text>
                  <Text fontSize={13} color="#888" lineHeight={18}>Nói tên món hàng bạn cần, SmartBot sẽ dẫn bạn đến tận kệ hàng.</Text>
                </YStack>
                <XStack alignItems="center" gap="$2" marginTop="auto" height={44}>
                  <Text color="#00A550" fontWeight="bold" fontSize={13} numberOfLines={1}>Nhấn để nói</Text>
                  <Mic size={16} color="#00A550" />
                </XStack>
              </YStack>
            </Card>
          </Pressable>

          </XStack>
          <XStack gap="$4">

          {/* Card 3: Camera */}
          <Pressable
            style={{ flex: 1 }}
            onPress={() => {
              router.push('/image-search' as any);
            }}
          >
            <Card size="$4" borderWidth={1} borderRadius={24} flex={1} padding="$4" backgroundColor="white" borderColor="#f0fcf4" shadowColor="#00A550" shadowRadius={15} shadowOpacity={0.03} style={{ elevation: 2, height: '100%' }}>
              <YStack justifyContent="space-between" flex={1} gap="$4">
                <View width={50} height={50} borderRadius={25} backgroundColor="#eff6ff" justifyContent="center" alignItems="center">
                  <Camera size={22} color="#3b82f6" />
                </View>
                <YStack gap="$1.5">
                  <Text fontSize={16} fontWeight="bold" color="#333">Quét sản phẩm</Text>
                  <Text fontSize={13} color="#888" lineHeight={18}>Nhận diện & định vị kệ hàng thông qua camera AI thời gian thực.</Text>
                </YStack>
                <XStack alignItems="center" gap="$2" marginTop="auto" height={44}>
                  <Text color="#3b82f6" fontWeight="bold" fontSize={13} numberOfLines={1}>Mở Camera</Text>
                  <Camera size={16} color="#3b82f6" />
                </XStack>
              </YStack>
            </Card>
          </Pressable>

          {/* Card 4: Ưu đãi (Click: /member-offers | Long Press: /member-campaign) */}
          <Pressable
            onPressIn={() => {
              scale.value = withSpring(0.93);
              progressWidth.value = withTiming(100, { duration: 800 });
              borderCol.value = withTiming('#00A550', { duration: 300 });
            }}
            onPressOut={() => {
              scale.value = withSpring(1);
              progressWidth.value = withTiming(0, { duration: 150 });
              borderCol.value = withTiming('#f0fcf4', { duration: 200 });
            }}
            onPress={() => {
              // Click: navigate to Voucher list
              router.push('/member-offers' as any);
            }}
            onLongPress={() => {
              // Long Press: bounce animate and navigate to Attractive Promotions Campaign
              scale.value = withSpring(1.06, {}, () => {
                scale.value = withSpring(1);
              });
              router.push('/member-campaign' as any);
            }}
            delayLongPress={800}
            style={{ flex: 1 }}
          >
            <AnimatedView
              style={[{
                flex: 1,
                borderWidth: 1,
                borderRadius: 24,
                padding: 16,
                backgroundColor: 'white',
                shadowColor: '#00A550',
                shadowOffset: { width: 0, height: 4 },
                shadowRadius: 15,
                shadowOpacity: 0.03,
                elevation: 2,
                overflow: 'hidden',
                position: 'relative',
              }, animatedCardStyle]}
            >
              {/* Visual Loading bar to give feedback for long press */}
              <Animated.View
                style={[{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: 4,
                  backgroundColor: '#00A550',
                }, animatedProgressStyle]}
              />

              <YStack justifyContent="space-between" flex={1} gap="$4">
                <View width={50} height={50} borderRadius={25} backgroundColor="#ecfccb" justifyContent="center" alignItems="center">
                  <Tag size={22} color="#4d7c0f" />
                </View>
                <YStack gap="$1.5">
                  <Text fontSize={16} fontWeight="bold" color="#333">Ưu đãi cho bạn</Text>
                  <Text fontSize={13} color="#888" lineHeight={18}>Khám phá các ưu đãi đặc quyền dành riêng cho thành viên Premium.</Text>
                </YStack>

                <XStack alignItems="center" gap="$2" marginTop="auto" height={44}>
                  <Text color="#00A550" fontWeight="bold" fontSize={13} numberOfLines={2}>Xem Ưu đãi</Text>
                  <ArrowRight size={16} color="#00A550" />
                </XStack>
              </YStack>
            </AnimatedView>
          </Pressable>
          </XStack>
        </YStack>


        {/* SMART SUGGESTIONS SECTION */}
        <XStack justifyContent="space-between" alignItems="center" marginBottom="$4">
          <Text fontSize={18} fontWeight="bold" color="$textPrimary">Gợi ý thông minh cho bạn</Text>
          <Text fontSize={14} fontWeight="bold" color="#00A550">Xem tất cả gợi ý</Text>
        </XStack>

        <YStack gap="$4">

          {/* Suggestion 1: Thói quen */}
          <Card size="$4" borderWidth={1} borderRadius={16} overflow="hidden" backgroundColor="white" borderColor="#f0f0f0" padding="$3">
            <XStack gap="$3">
              <Image src="https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=400" width={100} height={100} borderRadius={12} />
              <YStack flex={1} gap="$2" justifyContent="space-between">
                <YStack gap="$1">
                  <XStack alignItems="center" gap="$1">
                    <Clock size={12} color="#00A550" />
                    <Text fontSize={10} fontWeight="bold" color="#00A550">THÓI QUEN MUA SẮM</Text>
                  </XStack>
                  <Text fontSize={14} fontWeight="bold" color="$textPrimary" numberOfLines={2}>Bạn thường mua sữa vào tuần này</Text>
                </YStack>
                <Button size="$3" borderRadius={12} backgroundColor="#f0fdf4" color="#00A550" fontWeight="bold" fontSize={11} height={32} paddingHorizontal="$3" alignSelf="flex-start">
                  Thêm vào danh sách
                </Button>
              </YStack>
            </XStack>
          </Card>

          {/* Suggestion 2: Món ăn kèm */}
          <Card size="$4" borderWidth={1} borderRadius={16} overflow="hidden" backgroundColor="white" borderColor="#f0f0f0" padding="$3">
            <XStack gap="$3">
              <Image src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=400" width={100} height={100} borderRadius={12} />
              <YStack flex={1} gap="$2" justifyContent="space-between">
                <YStack gap="$1">
                  <XStack alignItems="center" gap="$1">
                    <Utensils size={12} color="#d97706" />
                    <Text fontSize={10} fontWeight="bold" color="#d97706">GỢI Ý MÓN ĂN KÈM</Text>
                  </XStack>
                  <Text fontSize={14} fontWeight="bold" color="$textPrimary" numberOfLines={2}>Salad ức gà cho tối nay?</Text>
                </YStack>
                <Button size="$3" borderRadius={12} backgroundColor="#fffbeb" color="#d97706" fontWeight="bold" fontSize={11} height={32} paddingHorizontal="$3" alignSelf="flex-start">
                  Xem công thức
                </Button>
              </YStack>
            </XStack>
          </Card>

          {/* Suggestion 3: Giá tốt */}
          <Card size="$4" borderWidth={1} borderRadius={16} overflow="hidden" backgroundColor="white" borderColor="#f0f0f0" padding="$3">
            <XStack gap="$3">
              <Image src="https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?q=80&w=400" width={100} height={100} borderRadius={12} />
              <YStack flex={1} gap="$2" justifyContent="space-between">
                <YStack gap="$1">
                  <XStack alignItems="center" gap="$1">
                    <TrendingDown size={12} color="#00A550" />
                    <Text fontSize={10} fontWeight="bold" color="#00A550">GIÁ TỐT HÔM NAY</Text>
                  </XStack>
                  <Text fontSize={14} fontWeight="bold" color="$textPrimary" numberOfLines={2}>Cam Sành đang giảm giá 20%</Text>
                </YStack>
                <Button size="$3" borderRadius={12} backgroundColor="#f0fdf4" color="#00A550" fontWeight="bold" fontSize={11} height={32} paddingHorizontal="$3" alignSelf="flex-start">
                  Mua ngay
                </Button>
              </YStack>
            </XStack>
          </Card>

          {/* Suggestion 4: AI Phân tích */}
          <Card size="$4" borderRadius={16} flex={1} backgroundColor="#fcfdfd" borderColor="#00A550" borderWidth={2} overflow="hidden">
            <View position="absolute" top={0} left={0} right={0} height={4} backgroundColor="#00A550" />
            <YStack padding="$4" gap="$3" flex={1} justifyContent="center" alignItems="center">

              <View width={40} height={40} borderRadius={20} backgroundColor="#e6f5ea" justifyContent="center" alignItems="center">
                <Sparkles size={20} color="#00A550" />
              </View>

              <Text fontSize={11} fontWeight="bold" color="#00A550">AI PHÂN TÍCH</Text>

              <Text fontSize={14} fontWeight="bold" color="$textPrimary" textAlign="center" lineHeight={20}>
                Dựa trên 3 món bạn vừa chọn, bạn có thể cần thêm Hành
              </Text>

              <XStack alignItems="center" gap="$2" backgroundColor="white" paddingHorizontal="$3" paddingVertical="$2" borderRadius={20} borderWidth={1} borderColor="#f0f0f0">
                <YStack>
                  <XStack alignItems="center" gap="$2">
                    <Text fontSize={10} fontWeight="bold" color="$textPrimary">SmartBot v2.4</Text>
                    <View backgroundColor="#e6f5ea" paddingHorizontal="$1" borderRadius={4}>
                      <Text fontSize={8} color="#00A550" fontWeight="bold">85%</Text>
                    </View>
                  </XStack>
                  <Text fontSize={9} color="$textSecondary">Vị trí: Khu vực Thực phẩm khô</Text>
                </YStack>
              </XStack>

              <Button size="$3" width="100%" borderRadius={20} backgroundColor="#00A550" color="white" fontWeight="bold" fontSize={13} marginTop="$2">
                Đồng ý, thêm ngay
              </Button>

            </YStack>
          </Card>

        </YStack>

      </ScrollView>
    </View>
  );
}
