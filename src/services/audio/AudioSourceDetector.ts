/**
 * Audio Source Detector
 * 
 * Определяет и анализирует доступные аудио источники.
 * Соответствует архитектурным принципам hrpro.mdc:
 * - AppError для структурированных ошибок
 * - ErrorHandler для retry логики
 * - Logger для структурированного логирования
 * - PerformanceMonitor для метрик производительности
 * - MemoryManager для управления памятью
 */

import { AppError, ErrorHandler } from '../../utils/errors';
import { Logger } from '../../utils/logger';
import { PerformanceMonitor } from '../../utils/performance-monitor';
import { MemoryManager } from '../../utils/memory-manager';
import { IAudioSourceDetector, AudioSource } from '../../types/IAudioService';

export class AudioSourceDetector implements IAudioSourceDetector {
  private sources: Map<string, AudioSource> = new Map();
  private activeSource: string | null = null;
  private readonly MAX_SOURCES = 10; // Ограничение для управления памятью
  
  async detectSources(): Promise<AudioSource[]> {
    const startTime = performance.now();
    
    try {
      Logger.info('Starting audio source detection');
      
      // 1. Получаем доступные аудиоустройства с retry логикой
      const devices = await ErrorHandler.withRetry(
        () => navigator.mediaDevices.enumerateDevices(),
        3,
        1000
      );
      
      // 2. Анализируем системный звук (через Web Audio API)
      const systemAudio = await this.detectSystemAudio();
      
      // 3. Определяем характеристики каждого источника
      const sources = await this.analyzeSources(devices, systemAudio);
      
      // 4. Ограничиваем количество источников для управления памятью
      const limitedSources = sources.slice(0, this.MAX_SOURCES);
      
      // 5. Записываем метрики производительности
      const duration = performance.now() - startTime;
      PerformanceMonitor.recordAnalysisLatency(duration);
      
      Logger.info('Audio source detection completed', {
        sourcesFound: limitedSources.length,
        duration: `${duration.toFixed(2)}ms`
      });
      
      return limitedSources;
      
    } catch (error) {
      const appError = new AppError(
        'Failed to detect audio sources',
        'AUDIO_SOURCE_DETECTION_ERROR',
        true, // retriable
        { originalError: error }
      );
      
      Logger.error('Audio source detection failed', appError);
      throw appError;
    }
  }
  
  private async detectSystemAudio(): Promise<AudioSource | null> {
    try {
      // Попытка захвата системного звука (требует разрешений)
      const constraints = {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          // Специальные флаги для системного звука
          systemAudio: true
        }
      };
      
      const stream = await ErrorHandler.withRetry(
        () => navigator.mediaDevices.getDisplayMedia(constraints),
        2,
        500
      );
      
      return {
        id: 'system-audio',
        type: 'system',
        name: 'System Audio',
        isActive: true,
        quality: 0.9,
        priority: 8,
        characteristics: {
          sampleRate: 48000,
          channels: 2,
          bitDepth: 16,
          latency: 50
        }
      };
    } catch (error) {
      Logger.warn('System audio capture not available', { error });
      return null;
    }
  }
  
  private async analyzeSources(devices: MediaDeviceInfo[], systemAudio: AudioSource | null): Promise<AudioSource[]> {
    const sources: AudioSource[] = [];
    
    // Анализируем микрофоны с обработкой ошибок
    for (const device of devices.filter(d => d.kind === 'audioinput')) {
      try {
        const stream = await ErrorHandler.withRetry(
          () => navigator.mediaDevices.getUserMedia({
            audio: { deviceId: device.deviceId }
          }),
          2,
          500
        );
        
        const quality = await this.analyzeQuality(stream);
        const priority = this.calculatePriority(device, quality);
        
        sources.push({
          id: device.deviceId,
          type: 'microphone',
          name: device.label || 'Microphone',
          isActive: false,
          quality,
          priority,
          characteristics: {
            sampleRate: 16000,
            channels: 1,
            bitDepth: 16,
            latency: 100
          }
        });
        
        // Очищаем ресурсы
        stream.getTracks().forEach(track => track.stop());
        
      } catch (error) {
        Logger.warn('Failed to analyze audio device', {
          deviceId: device.deviceId,
          deviceLabel: device.label,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Добавляем системный звук если доступен
    if (systemAudio) {
      sources.push(systemAudio);
    }
    
    return sources.sort((a, b) => b.priority - a.priority);
  }
  
  async analyzeQuality(stream: MediaStream): Promise<number> {
    const startTime = performance.now();
    
    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 2048;
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      
      // Анализируем частотный спектр для определения качества
      const quality = this.calculateQualityFromSpectrum(dataArray);
      
      // Очищаем ресурсы
      audioContext.close();
      
      // Записываем метрики
      const duration = performance.now() - startTime;
      PerformanceMonitor.recordAnalysisLatency(duration);
      
      Logger.debug('Audio quality analysis completed', {
        quality: quality.toFixed(3),
        duration: `${duration.toFixed(2)}ms`
      });
      
      return quality;
      
    } catch (error) {
      Logger.error('Failed to analyze audio quality', { error });
      return 0.5; // Fallback значение
    }
  }
  
  private calculateQualityFromSpectrum(data: Uint8Array): number {
    // Простой алгоритм оценки качества по спектру
    const total = data.reduce((sum, value) => sum + value, 0);
    const average = total / data.length;
    const variance = data.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / data.length;
    
    // Качество основано на средней амплитуде и вариативности
    return Math.min(1, (average / 128) * (variance / 1000));
  }
  
  calculatePriority(device: MediaDeviceInfo, quality: number): number {
    let priority = quality * 5; // Базовый приоритет от качества
    
    // Повышаем приоритет для устройств с определенными именами
    const name = device.label?.toLowerCase() || '';
    if (name.includes('headset') || name.includes('headphone')) {
      priority += 2; // Гарнитуры обычно лучше для интервью
    }
    if (name.includes('usb') || name.includes('bluetooth')) {
      priority += 1; // USB/Bluetooth устройства часто качественнее
    }
    
    return Math.min(10, priority);
  }
  
  getSource(sourceId: string): AudioSource | undefined {
    return this.sources.get(sourceId);
  }
  
  // Очистка ресурсов
  cleanup(): void {
    this.sources.clear();
    this.activeSource = null;
    Logger.info('AudioSourceDetector cleaned up');
  }
}
