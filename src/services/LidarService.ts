/**
 * LidarService.ts
 *
 * Kết nối WebSocket thẳng vào ESP32 (http://192.168.4.1/lidar_stream)
 * để nhận luồng dữ liệu LiDAR thô + Odometry.
 *
 * Vai trò của Tablet: Nhận data, chạy thuật toán Scan Matching (AMCL đơn giản)
 * để ước tính tọa độ (x, y, heading) CHÍNH XÁC HƠN odometry thuần từ bánh xe.
 *
 * WEB MANAGER sẽ gửi map về cho service này tải xuống để đối chiếu (Localization).
 * Tablet CHỈ hiển thị và tính toán, KHÔNG quản lý route hay bản đồ.
 */

// ─── Cấu hình kết nối ─────────────────────────────────────────────────────────
// ESP32 mở WebSocket Server độc lập trên port 82 (LidarStreamWS.h)
// Format: ws://<IP>:<PORT> — không phải path /lidar_stream
const ESP32_WS_LIDAR = 'ws://192.168.4.1:82';
const RECONNECT_INTERVAL_MS = 3000;
const MAX_LIDAR_POINTS = 360;

// ─── Types ─────────────────────────────────────────────────────────────────────

/** Một điểm LiDAR thô nhận từ ESP32 */
export interface LidarPoint {
  angleDeg: number;    // Góc (0-359 độ)
  distMm: number;      // Khoảng cách (mm), 0 = không đo được
}

/** Frame LiDAR đầy đủ gồm 1 vòng quét + tọa độ odometry từ ESP32 */
export interface LidarFrame {
  points: LidarPoint[];   // Mảng 360 điểm
  odomX: number;          // Tọa độ X ước lượng từ bánh xe (m)
  odomY: number;          // Tọa độ Y ước lượng từ bánh xe (m)
  odomHeadingRad: number; // Góc heading từ bánh xe + IMU (rad)
  timestampMs: number;    // Thời điểm thu thập
}

/** Tọa độ ước lượng sau khi đã qua Scan Matching trên Tablet */
export interface RobotPose {
  x: number;
  y: number;
  headingRad: number;
  confidence: number; // 0-1: độ tin cậy của estimate
  sourceMs: number;   // Thời điểm tính
}

export type LidarFrameCallback = (frame: LidarFrame) => void;
export type PoseUpdateCallback = (pose: RobotPose) => void;
export type ConnectionCallback = (connected: boolean) => void;

// ─── Singleton Service ─────────────────────────────────────────────────────────

class LidarServiceClass {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isConnected = false;
  private shouldReconnect = false;

  private frameListeners: Set<LidarFrameCallback> = new Set();
  private poseListeners: Set<PoseUpdateCallback> = new Set();
  private connListeners: Set<ConnectionCallback> = new Set();

  // Tọa độ ước lượng hiện tại (sau Scan Matching)
  private currentPose: RobotPose = {
    x: 0, y: 0, headingRad: 0, confidence: 0, sourceMs: 0,
  };

  // Buffer tham chiếu để Scan Matching (nhận từ Web Manager qua Backend)
  private referenceMap: LidarPoint[][] | null = null;

  // ─── Kết nối / ngắt ─────────────────────────────────────────────────

