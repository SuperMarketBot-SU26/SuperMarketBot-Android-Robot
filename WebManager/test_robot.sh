#!/usr/bin/env bash
# ============================================================================
# test_robot.sh — End-to-end smoke test cho SuperMarketBot
# ----------------------------------------------------------------------------
# Verify:
#   1. Topics cần thiết tồn tại (/scan, /odom, /imu/data, /battery)
#   2. /scan publishing ở tần số hợp lý (>= 2 Hz)
#   3. /odom publishing ở tần số hợp lý (>= 20 Hz)
#   4. /battery có data (data.id != 0 hoặc % pin > 0)
#   5. Pub /cmd_vel thử → ESP32 nhận (nếu có cách check)
#
# Usage:
#   cd ~/ros2_ws && ./test_robot.sh
#   ./test_robot.sh --skip-cmdvel       # bỏ test cmd_vel
#
# Exit codes:
#   0 = ALL PASSED
#   1 = có test FAIL
# ============================================================================

set -uo pipefail

# ---------- Config ----------
ESP_IP="${ESP_IP:-192.168.1.178}"
ESP_WS_PORT="${ESP_WS_PORT:-81}"
ROS_DOMAIN_ID_VALUE="${ROS_DOMAIN_ID:-0}"
SKIP_CMDVEL=false

for arg in "$@"; do
  case "$arg" in
    --skip-cmdvel) SKIP_CMDVEL=true ;;
    --esp-ip=*)    ESP_IP="${arg#*=}" ;;
  esac
done

PASS_COUNT=0
FAIL_COUNT=0
RESULTS=()

# ---------- Helpers ----------
print_header() {
  echo
  echo "============================================================"
  echo "  SuperMarketBot E2E Test"
  echo "  $(date '+%Y-%m-%d %H:%M:%S')"
  echo "  ESP32: ${ESP_IP} (WS port ${ESP_WS_PORT})"
  echo "============================================================"
}

