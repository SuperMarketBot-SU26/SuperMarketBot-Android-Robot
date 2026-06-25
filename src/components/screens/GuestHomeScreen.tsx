import React, { useEffect, useState, useRef } from 'react';
import { ScrollView, Pressable } from 'react-native';
import { View, Text, XStack, YStack, Button, Card, Avatar } from 'tamagui';
import { Mic, Camera, Search, MapPin, QrCode, Bot, User, Settings, LogOut, ShoppingCart } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp, FadeInRight, FadeOutUp, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useRobotVoice, isRobotVoiceSpeaking } from '../../hooks/useRobotVoice';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';


// Dữ liệu mẫu Sản phẩm
const HOT_PRODUCTS = [
  {
    id: '1',
    name: 'Súp lơ xanh Organic',
    oldPrice: '45.000đ',
    newPrice: '36.000đ',
    badge: '-20%',
    badgeColor: '#eab308', // Vàng
    image: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=400&q=80'
  },
  {
    id: '2',
    name: 'Cà chua bi Đà Lạt',
    oldPrice: '',
    newPrice: '28.000đ',
    badge: 'Bán chạy',
    badgeColor: '#f97316', // Cam
    image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&q=80'
  },
  {
    id: '3',
    name: 'Dứa mật MD2',
    oldPrice: '65.000đ',
    newPrice: '52.000đ',
    badge: 'HOT',
    badgeColor: '#ef4444', // Đỏ
    image: 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=400&q=80'
  },
  {
    id: '4',
    name: 'Bơ sáp loại 1',
    oldPrice: '80.000đ',
    newPrice: '68.000đ',
    badge: '-15%',
    badgeColor: '#eab308',
    image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=400&q=80'
  }
];