  connect() {
    this.shouldReconnect = true;
    this._openSocket();
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private _openSocket() {
    if (this.ws) return;
    try {
      this.ws = new WebSocket(ESP32_WS_LIDAR);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log('[LidarService] Kết nối ESP32 Lidar stream thành công.');
        this._notifyConn(true);
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        this._handleMessage(event.data);
      };

      this.ws.onerror = (e) => {
        console.warn('[LidarService] WebSocket error:', e);
      };

      this.ws.onclose = () => {
        this.ws = null;
        this.isConnected = false;
        this._notifyConn(false);
        console.warn('[LidarService] Mất kết nối với ESP32. Thử kết nối lại...');
        if (this.shouldReconnect) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this._openSocket();
          }, RECONNECT_INTERVAL_MS);
        }
      };
    } catch (e) {
      console.warn('[LidarService] Không thể mở WebSocket:', e);
    }
  }

  // ─── Xử lý data nhận về ─────────────────────────────────────────────

  /**
   * ESP32 gửi JSON nhị phân (compact) theo format:
   * {
   *   "pts": [[angleDeg, distMm], ...],   // 360 phần tử
   *   "ox": 1.23,   // odom X (m)
   *   "oy": 0.45,   // odom Y (m)
   *   "oh": -0.12,  // odom heading (rad)
   *   "ts": 123456  // millis()
   * }
   */
  private _handleMessage(data: any) {
    try {
      let jsonStr: string;
      if (data instanceof ArrayBuffer) {
        jsonStr = new TextDecoder().decode(data);
      } else {
        jsonStr = data as string;
      }

      const raw = JSON.parse(jsonStr);
      const pts: LidarPoint[] = (raw.pts as number[][]).map(([a, d]) => ({
        angleDeg: a,
        distMm: d,
      }));

      const frame: LidarFrame = {
        points: pts,
        odomX: raw.ox ?? 0,
        odomY: raw.oy ?? 0,
        odomHeadingRad: raw.oh ?? 0,
        timestampMs: raw.ts ?? Date.now(),
      };

      // Bước 1: Thông báo cho UI vẽ điểm Lidar thô
      this.frameListeners.forEach(cb => cb(frame));

      // Bước 2: Chạy Scan Matching để tính tọa độ chính xác hơn
      const pose = this._runScanMatching(frame);
      if (pose) {
        this.currentPose = pose;
        this.poseListeners.forEach(cb => cb(pose));
      }
    } catch (e) {
      // Không crash app nếu có frame lỗi
    }
  }

  // ─── Scan Matching (Thuật toán ICP đơn giản) ────────────────────────

  /**
   * Scan Matching đơn giản: So khớp điểm Lidar hiện tại với reference map.
   * Nếu chưa có reference map → dùng Odometry làm fallback (kém chính xác).
   *
   * TODO (Phase 2): Tích hợp thuật toán ICP (Iterative Closest Point)
   * hoặc Correlative Scan Matching đầy đủ khi có thời gian.
   */
  private _runScanMatching(frame: LidarFrame): RobotPose | null {
    // === Nếu chưa có Reference Map (chưa download map từ server) ===
    // Dùng Odometry của ESP32 trực tiếp (Fallback)
    if (!this.referenceMap) {
      return {
        x: frame.odomX,
        y: frame.odomY,
        headingRad: frame.odomHeadingRad,
        confidence: 0.3, // Thấp vì chỉ dựa vào bánh xe
        sourceMs: frame.timestampMs,
      };
    }

    // === Có Reference Map: Chạy ICP đơn giản ===
    // Bước 1: Chuyển mảng Lidar sang tọa độ Cartesian (x,y) với pose hiện tại
    const currentPoints = this._lidarToCartesian(frame.points, this.currentPose);

    // Bước 2: Tìm các điểm tương ứng trong reference map (nearest-neighbor)
    //         và tính vector dịch chuyển tối ưu
    const delta = this._computeIcpDelta(currentPoints);

    // Bước 3: Cộng delta vào tọa độ hiện tại để ra tọa độ mới
    const newPose: RobotPose = {
      x: this.currentPose.x + delta.dx,
      y: this.currentPose.y + delta.dy,
      headingRad: this.currentPose.headingRad + delta.dtheta,
      confidence: delta.confidence,
      sourceMs: frame.timestampMs,
    };

    return newPose;
  }

  /** Chuyển mảng LidarPoint (góc + khoảng cách) thành tọa độ XY thực */
  private _lidarToCartesian(
    points: LidarPoint[],
    pose: RobotPose
  ): Array<{ x: number; y: number }> {
    return points
      .filter(p => p.distMm > 50 && p.distMm < 8000) // Lọc nhiễu
      .map(p => {
        const angleRad = (p.angleDeg * Math.PI) / 180 + pose.headingRad;
        const distM = p.distMm / 1000;
        return {
          x: pose.x + distM * Math.cos(angleRad),
          y: pose.y + distM * Math.sin(angleRad),
        };
      });
  }

  /**
   * Tính delta dịch chuyển bằng thuật toán ICP cực giản.
   * Phase 1: Chỉ tính centroid offset (đủ dùng với map phẳng).
   * Phase 2+: Thay bằng thư viện C++ NDK đầy đủ.
   */
  private _computeIcpDelta(
    _currentPts: Array<{ x: number; y: number }>
  ): { dx: number; dy: number; dtheta: number; confidence: number } {
    // Placeholder: Ở Phase 1 không có đủ reference map data
    // → Delta = 0, confidence thấp, chờ Phase 2 implement đầy đủ.
    return { dx: 0, dy: 0, dtheta: 0, confidence: 0.5 };
  }

  // ─── Reference Map (tải từ Server) ──────────────────────────────────

  /** Nạp reference map (dữ liệu Lidar đã ghi lại) từ Backend để đối chiếu */
  setReferenceMap(mapData: LidarPoint[][]) {
    this.referenceMap = mapData;
    console.log(`[LidarService] Reference map loaded: ${mapData.length} scan lines.`);
  }

  // ─── Getters & Listeners ─────────────────────────────────────────────

  getCurrentPose(): RobotPose { return this.currentPose; }
  getIsConnected(): boolean { return this.isConnected; }

  onFrame(cb: LidarFrameCallback)      { this.frameListeners.add(cb); }
  offFrame(cb: LidarFrameCallback)     { this.frameListeners.delete(cb); }
  onPoseUpdate(cb: PoseUpdateCallback) { this.poseListeners.add(cb); }
  offPoseUpdate(cb: PoseUpdateCallback){ this.poseListeners.delete(cb); }
  onConnection(cb: ConnectionCallback) { this.connListeners.add(cb); }
  offConnection(cb: ConnectionCallback){ this.connListeners.delete(cb); }

  private _notifyConn(c: boolean) {
    this.connListeners.forEach(cb => cb(c));
  }
}

export const LidarService = new LidarServiceClass();
