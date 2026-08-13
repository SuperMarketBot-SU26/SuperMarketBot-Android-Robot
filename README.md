# SmartMarketBot Android Robot

Ứng dụng production nhận mission `patrol`/`ad` trực tiếp từ Backend qua RobotHub. Patrol tự bật camera sau tại waypoint `photo`, chống chụp trùng và gửi ảnh tới `/api/v1/shelf-patrol/analyze-node`; quảng cáo hiển thị playlist tại waypoint `ad`.

> [`robot_simulator.html`](./robot_simulator.html) chỉ là công cụ debug tích hợp. Admin Web và ứng dụng Android Robot trong `src/` mới là luồng vận hành production.

## 1. Kiến trúc đang sử dụng

```text
Admin Web → Android Robot app
        │ REST + SignalR
        ▼
ASP.NET Core Backend (.NET 10)
        │
        ├── Azure SQL: map, zone, aisle, shelf, product, campaign, log
        ├── MQTT command ───────────────► ROS2 / Robot RB001
        ├── MQTT telemetry/status ◄───── ROS2 / Robot RB001
        └── SignalR /hubs/robot ────────► Android/HTML cập nhật realtime
```

Luồng nhiệm vụ quảng cáo thực tế:

```text
Dispatch mission
  → NAVIGATING / MOVING
  → ARRIVED tại waypoint
  → PLAYLIST_PLAYING (robot đứng yên)
  → phát hình ảnh + nội dung + TTS trong dwell time
  → PLAYLIST_COMPLETE
  → robot đi waypoint tiếp theo
  → COMPLETED khi hết nhiệm vụ
```

## 2. Nội dung Backend đã hoàn thiện

### 2.1. Điều hướng thật qua MQTT

- Dùng một dispatcher trung tâm: `POST /api/v1/navigation/dispatch-autonomous`.
- Backend tạo `missionId`, lấy waypoint từ Azure SQL và publish một payload `NAVIGATE_WAYPOINTS` xuống topic của robot.
- Hỗ trợ ba flow:
  - `ad`: tự hành và phát quảng cáo.
  - `patrol`: tuần tra.
  - `guide`: dẫn khách đến sản phẩm.
- Hỗ trợ các phạm vi chạy:
  - Một node chỉ định bằng `nodeIds`.
  - Toàn bộ node trong một Zone.
  - Toàn bộ Map cha gồm Zone 1–4 bằng `fullZoneMap=true`.
  - Route demo hội đồng, một node an toàn đại diện cho mỗi Zone bằng `demoRoute=true`.
- Node có `IsBlocked=true` bị loại trước khi gửi lệnh cho robot thật.

### 2.2. Dữ liệu waypoint đầy đủ

Mỗi waypoint trả về cho Android/HTML có:

- `nodeId`, `nodeName`, `xCoord`, `yCoord`, `headingYawDeg`.
- Zone: `zoneId`, `zoneName`.
- Dãy: `aisleId`, `aisleName`.
- Kệ: `shelfId`, `shelfName`.
- Danh sách `productNames` đang được gắn vào kệ.
- `playlist` quảng cáo phù hợp với Zone.
- `dwellTimeSeconds`, tổng thời lượng playlist và thời gian dừng thực tế.

Thời gian dừng thực tế được tính như sau:

```text
effectiveDwellTime = max(dwellTime mặc định, tổng thời lượng playlist)
```

Nhờ vậy robot đến node sẽ dừng đủ lâu để phát hết quảng cáo rồi mới đi tiếp.

### 2.3. Điều khiển nhiệm vụ robot

| Chức năng | API | MQTT command |
|---|---|---|
| Tạm dừng | `POST /api/v1/navigation/robots/{robotCode}/pause` | `PAUSE_NAV` |
| Tiếp tục | `POST /api/v1/navigation/robots/{robotCode}/resume` | `RESUME_NAV` |
| Dừng mềm nhiệm vụ | `POST /api/v1/navigation/robots/{robotCode}/stop` | `CANCEL_NAV` |
| Dừng khẩn cấp | `POST /api/v1/navigation/robots/{robotCode}/estop` | `ESTOP` |

Pause/Resume chỉ được xem là thành công sau khi robot phản hồi trạng thái tương ứng. E-STOP cần quy trình kiểm tra an toàn và reset trực tiếp ở phía robot trước khi vận hành lại.

### 2.4. Nhận trạng thái MQTT và đẩy SignalR

Backend subscribe:

```text
smartmarketbot/robot/+/status
smartmarketbot/robot/+/telemetry
smartmarketbot/robot/+/log
smartmarketbot/robot/+/slam_map
smartmarketbot/robot/+/navigation_status
```

