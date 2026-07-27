# SmartMarketBot - Workflow Vận Hành Sau Khi Fix

> Tài liệu này mô tả quy trình vận hành E2E sau khi áp dụng 6 bước fix (2026-07-27).
> Đối tượng: người vận hành siêu thị (demo) + team nội bộ phát triển.

---

## 1. Khởi động hệ thống

### Bước 1.1 — ESP32-S3 firmware
1. Mở Arduino IDE, mở project `SuperMarketBot-IOT/ESP32-S3/SuperMarketBot-IOT/SuperMarketBot-IOT.ino`
2. **Verify Config.h** đã đúng:
   - `USE_ENCODER_HARDWARE = 1` ✅
   - `ENC_L = 35`, `ENC_R = 36` đã cắm đúng 2 dây signal encoder
3. Flash firmware → ESP32 boot, kết nối WiFi (AP/STA tùy cấu hình), IP `192.168.1.178` (ghi nhận IP in ra Serial Monitor lúc boot để dùng bước sau)

### Bước 1.2 — Ubuntu (PC ROS2) — 🚀 KHUYẾN NGHỊ: chạy 1 lệnh duy nhất

> **Bạn tôi chỉ cần 1 lệnh.** Hai script tự động hóa toàn bộ: source ROS2, ping ESP32, khởi bridge + rosbridge, đợi topics, chạy test E2E.

```bash
# 1) Copy 2 script vào ros2 workspace (lần đầu tiên)
mkdir -p ~/ros2_ws
cp SuperMarketBot-Android-Robot/WebManager/start_smb_e2e.sh ~/ros2_ws/
cp SuperMarketBot-Android-Robot/WebManager/test_robot.sh      ~/ros2_ws/
chmod +x ~/ros2_ws/start_smb_e2e.sh ~/ros2_ws/test_robot.sh

# 2) Chạy
cd ~/ros2_ws
./start_smb_e2e.sh                       # dùng IP mặc định 192.168.1.178
# hoặc: ./start_smb_e2e.sh 192.168.1.50  # custom IP
# hoặc: ESP_IP=192.168.1.50 ./start_smb_e2e.sh
```

**Script tự động làm:**
1. Source ROS2 distro (auto-detect Humble/Lyrical/Kilted/Jazzy)
2. Verify `ros2 --version`
3. Ping ESP32 (3s timeout — warn nếu fail nhưng vẫn chạy tiếp)
4. Khởi **ESP32 ↔ ROS2 bridge** (background, log → `~/.smb_logs/smb_bridge.log`)
5. Khởi **rosbridge_server** (background, log → `~/.smb_logs/smb_rosbridge.log`)
6. Đợi topics xuất hiện (tối đa 30s, hiển thị `/scan`, `/odom`, `/battery` rate)
7. Chạy `test_robot.sh` E2E test (7 test cases: topics + rate + battery + cmd_vel)
8. In hướng dẫn mở WebManager

**Verify cuối:**
```
============================================================
  ✅ SuperMarketBot E2E đã khởi động
============================================================
  📡 ESP32 WS     : ws://192.168.1.178:81
  🌉 Rosbridge WS : ws://<ubuntu_ip>:9090
  📋 Logs:
    - bridge    : /home/<user>/.smb_logs/smb_bridge.log
    - rosbridge : /home/<user>/.smb_logs/smb_rosbridge.log
  🌐 Bước tiếp theo: Mở WebManager (Chrome)
============================================================
```

**Dừng hệ thống:**
```bash
./start_smb_e2e.sh stop
# hoặc: kill $(cat /tmp/smb_bridge.pid /tmp/smb_rosbridge.pid)
```

**Xem log real-time:**
```bash
tail -f ~/.smb_logs/smb_bridge.log
tail -f ~/.smb_logs/smb_rosbridge.log
```

---

### Bước 1.2-bis — Fallback: Quy trình 3 terminal (nếu script lỗi)

> Dùng khi `start_smb_e2e.sh` không hoạt động (vd: package rosbridge_server chưa cài, bridge script ở path khác).

**Terminal #1 — ESP32 ↔ ROS2 bridge** (publish `/scan`, `/odom`, `/imu`, `/battery`, nhận `/cmd_vel`)
```bash
python3 esp32_ros2_bridge.py --ros-args -p esp32_ip:=192.168.1.178
```
- Verify: `[Bridge] Connected to ESP32 WS://192.168.1.178:81`
- Verify: `[Bridge] Publishing /scan, /odom, /imu, /battery, /cmd_vel`

