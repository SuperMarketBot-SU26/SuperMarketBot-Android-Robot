import React, { useState, useEffect, useRef } from 'react';
import { TextInput, ScrollView, Pressable, Image as RNImage, Alert, TouchableOpacity } from 'react-native';
import { View, Text, XStack, YStack, Button, Input, Image, Card } from 'tamagui';
import { Search, Mic, X, MapPin, ShoppingCart, Volume2, Sparkles, HelpCircle, Beef, Fish, Wheat, Carrot, Apple, Droplets, Milk, Coffee, ShoppingBag, Egg, CupSoda, Cookie, Snowflake, Drumstick, Navigation } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, ZoomIn, useSharedValue, withRepeat, withTiming, withSequence, useAnimatedStyle, Easing, interpolateColor } from 'react-native-reanimated';
import { useRobotVoice, useVoiceRouter } from '../../hooks/useRobotVoice';

function SearchSkeleton() {
  const opacity = useSharedValue(0.4);
  
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 600 }),
        withTiming(0.4, { duration: 600 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <YStack gap="$4" paddingVertical="$4" flex={1}>
      {[1, 2, 3].map((i) => (
        <Animated.View key={i} style={animatedStyle}>
          <Card
            borderWidth={1}
            borderColor="#e2ede5"
            borderRadius={24}
            backgroundColor="white"
            padding="$4"
          >
            <XStack gap="$4" alignItems="center">
              <View width={110} height={110} borderRadius={16} backgroundColor="#e2e8f0" />
              <YStack flex={1} gap="$2">
                <View width="80%" height={20} borderRadius={6} backgroundColor="#e2e8f0" />
                <View width="50%" height={20} borderRadius={6} backgroundColor="#e2e8f0" />
                <View width="40%" height={16} borderRadius={6} backgroundColor="#e2e8f0" marginTop="$2" />
                <View width="60%" height={30} borderRadius={15} backgroundColor="#e2e8f0" marginTop="$2" />
              </YStack>
            </XStack>
          </Card>
        </Animated.View>
      ))}
    </YStack>
  );
}

const getCategoryImage = (typeName: string): string => {
  const lowerName = typeName.toLowerCase();
  
  if (lowerName.includes('thịt')) return 'https://images.unsplash.com/photo-1607623814075-e51df1bd682f?q=80&w=600&auto=format&fit=crop';
  if (lowerName.includes('hải sản') || lowerName.includes('cá')) return 'https://images.unsplash.com/photo-1615141982883-c7da0e40cb81?q=80&w=600&auto=format&fit=crop';
  if (lowerName.includes('gạo') || lowerName.includes('ngũ cốc')) return 'https://images.unsplash.com/photo-1586201375761-83865001e8ac?q=80&w=600&auto=format&fit=crop';
  if (lowerName.includes('mì') || lowerName.includes('phở') || lowerName.includes('hủ tiếu')) return 'https://images.unsplash.com/photo-1585032226651-759b368d7246?q=80&w=600&auto=format&fit=crop';
  if (lowerName.includes('rau') || lowerName.includes('củ')) return 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?q=80&w=600&auto=format&fit=crop';
  if (lowerName.includes('trái cây') || lowerName.includes('quả')) return 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=600&auto=format&fit=crop';
  if (lowerName.includes('nước mắm') || lowerName.includes('tương') || lowerName.includes('đường') || lowerName.includes('gia vị') || lowerName.includes('tiêu')) return 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?q=80&w=600&auto=format&fit=crop';
  if (lowerName.includes('sữa') || lowerName.includes('kem')) return 'https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=600&auto=format&fit=crop';
  if (lowerName.includes('chăm sóc') || lowerName.includes('cá nhân') || lowerName.includes('gội')) return 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?q=80&w=600&auto=format&fit=crop';
  if (lowerName.includes('bát') || lowerName.includes('đĩa') || lowerName.includes('chảo')) return 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?q=80&w=600&auto=format&fit=crop';
  
  // Default fallback
  return 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?q=80&w=600&auto=format&fit=crop';
}

interface FeaturedCategory {
  id: string;
  name: string;
  subtitle: string;
  keyword: string;
  icon: any;
  bgColor: string;
  borderColor: string;
  iconColor: string;
  textColor: string;
}

