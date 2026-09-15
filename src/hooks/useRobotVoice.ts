/* eslint-disable react-hooks/globals */
import { useRouter } from 'expo-router';
import { useEffect, useState, useRef, useCallback } from 'react';
import { VoiceService } from '../services/RobotVoiceService';

// Hàm kiểm tra trạng thái nói toàn cục của ứng dụng
export function isRobotVoiceSpeaking(): boolean {
  return VoiceService.isSpeaking();
}

// Dừng giọng nói toàn cục, được gọi khi có thao tác điều hướng
export const stopGlobalVoice = (): void => {
  void VoiceService.stop();
};

// Hook router thông minh: Chặn hoặc dừng giọng nói khi chuyển trang
export function useVoiceRouter() {
  const router = useRouter();

  return {
    ...router,
    push: (href: any, options?: any) => {
      if (VoiceService.isSpeaking()) {
        stopGlobalVoice();
      }
      router.push(href, options);
    },
    replace: (href: any, options?: any) => {
      if (VoiceService.isSpeaking()) {
        stopGlobalVoice();
      }
      router.replace(href, options);
    },
    back: () => {
      if (VoiceService.isSpeaking()) {
        stopGlobalVoice();
      }
      router.back();
    },
  };
}

export function useRobotVoice() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      void VoiceService.stop();
    };
  }, []);

  const stop = useCallback(async () => {
    if (isMountedRef.current) {
      setIsSpeaking(false);
    }
    await VoiceService.stop();
  }, []);

  const speak = useCallback(
    async (text: string, onDone?: () => void) => {
      if (isMountedRef.current) {
        setIsSpeaking(true);
      }

      await VoiceService.speak(text, {
        onStart: () => {
          if (isMountedRef.current) {
            setIsSpeaking(true);
          }
        },
        onDone: () => {
          if (isMountedRef.current) {
            setIsSpeaking(false);
          }
          onDone?.();
        },
      });
    },
    []
  );

  const cleanText = useCallback((text: string) => {
    return VoiceService.cleanText(text);
  }, []);

  const preload = useCallback((texts: string[]) => {
    void VoiceService.preload(texts);
  }, []);

  return { speak, stop, isSpeaking, cleanText, preload };
}