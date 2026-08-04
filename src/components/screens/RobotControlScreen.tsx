/**
 * RobotControlScreen.tsx
 * 
 * Màn hình lái tay đã bị loại bỏ.
 * Toàn bộ điều khiển đi qua BE → MQTT → ROS2 → Robot.
 */
import { Redirect } from 'expo-router';

export default function RobotControlScreen() {
  return <Redirect href="/" />;
}