const FEATURED_CATEGORIES: FeaturedCategory[] = [
  { id: '1', name: 'Rau Củ Tươi', subtitle: 'Xà lách, cà chua...', keyword: 'Rau', icon: Carrot, bgColor: '#F0FDF4', borderColor: '#BBF7D0', iconColor: '#16A34A', textColor: '#166534' },
  { id: '2', name: 'Thịt & Hải Sản', subtitle: 'Heo, bò, tôm cá...', keyword: 'Thịt', icon: Drumstick, bgColor: '#FEF2F2', borderColor: '#FECACA', iconColor: '#DC2626', textColor: '#991B1B' },
  { id: '3', name: 'Sữa & Bơ Trứng', subtitle: 'Sữa tươi, trứng gà...', keyword: 'Sữa', icon: Milk, bgColor: '#FEFCE8', borderColor: '#FEF08A', iconColor: '#CA8A04', textColor: '#854D0E' },
  { id: '4', name: 'Gạo & Mì Khô', subtitle: 'Gạo ST25, mì gói...', keyword: 'Mì', icon: Wheat, bgColor: '#FFF7ED', borderColor: '#FED7AA', iconColor: '#EA580C', textColor: '#9A3412' },
  { id: '5', name: 'Nước Giải Khát', subtitle: 'Nước ngọt, trà, cafe...', keyword: 'Nước', icon: CupSoda, bgColor: '#F0F9FF', borderColor: '#BAE6FD', iconColor: '#0284C7', textColor: '#075985' },
  { id: '6', name: 'Gia Vị & Dầu Ăn', subtitle: 'Nước mắm, đường, dầu...', keyword: 'Gia vị', icon: Droplets, bgColor: '#FEFCE8', borderColor: '#FDE047', iconColor: '#D97706', textColor: '#78350F' },
  { id: '7', name: 'Bánh Kẹo Ăn Vặt', subtitle: 'Bánh quy, snack, kẹo...', keyword: 'Bánh', icon: Cookie, bgColor: '#FDF2F8', borderColor: '#FBCFE8', iconColor: '#DB2777', textColor: '#9D174D' },
  { id: '8', name: 'Hóa Mỹ Phẩm', subtitle: 'Dầu gội, xà phòng...', keyword: 'Dầu gội', icon: Sparkles, bgColor: '#FAF5FF', borderColor: '#E9D5FF', iconColor: '#9333EA', textColor: '#5B21B6' },
];

const TRENDING_SEARCHES = ['Sữa tươi', 'Trứng gà', 'Mì tôm', 'Rau xanh', 'Thịt heo', 'Nước mắm', 'Cà phê', 'Dầu ăn'];

