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

    // Nếu đang ở màn hình Tự hành thì không cần đếm giờ
    if (pathname !== '/autonomous') {
      timerRef.current = setTimeout(() => {
        // Hết giờ -> Chuyển về màn hình Tự hành
        router.replace('/autonomous');
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
