/**
 * RobotControlService.ts
 *
 * Giao tiếp với Robot THÔNG QUA Backend (BE → MQTT → ROS2 → Robot).
 * Không có kết nối WebSocket trực tiếp tới ESP32.
 *
 * Các API:
 *   POST /api/v1/navigation/dispatch-autonomous  — Dispatch 3 flow tự hành
 *   POST /api/robots/command                     — Gửi lệnh thô qua MQTT
 */

const API_BASE = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || '';
const ROBOT_CODE_DEFAULT = 'RB001';

export interface NavigateWaypoint {
  x: number;
  y: number;
  nodeId: number;
}

class RobotControlServiceClass {
  // ─── Dispatch Autonomous (API) ──────────────────────────────────────────────

  /**
   * Gọi API POST /api/v1/navigation/dispatch-autonomous
   * BE tự tính toán lộ trình (Dijkstra) và publish MQTT xuống ROS2/Robot.
   */
  async dispatchAutonomous(payload: {
    robotCode?: string;
    flowType: string;
    productId?: number;
    aisleId?: number;
    zoneId?: number;
    nodeIds?: number[];
  }): Promise<boolean> {
    if (!API_BASE) {
      console.warn('[RobotControl.dispatchAutonomous] EXPO_PUBLIC_API_URL chưa set');
      return false;
    }
    const url = `${API_BASE}/api/v1/navigation/dispatch-autonomous`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          robotCode: payload.robotCode || ROBOT_CODE_DEFAULT,
          flowType: payload.flowType,
          productId: payload.productId,
          aisleId: payload.aisleId,
          zoneId: payload.zoneId,
          nodeIds: payload.nodeIds,
        }),
      });
      const ok = res.ok;
      console.log(`[RobotControl.dispatchAutonomous] ${ok ? 'OK' : 'FAIL'} ${res.status}`);
      return ok;
    } catch (e) {
      console.warn('[RobotControl.dispatchAutonomous] Lỗi:', e);
      return false;
    }
  }

  /**
   * Gửi waypoints qua BE → MQTT → Robot.
   * Endpoint: POST /api/robots/command
   */
  async sendNavigateViaBackend(
    waypoints: NavigateWaypoint[],
    robotCode: string = ROBOT_CODE_DEFAULT,
  ): Promise<boolean> {
    if (!waypoints || waypoints.length === 0) {
      console.warn('[RobotControl.sendNavigateViaBackend] Empty waypoints');
      return false;
    }
    if (!API_BASE) {
      console.warn('[RobotControl.sendNavigateViaBackend] EXPO_PUBLIC_API_URL chưa set');
      return false;
    }
    const url = `${API_BASE}/api/robots/command`;
    try {
      const payloadStr = JSON.stringify({ waypoints });
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          robotCode,
          command: 'navigate',
          payload: payloadStr,
        }),
      });
      const ok = res.ok;
      console.log(
        `[RobotControl.sendNavigateViaBackend] ${ok ? 'OK' : 'FAIL'} ${res.status} → ${waypoints.length} waypoints`,
      );
      return ok;
    } catch (e) {
      console.warn('[RobotControl.sendNavigateViaBackend] Lỗi:', e);
      return false;
    }
  }

  // Alias giữ backward-compat với MapViewerScreen
  async sendNavigateWithFallback(
    waypoints: NavigateWaypoint[],
  ): Promise<{ sent: boolean; channel: 'be' | 'none' }> {
    const ok = await this.sendNavigateViaBackend(waypoints);
    return { sent: ok, channel: ok ? 'be' : 'none' };
  }
}

export const RobotControlService = new RobotControlServiceClass();
