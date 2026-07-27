#!/bin/bash
# ==============================================================================
# SMARTMARKETBOT — ROS2 SLAM TOOLBOX & ROSBRIDGE LAUNCH SCRIPT
# Khởi động Bộ Não ROS2 slam_toolbox + Rosbridge WebSocket Server (ws://localhost:9090)
# ==============================================================================
# Tầng 3 (Root-Cause fix):
#   - Truyền file mapper_params_online_async.yaml (cùng folder với bridge)
#     để siết scan-matching & loop-closure cho YDLIDAR X3.
#   - Tự dò đường dẫn Workspace/Install nếu có slam_toolbox cài local.
#
# F (Root-Cause fix):
#   - Khởi luôn robot_localization EKF + esp32_ros2_bridge node
#     để fuse /odom + /imu/data + /amcl_pose → /odometry/filtered
# ==============================================================================

set -e

echo "🚀 [ROS2 Launch] Khởi động hệ thống ROS2 Dual-Engine cho WebManager..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../../SuperMarketBot-IOT" && pwd)"
SLAM_CONFIG="$WORKSPACE_ROOT/ros2_bridge/config/mapper_params_online_async.yaml"
EKF_CONFIG="$WORKSPACE_ROOT/ros2_bridge/config/ekf_config.yaml"
EKF_LAUNCH="$WORKSPACE_ROOT/ros2_bridge/launch/ekf_localization.launch.py"
BRIDGE_PY="$WORKSPACE_ROOT/ros2_bridge/esp32_ros2_bridge.py"

# 1. Source ROS2 Humble Environment
if [ -f "/opt/ros/humble/setup.bash" ]; then
    # shellcheck disable=SC1091
    source /opt/ros/humble/setup.bash
    echo "✅ [1/5] Đã nạp môi trường ROS2 Humble."
else
    echo "⚠️ ROS2 Humble chưa được cài đặt tại /opt/ros/humble!"
fi

# 1b. Nếu có workspace local (~/ros2_ws/install/setup.bash) thì nạp thêm
for ws_setup in "$HOME/ros2_ws/install/setup.bash" "/opt/slam_ws/install/setup.bash"; do
    if [ -f "$ws_setup" ]; then
        # shellcheck disable=SC1091
        source "$ws_setup"
        echo "✅ [1b/5] Đã nạp thêm workspace local: $ws_setup"
        break
    fi
done

# 2. Khởi động rosbridge_server (Cổng kết nối WebSocket cho WebManager)
echo "⚡ [2/5] Đang khởi chạy Rosbridge WebSocket Server tại port 9090..."
ros2 launch rosbridge_server rosbridge_websocket_launch.xml &
ROSBRIDGE_PID=$!

# 3. Khởi động slam_toolbox (Bộ thuật toán SLAM chính chủ ROS2)
echo "🧠 [3/5] Đang khởi chạy slam_toolbox (Online Async SLAM) với config YDLIDAR X3..."
if [ -f "$SLAM_CONFIG" ]; then
    echo "    📄 Dùng file: $SLAM_CONFIG"
    ros2 launch slam_toolbox online_async_launch.py \
        params_file:="$SLAM_CONFIG" &
else
    echo "    ⚠️ Không thấy $SLAM_CONFIG — fallback về default params (có thể bị nhiễu như Ảnh 1)"
    ros2 launch slam_toolbox online_async_launch.py &
fi
SLAM_PID=$!

# 4. Khởi robot_localization EKF (fusion /odom + /imu/data + /amcl_pose)
echo "🧮 [4/5] Đang khởi chạy robot_localization EKF (odom + IMU + SLAM fusion)..."
if [ -f "$EKF_LAUNCH" ]; then
    ros2 launch "$EKF_LAUNCH" &
    EKF_PID=$!
    echo "    📄 Dùng launch: $EKF_LAUNCH"
else
    echo "    ⚠️ Không thấy $EKF_LAUNCH — EKF sẽ không chạy (heading drift sẽ không được bù từ wheel)"
    EKF_PID=""
fi

# 5. Khởi ESP32-S3 ROS2 Bridge Node (publish /scan, /odom, /imu/data cho EKF input)
echo "📡 [5/5] Đang khởi chạy ESP32-S3 ROS2 Bridge Node..."
if [ -f "$BRIDGE_PY" ]; then
    # Default IP có thể override qua biến môi trường ESP32_IP
    ESP32_IP="${ESP32_IP:-192.168.0.105}"
    python3 "$BRIDGE_PY" --ros-args -p esp32_ip:="$ESP32_IP" &
    BRIDGE_PID=$!
    echo "    📄 Dùng bridge: $BRIDGE_PY (IP: $ESP32_IP)"
else
    echo "    ⚠️ Không thấy $BRIDGE_PY — /scan, /odom, /imu/data sẽ không có dữ liệu"
    BRIDGE_PID=""
fi

echo ""
echo "🎉 HỆ THỐNG ROS2 CORE ĐÃ SẴN SÀNG!"
echo "🌐 Bây giờ bạn hãy mở WebManager (index.html) trên Trình duyệt."
echo "🔗 WebManager sẽ tự động kết nối tới ws://localhost:9090!"
echo ""
echo "Các topic ROS2 đang publish:"
echo "   /scan                      ← YDLIDAR X3 (đã lọc nhiễu Tầng 1)"
echo "   /map                       ← SLAM Toolbox"
echo "   /odom                      ← wheel + PWM dead-reckoning"
echo "   /imu/data                  ← heading EKF-fused từ ESP32"
echo "   /odometry/filtered         ← EKF ROS2 fusion (3 nguồn)"
echo ""
echo "Nhấn [Ctrl+C] để dừng toàn bộ hệ thống ROS2."

# Trap SIGINT to clean up background processes
trap "kill $ROSBRIDGE_PID $SLAM_PID $EKF_PID $BRIDGE_PID 2>/dev/null; exit" INT

wait
