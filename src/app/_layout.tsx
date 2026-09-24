import { Stack, usePathname } from 'expo-router';
import { TamaguiProvider } from 'tamagui';
import tamaguiConfig from '../theme/tamagui.config';
import { View, LogBox } from 'react-native';

LogBox.ignoreLogs([
  '[RobotControl]',
  'Mất kết nối Control',
]);
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import { CustomerSessionProvider } from '../context/CustomerSessionContext';
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
import { LowBatteryLockOverlay } from '../components/common/LowBatteryLockOverlay';
import { useKeepAwake } from 'expo-keep-awake';

/**
 * AdAwareZoneOverlay — Wrapper bọc ZoneAdOverlay để tránh hiển thị đồng thời
 * với AdMissionOverlay khi robot đang chạy mission flowType='ad'.
 * Khi RobotMissionRuntimeContext có mission ad đang active → ẩn ZoneAdOverlay
 * (AdMissionOverlay đã đảm nhận việc hiển thị quảng cáo và tương tác khách hàng).
 */
function AdAwareZoneOverlay() {
  const { mission } = useRobotMissionRuntime();
  const { isBusy: isGuideBusy, status: guideStatus } = useRobotGuide();
  const pathname = usePathname();

  // Ẩn hoàn toàn ZoneAdOverlay khi:
  // 1. Robot đang chạy ad mission thật (đã có AdMissionOverlay)
  // 2. Robot đang dẫn đường mua sắm (isGuideBusy hoặc guideStatus NAVIGATING/ARRIVED)
  // 3. Khách đang ở màn hình bản đồ dẫn đường hoặc chọn món
  if (
    mission?.flowType === 'ad' ||
    isGuideBusy ||
    guideStatus === 'NAVIGATING' ||
    guideStatus === 'ARRIVED' ||
    guideStatus === 'DISPATCHING' ||
    pathname?.includes('cart-guide') ||
    pathname?.includes('ad-multi-select')
  ) {
    return null;
  }
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
      <LowBatteryLockOverlay />
    </View>
  );
}

export default function RootLayout() {
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <CustomerSessionProvider>
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
      </CustomerSessionProvider>
    </TamaguiProvider>
  );
}
