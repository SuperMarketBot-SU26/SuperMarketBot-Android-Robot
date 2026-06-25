/**
 * RobotControlService.ts
 *
 * Kết nối WebSocket trực tiếp đến ESP32-S3 (port 81)
 * để gửi lệnh lái tay thời gian thực — độ trễ < 5ms.
 *
 * Định dạng JSON gửi đi:
 *   { t: 'joy',  x, y, s }   — di chuyển omnidirectional
 *   { t: 'mode', m }         — chuyển chế độ (0=Manual, 1=Auto, 2=Waypoint)
 *   { t: 'spd',  v }         — tốc độ nền lái tay (0-100)
 *   { t: 'estop' }           — dừng khẩn cấp
 *   { t: 'odomReset' }       — reset odometry
 *   { t: 'motLayout', mapMot, motInv } — cấu hình bánh xe
 *   { t: 'test_motor', payload }      — chạy thử 1 bánh "slot_speedPct"
 */

const ESP32_WS_CONTROL = 'ws://192.168.4.1:81';
const RECONNECT_INTERVAL_MS = 3000;

export type ConnectionCallback = (connected: boolean) => void;

class RobotControlServiceClass {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;
  private _isConnected = false;

  private connListeners: Set<ConnectionCallback> = new Set();

  // ─── Connection ────────────────────────────────────────────────────────────

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
    this._setConnected(false);
  }

  private _openSocket() {
    if (this.ws) return;
    try {
      this.ws = new WebSocket(ESP32_WS_CONTROL);

      this.ws.onopen = () => {
        this._setConnected(true);
        console.log('[RobotControl] Kết nối ESP32 Control (port 81) thành công.');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onerror = () => {
        // error handled in onclose
      };

      this.ws.onclose = () => {
        this.ws = null;
        this._setConnected(false);
        console.warn('[RobotControl] Mất kết nối Control. Thử reconnect...');
        if (this.shouldReconnect) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this._openSocket();
          }, RECONNECT_INTERVAL_MS);
        }
      };
    } catch (e) {
      console.warn('[RobotControl] Không thể mở WebSocket:', e);
    }
  }

  private _send(obj: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  private _setConnected(c: boolean) {
    this._isConnected = c;
    this.connListeners.forEach(cb => cb(c));
  }

  // ─── Commands ─────────────────────────────────────────────────────────────

  /** Di chuyển omnidirectional.
   * @param x     rotate (xoay tại chỗ) –80..+80 (âm=trái, dương=phải)
   * @param y     forward/backward      –80..+80 (âm=lùi, dương=tiến)
   * @param strafe ngang                –80..+80 (âm=trái, dương=phải)
   */
  sendMove(x: number, y: number, strafe: number) {
    this._send({ t: 'joy', x, y, s: strafe });
  }

  /** Chuyển chế độ hoạt động.
   * @param mode  0=Manual, 1=Auto (tự hành), 2=Waypoint
   */
  sendMode(mode: 0 | 1 | 2) {
    this._send({ t: 'mode', m: mode });
  }

  /** Đặt tốc độ nền lái tay.
   * @param manualSpeedPct  0..100
   */
  sendSpeed(manualSpeedPct: number) {
    this._send({ t: 'spd', v: Math.max(0, Math.min(100, manualSpeedPct)) });
  }

  /** Dừng khẩn cấp */
  sendEstop() {
    this._send({ t: 'estop' });
  }

  /** Reset odometry */
  sendOdomReset() {
    this._send({ t: 'odomReset' });
  }

  /** Gửi cấu hình map bánh xe + đảo chiều.
   * @param mapMot  mảng 4 phần tử [FL, RL, FR, RR] — chỉ số slot driver (0-3)
   * @param motInv  mảng 4 phần tử [FL, RL, FR, RR] — 0=thuận, 1=đảo chiều
   */
  sendMotorLayout(mapMot: number[], motInv: number[]) {
    if (mapMot.length !== 4 || motInv.length !== 4) return;
    this._send({ t: 'motLayout', mapMot, motInv });
  }

  /** Chạy thử riêng lẻ 1 động cơ.
   * @param slot     chỉ số slot driver 0-3
   * @param speedPct tốc độ 0..100
   */
  sendMotorTest(slot: number, speedPct: number) {
    this._send({ t: 'test_motor', payload: `${slot}_${speedPct}` });
  }

  // ─── Getters & Listeners ───────────────────────────────────────────────────

  getIsConnected(): boolean {
    return this._isConnected;
  }

  onConnection(cb: ConnectionCallback)  { this.connListeners.add(cb); }
  offConnection(cb: ConnectionCallback) { this.connListeners.delete(cb); }
}

export const RobotControlService = new RobotControlServiceClass();