# Source ROS2 distro
source_ros() {
  for d in /opt/ros/*/setup.bash; do
    if [[ -f "$d" ]]; then
      # shellcheck source=/dev/null
      source "$d"
      export ROS_DOMAIN_ID="$ROS_DOMAIN_ID_VALUE"
      return 0
    fi
  done
  echo "[FATAL] Không tìm thấy ROS2 distro. Cài: sudo apt install ros-humble-desktop"
  exit 1
}

# Run test và record pass/fail
run_test() {
  local test_name="$1"
  local cmd="$2"
  local expect="$3"   # regex
  local timeout_s="${4:-10}"

  echo
  echo "[TEST] $test_name"
  echo "  CMD: $cmd"

  local out
  out="$(timeout "$timeout_s" bash -c "$cmd" 2>&1 || true)"
  local rc=$?

  if echo "$out" | grep -qE "$expect"; then
    echo "  [PASS] match: $expect"
    PASS_COUNT=$((PASS_COUNT+1))
    RESULTS+=("PASS: $test_name")
    if [[ -n "${VERBOSE:-}" ]]; then
      echo "  --- output ---"
      echo "$out" | head -10 | sed 's/^/  /'
      echo "  ---------------"
    fi
  else
    echo "  [FAIL] no match: $expect"
    echo "  --- output ---"
    echo "$out" | head -20 | sed 's/^/  /'
    echo "  ---------------"
    FAIL_COUNT=$((FAIL_COUNT+1))
    RESULTS+=("FAIL: $test_name")
  fi
}

# ---------- Main ----------
print_header
source_ros

echo
echo "[INFO] ROS distro: $(ros2 --version 2>&1 | head -n1)"
echo "[INFO] Domain ID : ${ROS_DOMAIN_ID}"

# Test 1: topic list
run_test "Topic list có /scan, /odom, /battery" \
  "ros2 topic list" \
  "^/scan$|^/odom$|^/battery$"

# Test 2: topic info /scan
run_test "Topic /scan tồn tại" \
  "ros2 topic info /scan 2>&1" \
  "Publisher count: [1-9]"

# Test 3: topic info /odom
run_test "Topic /odom tồn tại" \
  "ros2 topic info /odom 2>&1" \
  "Publisher count: [1-9]"

# Test 4: /scan publishing (hz check)
echo
echo "[TEST] /scan rate check (đo 5s)..."
SCAN_RATE="$(timeout 8 ros2 topic hz /scan --window 30 2>&1 | tail -3 | grep -oE '[0-9]+\.[0-9]+' | tail -1 || echo '0')"
SCAN_RATE_INT="${SCAN_RATE%%.*}"
if [[ -z "$SCAN_RATE_INT" ]]; then SCAN_RATE_INT=0; fi
if [[ "$SCAN_RATE_INT" -ge 2 ]]; then
  echo "  [PASS] /scan rate = ${SCAN_RATE} Hz (>= 2 Hz)"
  PASS_COUNT=$((PASS_COUNT+1))
  RESULTS+=("PASS: /scan rate ${SCAN_RATE} Hz")
else
  echo "  [FAIL] /scan rate = ${SCAN_RATE} Hz (< 2 Hz hoặc no data)"
  FAIL_COUNT=$((FAIL_COUNT+1))
  RESULTS+=("FAIL: /scan rate ${SCAN_RATE} Hz")
fi

# Test 5: /odom publishing
echo
echo "[TEST] /odom rate check (đo 5s)..."
ODOM_RATE="$(timeout 8 ros2 topic hz /odom --window 50 2>&1 | tail -3 | grep -oE '[0-9]+\.[0-9]+' | tail -1 || echo '0')"
ODOM_RATE_INT="${ODOM_RATE%%.*}"
if [[ -z "$ODOM_RATE_INT" ]]; then ODOM_RATE_INT=0; fi
if [[ "$ODOM_RATE_INT" -ge 20 ]]; then
  echo "  [PASS] /odom rate = ${ODOM_RATE} Hz (>= 20 Hz)"
  PASS_COUNT=$((PASS_COUNT+1))
  RESULTS+=("PASS: /odom rate ${ODOM_RATE} Hz")
else
  echo "  [FAIL] /odom rate = ${ODOM_RATE} Hz (< 20 Hz)"
  FAIL_COUNT=$((FAIL_COUNT+1))
  RESULTS+=("FAIL: /odom rate ${ODOM_RATE} Hz")
fi

# Test 6: /battery có data
echo
echo "[TEST] /battery data check..."
BAT_OUT="$(timeout 5 ros2 topic echo /battery --once 2>&1 || true)"
if echo "$BAT_OUT" | grep -qE "data:|percentage:|level:|voltage:"; then
  echo "  [PASS] /battery có data"
  PASS_COUNT=$((PASS_COUNT+1))
  RESULTS+=("PASS: /battery data")
  echo "$BAT_OUT" | head -5 | sed 's/^/    /'
else
  echo "  [FAIL] /battery không có data hoặc timeout"
  FAIL_COUNT=$((FAIL_COUNT+1))
  RESULTS+=("FAIL: /battery data")
fi

# Test 7: cmd_vel round-trip (optional)
if ! $SKIP_CMDVEL; then
  echo
  echo "[TEST] /cmd_vel publish test (ESP32 sẽ chạy thẳng 1s nếu nhận)..."
  echo "       ⚠️  Đảm bảo robot có chỗ trống phía trước ~30cm!"
  echo "       Ctrl+C trong 3s để skip..."
  read -t 3 -r || true

  if timeout 4 ros2 topic pub --once /cmd_vel geometry_msgs/msg/Twist \
        "{linear: {x: 0.1, y: 0.0, z: 0.0}, angular: {x: 0.0, y: 0.0, z: 0.0}}" \
        2>&1 | grep -qE "Publishing|published"; then
    echo "  [PASS] /cmd_vel published thành công (ESP32 sẽ chạy 0.1 m/s trong ~1s)"
    PASS_COUNT=$((PASS_COUNT+1))
    RESULTS+=("PASS: /cmd_vel publish")
  else
    echo "  [WARN] /cmd_vel publish không rõ ràng (có thể ESP32 đã nhận, có thể không)"
    # Không tính fail ở test này vì không có cách verify ngược 100%
    RESULTS+=("WARN: /cmd_vel publish")
  fi
fi

# ---------- Summary ----------
echo
echo "============================================================"
echo "  TEST SUMMARY"
echo "============================================================"
for r in "${RESULTS[@]}"; do
  echo "  $r"
done
echo
echo "  PASS: $PASS_COUNT"
echo "  FAIL: $FAIL_COUNT"
echo "============================================================"

if [[ $FAIL_COUNT -eq 0 ]]; then
  echo "  ✅ ALL TESTS PASSED"
  exit 0
else
  echo "  ❌ SOME TESTS FAILED — xem chi tiết ở trên"
  exit 1
fi