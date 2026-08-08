import React from 'react';
import { Pressable } from 'react-native';
import { View, Text, XStack, YStack, Card, Image, Button } from 'tamagui';
import { Sparkles, ShoppingCart } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { IngredientRecommendationDto } from '../../services/SearchService';

interface RecipeRecommendationUIProps {
  ingredients: IngredientRecommendationDto[];
  onProductSelect: (productId: number) => void;
  onAddToCart: (productName: string, productId: number, qty?: number) => void;
}

export const RecipeRecommendationUI: React.FC<RecipeRecommendationUIProps> = ({ ingredients, onProductSelect, onAddToCart }) => {
  return (
    <YStack gap="$4" paddingBottom={40}>
      {ingredients.map((item, index) => (
        <Animated.View key={index} entering={FadeInDown.delay(index * 100).duration(400)}>
          <Card
            backgroundColor="white"
            borderRadius={16}
            borderWidth={1}
            borderColor="#e2e8f0"
            overflow="hidden"
          >
            <Pressable onPress={() => onProductSelect(item.productId)}>
              <XStack padding="$3" gap="$3">
              {/* Ảnh sản phẩm */}
              <View
                width={80}
                height={80}
                borderRadius={12}
                backgroundColor="#f8fafc"
                borderWidth={1}
                borderColor="#e2e8f0"
                overflow="hidden"
                justifyContent="center"
                alignItems="center"
              >
                <Image
                  src={item.imageUrl}
                  width={80}
                  height={80}
                  objectFit="cover"
                />
              </View>

              <YStack flex={1} justifyContent="space-between">
                <YStack gap="$1">
                  <Text fontSize={15} fontWeight="bold" color="#1e293b" numberOfLines={2}>
                    {item.productName}
                  </Text>
                  
                  <XStack alignItems="center" gap="$2">
                    <Text fontSize={14} fontWeight="900" color="#00A550">
                      {item.unitPrice.toLocaleString('vi-VN')}đ
                    </Text>
                    <Text fontSize={12} color="#64748b" fontWeight="bold">
                      • {item.quantityText.split(' - ')[0]}
                    </Text>
                  </XStack>
                  
                  {/* AI Reason */}
                  <XStack 
                    gap="$3" 
                    backgroundColor="#f8fafc" 
                    padding="$3" 
                    borderRadius={12} 
                    marginTop="$2"
                    borderWidth={1}
                    borderColor="#e2e8f0"
                    alignItems="flex-start"
                  >
                    <View backgroundColor="#e0e7ff" padding="$1.5" borderRadius={8}>
                      <Sparkles size={14} color="#4f46e5" />
                    </View>
                    <YStack flex={1} gap="$1">
                      <Text fontSize={11} fontWeight="bold" color="#64748b" textTransform="uppercase" letterSpacing={0.5}>
                        Gợi ý từ AI
                      </Text>
                      <Text fontSize={13} color="#334155" lineHeight={18}>
                        {item.reason}
                      </Text>
                    </YStack>
                  </XStack>
                </YStack>
                
                <XStack justifyContent="flex-end" marginTop="$2">
                  <Button
                    size="$2.5"
                    backgroundColor="#22c55e"
                    color="white"
                    icon={<ShoppingCart size={14} color="white" />}
                    borderRadius={20}
                    onPress={(e) => {
                      e.stopPropagation();
                      onAddToCart(item.productName, item.productId, item.quantity);
                    }}
                  >
                    Thêm vào giỏ
                  </Button>
                </XStack>
              </YStack>
            </XStack>
            </Pressable>
          </Card>
        </Animated.View>
      ))}
    </YStack>
  );
};
