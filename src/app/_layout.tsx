import { Stack } from 'expo-router';
import { TamaguiProvider } from 'tamagui';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import tamaguiConfig from '../theme/tamagui.config';
import { View } from 'react-native';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import { RobotAuthProvider } from '../context/RobotAuthContext';
import { MapViewerProvider } from '../context/MapViewerContext';
import { RobotControlProvider } from '../context/RobotControlContext';
import { RouteProvider } from '../context/RouteContext';
import { NotificationProvider } from '../context/NotificationContext';
import { GeofencingProvider } from '../context/GeofencingContext';
import ZoneAdOverlay from '../components/ui/ZoneAdOverlay';

function RootLayoutContent() {
  const { resetTimer } = useIdleTimeout(60000); // 60 seconds

  return (
    <View
      style={{ flex: 1 }}
      onTouchStart={resetTimer}
      onTouchMove={resetTimer}
    >
      <Stack screenOptions={{ headerShown: false }} />
      <ZoneAdOverlay />
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Ép ẩn Splash Screen sau khi app mount, tránh lỗi kẹt màn hình
    setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 1000);
  }, []);

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <NotificationProvider>
          <RobotAuthProvider>
            <GeofencingProvider>
              <MapViewerProvider>
                <RouteProvider>
                  <RobotControlProvider>
                    <RootLayoutContent />
                  </RobotControlProvider>
                </RouteProvider>
              </MapViewerProvider>
            </GeofencingProvider>
          </RobotAuthProvider>
        </NotificationProvider>
    </TamaguiProvider>
  );
}