**Terminal #2 — rosbridge_server** (WebSocket port 9090 — WebManager kết nối vào đây)
```bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```
- Verify: `[rosbridge_websocket_server] WebSocket server started on port 9090`

**Terminal #3 — Verify topics & test**
```bash
# Mở terminal mới (giữ 2 terminal trên chạy nền)
ros2 topic list                    # phải thấy: /scan, /odom, /imu/data, /battery, /cmd_vel, /tf, /tf_static
ros2 topic hz /scan                # ~5–10 Hz (YDLIDAR X3)
ros2 topic hz /odom                # ~50 Hz (từ ESP32)
ros2 topic echo /odom --once       # pose hợp lệ (x, y, heading thay đổi khi robot chuyển động)
ros2 topic echo /battery --once    # % pin > 0
```

Sau ~5s, danh sách topic đang hoạt động phải đầy đủ. Nếu thiếu → xem **Bước 6 — Troubleshooting**.

### Bước 1.3 — WebManager
1. Mở `index.html` trong Chrome (Chrome hỗ trợ WebSocket tốt nhất)
2. Đợi ~3s để kết nối Rosbridge (`ws://<ubuntu_ip>:9090`) + ESP32 WS (`ws://192.168.1.178:81`)
3. Kiểm tra:
   - **LiDAR Log panel** → hiển thị `[YDLIDAR X3] 360° Scan #N | Points: ~350` (nếu firmware ESP32 đã chạy)
   - **Robot Status badge** → xanh "ONLINE"
   - **Pose (x, y, heading)** → cập nhật mỗi 100ms

### Bước 1.4 — Chạy `test_robot.sh` (script test tự động E2E)

> **Nếu dùng `start_smb_e2e.sh`** (Bước 1.2 khuyến nghị) → `test_robot.sh` đã được chạy tự động. Bỏ qua bước này.
>
> **Nếu dùng quy trình 3 terminal** (Bước 1.2-bis fallback) → mở Terminal mới và chạy:

```bash
cd ~/ros2_ws && ./test_robot.sh
# Options:
#   ./test_robot.sh --skip-cmdvel       # bỏ test publish /cmd_vel
#   ./test_robot.sh --esp-ip=192.168.1.50
```

**Script sẽ tự động (7 test cases):**
1. Source ROS2 distro
2. Verify topic list có `/scan`, `/odom`, `/battery`
3. Verify `/scan` có publisher
4. Verify `/odom` có publisher
5. Đo rate `/scan` (đòi hỏi ≥ 2 Hz)
6. Đo rate `/odom` (đòi hỏi ≥ 20 Hz)
7. Verify `/battery` có data
8. (Optional) Pub `/cmd_vel` 0.1 m/s trong 1s — **đẩy robot ra chỗ trống trước!**

**Verify kết quả cuối:**
```
============================================================
  TEST SUMMARY
============================================================
  PASS: Topic list có /scan, /odom, /battery
  PASS: Topic /scan tồn tại
  PASS: Topic /odom tồn tại
  PASS: /scan rate 8.5 Hz
  PASS: /odom rate 50.2 Hz
  PASS: /battery data
  ✅ ALL TESTS PASSED
============================================================
```

**Exit codes:**
- `0` = tất cả PASS → hệ thống sẵn sàng cho **Bước 2 — AUTO_EXPLORE** hoặc **Bước 3 — WAYPOINT**
- `1` = có FAIL → xem log:
  - `~/.smb_logs/smb_bridge.log` (bridge)
  - `~/.smb_logs/smb_rosbridge.log` (rosbridge)
  - ESP32 Serial Monitor

---

## 2. Quét Map tự động (Mode AUTO_EXPLORE)

### 2.1 Kích hoạt
1. WebManager → Panel **"AUTO SCAN MAP"** → click **"🚀 Bắt đầu quét"**
2. Modal mở → đặt tên map → check **"Auto-save map"** → **"Bắt đầu"**
3. Robot vào MODE_AUTO_EXPLORE:
   - CRUISE: bám tường phải (cung LIDAR 60-120°)
   - SPIN_DETECT: khi mất tường → quay 360° tìm hướng trống
   - AVOID_US: khi US < 25cm → lùi 600ms
4. Tiến trình hiển thị: **Coverage %**, **Distance (m)**, **FSM state**

