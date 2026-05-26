import React, { useState, useEffect, useRef } from 'react';
import { TextInput, ScrollView, Pressable, Image as RNImage } from 'react-native';
import { View, Text, XStack, YStack, Button, Input, Image, Card } from 'tamagui';
import { Search, Mic, X, MapPin, Navigation, ShoppingCart, Volume2, Sparkles, HelpCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useRobotVoice, useVoiceRouter } from '../../hooks/useRobotVoice';

// CƠ SỞ DỮ LIỆU SẢN PHẨM TRỰC QUAN
const PRODUCT_DATABASE = [
  {
    id: 'cam1',
    name: 'Nước ép cam nguyên chất Tipco',
    price: '38.000đ',
    originalPrice: '45.000đ',
    badge: 'Bán chạy',
    badgeColor: '#ef4444',
    image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=80',
    location: 'Kệ số 2 - Dãy C',
    distance: '3.5m',
    voiceText: 'Tôi đã tìm thấy Nước ép cam nguyên chất Tipco có giá 38.000 đồng, nằm ngay tại Kệ số 2 dãy C bên tay phải của bạn.',
    keywords: ['cam', 'nước', 'nước ép']
  },
  {
    id: 'cam2',
    name: 'Nước cam sành tự nhiên tươi ngon',
    price: '25.000đ',
    originalPrice: '',
    badge: 'Mới',
    badgeColor: '#22c55e',
    image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400&q=80',
    location: 'Kệ số 2 - Dãy C',
    distance: '3.7m',
    voiceText: 'Nước cam sành tự nhiên có giá 25.000 đồng, cũng nằm ở Kệ số 2 dãy C khu nước giải khát.',
    keywords: ['cam', 'nước', 'nước ép']
  },
  {
    id: 'ga1',
    name: 'Đùi gà tươi CP (Khay 500g)',
    price: '62.000đ',
    originalPrice: '75.000đ',
    badge: 'Khuyến mãi',
    badgeColor: '#f97316',
    image: 'https://images.unsplash.com/photo-1587593817642-87a7f729f37a?w=400&q=80',
    location: 'Kệ số 4 - Dãy A',
    distance: '12m',
    voiceText: 'Đùi gà tươi CP khay 500 gam đang giảm giá còn 62.000 đồng, nằm ở Kệ số 4 dãy A khu thực phẩm tươi sống.',
    keywords: ['gà', 'đùi gà']
  },
  {
    id: 'sua1',
    name: 'Sữa tươi Tiệt trùng Vinamilk 1L',
    price: '32.000đ',
    originalPrice: '',
    badge: '100% Sữa sạch',
    badgeColor: '#3b82f6',
    image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&q=80',
    location: 'Kệ số 1 - Dãy D',
    distance: '5.2m',
    voiceText: 'Sữa tươi tiệt trùng Vinamilk 1 lít có giá 32.000 đồng, ở Kệ số 1 dãy D khu sữa bơ.',
    keywords: ['sữa', 'sữa tươi']
  },
  {
    id: 'rau1',
    name: 'Rau xà lách Organic sạch 300g',
    price: '18.000đ',
    originalPrice: '22.000đ',
    badge: 'Organic',
    badgeColor: '#10b981',
    image: 'https://images.unsplash.com/photo-1556801712-76c8eb07bbc9?w=400&q=80',
    location: 'Kệ số 3 - Dãy B',
    distance: '2.1m',
    voiceText: 'Rau xà lách organic khay 300 gam có giá 18.000 đồng, nằm ở Kệ số 3 dãy B khu rau quả tươi.',
    keywords: ['rau', 'xà lách']
  },
  {
    id: 'tao1',
    name: 'Táo chín đỏ Envy Mỹ ngọt mát',
    price: '89.000đ',
    originalPrice: '110.000đ',
    badge: 'Bán chạy',
    badgeColor: '#ef4444',
    image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400&q=80',
    location: 'Kệ số 5 - Dãy B',
    distance: '8.4m',
    voiceText: 'Táo chín đỏ Envy Mỹ đang giảm giá còn 89.000 đồng, ở Kệ số 5 dãy B khu hoa quả tươi nhập khẩu.',
    keywords: ['táo', 'táo envy']
  }
];

