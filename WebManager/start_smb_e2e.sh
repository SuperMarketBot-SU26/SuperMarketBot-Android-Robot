#!/usr/bin/env bash
# ============================================================================
# start_smb_e2e.sh — Chạy E2E SuperMarketBot chỉ với 1 lệnh
# ----------------------------------------------------------------------------
# Tự động:
#   1. Source ROS2 distro (auto-detect Humble/Lyrical/Kilted/Jazzy)
#   2. Verify ros2 CLI hoạt động
#   3. Verify ESP32 IP có ping được (mặc định 192.168.1.178)
#   4. Khởi 3 process nền (background):
#        - ESP32 ↔ ROS2 bridge (Terminal #1)
#        - rosbridge_server (Terminal #2)
#        - Wait-loop verify topics (thay cho Terminal #3 thủ công)
#   5. Chạy test_robot.sh E2E (nếu tồn tại ~/ros2_ws/test_robot.sh)
#   6. In hướng dẫn mở WebManager
#
# Usage:
#   ./start_smb_e2e.sh                    # dùng IP mặc định 192.168.1.178
#   ./start_smb_e2e.sh 192.168.1.50       # custom IP
#   ESP_IP=192.168.1.50 ./start_smb_e2e.sh
#
# Stop:
#   ./start_smb_e2e.sh stop                # kill cả 3 process
#   hoặc: kill $(cat /tmp/smb_bridge.pid /tmp/smb_rosbridge.pid)
# ============================================================================

set -euo pipefail

# ---------- Config ----------
ESP_IP="${1:-${ESP_IP:-192.168.1.178}}"
ESP_WS_PORT="${ESP_WS_PORT:-81}"
ROSBRIDGE_PORT="${ROSBRIDGE_PORT:-9090}"
ROS_DOMAIN_ID_VALUE="${ROS_DOMAIN_ID:-0}"

SMB_HOME_DEFAULT="$HOME/ros2_ws"
SMB_HOME="${SMB_HOME:-$SMB_HOME_DEFAULT}"

BRIDGE_DIR_DEFAULT="$HOME/SuperMarketBot-Android-Robot/SuperMarketBot-IOT/ros2_bridge"
BRIDGE_DIR="${BRIDGE_DIR:-$BRIDGE_DIR_DEFAULT}"

BRIDGE_PID_FILE="/tmp/smb_bridge.pid"
ROSBRIDGE_PID_FILE="/tmp/smb_rosbridge.pid"
LOG_DIR="${HOME}/.smb_logs"
mkdir -p "$LOG_DIR"

# ---------- Banner ----------
print_banner() {
  echo "============================================================"
  echo "  SuperMarketBot E2E Launcher"
  echo "  ESP32 IP   : ${ESP_IP}"
  echo "  ESP32 WS   : ws://${ESP_IP}:${ESP_WS_PORT}"
  echo "  Rosbridge  : ws://0.0.0.0:${ROSBRIDGE_PORT}"
  echo "  Domain ID  : ${ROS_DOMAIN_ID_VALUE}"
  echo "  ros2_ws    : ${SMB_HOME}"
  echo "  bridge dir : ${BRIDGE_DIR}"
  echo "============================================================"
}

# ---------- Stop mode ----------
if [[ "${1:-}" == "stop" ]]; then
  echo "[STOP] Killing SuperMarketBot E2E processes..."
  for pf in "$BRIDGE_PID_FILE" "$ROSBRIDGE_PID_FILE"; do
    if [[ -f "$pf" ]]; then
      pid="$(cat "$pf")"
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" && echo "[STOP] Killed PID $pid ($pf)"
      else
        echo "[STOP] PID $pid ($pf) already dead"
      fi
      rm -f "$pf"
    fi
  done
  # cleanup any stragglers
  pkill -f "esp32_ros2_bridge.py" 2>/dev/null || true
  pkill -f "rosbridge_websocket"   2>/dev/null || true
  exit 0
fi

print_banner