### 2.2 Kết thúc
- Khi `coverage ≥ 95%` hoặc timeout 10 phút → ESP32 publish `scan_complete` qua WS
- WebManager nhận → gọi `POST /api/v1/maps/save-slam` (PNG occupancy_grid)
- BE lưu map → trả `mapId` → WebManager hiển thị "MapId: X — Mở Map Editor"

### 2.3 Nếu muốn dừng sớm
- Click **"⏹ Dừng"** → ESP32 publish `scan_stop` → dừng ngay

---

## 3. Tạo Waypoint (Mode WAYPOINT)

### 3.1 Mở Map Editor
1. Sau khi scan complete → click **"Mở Map Editor"**
2. WebManager load danh sách nodes từ `/api/v1/maps/latest`
3. Canvas hiển thị bản đồ (PNG) + nodes/edges đã lưu

### 3.2 Thêm Node
1. Chọn tool **"Node"** (toolbar)
2. Click lên map tại vị trí muốn đặt waypoint
3. Modal mở → nhập tên node (vd: "Kệ rau A1") → Save
4. Node hiển thị trên map với ID

### 3.3 Tạo Route
1. Chọn tool **"Route"**
2. Click lần lượt các node theo thứ tự muốn robot đi
3. Route hiển thị dạng polyline
4. Save → BE lưu vào DB

### 3.4 Chạy Route
1. Click **"▶ Chạy Route"**
2. WebManager gửi `{t:"navigate", payload:{waypoints:[{x,y,nodeId},...]}}` qua WS port 81
3. ESP32 nhận → `wpNavSetRoute()` → `wpNavStart()` → MODE_WAYPOINT
4. Robot chạy:
   - Spin-once đến khi alpha < 20° (heading locked)
   - PID yaw bẻ lái dọc segment
   - Snap-to-90° cho siêu thị layout lưới vuông
   - Khi đến WP → next WP
   - Hết route → MODE_MANUAL, publish `wp_done`

### 3.5 Nếu gặp vật cản
1. ESP32 OA active → 5 FSM states (IDLE→EVALUATE→BACKUP→TURN→STRAIGHTEN→RESUME)
2. Nếu OA_BLOCKED (kẹt cứng) → ESP32 publish `reroute_needed` qua MQTT
3. BE nhận → tính route mới (tránh vật cản) → gửi lại ESP32
4. ESP32 nhận `navigate` mới → chạy route mới

---

## 4. Lưu/Load Map (Save/Load)

### 4.1 Auto-save sau scan
- WebManager `app.js:2556-2612` — tự động gọi `POST /api/v1/maps/save-slam`
- BE lưu PNG + metadata vào DB

### 4.2 Manual save
- BE API: `POST /api/v1/maps/sync` (form data PNG + JSON metadata)
- Body: `{ floorId, mapName, pngBlob, resolution, originX, originY }`

### 4.3 Load map
- `GET /api/v1/maps/latest?floorId=X` → trả metadata + PNG
- WebManager render PNG + nodes/edges lên Canvas

### 4.4 BE endpoint cần có
| Method | Endpoint | Body | Trả về |
|--------|----------|------|--------|
| GET    | `/api/v1/maps/latest?floorId=X` | — | `{nodes, edges, pngUrl, mapId}` |
| POST   | `/api/v1/maps/sync` | `{floorId, mapName, pngBlob}` | `{ok: true, mapId}` |
| POST   | `/api/v1/maps/save-slam` | FormData (PNG, JSON params) | `{ok: true, mapId}` |
| GET    | `/api/v1/maps/:id` | — | `{pngBlob, metadata}` |

---

## 5. End-to-end Test Checklist

### Test 1: ESP32 ↔ Ubuntu (basic)
- [ ] ESP32 connect WiFi → IP `192.168.1.178` (hoặc IP in ra Serial Monitor lúc boot)
- [ ] Ubuntu connect cùng WiFi → IP cùng subnet (vd `192.168.1.X`)
- [ ] Ping 2 chiều OK (`ping 192.168.1.178` từ Ubuntu và ngược lại nếu cần)
- [ ] ESP32 Serial log hiển thị `[YDLIDAR X3] 360° Scan #N`

### Test 2: ROS2 stack
- [ ] Terminal #1 (bridge) in `[Bridge] Connected to ESP32 WS://192.168.1.178:81`
- [ ] Terminal #2 (rosbridge) in `[rosbridge_websocket_server] WebSocket server started on port 9090`
- [ ] Terminal #3: `ros2 topic list` có `/scan`, `/odom`, `/imu/data`, `/battery`, `/cmd_vel`, `/tf`
- [ ] `ros2 topic hz /scan` → ~5–10 Hz
- [ ] `ros2 topic hz /odom` → ~50 Hz
- [ ] `ros2 topic echo /battery --once` → % pin > 0