export default function MemberSearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useVoiceRouter();
  const params = useLocalSearchParams();
  const { speak, stop } = useRobotVoice();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<typeof PRODUCT_DATABASE>([]);
  const inputRef = useRef<TextInput>(null);

  const initialQuery = (params.query as string) || '';

  // Xử lý khi có query truyền từ trang Voice Search hoặc click gợi ý
  useEffect(() => {
    if (initialQuery) {
      const cleanQ = initialQuery.toLowerCase().trim();
      setSearchQuery(initialQuery);
      setIsSearching(true);

      // Lọc sản phẩm
      const filtered = PRODUCT_DATABASE.filter(p =>
        p.keywords.some(k => cleanQ.includes(k) || k.includes(cleanQ)) ||
        p.name.toLowerCase().includes(cleanQ)
      );
      setResults(filtered);

      // Phát âm thanh giọng nói của Robot về vị trí sản phẩm thông qua FPT.AI
      if (filtered.length > 0) {
        speak(filtered[0].voiceText);
      } else {
        speak(`Tôi đã tìm kiếm ${initialQuery} nhưng chưa thấy trên hệ thống kệ hàng hiện tại.`);
      }
    } else {
      speak('Tôi đã sẵn sàng tìm kiếm. Hãy nhập tên sản phẩm hoặc nói tên món bạn cần nhé!');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }

    return () => {
      stop();
    };
  }, [initialQuery]);

  // Thực hiện tìm kiếm khi người dùng nhấn Confirm
  const executeSearch = (query: string) => {
    if (!query.trim()) {
      speak('Quý khách vui lòng nhập hoặc nói tên sản phẩm cần tìm!');
      return;
    }
    setIsSearching(true);
    const cleanQ = query.toLowerCase().trim();

    // Lọc sản phẩm
    const filtered = PRODUCT_DATABASE.filter(p =>
      p.keywords.some(k => cleanQ.includes(k) || k.includes(cleanQ)) ||
      p.name.toLowerCase().includes(cleanQ)
    );
    setResults(filtered);

    if (filtered.length > 0) {
      speak(filtered[0].voiceText);
    } else {
      speak(`Bắt đầu tìm kiếm ${query}. Robot đang quét hệ thống kệ hàng nhưng sản phẩm này chưa có sẵn.`);
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    setIsSearching(false);
    setResults([]);
    stop();
    inputRef.current?.focus();
  };

  const handlePopularSearch = (item: string) => {
    setSearchQuery(item);
    executeSearch(item);
  };

  const handleProductVoiceSpeak = (voiceText: string) => {
    speak(voiceText);
  };

  return (
    <View flex={1} backgroundColor="#f4f7f5" paddingLeft={Math.max(insets.left, 24)} paddingRight={Math.max(insets.right, 24)} paddingTop={insets.top + 16} paddingBottom={insets.bottom + 16}>

      {/* HEADER SECTION */}
      <XStack justifyContent="space-between" alignItems="center" marginBottom="$5">
        <XStack gap="$3" alignItems="center">
          <RNImage
            source={require('../../../assets/images/logocute.png')}
            style={{ width: 46, height: 46, borderRadius: 10, resizeMode: 'contain' }}
          />
          <YStack gap="$0.5">
            <Text fontSize={18} fontWeight="bold" color="#005b2b">SmartMarketBot</Text>
            <Text fontSize={11} color="#666">Robot Unit 01 • Sẵn sàng tìm kiếm</Text>
          </YStack>
        </XStack>

        <Button
          backgroundColor="#e2e8f0"
          borderRadius={20}
          paddingHorizontal="$4"
          height={38}
          onPress={() => {
            stop();
            router.back();
          }}
          pressStyle={{ scale: 0.95, backgroundColor: '#cbd5e1' }}
        >
          <Text color="#475569" fontSize={13} fontWeight="bold">✕ Hủy</Text>
        </Button>
      </XStack>

      {/* SEARCH INPUT FIELD */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <XStack
          backgroundColor="white"
          borderWidth={1.5}
          borderColor="#e2e8f0"
          borderRadius={35}
          paddingLeft="$5"
          paddingRight="$2"
          height={64}
          alignItems="center"
          gap="$2"
          shadowColor="#00A550"
          shadowRadius={10}
          shadowOpacity={0.03}
          style={{ elevation: 2 }}
          marginBottom="$5"
        >
          <Input
            ref={inputRef as any}
            flex={1}
            backgroundColor="transparent"
            borderWidth={0}
            fontSize={16}
            color="#333"
            placeholder="Nhập tên sản phẩm bạn cần tìm..."
            placeholderTextColor={"#aaa" as any}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => executeSearch(searchQuery)}
            returnKeyType="search"
            height={50}
            style={{ paddingHorizontal: 0 }}
          />

          {searchQuery ? (
            <Button
              circular
              size="$3"
              chromeless
              icon={<X size={18} color="#999" />}
              onPress={handleClear}
            />
          ) : null}

          <Button
            backgroundColor="#22c55e"
            borderRadius={30}
            paddingHorizontal="$6"
            height={48}
            onPress={() => executeSearch(searchQuery)}
            pressStyle={{ scale: 0.96, backgroundColor: '#16a34a' }}
          >
            <Text color="white" fontSize={14} fontWeight="bold">Tìm kiếm</Text>
          </Button>
        </XStack>
      </Animated.View>

      {/* HIỂN THỊ KẾT QUẢ TÌM KIẾM ĐẲNG CẤP BẰNG VOICE */}
      {isSearching ? (
        <YStack flex={1} gap="$4">
          <XStack justifyContent="space-between" alignItems="center">
            <XStack alignItems="center" gap="$2">
              <Sparkles size={16} color="#00A550" />
              <Text fontSize={14} fontWeight="800" color="#333" letterSpacing={0.5}>
                ĐÃ TÌM THẤY {results.length} SẢN PHẨM KHỚP VỚI GIỌNG NÓI
              </Text>
            </XStack>
          </XStack>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
            {results.length > 0 ? (
              <YStack gap="$4">
                {results.map((product, index) => (
                  <Animated.View key={product.id} entering={FadeInDown.delay(index * 100).duration(400)}>
                    <Card
                      borderWidth={1}
                      borderColor="#e2ede5"
                      borderRadius={24}
                      backgroundColor="white"
                      padding="$4"
                      shadowColor="#00A550"
                      shadowRadius={15}
                      shadowOpacity={0.02}
                      style={{ elevation: 2 }}
                    >
                      <XStack gap="$4" alignItems="center">
                        {/* Image & Badge */}
                        <View position="relative" width={110} height={110} borderRadius={16} overflow="hidden" backgroundColor="#f5f5f5">
                          <Image src={product.image} width="100%" height="100%" objectFit="cover" />
                          <View position="absolute" top={6} left={6} backgroundColor={product.badgeColor} paddingHorizontal="$2" paddingVertical="$0.5" borderRadius={8}>
                            <Text color="white" fontSize={9} fontWeight="bold">{product.badge}</Text>
                          </View>
                        </View>

                        {/* Product Info & Shelf Position */}
                        <YStack flex={1} gap="$1.5">
                          <Text fontSize={15} fontWeight="bold" color="#333" numberOfLines={1}>{product.name}</Text>

                          <XStack gap="$2" alignItems="center">
                            {product.originalPrice ? (
                              <Text fontSize={12} color="#999" textDecorationLine="line-through">{product.originalPrice}</Text>
                            ) : null}
                            <Text fontSize={16} fontWeight="900" color="#00A550">{product.price}</Text>
                          </XStack>

                          {/* Futuristic Kiosk Location Indicator */}
                          <XStack backgroundColor="#f0fdf4" borderWidth={1} borderColor="#d1fae5" borderRadius={12} paddingHorizontal="$3" paddingVertical="$1.5" alignItems="center" gap="$2" marginTop="$1">
                            <MapPin size={13} color="#005b2b" />
                            <YStack>
                              <Text fontSize={11} fontWeight="bold" color="#005b2b">{product.location}</Text>
                              <Text fontSize={9} color="#059669">Khoảng cách: {product.distance}</Text>
                            </YStack>
                          </XStack>
                        </YStack>

                        {/* Interactive Voice and Direction CTA Buttons */}
                        <YStack gap="$2" justifyContent="center">
                          {/* Voice Speak Product Location */}
                          <Button
                            circular
                            size="$3.5"
                            backgroundColor="#eff6ff"
                            borderWidth={1}
                            borderColor="#bfdbfe"
                            icon={<Volume2 size={16} color="#2563eb" />}
                            pressStyle={{ scale: 0.9, backgroundColor: '#dbeafe' }}
                            onPress={() => handleProductVoiceSpeak(product.voiceText)}
                          />

                          {/* Navigation Guide */}
                          <Button
                            circular
                            size="$3.5"
                            backgroundColor="#f0fdf4"
                            borderWidth={1}
                            borderColor="#bbf7d0"
                            icon={<Navigation size={16} color="#16a34a" />}
                            pressStyle={{ scale: 0.9, backgroundColor: '#dcfce7' }}
                            onPress={() => speak(`Bắt đầu dẫn đường tới ${product.name} tại ${product.location}. Mời quý khách di chuyển theo mũi tên chỉ dẫn.`)}
                          />
                        </YStack>
                      </XStack>
                    </Card>
                  </Animated.View>
                ))}
              </YStack>
            ) : (
              <YStack alignItems="center" gap="$4" paddingVertical="$10">
                <HelpCircle size={48} color="#ccc" />
                <Text fontSize={14} color="#666" textAlign="center">
                  Rất tiếc, Robot chưa tìm thấy sản phẩm "{searchQuery}" trên kệ hàng của chi nhánh này.
                </Text>
                <Button size="$3" backgroundColor="#22c55e" color="white" onPress={handleClear}>
                  Thử tìm kiếm từ khóa khác
                </Button>
              </YStack>
            )}
          </ScrollView>
        </YStack>
      ) : (
        /* POPULAR searches (Chỉ hiện khi chưa tìm kiếm) */
        <Animated.View entering={FadeInDown.delay(100).duration(450)}>
          <YStack gap="$3" marginBottom="$6">
            <XStack alignItems="center" gap="$1.5">
              <Text fontSize={10} fontWeight="900" color="#666" letterSpacing={0.5}>📈 TÌM KIẾM PHỔ BIẾN</Text>
            </XStack>

            <XStack gap="$3" flexWrap="wrap">
              {[
                { label: '🍴 Đùi gà CP', value: 'Đùi gà CP' },
                { label: '🥛 Sữa tươi', value: 'Sữa tươi' },
                { label: '🥬 Rau xà lách', value: 'Rau xà lách' },
                { label: '🍎 Táo Envy', value: 'Táo Envy' }
              ].map((item, idx) => (
                <Button
                  key={idx}
                  backgroundColor="#e6ede8"
                  borderWidth={1}
                  borderColor="#d1dfd5"
                  borderRadius={12}
                  height={36}
                  paddingHorizontal="$3.5"
                  onPress={() => handlePopularSearch(item.value)}
                  pressStyle={{ backgroundColor: '#ccdcd1', scale: 0.95 }}
                >
                  <Text fontSize={12} color="#1b4d24" fontWeight="600">{item.label}</Text>
                </Button>
              ))}

              <Button
                backgroundColor="#f1f5f9"
                borderWidth={1}
                borderColor="#e2e8f0"
                borderRadius={12}
                height={36}
                paddingHorizontal="$3.5"
                onPress={() => speak('Xem thêm các tìm kiếm phổ biến')}
                pressStyle={{ backgroundColor: '#e2e8f0', scale: 0.95 }}
              >
                <Text fontSize={12} color="#475569" fontWeight="600">💬 Xem thêm</Text>
              </Button>
            </XStack>
          </YStack>
        </Animated.View>
      )}

      {/* FLOATING MIC BUTTON - Click leads directly to Futuristic Voice Search Screen */}
      <View
        position="absolute"
        bottom={30}
        right={30}
        zIndex={200}
      >
        <Animated.View entering={ZoomIn.delay(300)}>
          <Button
            circular
            size="$4.5"
            backgroundColor="#d1ebd8"
            borderWidth={1.5}
            borderColor="#a3d9b2"
            style={{ elevation: 4 }}
            pressStyle={{ scale: 0.92, backgroundColor: '#a3d9b2' }}
            icon={<Mic size={20} color="#005b2b" />}
            onPress={() => {
              stop();
              router.push('/voice-search' as any);
            }}
          />
        </Animated.View>
      </View>

    </View>
  );
}
