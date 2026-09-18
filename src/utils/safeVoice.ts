import { NativeModules, Platform } from 'react-native';

/**
 * Kiểm tra xem module native Voice có được hỗ trợ trên môi trường hiện tại hay không.
 * Trong Expo Go, NativeModules.Voice sẽ là undefined.
 */
export const isNativeVoiceSupported: boolean = Boolean(
  Platform.OS !== 'web' &&
  NativeModules &&
  (NativeModules.Voice || NativeModules.RCTVoice)
);

let SafeVoiceInstance: any = null;

if (isNativeVoiceSupported) {
  try {
    // Chỉ require khi native module thực sự tồn tại để tránh NativeEventEmitter(undefined) crash trên Expo Go
    const VoiceModule = require('@react-native-voice/voice');
    SafeVoiceInstance = VoiceModule.default || VoiceModule;
  } catch (err) {
    console.warn('[SafeVoice] Không thể tải native voice module:', err);
    SafeVoiceInstance = null;
  }
}

// Mock fallback an toàn cho môi trường Expo Go / Web / iOS simulator
if (!SafeVoiceInstance) {
  SafeVoiceInstance = {
    onSpeechStart: undefined,
    onSpeechRecognized: undefined,
    onSpeechEnd: undefined,
    onSpeechError: undefined,
    onSpeechResults: undefined,
    onSpeechPartialResults: undefined,
    onSpeechVolumeChanged: undefined,
    isAvailable: async () => 0,
    start: async () => {
      console.warn('[SafeVoice] Tính năng nhận diện giọng nói không hỗ trợ trên Expo Go.');
      return Promise.reject(new Error('Expo Go không hỗ trợ micro native'));
    },
    stop: async () => Promise.resolve(),
    cancel: async () => Promise.resolve(),
    destroy: async () => Promise.resolve(),
    removeAllListeners: () => {},
  };
}

export default SafeVoiceInstance;
