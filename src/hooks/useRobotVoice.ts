import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';

// Lưu trữ instance âm thanh toàn cục và trạng thái nói toàn cục để tránh đè giọng và chặn điều hướng
let globalActiveSound: Audio.Sound | null = null;
let globalRequestCounter = 0;
let isSpeakingGlobal = false;

// Hàm kiểm tra trạng thái nói toàn cục của ứng dụng
export function isRobotVoiceSpeaking() {
  return isSpeakingGlobal;
}

// Hook router thông minh: Chặn tất cả các thao tác chuyển trang nếu Robot đang nói
export function useVoiceRouter() {
  const router = useRouter();

  return {
    ...router,
    push: (href: any, options?: any) => {
      if (isSpeakingGlobal) {
        console.warn('Navigation blocked: Robot is speaking');
        return;
      }
      router.push(href, options);
    },
    replace: (href: any, options?: any) => {
      if (isSpeakingGlobal) {
        console.warn('Navigation blocked: Robot is speaking');
        return;
      }
      router.replace(href, options);
    },
    back: () => {
      if (isSpeakingGlobal) {
        console.warn('Navigation blocked: Robot is speaking');
        return;
      }
      router.back();
    },
  };
}

export function useRobotVoice() {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const stop = async () => {
    isSpeakingGlobal = false;
    setIsSpeaking(false);
    Speech.stop();
    try {
      // Dừng và giải phóng bộ nhớ của âm thanh đang phát toàn cục
      if (globalActiveSound) {
        const sound = globalActiveSound;
        globalActiveSound = null;
        await sound.stopAsync().catch(() => { });
        await sound.unloadAsync().catch(() => { });
      }
    } catch (e) {
      console.warn('Error stopping sound', e);
    }
  };

  const speak = async (text: string) => {
    // 1. Tăng counter định danh để hủy các yêu cầu cũ bất đồng bộ chưa hoàn thành
    const currentId = ++globalRequestCounter;

    // 2. Dừng bất kỳ giọng nói nào cũ đang phát ngay lập tức
    await stop();

    isSpeakingGlobal = true;
    setIsSpeaking(true);

    const apiKey = process.env.EXPO_PUBLIC_VOICE_API_KEY;

    if (!apiKey) {
      if (currentId !== globalRequestCounter) return;
      speakFallback(text);
      return;
    }

    try {
      // Cấu hình request theo chuẩn FPT.AI API v5
      const response = await fetch('https://api.fpt.ai/hmi/tts/v5', {
        method: 'POST',
        headers: {
          'api_key': apiKey,
          'voice': 'ngoclam', // Giọng nữ miền Nam thân thiện và truyền cảm cho siêu thị
          'speed': '0',
          'format': 'mp3',
        },
        body: text,
      });

      if (currentId !== globalRequestCounter) return;

      if (!response.ok) {
        throw new Error(`FPT.AI API response status: ${response.status}`);
      }

      const json = await response.json();
      if (currentId !== globalRequestCounter) return;

      if (json.error === 0 && json.async) {
        const audioUrl = json.async;

        // Chờ file âm thanh được FPT.AI tạo xong (tối đa 10 lần, cách nhau 300ms)
        let isReady = false;
        for (let i = 0; i < 10; i++) {
          try {
            const check = await fetch(audioUrl, { method: 'HEAD' });
            if (currentId !== globalRequestCounter) return;
            if (check.ok) {
              isReady = true;
              break;
            }
          } catch (e) {
            // Bỏ qua lỗi kết nối tạm thời khi file đang tạo
          }
          await new Promise(resolve => setTimeout(resolve, 300));
          if (currentId !== globalRequestCounter) return;
        }

        if (!isReady) {
          throw new Error('FPT.AI audio generation timeout.');
        }

        // Cấu hình Audio Mode để phát ra loa ngoài tốt nhất
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          playThroughEarpieceAndroid: false,
        });

        if (currentId !== globalRequestCounter) return;

        // Tạo sound instance và tự động phát
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true }
        );

        // Nếu trong lúc load sound mà có request mới, unload ngay lập tức
        if (currentId !== globalRequestCounter) {
          sound.unloadAsync().catch(() => { });
          return;
        }

        // Lưu sound vào biến toàn cục để các hook khác/lần gọi tiếp theo có thể stop() nó
        globalActiveSound = sound;
        isSpeakingGlobal = true;

        // Lắng nghe sự kiện phát xong để tắt trạng thái isSpeaking
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            isSpeakingGlobal = false;
            setIsSpeaking(false);
            sound.unloadAsync().catch(() => { });
            if (globalActiveSound === sound) {
              globalActiveSound = null;
            }
          }
        });
      } else {
        console.warn('FPT.AI TTS error response:', json);
        throw new Error(json.message || 'Unknown FPT.AI API error');
      }
    } catch (error) {
      if (currentId !== globalRequestCounter) return;
      console.warn('FPT.AI TTS failed, falling back to local TTS:', error);
      speakFallback(text);
    }
  };

  const speakFallback = (text: string) => {
    isSpeakingGlobal = true;
    Speech.speak(text, {
      language: 'vi-VN',
      pitch: 1.1,
      rate: 0.9,
      onDone: () => {
        isSpeakingGlobal = false;
        setIsSpeaking(false);
      },
      onError: () => {
        isSpeakingGlobal = false;
        setIsSpeaking(false);
      },
      onStopped: () => {
        isSpeakingGlobal = false;
        setIsSpeaking(false);
      },
    });
  };

  // Dọn dẹp âm thanh khi component sử dụng hook này unmount
  useEffect(() => {
    return () => {
      // Khi rời màn hình, ta dừng tiếng nói của chính màn hình đó ngay lập tức để không đè màn hình kế tiếp
      stop();
    };
  }, []);

  return { speak, stop, isSpeaking };
}
