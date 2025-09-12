/**
 * Audio Services Index
 * 
 * Экспортирует все компоненты аудио системы.
 * Соответствует архитектурным принципам hrpro.mdc:
 * - Модульная архитектура с четким разделением ответственности
 * - Единая точка входа для всех аудио сервисов
 */

export { AudioSourceDetector } from './AudioSourceDetector';
export { HeadphoneDetector } from './HeadphoneDetector';
export { HRHeadphoneHandler } from './HRHeadphoneHandler';
export { AudioStreamSplitter } from './AudioStreamSplitter';
export { nativeAudioService } from './NativeAudioService';

// Re-export types
export type {
  AudioSource,
  StreamAnalysis,
  IAudioService,
  IAudioSourceDetector,
  HeadphoneInfo,
  HRHeadphoneStrategy,
  AudioConfiguration,
  HeadphonePriorityRule
} from '../../types/IAudioService';
