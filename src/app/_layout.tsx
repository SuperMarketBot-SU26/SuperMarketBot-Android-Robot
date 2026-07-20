import { Stack } from 'expo-router';
import { TamaguiProvider, PortalProvider } from 'tamagui';
import tamaguiConfig from '../theme/tamagui.config';
import { View } from 'react-native';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import { RobotAuthProvider } from '../context/RobotAuthContext';
import { MapViewerProvider } from '../context/MapViewerContext';
import { RobotControlProvider } from '../context/RobotControlContext';
import { RouteProvider } from '../context/RouteContext';

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
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <PortalProvider shouldAddRootHost>
        <RobotAuthProvider>
          <MapViewerProvider>
            <RouteProvider>
              <RobotControlProvider>
                <RootLayoutContent />
              </RobotControlProvider>
            </RouteProvider>
          </MapViewerProvider>
        </RobotAuthProvider>
      </PortalProvider>
    </TamaguiProvider>
  );
}
