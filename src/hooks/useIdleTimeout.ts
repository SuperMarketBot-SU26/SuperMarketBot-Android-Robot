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

    // Nếu đang ở trang chủ (màn hình avatar) thì không cần đếm giờ để đẩy về nữa
    if (pathname !== '/') {
      timerRef.current = setTimeout(() => {
        // Hết giờ -> Chuyển về màn hình Welcome (Avatar)
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
