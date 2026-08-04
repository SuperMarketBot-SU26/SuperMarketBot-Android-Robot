/**
 * MotorLayoutScreen.tsx
 * 
 * Màn hình cấu hình Motor đã bị loại bỏ.
 * Toàn bộ điều khiển đi qua BE → MQTT → ROS2 → Robot.
 */
import { Redirect } from 'expo-router';

export default function MotorLayoutScreen() {
  return <Redirect href="/" />;
}
