#!/bin/bash
# ==============================================================================
# SMARTMARKETBOT — ROS2 SLAM TOOLBOX & ROSBRIDGE LAUNCH SCRIPT
# Khởi động Bộ Não ROS2 slam_toolbox + Rosbridge WebSocket Server (ws://localhost:9090)
# ==============================================================================
# v2.1 — Root-Cause fix (2026-07-27)
#   - Tự động phát hiện ROS2 distro (lyrical/humble/kilted/jazzy/rolling).
#     Trước đây script check `/opt/ros/humble/setup.bash` rồi source lyrical
#     → ROS2 CLI không khả dụng trên Ubuntu 26.04 (chỉ có lyrical).
#   - Verify `ros2` CLI hoạt động sau khi source (fail-loud nếu thiếu).
#   - Optional Nav2 (map_server + amcl) nếu file map đã có sẵn.
# ==============================================================================

set -e

echo "🚀 [ROS2 Launch] Khởi động hệ thống ROS2 Dual-Engine cho WebManager..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../../SuperMarketBot-IOT" && pwd)"
SLAM_CONFIG="$WORKSPACE_ROOT/ros2_bridge/config/mapper_params_online_async.yaml"
EKF_CONFIG="$WORKSPACE_ROOT/ros2_bridge/config/ekf_config.yaml"
EKF_LAUNCH="$WORKSPACE_ROOT/ros2_bridge/launch/ekf_localization.launch.py"
BRIDGE_PY="$WORKSPACE_ROOT/ros2_bridge/esp32_ros2_bridge.py"

# 1. Source ROS2 — tự động phát hiện distro (Lyrical / Humble / Kilted / Jazzy / Rolling)
ROS2_DISTRO=""
for distro in lyrical humble kilted jazzy rolling; do
    if [ -f "/opt/ros/${distro}/setup.bash" ]; then
        ROS2_DISTRO="${distro}"
        break
    fi
done

if [ -z "${ROS2_DISTRO}" ]; then
    echo "❌ [1/7] Không tìm thấy ROS2 distro nào trong /opt/ros/!"
    echo "    Cài ít nhất 1 trong: ros-humble-desktop | ros-lyrical-desktop | ros-jazzy-desktop"
    echo "    Tham khảo: setup_ros2_slam.sh (Humble) hoặc setup_ros2_slam_lyrical.sh (Lyrical)."
    exit 1
fi

# shellcheck disable=SC1091
source "/opt/ros/${ROS2_DISTRO}/setup.bash"
echo "✅ [1/7] Đã nạp môi trường ROS2 ${ROS2_DISTRO^} từ /opt/ros/${ROS2_DISTRO}/setup.bash"

# 1b. Nếu có workspace local (~/ros2_ws/install/setup.bash) thì nạp thêm
for ws_setup in "$HOME/ros2_ws/install/setup.bash" "/opt/slam_ws/install/setup.bash"; do
    if [ -f "$ws_setup" ]; then
        # shellcheck disable=SC1091
        source "$ws_setup"
        echo "✅ [1b/7] Đã nạp thêm workspace local: $ws_setup"
        break
    fi
done

# 1c. Verify `ros2` CLI hoạt động (fail-loud nếu source không thành công)
if ! command -v ros2 >/dev/null 2>&1; then
    echo "❌ [1c/7] Lệnh 'ros2' không khả dụng sau khi source — kiểm tra lại cài đặt ROS2."
    exit 1
fi
echo "✅ [1c/7] ros2 CLI OK — $(ros2 --version 2>/dev/null | head -n1 || echo 'ros2 detected')"

# 2. Khởi động rosbridge_server (Cổng kết nối WebSocket cho WebManager)
echo "⚡ [2/7] Đang khởi chạy Rosbridge WebSocket Server tại port 9090..."
ros2 launch rosbridge_server rosbridge_websocket_launch.xml &
ROSBRIDGE_PID=$!

# 3. Khởi động slam_toolbox (Bộ thuật toán SLAM chính chủ ROS2)
echo "🧠 [3/7] Đang khởi chạy slam_toolbox (Online Async SLAM) với config YDLIDAR X3..."
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
echo "🧮 [4/7] Đang khởi chạy robot_localization EKF (odom + IMU + SLAM fusion)..."
if [ -f "$EKF_LAUNCH" ]; then
    ros2 launch "$EKF_LAUNCH" &
    EKF_PID=$!
    echo "    📄 Dùng launch: $EKF_LAUNCH"
else
    echo "    ⚠️ Không thấy $EKF_LAUNCH — EKF sẽ không chạy (heading drift sẽ không được bù từ wheel)"
    EKF_PID=""
fi

# 5. Khởi ESP32-S3 ROS2 Bridge Node (publish /scan, /odom, /imu/data cho EKF input)
echo "📡 [5/7] Đang khởi chạy ESP32-S3 ROS2 Bridge Node..."
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

# 6. (Optional) Khởi Nav2 — chỉ chạy nếu đã save map trước đó.
#    Nếu không có map → skip (vẫn có /map realtime từ SLAM Toolbox để visualize).
echo "🧭 [6/7] (Optional) Khởi Nav2 nếu có map đã lưu..."
SAVED_MAP_YAML="${SAVED_MAP_YAML:-$HOME/.ros/saved_map/smb_map.yaml}"
if [ -f "$SAVED_MAP_YAML" ]; then
    echo "    📄 Load saved map: $SAVED_MAP_YAML"
    if ros2 pkg list 2>/dev/null | grep -q "^nav2_bringup$"; then
        ros2 launch nav2_bringup bringup_launch.py \
            map:="$SAVED_MAP_YAML" \
            use_sim_time:=False &
        NAV2_PID=$!
        echo "    ✅ Nav2 launched (PID=$NAV2_PID)"
    else
        echo "    ⚠️ nav2_bringup chưa cài (apt install ros-${ROS2_DISTRO}-nav2-bringup) — bỏ qua."
        NAV2_PID=""
    fi
else
    echo "    ℹ️  Chưa có saved map tại $SAVED_MAP_YAML — bỏ qua Nav2 (vẫn có /map từ SLAM)."
    NAV2_PID=""
fi

# 7. Health-check: đợi 5s rồi liệt kê topic ROS2 đang publish.
sleep 5
echo ""
echo "🔍 [7/7] Health check — danh sách topic ROS2 đang hoạt động:"
TOPICS=$(ros2 topic list 2>/dev/null | grep -E "^(/scan|/map|/odom|/imu/data|/odometry/filtered|/tf|/tf_static)$" | sort)
if [ -z "$TOPICS" ]; then
    echo "    ❌ Không tìm thấy topic SLAM/EKF. Kiểm tra:"
    echo "       • ESP32 đã connect WiFi 'FPTH_Student'?"
    echo "       • ESP32 firmware đã flash (USE_MICRO_ROS=1)?"
    echo "       • LiDAR X3 đã có scan (g_x3Scan.count > 0)?"
else
    echo "$TOPICS" | sed 's/^/       ✓ /'
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
trap "kill $ROSBRIDGE_PID $SLAM_PID $EKF_PID $BRIDGE_PID $NAV2_PID 2>/dev/null; exit" INT

wait
