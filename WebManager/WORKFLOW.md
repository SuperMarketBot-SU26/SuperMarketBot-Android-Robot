# SmartMarketBot - Workflow Vận Hành Sau Khi Fix

> Tài liệu này mô tả quy trình vận hành E2E sau khi áp dụng 6 bước fix (2026-07-27).
> Đối tượng: người vận hành siêu thị (demo) + team nội bộ phát triển.

---

## 1. Khởi động hệ thống

### Bước 1.1 — ESP32-S3 firmware
1. Mở Arduino IDE, mở project `SuperMarketBot-IOT/ESP32-S3/SuperMarketBot-IOT/SuperMarketBot-IOT.ino`
2. **Verify Config.h** đã đúng:
   - `USE_ENCODER_HARDWARE = 1` ✅
   - `USE_MICRO_ROS = 1` (nếu muốn dùng ROS2 native thay vì WS bridge)
   - `ENC_L = 35`, `ENC_R = 36` đã cắm đúng 2 dây signal encoder
3. Flash firmware → ESP32 boot, kết nối WiFi `FPTH_Student`, IP `192.168.0.105`

### Bước 1.2 — Ubuntu (PC ROS2)
```bash
cd ~/SuperMarketBot-Android-Robot/WebManager
chmod +x start_ros2_web_bridge.sh
./start_ros2_web_bridge.sh
```

Script sẽ tự động:
- Source ROS2 (Lyrical/Humble/Kilted/Jazzy tuỳ box)
- Verify `ros2 --version`
- Khởi Rosbridge WebSocket port 9090
- Khởi SLAM Toolbox (config YDLIDAR X3)
- Khởi robot_localization EKF
- Khởi ESP32 ROS2 Bridge (publish /scan, /odom, /imu/data)
- Optional: Nav2 nếu đã save map

Sau ~5s sẽ in danh sách topic đang hoạt động.

### Bước 1.3 — WebManager
1. Mở `index.html` trong Chrome (Chrome hỗ trợ WebSocket tốt nhất)
2. Đợi ~3s để kết nối Rosbridge + ESP32 WS
3. Kiểm tra:
   - **LiDAR Log panel** → hiển thị `[YDLIDAR X3] 360° Scan #N | Points: ~350` (nếu firmware ESP32 đã chạy)
   - **Robot Status badge** → xanh "ONLINE"
   - **Pose (x, y, heading)** → cập nhật mỗi 100ms

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
- [ ] ESP32 connect WiFi `FPTH_Student` → IP `192.168.0.105`
- [ ] Ubuntu connect cùng WiFi → IP `192.168.0.X`
- [ ] Ping 2 chiều OK
- [ ] ESP32 Serial log hiển thị `[YDLIDAR X3] 360° Scan #N`

### Test 2: ROS2 stack
- [ ] `ros2 topic list` có `/scan`, `/map`, `/odom`, `/imu/data`, `/tf`
- [ ] RViz2 visualize `/scan` + `/map` → thấy tường từ LiDAR
- [ ] `ros2 topic hz /scan` → ~10Hz
- [ ] `ros2 topic hz /odom` → ~50Hz (từ ESP32)

### Test 3: WebManager
- [ ] Mở index.html → WebSocket connected badge xanh
- [ ] Pose (x,y,heading) cập nhật real-time
- [ ] LiDAR Log có log mỗi 5s
- [ ] Occupancy grid render (sau khi SLAM build map)

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

---

## 7. File quan trọng đã thay đổi

| File | Thay đổi |
|------|----------|
| `start_ros2_web_bridge.sh` | Fix bug source ROS2 + auto-detect distro + verify CLI |
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

*Phiên bản: v2.0 (2026-07-27) — Tác giả: Cursor Agent (claude-fable-5)*
