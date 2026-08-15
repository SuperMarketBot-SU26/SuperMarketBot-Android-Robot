import { Stack } from 'expo-router';
import { TamaguiProvider, PortalProvider } from 'tamagui';
import tamaguiConfig from '../theme/tamagui.config';
import { View } from 'react-native';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import { RobotAuthProvider } from '../context/RobotAuthContext';
import { MapViewerProvider } from '../context/MapViewerContext';
import { RobotControlProvider } from '../context/RobotControlContext';
import { RouteProvider } from '../context/RouteContext';
import { NotificationProvider } from '../context/NotificationContext';
import { GeofencingProvider } from '../context/GeofencingContext';
import { RobotGuideProvider } from '../context/RobotGuideContext';
import { RobotMissionRuntimeProvider } from '../context/RobotMissionRuntimeContext';
import { RobotRealtimeProvider } from '../context/RobotRealtimeContext';
import ZoneAdOverlay from '../components/ui/ZoneAdOverlay';
import { useKeepAwake } from 'expo-keep-awake';

function RootLayoutContent() {
  useKeepAwake();
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
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <PortalProvider shouldAddRootHost>
        <NotificationProvider>
          <RobotAuthProvider>
            <RobotRealtimeProvider>
              <GeofencingProvider>
                <RobotMissionRuntimeProvider>
                  <RobotGuideProvider>
                    <MapViewerProvider>
                      <RouteProvider>
                        <RobotControlProvider>
                          <RootLayoutContent />
                        </RobotControlProvider>
                      </RouteProvider>
                    </MapViewerProvider>
                  </RobotGuideProvider>
                </RobotMissionRuntimeProvider>
              </GeofencingProvider>
            </RobotRealtimeProvider>
          </RobotAuthProvider>
        </NotificationProvider>
      </PortalProvider>
    </TamaguiProvider>
  );
}
