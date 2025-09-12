/**
 * Headphone Detector
 * 
 * Определяет наличие и характеристики наушников HR.
 * Соответствует архитектурным принципам hrpro.mdc:
 * - AppError для структурированных ошибок
 * - ErrorHandler для retry логики
 * - Logger для структурированного логирования
 * - PerformanceMonitor для метрик производительности
 */

import { AppError, ErrorHandler } from '../../utils/errors';
import { Logger } from '../../utils/logger';
import { PerformanceMonitor } from '../../utils/performance-monitor';
import { HeadphoneInfo } from '../../types/IAudioService';

export class HeadphoneDetector {
  private readonly MAX_HEADPHONES = 5; // Ограничение для управления памятью
  
  async detectHeadphones(): Promise<HeadphoneInfo[]> {
    const startTime = performance.now();
    
    try {
      Logger.info('Starting headphone detection');
      
      const devices = await ErrorHandler.withRetry(
        () => navigator.mediaDevices.enumerateDevices(),
        3,
        1000
      );
      
      const headphones: HeadphoneInfo[] = [];
      
      for (const device of devices.filter(d => d.kind === 'audioinput')) {
        try {
          const info = await this.analyzeDevice(device);
          if (this.isHeadphoneDevice(info)) {
            headphones.push(info);
          }
        } catch (error) {
          Logger.warn('Failed to analyze device for headphones', {
            deviceId: device.deviceId,
            deviceLabel: device.label,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      // Ограничиваем количество наушников для управления памятью
      const limitedHeadphones = headphones.slice(0, this.MAX_HEADPHONES);
      
      const duration = performance.now() - startTime;
      PerformanceMonitor.recordAnalysisLatency(duration);
      
      Logger.info('Headphone detection completed', {
        headphonesFound: limitedHeadphones.length,
        duration: `${duration.toFixed(2)}ms`
      });
      
      return limitedHeadphones;
      
    } catch (error) {
      const appError = new AppError(
        'Failed to detect headphones',
        'HEADPHONE_DETECTION_ERROR',
        true, // retriable
        { originalError: error }
      );
      
      Logger.error('Headphone detection failed', appError);
      throw appError;
    }
  }
  
  private async analyzeDevice(device: MediaDeviceInfo): Promise<HeadphoneInfo> {
    try {
      const stream = await ErrorHandler.withRetry(
        () => navigator.mediaDevices.getUserMedia({
          audio: { deviceId: device.deviceId }
        }),
        2,
        500
      );
      
      const characteristics = await this.analyzeDeviceCharacteristics(stream);
      
      stream.getTracks().forEach(track => track.stop());
      
      return {
        hasHeadphones: this.isHeadphoneDevice({ device, characteristics }),
        type: this.detectHeadphoneType(device.label, characteristics),
        isActive: true,
        deviceName: device.label || 'Unknown Device',
        characteristics
      };
    } catch (error) {
      Logger.warn('Failed to analyze device characteristics', {
        deviceId: device.deviceId,
        deviceLabel: device.label,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        hasHeadphones: false,
        type: 'unknown',
        isActive: false,
        deviceName: device.label || 'Unknown Device',
        characteristics: {
          hasMicrophone: false,
          isNoiseCancelling: false,
          isWireless: false
        }
      };
    }
  }
  
  private async analyzeDeviceCharacteristics(stream: MediaStream): Promise<HeadphoneInfo['characteristics']> {
    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 2048;
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      
      // Анализируем характеристики для определения типа наушников
      const characteristics = {
        hasMicrophone: this.detectMicrophone(dataArray),
        isNoiseCancelling: this.detectNoiseCancelling(dataArray),
        isWireless: this.detectWireless(dataArray)
      };
      
      audioContext.close();
      
      return characteristics;
      
    } catch (error) {
      Logger.warn('Failed to analyze device characteristics', { error });
      return {
        hasMicrophone: false,
        isNoiseCancelling: false,
        isWireless: false
      };
    }
  }
  
  private detectMicrophone(data: Uint8Array): boolean {
    // Простая эвристика: если есть активность в речевом диапазоне
    const speechRange = data.slice(10, 50); // Примерно 300-1500 Hz
    const average = speechRange.reduce((sum, value) => sum + value, 0) / speechRange.length;
    return average > 10; // Порог активности
  }
  
  private detectNoiseCancelling(data: Uint8Array): boolean {
    // Анализируем частотный спектр для определения шумоподавления
    const lowFreq = data.slice(0, 10); // Низкие частоты
    const highFreq = data.slice(50, 100); // Высокие частоты
    
    const lowAvg = lowFreq.reduce((sum, value) => sum + value, 0) / lowFreq.length;
    const highAvg = highFreq.reduce((sum, value) => sum + value, 0) / highFreq.length;
    
    // Шумоподавление обычно снижает низкочастотный шум
    return lowAvg < highAvg * 0.5;
  }
  
  private detectWireless(data: Uint8Array): boolean {
    // Анализируем задержку и качество для определения беспроводного соединения
    const total = data.reduce((sum, value) => sum + value, 0);
    const average = total / data.length;
    const variance = data.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / data.length;
    
    // Беспроводные устройства часто имеют более высокую вариативность
    return variance > 1000;
  }
  
  private isHeadphoneDevice(info: any): boolean {
    const name = info.device.label?.toLowerCase() || '';
    const keywords = [
      'headphone', 'headset', 'earphone', 'airpods', 'buds',
      'wireless', 'bluetooth', 'usb headset', 'gaming headset'
    ];
    
    return keywords.some(keyword => name.includes(keyword));
  }
  
  private detectHeadphoneType(deviceName: string, characteristics: any): HeadphoneInfo['type'] {
    const name = deviceName.toLowerCase();
    
    if (name.includes('usb')) return 'usb';
    if (name.includes('bluetooth') || name.includes('wireless')) return 'bluetooth';
    if (name.includes('jack') || name.includes('3.5mm')) return 'jack';
    if (characteristics.isWireless) return 'wireless';
    
    return 'unknown';
  }
  
  // Публичные методы для интеграции
  async isHRUsingHeadphones(): Promise<boolean> {
    try {
      const headphones = await this.detectHeadphones();
      return headphones.some(h => h.hasHeadphones && h.isActive);
    } catch (error) {
      Logger.warn('Failed to check HR headphones status', { error });
      return false;
    }
  }
  
  async getHRHeadphoneType(): Promise<HeadphoneInfo['type'] | null> {
    try {
      const headphones = await this.detectHeadphones();
      const hrHeadphones = headphones.find(h => h.hasHeadphones && h.isActive);
      return hrHeadphones?.type || null;
    } catch (error) {
      Logger.warn('Failed to get HR headphone type', { error });
      return null;
    }
  }
}
