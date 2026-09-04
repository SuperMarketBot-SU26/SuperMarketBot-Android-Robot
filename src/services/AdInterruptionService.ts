/**
 * AdInterruptionService.ts
 * Quản lý trạng thái bảo lưu & khôi phục lộ trình quảng cáo khi có khách tương tác dẫn đường.
 * 
 * Flow:
 * 1. Robot đang đi tuần tra quảng cáo (flowType: 'ad').
 * 2. Đến một trạm dừng, màn hình Kiosk hiển thị sản phẩm quảng cáo.
 * 3. Khách hàng chạm "Dẫn tôi mua món này":
 *    - AdInterruptionService lưu lại các waypoint còn lại của lộ trình quảng cáo (từ waypoint tiếp theo đến hết).
 *    - Hủy nhiệm vụ ad hiện tại trên Backend.
 *    - Chuyển sang nhiệm vụ dẫn đường (flowType: 'guide') cho sản phẩm khách chọn.
 * 4. Khách hàng đi theo robot, lấy hàng tại kệ và nhấn "Đã lấy hàng xong":
 *    - Hệ thống kiểm tra: nếu có lộ trình quảng cáo bị tạm dừng, robot sẽ tự động phát lệnh tiếp tục
 *      đi nốt các waypoint quảng cáo còn lại thay vì quay về trạm sạc.
 */

export interface InterruptedAdMission {
  originalMissionId: string;
  robotCode: string;
  remainingNodeIds: number[];
  floorId: number;
  campaignId?: number | null;
  interruptedAtWaypointIndex: number;
  totalWaypoints: number;
  productName?: string;
  shelfName?: string;
  savedTimestamp: number;
}

type Listener = (mission: InterruptedAdMission | null) => void;

class AdInterruptionServiceManager {
  private interruptedMission: InterruptedAdMission | null = null;
  private listeners: Listener[] = [];

  public saveInterruptedMission(data: InterruptedAdMission): void {
    console.log('[AdInterruptionService] Đã lưu lộ trình quảng cáo bị tạm dừng:', {
      originalMissionId: data.originalMissionId,
      remainingNodeCount: data.remainingNodeIds.length,
      remainingNodeIds: data.remainingNodeIds,
      interruptedIndex: data.interruptedAtWaypointIndex,
    });
    this.interruptedMission = data;
    this.notify();
  }

  public getInterruptedMission(): InterruptedAdMission | null {
    return this.interruptedMission;
  }

  public hasInterruptedMission(): boolean {
    return this.interruptedMission !== null && (this.interruptedMission.remainingNodeIds?.length ?? 0) > 0;
  }

  public clear(): void {
    console.log('[AdInterruptionService] Đã xóa lộ trình quảng cáo lưu tạm');
    this.interruptedMission = null;
    this.notify();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.interruptedMission);
      } catch (e) {
        console.warn('[AdInterruptionService] Listener error:', e);
      }
    }
  }
}

export const AdInterruptionService = new AdInterruptionServiceManager();
