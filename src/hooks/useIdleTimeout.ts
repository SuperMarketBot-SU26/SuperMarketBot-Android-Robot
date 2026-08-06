import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'expo-router';

export function useIdleTimeout(timeoutMs: number = 60000) {
  const router = useRouter();
  const pathname = usePathname();
  const timerRef = useRef<any>(null);

  const resetTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Nếu đang ở màn hình Welcome (index) thì không cần đếm giờ
    if (pathname !== '/') {
      timerRef.current = setTimeout(() => {
        // Hết giờ -> Chuyển về màn hình Welcome
        router.replace('/');
      }, timeoutMs);
    }
  };

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [pathname]);

  return { resetTimer };
}
