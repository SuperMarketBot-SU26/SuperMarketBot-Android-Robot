import { useCallback, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { useRobotAuth } from '../context/RobotAuthContext';

export function useIdleTimeout(timeoutMs: number = 60000, enabled: boolean = true) {
  const router = useRouter();
  const pathname = usePathname();
  const timerRef = useRef<any>(null);
  const { clearSession } = useRobotAuth();

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Nếu đang ở màn hình Welcome (index) thì không cần đếm giờ
    if (enabled && pathname !== '/') {
      timerRef.current = setTimeout(() => {
        // Hết giờ -> Xóa session và Chuyển về màn hình Welcome
        clearSession();
        router.replace('/');
      }, timeoutMs);
    }
  }, [clearSession, enabled, pathname, router, timeoutMs]);

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
