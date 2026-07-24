#!/bin/bash
# ==============================================================================
# SMARTMARKETBOT — ROS2 SLAM TOOLBOX & ROSBRIDGE LAUNCH SCRIPT
# Khởi động Bộ Não ROS2 slam_toolbox + Rosbridge WebSocket Server (ws://localhost:9090)
# ==============================================================================

echo "🚀 [ROS2 Launch] Khởi động hệ thống ROS2 Dual-Engine cho WebManager..."

# 1. Source ROS2 Humble Environment
if [ -f "/opt/ros/humble/setup.bash" ]; then
    source /opt/ros/humble/setup.bash
    echo "✅ [1/3] Đã nạp môi trường ROS2 Humble."
else
    echo "⚠️ ROS2 Humble chưa được cài đặt tại /opt/ros/humble!"
fi

# 2. Khởi động rosbridge_server (Cổng kết nối WebSocket cho WebManager)
echo "⚡ [2/3] Đang khởi chạy Rosbridge WebSocket Server tại port 9090..."
ros2 launch rosbridge_server rosbridge_websocket_launch.xml &
ROSBRIDGE_PID=$!

# 3. Khởi động slam_toolbox (Bộ thuật toán SLAM chính chủ ROS2)
echo "🧠 [3/3] Đang khởi chạy slam_toolbox (Online Async SLAM)..."
ros2 launch slam_toolbox online_async_launch.py &
SLAM_PID=$!

echo ""
echo "🎉 HỆ THỐNG ROS2 CORE ĐÃ SẴN SÀNG!"
echo "🌐 Bây giờ bạn hãy mở WebManager (index.html) trên Trình duyệt."
echo "🔗 WebManager sẽ tự động kết nối tới ws://localhost:9090!"
echo ""
echo "Nhấn [Ctrl+C] để dừng toàn bộ hệ thống ROS2."

# Trap SIGINT to clean up background processes
trap "kill $ROSBRIDGE_PID $SLAM_PID; exit" INT

wait
