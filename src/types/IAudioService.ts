/**
 * Audio Service Interface
 * 
 * Определяет контракт для сервисов аудио разделения потоков.
 * Соответствует архитектурным принципам hrpro.mdc:
 * - Строгая типизация с интерфейсами сервисов
 * - Четкое разделение ответственности
 * - Структурированная обработка ошибок
 */

export interface AudioSource {
  id: string;
  type: 'microphone' | 'system' | 'application';
  name: string;
  isActive: boolean;
  quality: number; // 0-1
  priority: number; // 0-10
  characteristics: {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    latency: number;
  };
}

export interface StreamAnalysis {
  source: AudioSource;
  isActive: boolean;
  confidence: number;
  lastActivity: number;
  characteristics: {
    volume: number;
    frequency: number;
    clarity: number;
  };
}

export interface IAudioService {
  initialize(): Promise<void>;
  detectSources(): Promise<AudioSource[]>;
  selectCandidateStream(): Promise<MediaStream | null>;
  cleanup(): void;
  isConfigured(): boolean;
}

export interface IAudioSourceDetector {
  detectSources(): Promise<AudioSource[]>;
  analyzeQuality(stream: MediaStream): Promise<number>;
  calculatePriority(device: MediaDeviceInfo, quality: number): number;
  getSource(sourceId: string): AudioSource | undefined;
  cleanup(): void;
}

export interface HeadphoneInfo {
  hasHeadphones: boolean;
  type: 'usb' | 'bluetooth' | 'jack' | 'wireless' | 'unknown';
  isActive: boolean;
  deviceName: string;
  characteristics: {
    hasMicrophone: boolean;
    isNoiseCancelling: boolean;
    isWireless: boolean;
  };
}

export interface HRHeadphoneStrategy {
  strategy: 'no_headphones' | 'usb_headphones' | 'bluetooth_headphones' | 
           'jack_headphones' | 'wireless_headphones' | 'unknown_headphones';
  message: string;
  actions: string[];
  configuration: {
    monitorSystemAudio: boolean;
    suppressHRInSystemAudio: boolean;
    useAdvancedFiltering?: boolean;
    useAdaptiveDetection?: boolean;
    candidateSource: string;
    hrSource: string;
  };
}

export interface AudioConfiguration {
  candidateSource: string;
  hrSource: string;
  enableFiltering: boolean;
  enableDiarization: boolean;
  enableNoiseCancellation: boolean;
}

export interface HeadphonePriorityRule {
  scenario: string;
  priority: number;
  rules: string[];
}
