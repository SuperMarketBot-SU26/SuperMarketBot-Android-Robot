/* eslint-disable react-hooks/globals */
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';

// Lưu trữ instance âm thanh toàn cục và trạng thái nói toàn cục để tránh đè giọng và chặn điều hướng
let globalActiveSound: AudioPlayer | null = null;
let globalRequestCounter = 0;
let isSpeakingGlobal = false;

// Hàm kiểm tra trạng thái nói toàn cục của ứng dụng
export function isRobotVoiceSpeaking() {
  return isSpeakingGlobal;
}

// Dừng giọng nói toàn cục, được gọi khi có thao tác điều hướng
export const stopGlobalVoice = () => {
  isSpeakingGlobal = false;
  try {
    Speech.stop();
  } catch (e) {
    console.warn('Error stopping local TTS speech:', e);
  }
  try {
    if (globalActiveSound) {
      const sound = globalActiveSound;
      globalActiveSound = null;
      try {
        sound.pause();
      } catch (e) {}
      setTimeout(() => {
        try {
          sound.remove();
        } catch (e) {}
      }, 500);
    }
  } catch (e) {
    console.warn('Error stopping sound', e);
  }
};

// Hook router thông minh: Chặn hoặc dừng giọng nói khi chuyển trang
export function useVoiceRouter() {
  const router = useRouter();

  return {
    ...router,
    push: (href: any, options?: any) => {
      if (isSpeakingGlobal) {
        stopGlobalVoice();
      }
      router.push(href, options);
    },
    replace: (href: any, options?: any) => {
      if (isSpeakingGlobal) {
        stopGlobalVoice();
      }
      router.replace(href, options);
    },
    back: () => {
      if (isSpeakingGlobal) {
        stopGlobalVoice();
      }
      router.back();
    },
  };
}

export function useRobotVoice() {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const stop = async () => {
    setIsSpeaking(false);
    stopGlobalVoice();
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

        // Chờ file âm thanh được FPT.AI tạo xong (tối đa 30 lần, cách nhau 500ms -> tối đa 15s)
        let isReady = false;
        for (let i = 0; i < 30; i++) {
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
          await new Promise(resolve => setTimeout(resolve, 500));
          if (currentId !== globalRequestCounter) return;
        }

        if (!isReady) {
          throw new Error('FPT.AI audio generation timeout.');
        }

        // Cấu hình Audio Mode để phát ra loa ngoài tốt nhất
        try {
          await setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: false,
          });
        } catch (audioModeError) {
          console.warn('Audio.setAudioModeAsync failed (safe to ignore on emulator):', audioModeError);
        }

        if (currentId !== globalRequestCounter) return;

        // Tạo sound instance bằng expo-audio
        const sound = createAudioPlayer(audioUrl);
        
        sound.play(); // Bắt đầu phát

        // Nếu trong lúc load sound mà có request mới, unload ngay lập tức
        if (currentId !== globalRequestCounter) {
          sound.remove();
          return;
        }

        // Lưu sound vào biến toàn cục để các hook khác/lần gọi tiếp theo có thể stop() nó
        globalActiveSound = sound;
        isSpeakingGlobal = true;

        // Lắng nghe sự kiện phát xong để tắt trạng thái isSpeaking
        sound.addListener('playbackStatusUpdate', (status) => {
          if (status.isLoaded && status.playing === false && status.currentTime >= status.duration - 0.5) {
            isSpeakingGlobal = false;
            setIsSpeaking(false);
            if (globalActiveSound === sound) {
              globalActiveSound = null;
            }
            setTimeout(() => {
              try {
                sound.remove();
              } catch (e) {}
            }, 100);
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

  const speakFallback = async (text: string) => {
    try {
      isSpeakingGlobal = true;
      setIsSpeaking(true);

      // Fallback phải hoạt động cả khi robot mất Internet: ưu tiên TTS Android
      // thay vì stream Google (lỗi playback bất đồng bộ trước đây gây im lặng).
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      }).catch((audioModeError) => {
        console.warn('Audio mode setup failed before local TTS:', audioModeError);
      });

      let targetVoiceId: string | undefined = undefined;
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        const viVoice = voices.find(v =>
          (v.language?.toLowerCase().includes('vi') || v.identifier?.toLowerCase().includes('vi')) &&
          !v.identifier?.toLowerCase().includes('miui')
        );
        if (viVoice) targetVoiceId = viVoice.identifier;
      } catch (voiceErr) {
        // Bỏ qua nếu không lấy được danh sách voice
      }

      await Speech.stop();
      const fallbackTimer = setTimeout(() => {
        isSpeakingGlobal = false;
        setIsSpeaking(false);
      }, 15000);

      Speech.speak(text, {
        language: 'vi-VN',
        voice: targetVoiceId,
        pitch: 1.0,
        rate: 0.9,
        volume: 1.0,
        onDone: () => {
          clearTimeout(fallbackTimer);
          isSpeakingGlobal = false;
          setIsSpeaking(false);
        },
        onError: (err) => {
          clearTimeout(fallbackTimer);
          isSpeakingGlobal = false;
          setIsSpeaking(false);
          console.warn('Speech.speak onError:', err);
        },
        onStopped: () => {
          clearTimeout(fallbackTimer);
          isSpeakingGlobal = false;
          setIsSpeaking(false);
        },
      });
    } catch (localTtsError) {
      isSpeakingGlobal = false;
      setIsSpeaking(false);
      console.warn('Local TTS Speech.speak failed synchronously:', localTtsError);
    }
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

