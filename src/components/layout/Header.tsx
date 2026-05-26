import React from 'react';
import { View, Text } from 'tamagui';

export const Header = () => {
  return (
    <View
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      paddingHorizontal="$6"
      paddingVertical="$4"
      width="100%"
      zIndex={10}
    >
      <Text color="$brandGreen" fontSize="$6" fontWeight="bold" fontFamily="$heading">
        SmartMarketBot
      </Text>
    </View>
  );
};