Các cải tiến đã thực hiện:

- `navigation_status` đi qua queue ưu tiên riêng nên không bị telemetry làm chậm.
- Telemetry chỉ giữ bản mới nhất và lưu DB tối đa khoảng một lần/giây/robot để giảm tải Azure SQL.
- Event kết thúc được chống trùng theo robot, mission, status, waypoint và timestamp để xử lý MQTT QoS 1.
- Log trạng thái và SignalR được phát trước thao tác lưu Azure SQL để UI nhìn thấy ngay.
- Các trạng thái quan trọng được lưu vào `RobotLogs`.
- Trạng thái `ERROR` cũ được chuẩn hóa thành `FAILED`.

Hợp đồng trạng thái hiện dùng:

```text
NAVIGATING, MOVING, ARRIVED,
PLAYLIST_PLAYING, PLAYLIST_COMPLETE,
PAUSED, COMPLETED, FAILED,
CANCELLED, BLOCKED, ESTOP
```

SignalR endpoint:

```text
/hubs/robot
```

Client gọi `JoinRobotGroup("RB001")` và nghe tối thiểu:

- `navigationStatus`: trạng thái nhiệm vụ/waypoint/playlist/dwell time.
- `telemetry`: tọa độ, pin, online, mode và trạng thái robot.
- `robotLog`: log vận hành.
- `zoneEntered`: robot đi vào vùng semantic.
- `slamMapStream`: dữ liệu map realtime nếu ROS2 publish.

### 2.5. Quảng cáo và analytics

- Playlist được lấy từ campaign/sponsored product đang active và còn thời hạn.
- Playlist được ghép theo Zone của waypoint/kệ.
- HTML ghi nhận robot đi qua Zone bằng `POST /api/v1/robot-events`.
- Sau khi hiển thị xong một quảng cáo, HTML gửi impression.
- Khi người dùng bấm xem sản phẩm quảng cáo, HTML gửi click.

| Chức năng | API |
|---|---|
| Playlist theo Zone | `GET /api/v1/ad-campaign/robot-playlist/{robotId}/zone/{zoneId}` |
| Route quảng cáo đã gán | `GET /api/v1/ad-campaign/robot/{robotCode}/broadcast/route` |
| Robot event | `POST /api/v1/robot-events` |
| Impression | `POST /api/v1/ad-campaigns/{campaignId}/impression` |
| Click | `POST /api/v1/ad-campaigns/{campaignId}/click` |

### 2.6. Deploy hiện tại

- Backend Railway: <https://backend-api-production-c4c0.up.railway.app>
- Scalar API: <https://backend-api-production-c4c0.up.railway.app/scalar/v1>
- Liveness: <https://backend-api-production-c4c0.up.railway.app/health/live>
- Face Recognition AI: <https://face-ai-production.up.railway.app>

Backend kết nối Face AI qua private network Railway:

```text
http://face-ai.railway.internal:8000
```

## 3. Nội dung `robot_simulator.html` đã hoàn thiện

### 3.1. Bảng điều khiển thật

Giao diện cho nhập:

- API Base URL.
- Robot code, mặc định `RB001`.
- Robot DB ID, mặc định `1`.
- Flow `ad`, `patrol` hoặc `guide`.
- Zone ID, Product ID và Node ID.

Các nút hiện có:

- Dispatch autonomous.
- Chạy node đơn.
- Chạy toàn bộ node trong Zone.
- Chạy toàn bộ Map gồm 4 Zone bằng một mission.
- Demo hội đồng: một node đại diện mỗi Zone.
- Pause, Resume, Stop và E-STOP.
- Lấy route quảng cáo đã được gán.

Mỗi lệnh làm robot chuyển động đều có hộp xác nhận để hạn chế bấm nhầm. E-STOP có xác nhận hai bước.

### 3.2. Màn hình kiosk robot

UI hiển thị realtime:

- Robot đang ở đâu và trạng thái hiện tại.
- Node, Zone, dãy, kệ và sản phẩm tại điểm dừng.
- Tiến độ `đã đi / tổng waypoint`.
- Tọa độ X/Y và trạm tiếp theo.
- Pin, online/offline và mode di chuyển.
- Danh sách route, node đang chạy và node đã hoàn thành.

### 3.3. Màn hình phát quảng cáo

Quảng cáo chỉ bắt đầu khi nhận `PLAYLIST_PLAYING` từ robot qua SignalR, không tự giả lập robot đã đến nơi.

Màn hình hỗ trợ:

