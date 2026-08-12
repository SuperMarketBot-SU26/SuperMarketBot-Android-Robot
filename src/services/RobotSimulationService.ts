import { RobotControlService } from './RobotControlService';

export type SimulationEvent =
  | { type: 'dispatching'; productName?: string }
  | { type: 'moving'; nodeId?: number; nodeName?: string; index: number; total: number }
  | { type: 'obstacle'; message: string }
  | { type: 'arrived'; nodeName?: string }
  | { type: 'stopped'; message: string };

export class RobotSimulationService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private index = 0;
  private waypoints: any[] = [];
  private loop = false;
  private paused = false;
  private listener: ((event: SimulationEvent) => void) | null = null;

  onEvent(listener: (event: SimulationEvent) => void) { this.listener = listener; }

  async dispatchProduct(productId: number, productName?: string) {
    this.stop('Đã hủy nhiệm vụ trước đó');
    this.listener?.({ type: 'dispatching', productName });
    const result = await RobotControlService.dispatchAutonomous({
      robotCode: 'RB001', flowType: 'guide', productId, simulation: true,
    });
    if (!result.ok) throw new Error(result.data?.error || `Dispatch thất bại (${result.status})`);
    this.waypoints = result.data?.waypoints || [];
    this.index = 0;
    this.loop = false;
    this.paused = false;
    this.start();
    return result.data;
  }

  async dispatchFullMap() {
    this.stop('Đã hủy nhiệm vụ trước đó');
    this.listener?.({ type: 'dispatching' });
    const result = await RobotControlService.dispatchAutonomous({
      robotCode: 'RB001', flowType: 'patrol', zoneId: 1, fullZoneMap: true, simulation: true,
    });
    if (!result.ok) throw new Error(result.data?.error || `Dispatch thất bại (${result.status})`);
    this.waypoints = result.data?.waypoints || [];
    this.index = 0;
    this.loop = true;
    this.paused = false;
    this.start();
    return result.data;
  }

  simulateObstacle(message = 'Phát hiện vật cản. Xin quý khách nhường đường để robot chuyển hướng.') {
    this.paused = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.listener?.({ type: 'obstacle', message });
    RobotControlService.sendMove(0, 0, 0);
  }

  resume() {
    if (!this.paused || this.waypoints.length === 0) return;
    this.paused = false;
    this.start();
  }

  start() {
    this.timer = setInterval(() => {
      if (this.index >= this.waypoints.length) {
        const last = this.waypoints[this.waypoints.length - 1];
        this.listener?.({ type: 'arrived', nodeName: last?.nodeName });
        if (this.loop && this.waypoints.length > 0) {
          this.index = 0;
          this.listener?.({ type: 'moving', nodeName: 'Bắt đầu vòng tuần tra mới', index: 0, total: this.waypoints.length });
          return;
        }
        this.stop('Đã hoàn thành lộ trình');
        return;
      }
      const point = this.waypoints[this.index];
      this.listener?.({ type: 'moving', nodeId: point.nodeId, nodeName: point.nodeName, index: this.index + 1, total: this.waypoints.length });
      this.index += 1;
    }, 1800);
  }

  stop(message = 'Đã dừng robot') {
    this.paused = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    RobotControlService.sendMove(0, 0, 0);
    if (message) this.listener?.({ type: 'stopped', message });
  }
}

export const robotSimulation = new RobotSimulationService();
