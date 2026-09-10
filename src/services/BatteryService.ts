import * as Battery from 'expo-battery';

export interface DeviceBatteryInfo {
  batteryPct: number;
  isCharging: boolean;
  batteryState: Battery.BatteryState;
}

class BatteryServiceClass {
  private cachedBatteryPct: number = 100;
  private cachedIsCharging: boolean = false;
  private subscription: Battery.Subscription | null = null;

  async init(): Promise<DeviceBatteryInfo> {
    try {
      const [level, state] = await Promise.all([
        Battery.getBatteryLevelAsync(),
        Battery.getBatteryStateAsync(),
      ]);

      // level is -1 if unavailable on simulator, otherwise 0.0 to 1.0
      this.cachedBatteryPct = level >= 0 ? Math.round(level * 100) : 100;
      this.cachedIsCharging =
        state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;

      // Subscribe to changes
      this.subscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
        if (batteryLevel >= 0) {
          this.cachedBatteryPct = Math.round(batteryLevel * 100);
        }
      });

      return {
        batteryPct: this.cachedBatteryPct,
        isCharging: this.cachedIsCharging,
        batteryState: state,
      };
    } catch (e) {
      console.warn('[BatteryService] Failed to read battery via expo-battery:', e);
      return {
        batteryPct: this.cachedBatteryPct,
        isCharging: this.cachedIsCharging,
        batteryState: Battery.BatteryState.UNKNOWN,
      };
    }
  }

  async getBatteryInfo(): Promise<DeviceBatteryInfo> {
    try {
      const [level, state] = await Promise.all([
        Battery.getBatteryLevelAsync(),
        Battery.getBatteryStateAsync(),
      ]);

      if (level >= 0) {
        this.cachedBatteryPct = Math.round(level * 100);
      }
      this.cachedIsCharging =
        state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;

      return {
        batteryPct: this.cachedBatteryPct,
        isCharging: this.cachedIsCharging,
        batteryState: state,
      };
    } catch {
      return {
        batteryPct: this.cachedBatteryPct,
        isCharging: this.cachedIsCharging,
        batteryState: Battery.BatteryState.UNKNOWN,
      };
    }
  }

  destroy() {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
  }
}

export const BatteryService = new BatteryServiceClass();