### Test 3: WebManager
- [ ] Mở `index.html` → WebSocket connected badge xanh
- [ ] Pose (x,y,heading) cập nhật real-time
- [ ] LiDAR Log có log mỗi 5s
- [ ] Occupancy grid render (nếu SLAM build map)

### Test 4: test_robot.sh
- [ ] `cd ~/ros2_ws && ./test_robot.sh` → in `ALL TESTS PASSED ✅`
- [ ] Bridge log có `[WS] cmd_vel ack` từ ESP32
- [ ] ESP32 Serial có `[CMD] v=0.10 w=0.00` (hoặc tương tự) khi script pub /cmd_vel

### Test 4: AUTO_EXPLORE
- [ ] Click AUTO_SCAN_START → robot bắt đầu bám tường
- [ ] Coverage tăng dần (0% → 95%)
- [ ] Khi coverage ≥ 95% → scan_complete → auto-save map
- [ ] BE trả mapId → hiển thị trong modal

### Test 5: WAYPOINT
- [ ] Map Editor load nodes từ BE
- [ ] Tạo 3+ nodes + 1 route
- [ ] Click Run Route → ESP32 vào MODE_WAYPOINT
- [ ] Robot chạy theo route, đến từng node, hết route về MANUAL
- [ ] Logs `[WP] WP[N] reached` cho mỗi node

### Test 6: SLAM pose feedback
- [ ] Mở Serial Monitor ESP32
- [ ] Di chuyển robot bằng tay
- [ ] Serial log: `[SLAM] Pose jump: Δpos=Xm Δh=Y° → (X, Y, Z°)` khi SLAM "snap"
- [ ] Kiểm tra pose (x,y) trên WebManager khớp với thực tế

### Test 7: Mode guard
- [ ] Nhấn EStop → click WAYPOINT mode → phải bị từ chối ("EStop ACTIVE")
- [ ] Release EStop (click EStop lần 2) → click WAYPOINT → OK
- [ ] Click WAYPOINT khi route rỗng → log "MODE_WAYPOINT yêu cầu nhưng route rỗng — đợi lệnh navigate"
- [ ] Click WAYPOINT sau khi load route từ BE → robot chạy

---

## 6. Troubleshooting

### Lỗi: `ros2: command not found` sau khi source setup.bash
- Triệu chứng: script source distro OK nhưng `ros2` không có trong PATH
- Nguyên nhân phổ biến:
  1. Folder `/opt/ros/<distro>/` rỗng (cài đặt chưa hoàn tất) — kiểm tra: `ls /opt/ros/<distro>/ | head -5`
  2. Source sai file — phải là `setup.bash` (không phải `setup.sh` hay file khác)
  3. Cài thiếu package — ROS2 trên Ubuntu 26.04 cần `ros-lyrical-ros-base` chứ không chỉ `ros-lyrical-desktop`
- Script v2.4 sẽ in diagnostic rõ ràng + hướng dẫn `apt install ros-${ROS_DISTRO}-ros-base` + exit 1 sạch sẽ
- Fix:
  ```bash
  # Kiểm tra distro thực sự có sẵn và có file ros2
  ls /opt/ros/<distro>/ros2/

  # Ép dùng distro cụ thể
  ./start_smb_e2e.sh --distro=lyrical

  # Cài bổ sung ros-base nếu thiếu
  sudo apt install ros-<distro>-ros-base ros-<distro>-rosbridge-server
  ```

### Lưu ý: ROS2 distro cho từng Ubuntu version
- Ubuntu 26.04+ → **lyrical** (chính thức từ May 2026, theo REP 2000)
- Ubuntu 24.04 → kilted / jazzy / rolling
- Ubuntu 22.04 → humble (LTS) / iron (EOL)
- Ubuntu 20.04 → foxy (EOL, không khuyến nghị)
- Script v2.4 auto-pick theo thứ tự: `lyrical > kilted > jazzy > rolling > humble > iron`

### Lỗi: Script crash với `unbound variable` khi source setup.bash
- Script v2.3 đã bỏ `set -u` để xử lý. Nếu vẫn gặp → báo lại (đây là bug distro cụ thể).

