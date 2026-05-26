import { Stack } from 'expo-router';
import { useEffect } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
import { TamaguiProvider } from 'tamagui';
import tamaguiConfig from '../theme/tamagui.config';
import { View } from 'react-native';
import { useIdleTimeout } from '../hooks/useIdleTimeout';

function RootLayoutContent() {
  const { resetTimer } = useIdleTimeout(60000); // 60 seconds

  return (
    <View
      style={{ flex: 1 }}
      onTouchStart={resetTimer}
      onTouchMove={resetTimer}
    >
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Dual-layer lock: Enforce landscape at JS level too, after 500ms delay for stability.
    const timer = setTimeout(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch((error) => {
        console.warn('Failed to lock screen orientation:', error);
      });
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <RootLayoutContent />
    </TamaguiProvider>
  );
}