const CategoryCard = ({ cat, onPress }: { cat: FeaturedCategory; onPress: (kw: string) => void }) => {
  const IconComp = cat.icon;
  return (
    <Pressable
      onPress={() => onPress(cat.keyword)}
      style={({ pressed }) => ({
        width: '48%',
        opacity: pressed ? 0.88 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <Card
        backgroundColor={cat.bgColor}
        borderWidth={1.5}
        borderColor={cat.borderColor}
        borderRadius={14}
        padding="$2.5"
        shadowColor="black"
        shadowRadius={4}
        shadowOpacity={0.04}
        style={{ elevation: 1 }}
      >
        <XStack gap="$2" alignItems="center">
          <View
            width={34}
            height={34}
            borderRadius={10}
            backgroundColor="white"
            justifyContent="center"
            alignItems="center"
            shadowColor="black"
            shadowRadius={3}
            shadowOpacity={0.06}
            style={{ elevation: 2 }}
          >
            <IconComp size={18} color={cat.iconColor} />
          </View>
          <YStack flex={1} gap={1}>
            <Text fontSize={11.5} fontWeight="800" color={cat.textColor} numberOfLines={1}>
              {cat.name}
            </Text>
            <Text fontSize={9.5} color="#64748B" numberOfLines={1}>
              {cat.subtitle}
            </Text>
          </YStack>
        </XStack>
      </Card>
    </Pressable>
  );
};

import { SearchService, MobileProductSearchResultDto, IngredientRecommendationDto } from '../../services/SearchService';
import { ProductService, ProductTypeDto } from '../../services/ProductService';
import { useRobotAuth } from '../../context/RobotAuthContext';
import { RecipeRecommendationUI } from '../ui/RecipeRecommendationUI';
import { CartService } from '../../services/CartService';
import { useNotification } from '../../context/NotificationContext';
import { RobotControlService } from '../../services/RobotControlService';
import { useRobotGuide } from '../../context/RobotGuideContext';

const PRODUCT_DATABASE: any[] = []; // Bỏ qua mảng mock dài

export default function MemberSearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useVoiceRouter();
  const params = useLocalSearchParams();
  const { query: initialQuery } = params as { query?: string };
  const { speak, stop } = useRobotVoice();
  const { token } = useRobotAuth();
  const { dispatchCart } = useRobotGuide();

  const [searchQuery, setSearchQuery] = useState(initialQuery ?? '');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [productTypes, setProductTypes] = useState<ProductTypeDto[]>([]);
  const [recipeIngredients, setRecipeIngredients] = useState<IngredientRecommendationDto[]>([]);
  const [searchIntent, setSearchIntent] = useState<'recipe' | 'product'>('product');
  const inputRef = useRef<TextInput>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { showNotification } = useNotification();

  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiRanked, setAiRanked] = useState(false);

  // Map dữ liệu API về format UI
  const mapApiToUI = (items: any[]) => {
    return items.map(p => {
      const formattedPrice = p.unitPrice.toLocaleString('vi-VN') + 'đ';
      const loc = p.location || {};
      const location = [loc.zoneName || loc.zone, loc.aisleName || loc.aisleCode, loc.shelfName, loc.slotCode]
        .filter(Boolean).join(' | ') || p.categoryName || 'Vị trí đang cập nhật';
      return {
        id: p.productId,
        name: p.productName,
        price: formattedPrice,
        originalPrice: p.promotionPrice ? p.promotionPrice.toLocaleString('vi-VN') + 'đ' : null,
        badge: p.status === 'Available' || p.status === 'instock' ? 'Có sẵn' : 'Tạm hết',
        badgeColor: p.status === 'Available' || p.status === 'instock' ? '#22c55e' : '#ef4444',
        image: p.imageUrl || 'https://via.placeholder.com/400',
        location,
        distance: 'Tính toán...', // Lidar sẽ update sau
        voiceText: `Tôi đã tìm thấy ${p.productName} có giá ${formattedPrice}, nằm tại ${location}.`,
        relevanceScore: p.relevanceScore || 0,
        healthTags: p.healthTags || []
      };
    });
  };

  // Thực hiện tìm kiếm khi người dùng nhấn Confirm hoặc khi gõ chữ
  const executeSearch = async (query: string, silent: boolean = false) => {
    if (!query.trim()) {
      if (!silent) speak('Quý khách vui lòng nhập hoặc nói tên sản phẩm cần tìm!');
      return;
    }
    setIsSearching(true);
    setIsLoading(true);
    setResults([]);
    setRecipeIngredients([]);
    setAiExplanation(null);
    setAiRanked(false);
    const cleanQ = query.toLowerCase().trim();

    // Classify intent
    const intent = SearchService.classifyIntent(cleanQ);
    setSearchIntent(intent);

    try {
      if (intent === 'recipe') {
        if (!silent) speak(`Xin chờ trong giây lát, trợ lý AI đang phân tích nguyên liệu cho món ${query}.`);
        const rec = await SearchService.recommendIngredients(cleanQ);
        setRecipeIngredients(rec.ingredients || []);
        if (rec.ingredients?.length > 0) {
          if (!silent) speak(`Đây là một số nguyên liệu tôi tìm được cho món ${query}.`);
        } else {
          if (!silent) speak(`Xin lỗi, tôi không tìm thấy nguyên liệu nào phù hợp cho món ${query}.`);
        }
        return;
      } else {
        let searchResponse;

        if (intent === 'product') {
          if (token) {
            searchResponse = await SearchService.searchPersonalized({
              q: cleanQ,
              useAi: true,
              token: token
            });

            // Nếu tìm kiếm cá nhân hóa không ra kết quả, kiểm tra xem có phải do bị lọc dị ứng không
            if (!searchResponse.results || searchResponse.results.length === 0) {
              const rawSearch = await SearchService.searchProducts(cleanQ);
              if (rawSearch && rawSearch.length > 0) {
                const targetProduct = rawSearch[0];
                setAiExplanation(`⚠️ CẢNH BÁO DỊ ỨNG: Sản phẩm "${targetProduct.productName}" đã bị ẩn vì chứa thành phần dị ứng hoặc không phù hợp với chế độ ăn của bạn! Vui lòng nhờ nhân viên tư vấn sản phẩm thay thế.`);
                if (!silent) speak(`Xin lỗi, sản phẩm ${targetProduct.productName} không phù hợp với chế độ ăn hoặc dị ứng của bạn nên đã bị hệ thống tự động ẩn đi để bảo vệ sức khỏe.`);
                setResults([]);
                setIsLoading(false);
                return;
              }
            }

          } else {
            try {
              const allRes = await SearchService.searchAll({ q: cleanQ, useAi: false });
              searchResponse = {
                results: allRes.results || [],
                aiExplanation: allRes.aiExplanation || null,
                aiRanked: allRes.aiRanked || false,
              };
            } catch {
              const rawProds = await SearchService.searchProducts(cleanQ);
              searchResponse = { results: rawProds, aiExplanation: null, aiRanked: false };
            }
          }

          const formatted = mapApiToUI(searchResponse.results || []);
          setResults(formatted);
          setAiExplanation(searchResponse.aiExplanation || null);
          setAiRanked(searchResponse.aiRanked || false);

          if (formatted.length > 0) {
            if (!silent) speak(formatted[0].voiceText);
          } else {
            if (!silent) speak(`Bắt đầu tìm kiếm ${query}. Robot đang quét hệ thống kệ hàng nhưng sản phẩm này chưa có sẵn.`);
          }
        }
      }
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.message && error.message.length < 200 ? error.message : `Xin lỗi, có lỗi kết nối khi tìm kiếm ${query}.`;
      setAiExplanation(errorMsg);
      if (!silent) speak(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    ProductService.getProductTypes().then(setProductTypes);
    if (initialQuery) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void executeSearch(initialQuery);
    } else {
      speak('Tôi đã sẵn sàng tìm kiếm. Hãy nhập tên sản phẩm bạn cần nhé!');
      setTimeout(() => inputRef.current?.focus(), 150);
    }
    return () => {
      void stop();
    };
    // Route query is the lifecycle boundary for this kiosk search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const handleTextChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    if (!text.trim()) {
      setIsSearching(false);
      setResults([]);
      setRecipeIngredients([]);
      return;
    }
    
    searchTimeout.current = setTimeout(() => {
      executeSearch(text, true);
    }, 600);
  };

  const handleAddToCart = async (productName: string, productId: number, qty: number = 1) => {
    try {
      if (token) {
        await CartService.addItem(productId, qty, token);
        speak(`Thành công! Đã đưa ${qty} ${productName} vào giỏ hàng của quý khách.`);
        showNotification({ title: '🛒 THÀNH CÔNG', message: `Đã thêm ${qty} x ${productName} vào giỏ hàng.`, type: 'success' });
      } else {
        speak(`Vui lòng đăng nhập để thêm vào giỏ hàng.`);
      }
    } catch (e) {
      speak(`Lỗi khi thêm ${productName} vào giỏ hàng.`);
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

  const handleGuideToProduct = async (product: { id: number; name: string; image?: string; price?: any; location?: string }) => {
    try {
      speak(`Dạ vâng! Robot sẽ dẫn quý khách đến quầy bán ${product.name}. Xin mời đi theo tôi!`);
      showNotification({
        title: '🤖 DẪN ĐƯỜNG MUA SẮM',
        message: `Đang khởi tạo lộ trình đến quầy ${product.name}`,
        type: 'info',
      });
      await dispatchCart([{ productId: product.id, productName: product.name }]);
      router.push({
        pathname: '/cart-guide-map',
        params: {
          productId: String(product.id),
          productName: product.name,
          productImage: product.image || '',
          productPrice: String(product.price || 0),
          shelfName: product.location || '',
        },
      } as any);
    } catch (err: any) {
      speak('Không thể khởi tạo dẫn đường');
      showNotification({
        title: 'LỖI',
        message: err?.message || 'Lỗi phát lệnh dẫn đường',
        type: 'error',
      });
    }
  };

  return (
    <View flex={1} backgroundColor="#f4f7f5" paddingLeft={Math.max(insets.left, 16)} paddingRight={Math.max(insets.right, 16)} paddingTop={insets.top + 12} paddingBottom={insets.bottom + 12}>

      {/* HEADER SECTION */}
      <XStack justifyContent="space-between" alignItems="center" marginBottom="$4">
        <XStack gap="$3" alignItems="center">
          <RNImage
            source={require('../../../assets/images/logocute.png')}
            style={{ width: 42, height: 42, borderRadius: 10, resizeMode: 'contain' }}
          />
          <YStack gap="$0.5">
            <Text fontSize={17} fontWeight="bold" color="#005b2b">SmartMarketBot</Text>
            <Text fontSize={11} color="#666">Sẵn sàng tìm kiếm</Text>
          </YStack>
        </XStack>

        <Button
          backgroundColor="#e2e8f0"
          borderRadius={20}
          paddingHorizontal="$3.5"
          height={36}
          onPress={() => {
            stop();
            router.back();
          }}
          pressStyle={{ scale: 0.95, backgroundColor: '#cbd5e1' }}
        >
          <Text color="#475569" fontSize={12} fontWeight="bold">✕ Hủy</Text>
        </Button>
      </XStack>

      {/* SEARCH INPUT FIELD */}
      <Animated.View entering={FadeInDown.duration(400)}>
        <XStack
          backgroundColor="white"
          borderWidth={1.5}
          borderColor="#e2e8f0"
          borderRadius={26}
          paddingLeft="$4"
          paddingRight="$2"
          height={52}
          alignItems="center"
          gap="$2"
          shadowColor="#00A550"
          shadowRadius={8}
          shadowOpacity={0.03}
          style={{ elevation: 2 }}
          marginBottom="$4"
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
            onChangeText={handleTextChange}
            onSubmitEditing={() => {
              if (searchTimeout.current) clearTimeout(searchTimeout.current);
              executeSearch(searchQuery, false);
            }}
            returnKeyType="search"
            style={{ paddingHorizontal: 0, paddingVertical: 0 }}
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

      {/* HIỂN THỊ KẾT QUẢ TÌM KIẾM BÌNH THƯỜNG VÀ RECIPE */}
      {isSearching ? (
        <YStack flex={1} gap="$4">
          <XStack justifyContent="space-between" alignItems="center" paddingRight="$4">
            <XStack alignItems="flex-start" gap="$2" flex={1}>
              <Sparkles size={16} color="#00A550" style={{ marginTop: 2 }} />
              <Text fontSize={13} fontWeight="800" color="#333" letterSpacing={0.5} flex={1} flexWrap="wrap" lineHeight={18}>
                {isLoading 
                  ? 'ĐANG TÌM KIẾM...' 
                  : searchIntent === 'recipe'
                    ? `GỢI Ý NGUYÊN LIỆU NẤU ${searchQuery.toUpperCase()}`
                    : `ĐÃ TÌM THẤY ${results.length} SẢN PHẨM PHÙ HỢP`}
              </Text>
            </XStack>
          </XStack>

          {isLoading ? (
            <SearchSkeleton />
          ) : searchIntent === 'recipe' ? (
            <Animated.View entering={FadeInDown.duration(400)} style={{ flex: 1, marginTop: 10 }}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                <RecipeRecommendationUI 
                  ingredients={recipeIngredients}
                  onProductSelect={(id) => {
                    router.push(`/product/${id}` as any);
                  }}
                  onAddToCart={handleAddToCart}
                />
              </ScrollView>
            </Animated.View>
          ) : (

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
                        <Pressable onPress={() => router.push(`/product/${product.id}`)}>
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
                              <View position="relative" width={85} height={85} borderRadius={14} overflow="hidden" backgroundColor="#f5f5f5">
                                <Image src={product.image} width="100%" height="100%" objectFit="cover" />
                                <View position="absolute" top={4} left={4} backgroundColor={product.badgeColor} paddingHorizontal="$1.5" paddingVertical="$0.5" borderRadius={6}>
                                  <Text color="white" fontSize={8.5} fontWeight="bold">{product.badge}</Text>
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
                                <XStack backgroundColor="#f0fdf4" borderWidth={1} borderColor="#d1fae5" borderRadius={12} paddingHorizontal="$3" paddingVertical="$2" alignItems="center" gap="$2" marginTop="$1">
                                  <MapPin size={14} color="#005b2b" />
                                  <Text fontSize={11} fontWeight="bold" color="#005b2b" flex={1} numberOfLines={2}>
                                    {product.location}
                                  </Text>
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

                                {/* Autonomous Robot Guidance to Shelf */}
                                <Button
                                  circular
                                  size="$3.5"
                                  backgroundColor="#00A550"
                                  icon={<Navigation size={15} color="white" />}
                                  pressStyle={{ scale: 0.9, backgroundColor: '#008740' }}
                                  onPress={() => handleGuideToProduct(product)}
                                />

                                {/* Add to Cart */}
                                <Button
                                  circular
                                  size="$3.5"
                                  backgroundColor="#f0fdf4"
                                  borderWidth={1}
                                  borderColor="#bbf7d0"
                                  icon={<ShoppingCart size={16} color="#16a34a" />}
                                  pressStyle={{ scale: 0.9, backgroundColor: '#dcfce7' }}
                                  onPress={async () => {
                                    if (token) {
                                      try {
                                        await CartService.addItem(product.id, 1, token);
                                        showNotification({ message: 'Đã thêm vào giỏ hàng', type: 'success' });
                                      } catch (error) {
                                        showNotification({ message: 'Thêm giỏ hàng thất bại', type: 'error' });
                                      }
                                    } else {
                                      Alert.alert(
                                        'Giỏ Hàng Thành Viên',
                                        'Tính năng giỏ hàng lưu trữ dành cho khách thành viên. Bạn muốn đăng nhập Face ID hay để Robot dẫn đường đến quầy lấy sản phẩm?',
                                        [
                                          {
                                            text: '🚀 Dẫn đường đến quầy',
                                            onPress: () => handleGuideToProduct(product),
                                          },
                                          {
                                            text: '👑 Quét Face ID',
                                            onPress: () => router.push('/face-scan' as any),
                                          },
                                          { text: 'Đóng', style: 'cancel' },
                                        ]
                                      );
                                    }
                                  }}
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
                      Rất tiếc, Robot chưa tìm thấy sản phẩm “{searchQuery}” trên kệ hàng của chi nhánh này.
                    </Text>
                    <Button size="$3" backgroundColor="#22c55e" color="white" onPress={handleClear}>
                      Thử tìm kiếm từ khóa khác
                    </Button>
                  </YStack>
                )}
          </ScrollView>
          )}
        </YStack>
      ) : (
        /* TRẠNG THÁI EMPTY LÚC ĐẦU (TÌM PHỔ BIẾN, DANH MỤC 8 NHÓM, AI GỢI Ý MÓN) */
        <Animated.View style={{ flex: 1 }} entering={FadeInDown.delay(100).duration(450)}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>

            {/* 1. TỪ KHÓA TÌM KIẾM PHỔ BIẾN (TRENDING CHIPS) */}
            <Animated.View entering={FadeInDown.delay(150).duration(400)}>
              <YStack gap="$2" marginBottom="$4">
                <Text fontSize={12} fontWeight="900" color="#475569" letterSpacing={0.5}>
                  🔥 TÌM KIẾM PHỔ BIẾN
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {TRENDING_SEARCHES.map((item, idx) => (
                    <TouchableOpacity
                      key={`trending-${idx}`}
                      onPress={() => handlePopularSearch(item)}
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        paddingHorizontal: 13,
                        paddingVertical: 7,
                        borderRadius: 20,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        shadowColor: 'black',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.04,
                        shadowRadius: 3,
                        elevation: 1,
                      }}
                    >
                      <Search size={12} color="#00A550" />
                      <Text fontSize={12} fontWeight="700" color="#1E293B">{item}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </YStack>
            </Animated.View>

            {/* 2. 8 DANH MỤC SẢN PHẨM NỔI BẬT (CLEAN RETAIL GRID) */}
            <Animated.View entering={FadeInDown.delay(250).duration(400)}>
              <YStack gap="$2.5" marginBottom="$4">
                <XStack justifyContent="space-between" alignItems="center">
                  <Text fontSize={12} fontWeight="900" color="#475569" letterSpacing={0.5}>
                    🏷️ DANH MỤC SẢN PHẨM
                  </Text>
                  <Text fontSize={11} color="#64748B" fontWeight="600">
                    Chạm để lọc theo quầy
                  </Text>
                </XStack>

                <XStack flexWrap="wrap" justifyContent="space-between" rowGap="$3">
                  {FEATURED_CATEGORIES.map((cat) => (
                    <CategoryCard key={cat.id} cat={cat} onPress={handlePopularSearch} />
                  ))}
                </XStack>
              </YStack>
            </Animated.View>

            {/* 3. TRỢ LÝ CÔNG THỨC NẤU ĂN AI (RECIPE ASSISTANT) */}
            <Animated.View entering={FadeInDown.delay(350).duration(400)}>
              <Card
                backgroundColor="#F0FDF4"
                borderWidth={1.5}
                borderColor="#BBF7D0"
                borderRadius={20}
                padding="$4"
                marginBottom="$4"
                shadowColor="#00A550"
                shadowRadius={8}
                shadowOpacity={0.05}
                style={{ elevation: 2 }}
              >
                <YStack gap="$2.5">
                  <XStack gap="$2" alignItems="center">
                    <View width={28} height={28} borderRadius={14} backgroundColor="#DCFCE7" justifyContent="center" alignItems="center">
                      <Sparkles size={16} color="#00A550" />
                    </View>
                    <YStack flex={1}>
                      <Text fontSize={14} fontWeight="900" color="#0F172A">
                        Nấu Ăn Cùng Trợ Lý AI
                      </Text>
                      <Text fontSize={11} color="#166534" fontWeight="600">
                        Tự động gom trọn bộ nguyên liệu trên kệ
                      </Text>
                    </YStack>
                  </XStack>

                  <Text fontSize={12} color="#475569" lineHeight={18}>
                    Nhập tên món ăn bất kỳ (vd: "Lẩu thái hải sản", "Thịt kho tàu"), robot sẽ phân tích công thức và chỉ đường lấy toàn bộ gia vị, rau củ trên kệ.
                  </Text>

                  <XStack gap="$2" marginTop="$1">
                    <TouchableOpacity
                      onPress={() => handlePopularSearch('Lẩu thái')}
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1.5,
                        borderColor: '#00A550',
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 16,
                      }}
                    >
                      <Text color="#00A550" fontSize={12} fontWeight="800">🍲 Thử: Lẩu Thái</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handlePopularSearch('Thịt kho tàu')}
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1.5,
                        borderColor: '#00A550',
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 16,
                      }}
                    >
                      <Text color="#00A550" fontSize={12} fontWeight="800">🥩 Thử: Thịt Kho Tàu</Text>
                    </TouchableOpacity>
                  </XStack>
                </YStack>
              </Card>
            </Animated.View>

            {/* 4. KHUYẾN MÃI GIÁ SỐC BANNER */}
            <Animated.View entering={FadeInDown.delay(450).duration(400)}>
              <Card
                backgroundColor="#00A550"
                borderRadius={20}
                padding="$4"
                pressStyle={{ scale: 0.98 }}
                onPress={() => handlePopularSearch('Rau')}
              >
                <XStack justifyContent="space-between" alignItems="center">
                  <YStack gap="$1" flex={1}>
                    <Text color="#DCFCE7" fontSize={10} fontWeight="900" letterSpacing={1}>⚡ ƯU ĐÃI KIOSK HÔM NAY</Text>
                    <Text color="white" fontSize={15} fontWeight="900">Giảm Đến 50% Nông Sản Sạch</Text>
                    <Text color="rgba(255,255,255,0.85)" fontSize={11} marginTop="$0.5">Ưu đãi độc quyền tại hệ thống quầy kệ</Text>
                  </YStack>
                  <View backgroundColor="white" borderRadius={20} paddingHorizontal="$3.5" paddingVertical="$2">
                    <Text color="#00A550" fontWeight="800" fontSize={12}>Xem Ngay</Text>
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
    </View>
  );
}
