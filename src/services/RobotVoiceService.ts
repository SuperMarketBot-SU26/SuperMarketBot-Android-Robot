import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';

export interface SpeakOptions {
  onStart?: () => void;
  onDone?: () => void;
  rate?: number;
  pitch?: number;
  interrupt?: boolean;
}

class RobotVoiceService {
  private static instance: RobotVoiceService;

  private activeSound: AudioPlayer | null = null;
  private currentRequestId = 0;
  private isCurrentlySpeaking = false;
  private cachedViVoiceId: string | undefined = undefined;
  private isVoiceInitialized = false;

  // Cache URL âm thanh đã tổng hợp từ FPT.AI theo nội dung văn bản (đỡ gọi lại API & phát tức thì)
  private audioUrlCache = new Map<string, string>();
  // Tránh prefetch trùng lặp cùng lúc
  private prefetchInFlight = new Map<string, Promise<string | null>>();

  private constructor() {
    this.initAudioMode();
    this.initNativeVoices();
  }

  public static getInstance(): RobotVoiceService {
    if (!RobotVoiceService.instance) {
      RobotVoiceService.instance = new RobotVoiceService();
    }
    return RobotVoiceService.instance;
  }

  private async initAudioMode() {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });
    } catch (e) {
      console.warn('[RobotVoiceService] setAudioModeAsync init notice:', e);
    }
  }

  private async initNativeVoices() {
    if (this.isVoiceInitialized) return;
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const viVoice = voices.find(
        (v) =>
          (v.language?.toLowerCase().includes('vi') || v.identifier?.toLowerCase().includes('vi')) &&
          !v.identifier?.toLowerCase().includes('miui')
      );
      if (viVoice) {
        this.cachedViVoiceId = viVoice.identifier;
      }
      this.isVoiceInitialized = true;
    } catch (e) {
      this.isVoiceInitialized = true;
    }
  }

  /**
   * Chuẩn hóa văn bản tiếng Việt cho giọng đọc mượt mà:
   * - Thay thế dấu gạch ngang '-', gạch dưới '_', gạch chéo bằng dấu phẩy để tạo nhịp nghỉ tự nhiên (tránh đọc thành 'trừ' hoặc 'gạch ngang')
   * - Xóa các ký tự đặc biệt markdown như '*', '#', '~', '|'
   */
  public cleanText(text: string): string {
    if (!text) return '';
    return text
      .replace(/[\-–—]/g, ', ')
      .replace(/[_*#~|`\^]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*,+/g, ', ')
      .trim();
  }

  public isSpeaking(): boolean {
    return this.isCurrentlySpeaking;
  }

  /**
   * Dừng toàn bộ âm thanh và giọng đọc ngay lập tức
   */
  public async stop(): Promise<void> {
    this.isCurrentlySpeaking = false;
    this.currentRequestId++;

    try {
      Speech.stop();
    } catch (e) {}

    if (this.activeSound) {
      const sound = this.activeSound;
      this.activeSound = null;
      try {
        sound.pause();
      } catch (e) {}
      setTimeout(() => {
        try {
          sound.remove();
        } catch (e) {}
      }, 300);
    }
  }

  private rateLimitCooldownUntil = 0;

  /**
   * Tổng hợp hoặc lấy URL âm thanh từ FPT.AI TTS v5
   */
  private async getFptAiAudioUrl(cleanedText: string): Promise<string | null> {
    const apiKey =
      process.env.EXPO_PUBLIC_VOICE_API_KEY || 'shgO1VCmCHInmnYRjo3RV8jlYHbvJIFV';
    const voice = process.env.EXPO_PUBLIC_VOICE_NAME || 'banmai';
    const speed = process.env.EXPO_PUBLIC_VOICE_SPEED || '0';

    if (!apiKey) return null;

    // Nếu FPT.AI đang bị giới hạn tần suất (Rate Limit 429), tự động backoff và dùng local TTS ngay lập tức
    if (Date.now() < this.rateLimitCooldownUntil) {
      return null;
    }

    const cacheKey = `${voice}_${speed}_${cleanedText}`;
    if (this.audioUrlCache.has(cacheKey)) {
      return this.audioUrlCache.get(cacheKey)!;
    }

    if (this.prefetchInFlight.has(cacheKey)) {
      return await this.prefetchInFlight.get(cacheKey)!;
    }

    const fetchPromise = (async () => {
      try {
        const response = await fetch('https://api.fpt.ai/hmi/tts/v5', {
          method: 'POST',
          headers: {
            'api-key': apiKey,
            'voice': voice,
            'speed': speed,
            'format': 'mp3',
          },
          body: cleanedText,
        });

        if (!response.ok) {
          if (response.status === 429) {
            // FPT.AI giới hạn gói Free (tối đa request/giây). Cooldown 60s để không spam và dùng local TTS mượt mà.
            this.rateLimitCooldownUntil = Date.now() + 60000;
            console.log('[RobotVoiceService] FPT.AI rate limit (429). Chuyển sang giọng offline 60s để bảo đảm mượt mà.');
          } else {
            console.warn(`[RobotVoiceService] FPT.AI API status ${response.status}`);
          }
          return null;
        }

        const json = await response.json();
        if (json.error !== 0 || !json.async) {
          console.warn('[RobotVoiceService] FPT.AI returned error:', json);
          return null;
        }

        const audioUrl = json.async;

        let isReady = false;
        for (let attempt = 0; attempt < 12; attempt++) {
          try {
            const check = await fetch(audioUrl, { method: 'HEAD' });
            if (check.ok) {
              isReady = true;
              break;
            }
          } catch (e) {}
          await new Promise((r) => setTimeout(r, 350));
        }

        if (isReady) {
          this.audioUrlCache.set(cacheKey, audioUrl);
          return audioUrl;
        }
        return null;
      } catch (err) {
        console.warn('[RobotVoiceService] FPT.AI TTS fetch error:', err);
        return null;
      } finally {
        this.prefetchInFlight.delete(cacheKey);
      }
    })();

    this.prefetchInFlight.set(cacheKey, fetchPromise);
    return await fetchPromise;
  }

  /**
   * Tải trước âm thanh FPT.AI cho danh sách văn bản (tuần tự, tránh chạm Rate Limit)
   */
  public async preload(texts: string[]): Promise<void> {
    for (const raw of texts) {
      if (Date.now() < this.rateLimitCooldownUntil) break;
      const cleaned = this.cleanText(raw);
      if (cleaned.length > 2) {
        await this.getFptAiAudioUrl(cleaned);
        // Giãn cách 1.5s giữa các lần tải trước để tránh làm nghẽn API
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  /**
   * Phát giọng nói bất đồng bộ (chờ đọc xong mới resolve)
   */
  public speakAsync(text: string, options?: Omit<SpeakOptions, 'onDone'>): Promise<void> {
    return new Promise<void>((resolve) => {
      this.speak(text, {
        ...options,
        onDone: () => resolve(),
      });
    });
  }

  /**
   * Phát giọng nói mượt mà với FPT.AI (giọng banmai) và fallback tức thì sang Android TTS cục bộ
   */
  public async speak(text: string, options?: SpeakOptions): Promise<void> {
    const cleaned = this.cleanText(text);
    if (!cleaned) {
      options?.onDone?.();
      return;
    }

    const requestId = ++this.currentRequestId;
    await this.stop();

    this.isCurrentlySpeaking = true;
    options?.onStart?.();

    // 1. Thử phát bằng giọng FPT.AI tự nhiên
    const audioUrl = await this.getFptAiAudioUrl(cleaned);

    if (requestId !== this.currentRequestId) return;

    if (audioUrl) {
      try {
        await this.initAudioMode();

        const sound = createAudioPlayer(audioUrl);
        this.activeSound = sound;
        sound.play();

        let finished = false;
        const markDone = () => {
          if (finished) return;
          finished = true;
          this.isCurrentlySpeaking = false;
          if (this.activeSound === sound) {
            this.activeSound = null;
          }
          options?.onDone?.();
          setTimeout(() => {
            try {
              sound.remove();
            } catch (e) {}
          }, 200);
        };

        sound.addListener('playbackStatusUpdate', (status: any) => {
          if (requestId !== this.currentRequestId) return;

          if (
            status.didJustFinish === true ||
            (status.isLoaded &&
              status.playing === false &&
              status.duration > 0 &&
              status.currentTime >= status.duration - 0.3)
          ) {
            markDone();
          }
        });

        setTimeout(() => {
          if (requestId === this.currentRequestId && !finished) {
            markDone();
          }
        }, 30000);

        return;
      } catch (playerError) {
        console.warn('[RobotVoiceService] FPT.AI sound playback failed, fallback to local TTS:', playerError);
      }
    }

    // 2. Fallback sang Local Android TTS
    if (requestId !== this.currentRequestId) return;
    this.speakLocalTts(cleaned, requestId, options);
  }

  private speakLocalTts(cleanedText: string, requestId: number, options?: SpeakOptions) {
    try {
      this.isCurrentlySpeaking = true;

      const fallbackTimer = setTimeout(() => {
        if (requestId === this.currentRequestId) {
          this.isCurrentlySpeaking = false;
          options?.onDone?.();
        }
      }, 15000);

      Speech.speak(cleanedText, {
        language: 'vi-VN',
        voice: this.cachedViVoiceId,
        pitch: options?.pitch ?? 1.0,
        rate: options?.rate ?? 0.9,
        volume: 1.0,
        onDone: () => {
          clearTimeout(fallbackTimer);
          if (requestId === this.currentRequestId) {
            this.isCurrentlySpeaking = false;
            options?.onDone?.();
          }
        },
        onError: (err) => {
          clearTimeout(fallbackTimer);
          if (requestId === this.currentRequestId) {
            this.isCurrentlySpeaking = false;
            options?.onDone?.();
          }
          console.warn('[RobotVoiceService] Local Speech error:', err);
        },
        onStopped: () => {
          clearTimeout(fallbackTimer);
          if (requestId === this.currentRequestId) {
            this.isCurrentlySpeaking = false;
          }
        },
      });
    } catch (e) {
      this.isCurrentlySpeaking = false;
      options?.onDone?.();
      console.warn('[RobotVoiceService] Local Speech failed synchronously:', e);
    }
  }
}

export const VoiceService = RobotVoiceService.getInstance();