# ---------- 1. Auto-detect ROS2 distro ----------
echo "[1/6] Auto-detecting ROS2 distro..."
ROS_SETUP=""
for d in /opt/ros/*/setup.bash; do
  if [[ -f "$d" ]]; then
    ROS_SETUP="$d"
    ROS_DISTRO="$(basename "$(dirname "$d")")"
    break
  fi
done

if [[ -z "$ROS_SETUP" ]]; then
  echo "[ERROR] Không tìm thấy ROS2 distro nào trong /opt/ros/"
  echo "        Cài đặt: sudo apt install ros-humble-desktop"
  exit 1
fi

# shellcheck source=/dev/null
source "$ROS_SETUP"
export ROS_DOMAIN_ID="$ROS_DOMAIN_ID_VALUE"
echo "[OK]   Sourced $ROS_DISTRO (ROS_DOMAIN_ID=$ROS_DOMAIN_ID)"

# ---------- 2. Verify ros2 CLI ----------
echo "[2/6] Verifying ros2 CLI..."
if ! command -v ros2 >/dev/null 2>&1; then
  echo "[ERROR] 'ros2' không có trong PATH sau khi source $ROS_SETUP"
  exit 1
fi
echo "[OK]   $(ros2 --version 2>&1 | head -n1)"

# ---------- 3. Ping ESP32 ----------
echo "[3/6] Pinging ESP32 (${ESP_IP})..."
if timeout 3 ping -c 1 -W 2 "$ESP_IP" >/dev/null 2>&1; then
  echo "[OK]   ESP32 reachable"
else
  echo "[WARN] ESP32 ${ESP_IP} KHÔNG ping được!"
  echo "        - Đã cắm nguồn + WiFi OK chưa?"
  echo "        - Đã đúng IP chưa? (xem Serial Monitor ESP32 lúc boot)"
  echo "        - Vẫn tiếp tục chạy, có thể ESP32 sẽ reconnect sau..."
fi

# ---------- 4. Cleanup old processes ----------
echo "[4/6] Cleaning up old SMB processes..."
for pf in "$BRIDGE_PID_FILE" "$ROSBRIDGE_PID_FILE"; do
  if [[ -f "$pf" ]]; then
    pid="$(cat "$pf")"
    kill "$pid" 2>/dev/null || true
    rm -f "$pf"
  fi
done
pkill -f "esp32_ros2_bridge.py" 2>/dev/null || true
pkill -f "rosbridge_websocket"   2>/dev/null || true
sleep 1

# ---------- 5. Start ESP32 ↔ ROS2 bridge ----------
echo "[5/6] Starting ESP32 ↔ ROS2 bridge (background)..."
BRIDGE_LOG="$LOG_DIR/smb_bridge.log"
if [[ -d "$BRIDGE_DIR" ]]; then
  cd "$BRIDGE_DIR"
  nohup python3 esp32_ros2_bridge.py \
      --ros-args -p esp32_ip:="$ESP_IP" \
      >"$BRIDGE_LOG" 2>&1 &
  echo $! > "$BRIDGE_PID_FILE"
  echo "[OK]   PID $(cat "$BRIDGE_PID_FILE") — log: $BRIDGE_LOG"
else
  echo "[WARN] Không tìm thấy bridge script ở $BRIDGE_DIR — bỏ qua."
  echo "        Đặt script ở: $BRIDGE_DIR/esp32_ros2_bridge.py"
fi

# ---------- 6. Start rosbridge_server ----------
echo "[6/6] Starting rosbridge_server (background)..."
ROSBRIDGE_LOG="$LOG_DIR/smb_rosbridge.log"
nohup ros2 launch rosbridge_server rosbridge_websocket_launch.xml \
    >"$ROSBRIDGE_LOG" 2>&1 &
echo $! > "$ROSBRIDGE_PID_FILE"
echo "[OK]   PID $(cat "$ROSBRIDGE_PID_FILE") — log: $ROSBRIDGE_LOG"

# ---------- Wait for topics ----------
echo
echo "[WAIT] Đợi các topic xuất hiện (tối đa 30s)..."
TOPICS_OK=false
for i in $(seq 1 30); do
  if ros2 topic list 2>/dev/null | grep -qE "/scan|/odom"; then
    TOPICS_OK=true
    echo "[OK]   Topics đã sẵn sàng sau ${i}s"
    break
  fi
  sleep 1
done

if ! $TOPICS_OK; then
  echo "[WARN] Topics chưa xuất hiện sau 30s. Check logs:"
  echo "       $BRIDGE_LOG"
  echo "       $ROSBRIDGE_LOG"
fi

# ---------- Show running topics ----------
echo
echo "[TOPICS] Danh sách topic đang hoạt động:"
ros2 topic list 2>/dev/null | sed 's/^/  /' || echo "  (ros2 topic list thất bại)"

echo
echo "[TOPICS] Rate check:"
echo "  /scan:    $(ros2 topic hz /scan    --window 5 2>/dev/null | tail -1 || echo 'N/A')"
echo "  /odom:    $(ros2 topic hz /odom    --window 5 2>/dev/null | tail -1 || echo 'N/A')"
echo "  /battery: $(ros2 topic hz /battery --window 5 2>/dev/null | tail -1 || echo 'N/A')"

# ---------- Run test_robot.sh ----------
echo
if [[ -x "$SMB_HOME/test_robot.sh" ]]; then
  echo "[TEST] Chạy test_robot.sh..."
  cd "$SMB_HOME" && ./test_robot.sh
  TEST_RC=$?
  if [[ $TEST_RC -eq 0 ]]; then
    echo "[TEST] ✅ test_robot.sh PASSED"
  else
    echo "[TEST] ❌ test_robot.sh FAILED (rc=$TEST_RC) — xem log ở trên"
  fi
else
  echo "[TEST] Bỏ qua: không tìm thấy $SMB_HOME/test_robot.sh (chmod +x để enable)"
fi

# ---------- Final instructions ----------
cat <<EOF

============================================================
  ✅ SuperMarketBot E2E đã khởi động
============================================================

  📡 ESP32 WS     : ws://${ESP_IP}:${ESP_WS_PORT}
  🌉 Rosbridge WS : ws://<ubuntu_ip>:${ROSBRIDGE_PORT}
  📋 Logs:
    - bridge    : ${BRIDGE_LOG}
    - rosbridge : ${ROSBRIDGE_LOG}

  🌐 Bước tiếp theo: Mở WebManager (Chrome)
    - Mở file index.html (SuperMarketBot-Android-Robot/WebManager/)
    - Hoặc truy cập URL đã deploy (vd http://localhost:8080)

  🛑 Dừng hệ thống:
    ./start_smb_e2e.sh stop
    hoặc: kill \$(cat ${BRIDGE_PID_FILE} ${ROSBRIDGE_PID_FILE})

  🔁 Xem log real-time:
    tail -f ${BRIDGE_LOG}
    tail -f ${ROSBRIDGE_LOG}
============================================================
EOF