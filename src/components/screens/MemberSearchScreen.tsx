import React, { useState, useEffect, useRef } from 'react';
import { TextInput, ScrollView, Pressable, Image as RNImage } from 'react-native';
import { View, Text, XStack, YStack, Button, Input, Image, Card } from 'tamagui';
import { Search, Mic, X, MapPin, Navigation, ShoppingCart, Volume2, Sparkles, HelpCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useRobotVoice, useVoiceRouter } from '../../hooks/useRobotVoice';
import { SearchService, MobileProductSearchResultDto } from '../../services/SearchService';
import { useRobotAuth } from '../../context/RobotAuthContext';
import { ProductDetailSheet } from '../ui/ProductDetailSheet';

const PRODUCT_DATABASE: any[] = []; // Bỏ qua mảng mock dài

export default function MemberSearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useVoiceRouter();
  const params = useLocalSearchParams();
  const { speak, stop } = useRobotVoice();
  const { token } = useRobotAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const inputRef = useRef<TextInput>(null);

  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const initialQuery = (params.query as string) || '';

  // Xử lý khi có query truyền từ trang Voice Search hoặc click gợi ý
  useEffect(() => {
    if (initialQuery) {
      setSearchQuery(initialQuery);
      executeSearch(initialQuery);
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

  // Map dữ liệu API về format UI
  const mapApiToUI = (items: any[]) => {
    return items.map(p => {
      const formattedPrice = p.unitPrice.toLocaleString('vi-VN') + 'đ';
      const shelf = p.categoryName || 'Kệ chưa xác định';
      return {
        id: p.productId,
        name: p.productName,
        price: formattedPrice,
        originalPrice: p.promotionPrice ? p.promotionPrice.toLocaleString('vi-VN') + 'đ' : null,
        badge: p.status === 'Available' || p.status === 'instock' ? 'Có sẵn' : 'Tạm hết',
        badgeColor: p.status === 'Available' || p.status === 'instock' ? '#22c55e' : '#ef4444',
        image: p.imageUrl || 'https://via.placeholder.com/400',
        location: shelf,
        distance: 'Tính toán...', // Lidar sẽ update sau
        voiceText: `Tôi đã tìm thấy ${p.productName} có giá ${formattedPrice}, nằm tại ${shelf}.`,
        semanticObjectId: null,
        relevanceScore: p.relevanceScore || 0,
        healthTags: p.healthTags || []
      };
    });
  };

  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiRanked, setAiRanked] = useState(false);

  // Thực hiện tìm kiếm khi người dùng nhấn Confirm
  const executeSearch = async (query: string) => {
    if (!query.trim()) {
      speak('Quý khách vui lòng nhập hoặc nói tên sản phẩm cần tìm!');
      return;
    }
    setIsSearching(true);
    setResults([]);
    setAiExplanation(null);
    setAiRanked(false);
    const cleanQ = query.toLowerCase().trim();

    try {
      let searchResponse;
      
      if (token) {
        searchResponse = await SearchService.searchPersonalized({
          q: cleanQ,
          useAi: true,
          token: token
        });
      } else {
        searchResponse = await SearchService.searchAll({
          q: cleanQ,
          useAi: false,
        });
      }

      const formatted = mapApiToUI(searchResponse.results || []);
      setResults(formatted);
      setAiExplanation(searchResponse.aiExplanation || null);
      setAiRanked(searchResponse.aiRanked || false);

      if (formatted.length > 0) {
        speak(formatted[0].voiceText);
      } else {
        speak(`Bắt đầu tìm kiếm ${query}. Robot đang quét hệ thống kệ hàng nhưng sản phẩm này chưa có sẵn.`);
      }
    } catch (error) {
      console.error(error);
      speak(`Xin lỗi, có lỗi kết nối khi tìm kiếm ${query}.`);
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
            placeholder="Tìm kiếm sản phẩm..."
            placeholderTextColor={"#aaa" as any}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => executeSearch(searchQuery)}
            returnKeyType="search"
            height={50}
            style={{ paddingHorizontal: 0 }}
            multiline={false}
            numberOfLines={1}
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
          <XStack justifyContent="space-between" alignItems="center" paddingRight="$4">
            <XStack alignItems="flex-start" gap="$2" flex={1}>
              <Sparkles size={16} color="#00A550" style={{ marginTop: 2 }} />
              <Text fontSize={13} fontWeight="800" color="#333" letterSpacing={0.5} flex={1} flexWrap="wrap" lineHeight={18}>
                ĐÃ TÌM THẤY {results.length} SẢN PHẨM PHÙ HỢP
              </Text>
            </XStack>
          </XStack>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
            {aiExplanation && (
              <Animated.View entering={FadeInDown.delay(100).duration(400)}>
                <Card
                  backgroundColor="#ECFDF5"
                  borderWidth={1}
                  borderColor="#A7F3D0"
                  borderRadius={16}
                  padding="$4"
                  marginBottom="$4"
                >
                  <XStack alignItems="center" gap="$2" marginBottom="$2">
                    <Sparkles size={16} color="#059669" />
                    <Text fontSize={13} fontWeight="bold" color="#047857">Trợ lý AI phân tích</Text>
                  </XStack>
                  <Text fontSize={12} color="#065F46" lineHeight={18}>
                    {aiExplanation}
                  </Text>
                </Card>
              </Animated.View>
            )}

            {results.length > 0 ? (
              <YStack gap="$4">
                {results.map((product, index) => (
                  <Animated.View key={product.id} entering={FadeInDown.delay((index + 1) * 100).duration(400)}>
                    <Pressable onPress={() => { setSelectedProductId(product.id); setSheetOpen(true); }}>
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
                          {product.relevanceScore > 0 && (
                            <XStack backgroundColor="#ECFDF5" alignSelf="flex-start" paddingHorizontal="$2" paddingVertical="$1" borderRadius={6} alignItems="center" gap="$1">
                              <Sparkles size={10} color="#059669" />
                              <Text fontSize={9} fontWeight="bold" color="#059669">
                                Độ phù hợp: {product.relevanceScore}%
                              </Text>
                            </XStack>
                          )}
                          <Text fontSize={15} fontWeight="bold" color="#333" numberOfLines={2} lineHeight={20}>{product.name}</Text>

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
                    </Pressable>
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
        /* TRẠNG THÁI EMPTY LÚC ĐẦU (POPULAR, DANH MỤC, KHUYẾN MÃI) */
        <Animated.View style={{ flex: 1 }} entering={FadeInDown.delay(100).duration(450)}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          <YStack gap="$3" marginBottom="$4">
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

          {/* KHÁM PHÁ DANH MỤC */}
          <Animated.View entering={FadeInDown.delay(200).duration(450)}>
            <YStack gap="$3" marginTop="$2">
              <Text fontSize={11} fontWeight="900" color="#666" letterSpacing={0.5}>🏷️ KHÁM PHÁ DANH MỤC</Text>
              <XStack flexWrap="wrap" justifyContent="space-between" rowGap="$3">
                {[
                  { title: 'Thực phẩm tươi sống', icon: '🥩', color: '#fee2e2' },
                  { title: 'Trái cây nhập khẩu', icon: '🍎', color: '#fef3c7' },
                  { title: 'Nước giải khát', icon: '🥤', color: '#e0f2fe' },
                  { title: 'Bánh kẹo & Đồ ngọt', icon: '🍫', color: '#f3e8ff' },
                ].map((cat, idx) => (
                  <Card 
                    key={idx} 
                    width="48%" 
                    backgroundColor={cat.color} 
                    borderRadius={16} 
                    padding="$3" 
                    pressStyle={{ scale: 0.95 }}
                    onPress={() => {
                      setSearchQuery(cat.title);
                      executeSearch(cat.title);
                    }}
                  >
                    <YStack gap="$2" alignItems="center">
                      <Text fontSize={26}>{cat.icon}</Text>
                      <Text fontSize={13} fontWeight="bold" color="#333" textAlign="center">{cat.title}</Text>
                    </YStack>
                  </Card>
                ))}
              </XStack>
            </YStack>
          </Animated.View>

          {/* KHUYẾN MÃI HÔM NAY BĂNG RÔN (BANNER) */}
          <Animated.View entering={FadeInDown.delay(300).duration(450)}>
            <Card 
              marginTop="$4" 
              backgroundColor="#10B981" 
              borderRadius={20} 
              padding="$4" 
              pressStyle={{ scale: 0.98 }}
              onPress={() => executeSearch('Rau xà lách')}
            >
              <XStack justifyContent="space-between" alignItems="center">
                <YStack gap="$1" flex={1}>
                  <Text color="white" fontSize={11} fontWeight="900" letterSpacing={1}>⚡ GIỜ VÀNG GIÁ SỐC</Text>
                  <Text color="white" fontSize={16} fontWeight="bold">Giảm 50% Rau Củ Sạch</Text>
                  <Text color="rgba(255,255,255,0.9)" fontSize={12} marginTop="$1">Áp dụng đến 12:00 trưa nay</Text>
                </YStack>
                <View backgroundColor="white" borderRadius={30} paddingHorizontal="$4" paddingVertical="$2">
                  <Text color="#10B981" fontWeight="bold" fontSize={12}>Xem ngay</Text>
                </View>
              </XStack>
            </Card>
          </Animated.View>
        </ScrollView>
        </Animated.View>
      )}

      {/* FLOATING MIC BUTTON - Click leads directly to Futuristic Voice Search Screen */}
      <View
        position="absolute"
        bottom={Math.max(insets.bottom, 20) + 30}
        right={24}
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

      <ProductDetailSheet 
        productId={selectedProductId}
        isOpen={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </View>
  );
}