### Lỗi: Bridge (Terminal #1) không connect ESP32
- Check IP trong Serial Monitor ESP32 lúc boot → đảm bảo khớp `-p esp32_ip:=192.168.1.178`
- Ping thử: `ping 192.168.1.178` (từ Ubuntu)
- Nếu ESP32 reset liên tục → mở Serial Monitor xem lỗi boot
- Nếu WiFi OK nhưng WS fail → ESP32 đã ngừng lắng nghe WS port 81 → reset ESP32

### Lỗi: rosbridge (Terminal #2) không start được
- Lỗi `package rosbridge_server not found` → `sudo apt install ros-<distro>-rosbridge-server`
- Lỗi port 9090 đã bị chiếm → `sudo lsof -i :9090` rồi kill process
- Sau khi launch, test: `ros2 service list | grep rosbridge`

### Lỗi: `ros2 topic list` rỗng
- Terminal #1 (bridge) đã chạy và in `[Bridge] Publishing...` chưa? Nếu chưa → fix bridge trước
- Terminal #2 (rosbridge) đã in `WebSocket server started` chưa? Nếu chưa → fix rosbridge trước
- Cả 2 OK mà topic vẫn rỗng → check `ROS_DOMAIN_ID` phải giống nhau giữa các terminal:
  ```bash
  echo $ROS_DOMAIN_ID    # chạy ở mỗi terminal phải ra cùng giá trị
  ```

### Lỗi: Topics không xuất hiện sau 30s (case "Lyrical" / Ubuntu 26.04 OK nhưng topics rỗng)

- **Triệu chứng**: Script chạy đến `[WAIT] Đợi các topic xuất hiện (tối đa 30s)` rồi fail với `[WARN] Topics chưa xuất hiện sau 30s`.
- **Script v2.5 sẽ tự động**:
  1. Probe ESP32 WS port 81 (đảm bảo port open)
  2. Print 20 dòng cuối của `smb_bridge.log`
  3. Check bridge process còn alive không (kill -0)
  4. Print 5 dòng log cuối nếu alive
- **Nguyên nhân phổ biến** (theo thứ tự):
  1. **ESP32 chưa flash firmware** → Serial Monitor trống → bridge chờ WS không kết nối được
  2. **ESP32 firmware start nhưng chưa init YDLIDAR X3** → Serial log thiếu `[YDLIDAR X3] 360° Scan #N`
  3. **Sai IP ESP32** → bridge thử connect IP cũ nhưng ESP32 đã đổi IP khi reconnect WiFi
  4. **Bridge script path sai** → bridge không tìm thấy `esp32_ros2_bridge.py`
  5. **Linux firewall** → port 81 bị chặn
- **Diagnose thủ công**:
  ```bash
  # 1. Ping ESP32
  ping -c3 $ESP_IP

  # 2. Probe WS port 81
  nc -zv $ESP_IP 81         # cài: sudo apt install netcat

  # 3. Xem bridge log live
  tail -f ~/.smb_logs/smb_bridge.log

  # 4. Test bridge manually (foreground, không nohup)
  cd ~/SuperMarketBot-Android-Robot/SuperMarketBot-IOT/ros2_bridge
  python3 esp32_ros2_bridge.py --ros-args -p esp32_ip:=$ESP_IP
  ```

### Lỗi: Bridge chạy nhưng topics rỗng (case Lyrical-specific)
- Triệu chứng: bridge log OK nhưng `ros2 topic list` rỗng
- Lý do khả nghi nhất trên Ubuntu 26.04 + Lyrical: **ROS_DOMAIN_ID không khớp** giữa bridge và rosbridge
- Script v2.5 đã set `ROS_DOMAIN_ID=$ROS_DOMAIN_ID_VALUE` (default 0) ở cả 2 process → đã fix.
- Nếu vẫn lệch → check:
  ```bash
  echo $ROS_DOMAIN_ID    # phải ra cùng giá trị ở mọi terminal
  ```

### Lỗi: Robot không di chuyển sau khi nhấn AUTO_SCAN
- Check Serial Monitor: `[AUTO-EXPLORE] Front US < 25cm → AVOID_US` liên tục?
  → US sensor dính vật cản gần → kiểm tra dây US hoặc giảm `AUTO_EXPLORE_US_BRAKE_MM` xuống 15cm
- Check: `[AUTO-EXPLORE] Mất tường phải → SPIN_DETECT` liên tục?
  → Robot mất tường (phòng quá rộng >1.5m) → tăng `AUTO_EXPLORE_MIN_WALL_DIST_MM` lên 50cm