export default function GuestHomeScreen() {
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const { speak, stop, isSpeaking } = useRobotVoice();

  // Trạng thái điều hướng bằng giọng nói cho Camera Quét sản phẩm
  const [shouldNavigateToImageSearch, setShouldNavigateToImageSearch] = useState(false);
  const imageSearchSpeakingStarted = useRef<boolean>(false);

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

  const handleLogout = () => {
    setMenuOpen(false);
    router.replace('/role-selection' as any);
  };

  // Animation bồng bềnh cho Bot Widget
  const botFloat = useSharedValue(0);
  useEffect(() => {
    botFloat.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 1500 }),
        withTiming(0, { duration: 1500 })
      ),
      -1,
      true
    );
  }, []);

  const botFloatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: botFloat.value }]
  }));

  return (
    <View flex={1} backgroundColor="#fcfdfd" paddingLeft={Math.max(insets.left, 0)} paddingRight={Math.max(insets.right, 30)}>

      {/* HEADER */}
      <XStack width="100%" justifyContent="space-between" alignItems="center" paddingHorizontal="$6" paddingVertical="$4" backgroundColor="white" borderBottomWidth={1} borderBottomColor="#f0f0f0" zIndex={100}>
        <Text fontSize={22} fontWeight="900" color="#00A550">SmartMarketBot</Text>

        <XStack alignItems="center" gap="$5">
          {/* Location Badge */}
          <XStack backgroundColor="#f0fdf4" paddingHorizontal="$3" paddingVertical="$1.5" borderRadius={20} alignItems="center" gap="$1.5">
            <MapPin size={14} color="#00A550" />
            <Text fontSize={12} color="#00A550" fontWeight="bold">Cửa hàng Quận 1</Text>
          </XStack>

          <View width={1} height={20} backgroundColor="#e0e0e0" />

          {/* Guest Avatar with Dropdown */}
          <View position="relative" zIndex={100}>
            <XStack
              alignItems="center"
              gap="$3"
              onPress={() => setMenuOpen(!menuOpen)}
              cursor="pointer"
            >
              <Avatar circular size="$3" style={{ borderWidth: 2, borderColor: menuOpen ? '#00A550' : 'transparent' }}>
                <Avatar.Image src="https://i.pravatar.cc/150?u=guest" />
                <Avatar.Fallback backgroundColor="#e0e0e0" />
              </Avatar>
            </XStack>

            {/* Dropdown Menu */}
            {menuOpen && (
              <Animated.View
                entering={FadeInUp.duration(300).springify()}
                exiting={FadeOutUp.duration(200)}
                style={{
                  position: 'absolute',
                  top: '120%',
                  right: 0,
                  width: 200,
                  backgroundColor: 'white',
                  borderRadius: 12,
                  shadowColor: 'black',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.1,
                  shadowRadius: 20,
                  elevation: 5,
                  borderWidth: 1,
                  borderColor: '#f0f0f0',
                  overflow: 'hidden'
                }}
              >
                <Button
                  justifyContent="flex-start"
                  backgroundColor="transparent"
                  borderRadius={0}
                  icon={<User size={18} color="#555" />}
                  onPress={() => setMenuOpen(false)}
                >
                  <Text color="#333" fontWeight="500">Hồ sơ cá nhân</Text>
                </Button>

                <Button
                  justifyContent="flex-start"
                  backgroundColor="transparent"
                  borderRadius={0}
                  icon={<Settings size={18} color="#555" />}
                  onPress={() => setMenuOpen(false)}
                >
                  <Text color="#333" fontWeight="500">Cài đặt</Text>
                </Button>

                <View width="100%" height={1} backgroundColor="#f0f0f0" />

                <Button
                  justifyContent="flex-start"
                  backgroundColor="#fff1f2"
                  borderRadius={0}
                  icon={<LogOut size={18} color="#e11d48" />}
                  pressStyle={{ backgroundColor: '#ffe4e6' }}
                  onPress={handleLogout}
                >
                  <Text color="#e11d48" fontWeight="bold">Đăng xuất</Text>
                </Button>
              </Animated.View>
            )}
          </View>
        </XStack>
      </XStack>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>

        {/* BANNER SECTION */}
        <Animated.View entering={FadeInDown.duration(600).springify()}>
          <Card size="$4" borderRadius={24} padding="$6" backgroundColor="#f2fcf5" overflow="hidden" marginBottom="$6">
            <YStack justifyContent="space-between" alignItems="center" gap="$4">
              <YStack flex={1} gap="$4" maxWidth={600}>
                <Text fontSize={18} fontWeight="bold" color="$textPrimary">
                  Chào quý khách! Sẵn sàng mua sắm cùng <Text color="#00A550">SmartMarketBot</Text> chứ?
                </Text>
                <Text fontSize={14} color="$textSecondary" lineHeight={22}>
                  Khám phá hàng ngàn sản phẩm tươi ngon mỗi ngày với sự trợ giúp của AI thông minh.
                </Text>
                <XStack gap="$3" marginTop="$2">
                  <Button size="$3" backgroundColor="#00A550" color="white" fontWeight="bold" borderRadius={30} paddingHorizontal="$5">
                    Đăng ký Thành viên
                  </Button>
                  <Button size="$3" backgroundColor="transparent" color="#00A550" fontWeight="bold" borderRadius={30} borderWidth={1} borderColor="#00A550" paddingHorizontal="$5">
                    Tìm hiểu thêm
                  </Button>
                </XStack>
              </YStack>

              {/* QR Code Floating Card */}
              <Card size="$2" backgroundColor="white" borderRadius={20} padding="$4" shadowColor="black" shadowRadius={20} shadowOpacity={0.06} alignItems="center" gap="$2" style={{ elevation: 5 }}>
                <View width={80} height={80} backgroundColor="#f9f9f9" borderRadius={10} justifyContent="center" alignItems="center">
                  <QrCode size={40} color="#ccc" />
                </View>
                <Text fontSize={10} color="$textSecondary" fontWeight="bold">Tải App nhận ưu đãi</Text>
              </Card>
            </YStack>
          </Card>
        </Animated.View>

        {/* QUICK ACTIONS SECTION (Dọc) */}
        <YStack gap="$4" marginBottom="$8">

          {/* Giọng nói */}
          <Animated.View entering={FadeInUp.delay(200).duration(500).springify()} style={{ flex: 1 }}>
            <Pressable
              onPress={() => {
                router.push('/voice-search' as any);
              }}
              style={({ pressed }) => ({
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
                flex: 1,
              })}
            >
              <Card size="$3" borderRadius={20} flex={1} padding="$4" backgroundColor="white" shadowColor="black" shadowRadius={15} shadowOpacity={0.03} style={{ elevation: 2 }}>
                <XStack gap="$4" alignItems="center">
                  <View width={50} height={50} borderRadius={16} backgroundColor="#22c55e" justifyContent="center" alignItems="center" shadowColor="#22c55e" shadowRadius={10} shadowOpacity={0.3}>
                    <Mic size={24} color="white" />
                  </View>
                  <YStack flex={1} gap="$1">
                    <Text fontSize={14} fontWeight="bold" color="$textPrimary">Tìm bằng Giọng nói</Text>
                    <Text fontSize={12} color="$textSecondary" numberOfLines={2}>Nói tên món hàng bạn cần</Text>
                  </YStack>
                </XStack>
              </Card>
            </Pressable>
          </Animated.View>

          {/* Camera */}
          <Animated.View entering={FadeInUp.delay(300).duration(500).springify()} style={{ flex: 1 }}>
            <Pressable
              onPress={() => {
                // Nhấn phát đi luôn không cần qua voice trung gian
                router.push('/image-search' as any);
              }}
              style={({ pressed }) => ({
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
                flex: 1,
              })}
            >
              <Card size="$3" borderRadius={20} flex={1} padding="$4" backgroundColor="white" shadowColor="black" shadowRadius={15} shadowOpacity={0.03} style={{ elevation: 2 }}>
                <XStack gap="$4" alignItems="center">
                  <View width={50} height={50} borderRadius={16} backgroundColor="#3b82f6" justifyContent="center" alignItems="center" shadowColor="#3b82f6" shadowRadius={10} shadowOpacity={0.3}>
                    <Camera size={24} color="white" />
                  </View>
                  <YStack flex={1} gap="$1">
                    <Text fontSize={14} fontWeight="bold" color="$textPrimary">Quét sản phẩm</Text>
                    <Text fontSize={12} color="$textSecondary" numberOfLines={2}>Nhận diện & định vị kệ hàng</Text>
                  </YStack>
                </XStack>
              </Card>
            </Pressable>
          </Animated.View>

          {/* Văn bản */}
          <Animated.View entering={FadeInUp.delay(400).duration(500).springify()} style={{ flex: 1 }}>
            <Pressable
              onPress={() => {
                router.push('/member-search' as any);
              }}
              style={({ pressed }) => ({
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
                flex: 1,
              })}
            >
              <Card size="$3" borderRadius={20} flex={1} padding="$4" backgroundColor="white" shadowColor="black" shadowRadius={15} shadowOpacity={0.03} style={{ elevation: 2 }}>
                <XStack gap="$4" alignItems="center">
                  <View width={50} height={50} borderRadius={16} backgroundColor="#22c55e" justifyContent="center" alignItems="center" shadowColor="#22c55e" shadowRadius={10} shadowOpacity={0.3}>
                    <Search size={24} color="white" />
                  </View>
                  <YStack flex={1} gap="$1">
                    <Text fontSize={14} fontWeight="bold" color="$textPrimary">Tìm kiếm văn bản</Text>
                    <Text fontSize={12} color="$textSecondary" numberOfLines={2}>Gõ tên sản phẩm cần tìm</Text>
                  </YStack>
                </XStack>
              </Card>
            </Pressable>
          </Animated.View>

        </YStack>

        {/* HOT PRODUCTS SECTION */}
        <Animated.View entering={FadeInUp.delay(500).duration(600).springify()}>
          <Text fontSize={16} fontWeight="bold" color="$textPrimary" marginBottom="$4">Khuyến mãi HOT hôm nay</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            <XStack gap="$4">
              {HOT_PRODUCTS.map((product) => (
                <Card key={product.id} width={200} borderRadius={20} backgroundColor="white" overflow="hidden" shadowColor="black" shadowRadius={15} shadowOpacity={0.05} style={{ elevation: 3 }}>

                  {/* Product Image & Badge */}
                  <View position="relative" height={130} backgroundColor="#f5f5f5">
                    <Image source={{ uri: product.image }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    <View position="absolute" top={10} left={10} backgroundColor={product.badgeColor} paddingHorizontal="$2" paddingVertical="$1" borderRadius={10}>
                      <Text color="white" fontSize={10} fontWeight="bold">{product.badge}</Text>
                    </View>
                  </View>

                  {/* Product Info */}
                  <YStack padding="$3" gap="$2">
                    <Text fontSize={14} fontWeight="bold" color="$textPrimary" numberOfLines={1}>{product.name}</Text>

                    <XStack justifyContent="space-between" alignItems="flex-end" marginTop="$2">
                      <YStack>
                        {product.oldPrice ? (
                          <Text fontSize={11} color="$textSecondary" textDecorationLine="line-through">{product.oldPrice}</Text>
                        ) : null}
                        <Text fontSize={15} fontWeight="900" color="#00A550">{product.newPrice}</Text>
                      </YStack>

                      <View width={36} height={36} borderRadius={18} backgroundColor="#00A550" justifyContent="center" alignItems="center" shadowColor="#00A550" shadowRadius={5} shadowOpacity={0.3}>
                        <ShoppingCart size={16} color="white" />
                      </View>
                    </XStack>
                  </YStack>

                </Card>
              ))}
            </XStack>
          </ScrollView>
        </Animated.View>

      </ScrollView>

      {/* FLOATING SMARTBOT WIDGET */}
      <Animated.View style={{ position: 'absolute', bottom: 30, right: Math.max(insets.right, 30) }} entering={FadeInRight.delay(800).duration(600).springify()}>
        <Animated.View style={botFloatStyle}>
          <Card borderRadius={24} padding="$4" backgroundColor="white" shadowColor="black" shadowRadius={30} shadowOpacity={0.1} style={{ elevation: 10, borderWidth: 1, borderColor: '#f0fcf4' }}>

            {/* Top Green Glow */}
            <View position="absolute" top={0} left={20} right={20} height={40} backgroundColor="#00A550" opacity={0.1} />

            <YStack alignItems="center" gap="$3">
              <View width={60} height={60} borderRadius={30} backgroundColor="#f0fdf4" justifyContent="center" alignItems="center" borderWidth={2} borderColor="#00A550">
                <Bot size={32} color="#00A550" />
              </View>

              <YStack alignItems="center" gap="$1">
                <Text fontSize={12} fontWeight="900" color="#111">SmartBot v2.1</Text>
                <XStack alignItems="center" gap="$1.5">
                  <View width={6} height={6} borderRadius={3} backgroundColor="#00A550" />
                  <Text fontSize={9} color="#00A550" fontWeight="bold">Đang hoạt động</Text>
                </XStack>
              </YStack>

              <View width="100%" height={1} backgroundColor="#f0f0f0" marginVertical="$1" />

              <YStack alignItems="center">
                <Text fontSize={9} color="#888" fontWeight="bold">VỊ TRÍ</Text>
                <Text fontSize={11} color="$textPrimary" fontWeight="bold">Cửa ra vào</Text>
              </YStack>
            </YStack>

          </Card>
        </Animated.View>
      </Animated.View>

    </View>
  );
}
