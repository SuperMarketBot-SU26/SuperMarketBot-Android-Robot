import React, { useState, useEffect, useRef } from 'react';
import { TextInput, ScrollView, Pressable, Image as RNImage } from 'react-native';
import { View, Text, XStack, YStack, Button, Input, Image, Card } from 'tamagui';
import { Search, Mic, X, MapPin, ShoppingCart, Volume2, Sparkles, HelpCircle, Beef, Fish, Wheat, Carrot, Apple, Droplets, Milk, Coffee, ShoppingBag, Egg, CupSoda, Cookie, Snowflake, Drumstick } from 'lucide-react-native';
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

const getCategoryStyle = (typeName: string) => {
  const lowerName = typeName.toLowerCase();
  
  if (lowerName.includes('trứng')) return { icon: Egg, bgColor: '#FEF08A', textColor: '#854D0E', iconColor: '#EAB308' };
  if (lowerName.includes('thịt gà') || lowerName.includes('gia cầm')) return { icon: Drumstick, bgColor: '#FFEDD5', textColor: '#9A3412', iconColor: '#F97316' };
  if (lowerName.includes('thịt')) return { icon: Beef, bgColor: '#FEE2E2', textColor: '#991B1B', iconColor: '#EF4444' };
  if (lowerName.includes('hải sản') || lowerName.includes('cá')) return { icon: Fish, bgColor: '#E0F2FE', textColor: '#075985', iconColor: '#0EA5E9' };
  if (lowerName.includes('đông lạnh')) return { icon: Snowflake, bgColor: '#E0F2FE', textColor: '#0369A1', iconColor: '#38BDF8' };
  if (lowerName.includes('gạo') || lowerName.includes('ngũ cốc')) return { icon: Wheat, bgColor: '#FEF3C7', textColor: '#92400E', iconColor: '#F59E0B' };
  if (lowerName.includes('rau') || lowerName.includes('củ')) return { icon: Carrot, bgColor: '#DCFCE7', textColor: '#166534', iconColor: '#22C55E' };
  if (lowerName.includes('trái cây') || lowerName.includes('quả')) return { icon: Apple, bgColor: '#FFE4E6', textColor: '#9F1239', iconColor: '#F43F5E' };
  if (lowerName.includes('nước mắm') || lowerName.includes('gia vị') || lowerName.includes('đường') || lowerName.includes('tiêu')) return { icon: Droplets, bgColor: '#FFEDD5', textColor: '#9A3412', iconColor: '#F97316' };
  if (lowerName.includes('đồ uống') || lowerName.includes('nước ngọt') || lowerName.includes('bia') || lowerName.includes('giải khát')) return { icon: CupSoda, bgColor: '#FCE7F3', textColor: '#9D174D', iconColor: '#EC4899' };
  if (lowerName.includes('cà phê') || lowerName.includes('trà')) return { icon: Coffee, bgColor: '#FFEDD5', textColor: '#78350F', iconColor: '#B45309' };
  if (lowerName.includes('bánh') || lowerName.includes('kẹo') || lowerName.includes('ăn vặt')) return { icon: Cookie, bgColor: '#FEF3C7', textColor: '#92400E', iconColor: '#F59E0B' };
  if (lowerName.includes('sữa') || lowerName.includes('kem')) return { icon: Milk, bgColor: '#F3F4F6', textColor: '#1F2937', iconColor: '#6B7280' };
  if (lowerName.includes('chăm sóc') || lowerName.includes('cá nhân') || lowerName.includes('gội') || lowerName.includes('giặt') || lowerName.includes('vệ sinh')) return { icon: Sparkles, bgColor: '#F3E8FF', textColor: '#5B21B6', iconColor: '#A855F7' };
  
  return { icon: ShoppingBag, bgColor: '#F3F4F6', textColor: '#374151', iconColor: '#6B7280' };
}

const RGBCard = ({ cat, style, onPress }: any) => {
  const IconComp = style.icon;
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotateZ: `${rotation.value}deg` }],
      position: 'absolute',
      width: '200%',
      height: '400%',
      top: '-150%',
      left: '-50%',
    };
  });

  const rainbow = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'];
  const multiRainbow = [...rainbow, ...rainbow, ...rainbow, '#ff0000'] as unknown as [string, string, ...string[]];

  return (
    <Card
      width="48%"
      height={55}
      borderRadius={12}
      overflow="hidden"
      pressStyle={{ scale: 0.95 }}
      onPress={() => onPress(cat.typeName)}
      style={{ position: 'relative', elevation: 3, shadowColor: '#999', shadowRadius: 5, shadowOpacity: 0.2 }}
    >
      <Animated.View style={animatedStyle}>
        <LinearGradient
          colors={multiRainbow}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
      <XStack
        position="absolute"
        top={2}
        left={2}
        right={2}
        bottom={2}
        backgroundColor="#ffffff"
        borderRadius={10}
        alignItems="center"
        justifyContent="flex-start"
        gap="$2"
        paddingHorizontal="$3"
      >
        <IconComp size={22} color={style.iconColor} />
        <Text fontSize={12} fontWeight="900" color="#555" numberOfLines={1} flex={1}>
          {cat.typeName}
        </Text>
      </XStack>
    </Card>
  );
};

import { SearchService, MobileProductSearchResultDto, IngredientRecommendationDto } from '../../services/SearchService';
import { ProductService, ProductTypeDto } from '../../services/ProductService';
import { useRobotAuth } from '../../context/RobotAuthContext';
import { RecipeRecommendationUI } from '../ui/RecipeRecommendationUI';
import { CartService } from '../../services/CartService';
import { useNotification } from '../../context/NotificationContext';

const PRODUCT_DATABASE: any[] = []; // Bỏ qua mảng mock dài

export default function MemberSearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useVoiceRouter();
  const params = useLocalSearchParams();
  const { query: initialQuery } = params as { query?: string };
  const { speak, stop } = useRobotVoice();
  const { token } = useRobotAuth();

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
        semanticObjectId: null,
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
          } else {
            searchResponse = { results: await SearchService.searchProducts(cleanQ), aiExplanation: null, aiRanked: false };
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
            <Text fontSize={11} color="#666">Sẵn sàng tìm kiếm</Text>
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
                                      showNotification({ message: 'Vui lòng đăng nhập', type: 'error' });
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
        /* TRẠNG THÁI EMPTY LÚC ĐẦU (POPULAR, DANH MỤC, KHUYẾN MÃI) */
        <Animated.View style={{ flex: 1 }} entering={FadeInDown.delay(100).duration(450)}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            {/* KHÁM PHÁ DANH MỤC */}
            <Animated.View entering={FadeInDown.delay(200).duration(450)}>
              <YStack gap="$3" marginTop="$2">
                <Text fontSize={11} fontWeight="900" color="#666" letterSpacing={0.5}>🏷️ KHÁM PHÁ DANH MỤC</Text>
                <XStack flexWrap="wrap" justifyContent="space-between" rowGap="$4">
                  {productTypes.map((cat, idx) => {
                    const style = getCategoryStyle(cat.typeName);
                    return (
                      <RGBCard 
                        key={idx} 
                        cat={cat} 
                        style={style} 
                        onPress={(typeName: string) => {
                          setSearchQuery(typeName);
                          executeSearch(typeName);
                        }} 
                      />
                    );
                  })}
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
    </View>
  );
}