### Lỗi: SLAM map méo, tường nhảy
- Check `mapper_params_online_async.yaml`: `link_match_minimum_response_fine: 0.75` (quá cao → tường thẳng hơn nhưng khó match)
- Thử giảm xuống 0.5 nếu map quá thưa

### Lỗi: Pose (x,y) trôi dù có SLAM
- Check rate-limit `locSetSlamPose()` (100ms = 10Hz)
- Check bridge Python log: có publish `slam_pose` qua WS không
- Có thể ESP32 chưa nhận WS → check Serial Monitor có log `[WS] slam_pose x=X y=Y h=H` không

### Lỗi: ROS2 agent không khởi động
- Check log `[1/7]` → distro nào đã detect?
- Nếu `Không tìm thấy ROS2 distro nào` → cài `ros-humble-desktop` hoặc `ros-lyrical-desktop`
- Check `command -v ros2` có trả về đường dẫn không

### Lỗi: test_robot.sh fail
- Quyền thực thi: `chmod +x ~/ros2_ws/test_robot.sh`
- `ros2_ws` chưa build: `cd ~/ros2_ws && colcon build --symlink-install`
- Source ROS2 trong script sai → kiểm tra dòng `source /opt/ros/<distro>/setup.bash`
- Xem log terminal tương ứng (bridge/rosbridge) trước khi retry
- Trên Ubuntu 26.04 + Lyrical: phải dùng ROS_DOMAIN_ID=0 khớp cả bridge + rosbridge + test_robot.sh

---

## 7. File quan trọng đã thay đổi

| File | Thay đổi |
|------|----------|
| `start_smb_e2e.sh` | v2.5: Fix `set -u` + auto-detect distro (ưu tiên Lyrical cho Ubuntu 26.04) + WS port 81 probe + bridge alive check + wait progress + flags `--distro=`, `--skip-test`, `--no-bridge`, `--no-rosbridge` |
| `mapper_params_online_async.yaml` | Thêm `max_update_range`, `map_update_interval` |
| `Odometry.h` | Viết lại: ISR encoder + RPM/dist thật |
| `Localization.h` | Overload `locUpdate(dsL, dsR, dt)` + rate-limit slam_pose + debug log |
| `ImuMpu6050.h` | Thêm `imuMpu6050GetGyroZ()` API |
| `SuperMarketBot-IOT.ino` | taskControl dùng gyroZ thô thay vì delta_heading/dt |
| `MotorControlPro.h` | Thêm `botDriveSmoothNormal()` (differential + smooth) |
| `AutoExplore.h` | Dùng `botDriveSmoothNormal()` cho CRUISE + AVOID_US |
| `WaypointNav.h` | Dùng `botDriveSmoothNormal()` cho forward drive |
| `LocalObstacleAvoid.h` | `oaCruiseForward` dùng `botDriveSmoothNormal()` |
| `CtrlJson.h` | Bỏ fake waypoint + EStop guard |
| `esp32_ros2_bridge.py` | Rate-limit `/amcl_pose` → WS (10Hz) |

---

*Phiên bản: v2.5 (2026-07-27) — Tác giả: Cursor Agent (claude-fable-5)*
*Thay đổi v2.1: Chuẩn hóa quy trình Ubuntu theo 3 terminal (bridge + rosbridge + test_robot.sh) — bỏ start_ros2_web_bridge.sh gộp; đổi IP ESP32 → 192.168.1.178.*
*Thay đổi v2.2: Thêm `start_smb_e2e.sh` (1 lệnh duy nhất) làm workflow chính; 3 terminal làm fallback. Thêm `test_robot.sh` E2E test (7 test cases: topics + rate + battery + cmd_vel).*
*Thay đổi v2.3: Fix bug `set -u` crash + auto-detect distro hợp lệ + thêm flags `--distro=`, `--skip-test`, `--no-bridge`, `--no-rosbridge`.*
*Thay đổi v2.4: Hỗ trợ chính thức ROS2 Lyrical Luth cho Ubuntu 26.04+ (theo REP 2000, phát hành May 2026). Priority: lyrical > kilted > jazzy > rolling > humble > iron.*
*Thay đổi v2.5: Thêm WS port 81 probe + bridge alive check + wait progress (5s) + auto-print 20 dòng log khi topics fail → tự diagnose không cần hỏi.*
