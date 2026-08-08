import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { View, Text } from 'tamagui';
import ProductDetailScreen from '../../components/screens/ProductDetailScreen';

export default function ProductDetailRoute() {
  const params = useLocalSearchParams();
  const isRecipeStr = Array.isArray(params.isRecipe) ? params.isRecipe[0] : params.isRecipe;
  const isRecipe = isRecipeStr === 'true';

  const productId = parseInt(Array.isArray(params.id) ? params.id[0] : params.id, 10);

  if (isNaN(productId)) {
    return (
      <View flex={1} justifyContent="center" alignItems="center">
        <Text>Invalid Product ID</Text>
      </View>
    );
  }

  return <ProductDetailScreen productId={productId} isRecipe={isRecipe} />;
}
