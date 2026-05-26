import React from 'react';
import { View } from 'tamagui';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';

interface RobotAvatarProps {
  isSpeaking: boolean;
}

export const RobotAvatar = ({ isSpeaking }: RobotAvatarProps) => {
  return (
    <View
      width={160}
      height={160}
      borderRadius={80}
      backgroundColor="$surface"
      justifyContent="center"
      alignItems="center"
      // Add a subtle green glow effect using shadow
      shadowColor="$brandGreen"
      shadowOffset={{ width: 0, height: 0 }}
      shadowOpacity={0.4}
      shadowRadius={30}
      style={{ elevation: 10 }}
      marginVertical="$2"
    >
      <View
        width={110}
        height={110}
        borderRadius={55}
        backgroundColor={isSpeaking ? "$brandGreenLight" : "#f0f0f0"}
        justifyContent="center"
        alignItems="center"
        borderWidth={4}
        borderColor={isSpeaking ? "$brandGreen" : "transparent"}
        overflow="hidden"
      >
        <Image
          source={{ uri: "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExamNoZWJ1cnhzd3R4cm9uZmIyenNwMzQ5Mjdza3E0cXh5MjZ5M3dqcCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3og0IUzdgwVczU67eg/200.webp" }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
        />
      </View>
    </View>
  );
};
