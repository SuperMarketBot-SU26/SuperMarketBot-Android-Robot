import { useCallback, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { useRobotAuth } from '../context/RobotAuthContext';
import { useCustomerSession } from '../context/CustomerSessionContext';

export function useIdleTimeout(timeoutMs: number = 60000, enabled: boolean = true) {
  const router = useRouter();
  const pathname = usePathname();
  const timerRef = useRef<any>(null);
  const { clearSession } = useRobotAuth();
  const { refreshSession, endSession } = useCustomerSession();

  const resetTimer = useCallback(() => {
    refreshSession();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Nếu đang ở màn hình Welcome (index) thì không cần đếm giờ
    if (enabled && pathname !== '/') {
      timerRef.current = setTimeout(() => {
        // Hết giờ -> Xóa session auth, kết thúc phiên khách và Chuyển về màn hình Welcome
        clearSession();
        endSession();
        router.replace('/');
      }, timeoutMs);
    }
  }, [clearSession, endSession, refreshSession, enabled, pathname, router, timeoutMs]);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [resetTimer]);

  return { resetTimer };
}
