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
import { RobotGuideProvider, useRobotGuide } from '../context/RobotGuideContext';
import { RobotMissionRuntimeProvider, useRobotMissionRuntime } from '../context/RobotMissionRuntimeContext';
import { RobotRealtimeProvider } from '../context/RobotRealtimeContext';
import ZoneAdOverlay from '../components/ui/ZoneAdOverlay';
import { useKeepAwake } from 'expo-keep-awake';

/**
 * AdAwareZoneOverlay — Wrapper bọc ZoneAdOverlay để tránh hiển thị đồng thời
 * với AdMissionOverlay khi robot đang chạy mission flowType='ad'.
 * Khi RobotMissionRuntimeContext có mission ad đang active → ẩn ZoneAdOverlay
 * (AdMissionOverlay đã đảm nhận việc hiển thị quảng cáo và tương tác khách hàng).
 */
function AdAwareZoneOverlay() {
  const { mission } = useRobotMissionRuntime();
  // Nếu robot đang chạy ad mission thật → nhường cho AdMissionOverlay hiển thị
  if (mission?.flowType === 'ad') return null;
  return <ZoneAdOverlay />;
}

function RootLayoutContent() {
  useKeepAwake();
  const { isBusy: isGuideMissionActive } = useRobotGuide();
  // Không logout khách giữa lúc robot đang lập tuyến, di chuyển hoặc chờ lấy hàng.
  const { resetTimer } = useIdleTimeout(60000, !isGuideMissionActive);

  return (
    <View
      style={{ flex: 1 }}
      onTouchStart={resetTimer}
      onTouchMove={resetTimer}
    >
      <Stack screenOptions={{ headerShown: false }} />
      <AdAwareZoneOverlay />
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