- Hình banner hoặc ảnh sản phẩm.
- Nội dung quảng cáo.
- TTS tiếng Việt bằng `SpeechSynthesisUtterance`.
- Đồng hồ đếm ngược theo `displayDurationSeconds`.
- Phát tuần tự nhiều quảng cáo tại một waypoint.
- Gửi impression sau khi phát xong.
- Nút “Xem sản phẩm quảng cáo” để gửi click analytics.
- Hủy ngay nội dung/TTS khi mission hoàn tất, bị dừng, thất bại hoặc E-STOP.

### 3.4. Console và realtime

- Console hiển thị method, endpoint, request, status code và response rút gọn.
- SignalR tự reconnect theo các mốc `0, 1, 3, 5, 10 giây`.
- Khi reconnect, client tự join lại group của robot.
- UI cập nhật theo `navigationStatus` và `telemetry`, không polling liên tục.

## 4. Cách chạy

### 4.1. Dùng Backend Railway

Trong `robot_simulator.html`, đặt:

```text
API Base URL = https://backend-api-production-c4c0.up.railway.app
Robot code   = RB001
Robot DB ID  = 1
```

Mở HTML bằng VS Code Live Server hoặc một HTTP server local. Không nên mở bằng `file://` trên Android WebView vì CDN, CORS, TTS và SignalR có thể hoạt động không ổn định.

Ví dụ:

```powershell
cd E:\Do_an_SU26\SuperMarketBot-Android-Robot
npx http-server . -p 5500
```

Sau đó mở:

```text
http://localhost:5500/robot_simulator.html
```

### 4.2. Chạy Android Expo

```powershell
cd E:\Do_an_SU26\SuperMarketBot-Android-Robot
npm install
npx expo start
```

Nếu nhúng HTML vào `react-native-webview`, ưu tiên Backend Railway HTTPS để tránh Android chặn mixed content. Thiết bị cần Internet vì HTML hiện tải Tailwind và SignalR browser client từ CDN.

### 4.3. Chạy Backend local

```powershell
cd E:\Do_an_SU26\SuperMarketBot-BE
dotnet run --project src\SmartMarketBot.API
```

Khi chạy local, đảm bảo chỉ có một process chiếm port `5000`. API Base URL của HTML là:

```text
http://localhost:5000
```

Với Android thật, `localhost` là chính điện thoại/tablet, không phải laptop. Hãy thay bằng IP LAN của laptop, ví dụ `http://192.168.x.x:5000`, đồng thời mở firewall Windows nếu cần.

## 5. Checklist demo an toàn

1. Bật robot, ROS2, MQTT bridge và kiểm tra E-STOP vật lý.
2. Kiểm tra Backend có log `Successfully connected to MQTT broker`.
3. Mở HTML và xác nhận `SignalR: RB001 online`.
4. Kiểm tra Azure SQL có đủ 4 Zone, node không bị block và campaign còn active.
5. Chọn **Demo hội đồng (1 Node / Zone)** cho lượt đầu.
6. Theo dõi chuỗi `NAVIGATING → ARRIVED → PLAYLIST_PLAYING`.
7. Xác nhận robot đứng yên trong lúc màn hình phát quảng cáo/TTS.
8. Sau `PLAYLIST_COMPLETE`, xác nhận robot đi trạm tiếp theo.
9. Thử Pause/Resume ở tốc độ thấp và khu vực trống.
10. Chỉ thử E-STOP khi đã thống nhất quy trình reset với team robot.

## 6. Giới hạn và việc cần làm tiếp

- Các API điều khiển robot hiện đang phục vụ demo và còn `AllowAnonymous`; trước production phải thêm JWT/role dành riêng cho operator.
- Không dùng telemetry để xác định robot đã đến trạm. Nghiệp vụ quảng cáo phải dựa vào `ARRIVED` và `PLAYLIST_PLAYING`.
- `FAILED` là trạng thái chung khi Nav2 abort; không phải mọi trường hợp đều phân biệt chính xác được vật cản hay lỗi định vị.
- Railway gói không có Static Outbound IP có thể đổi IP sau redeploy, khiến Azure SQL firewall chặn lại. Production nên dùng Static Outbound IP hoặc kiến trúc DB không phụ thuộc IP động.
- `robot_simulator.html` hiện là console kiểm thử/tích hợp. Khi chuyển hoàn toàn sang React Native, giữ nguyên hợp đồng REST, MQTT và SignalR trong tài liệu này.

---

- **Cập nhật gần nhất:** 2026-08-13 12:45:49 (UTC+7)
- **Phạm vi:** Backend ASP.NET Core, Azure SQL, MQTT, SignalR, quảng cáo, điều hướng và giao diện HTML Android Robot.
- **Không thay đổi:** mã nguồn ROS2 và IOT.
