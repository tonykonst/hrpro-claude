/**
 * HR Headphone Handler
 * 
 * Обрабатывает различные сценарии использования наушников HR.
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
import { HeadphoneDetector } from './HeadphoneDetector';
import { HRHeadphoneStrategy, HeadphoneInfo } from '../../types/IAudioService';

export class HRHeadphoneHandler {
  private headphoneDetector: HeadphoneDetector;
  private readonly MAX_STRATEGIES = 10; // Ограничение для управления памятью
  
  constructor() {
    this.headphoneDetector = new HeadphoneDetector();
  }
  
  async handleHRWithHeadphones(): Promise<HRHeadphoneStrategy> {
    const startTime = performance.now();
    
    try {
      Logger.info('Starting HR headphone analysis');
      
      const headphones = await this.headphoneDetector.detectHeadphones();
      const hrHeadphones = headphones.find(h => this.isHRHeadphone(h));
      
      if (!hrHeadphones) {
        const strategy: HRHeadphoneStrategy = {
          strategy: 'no_headphones',
          message: 'HR not using headphones',
          actions: [
            'Use standard microphone for HR speech',
            'Monitor system audio for candidate speech',
            'Apply basic echo cancellation'
          ],
          configuration: {
            monitorSystemAudio: true,
            suppressHRInSystemAudio: false,
            candidateSource: 'system_audio',
            hrSource: 'hr_microphone'
          }
        };
        
        const duration = performance.now() - startTime;
        PerformanceMonitor.recordAnalysisLatency(duration);
        
        Logger.info('HR headphone analysis completed - no headphones', {
          duration: `${duration.toFixed(2)}ms`
        });
        
        return strategy;
      }
      
      // Определяем стратегию в зависимости от типа наушников
      let strategy: HRHeadphoneStrategy;
      
      switch (hrHeadphones.type) {
        case 'usb':
          strategy = await this.handleUSBHeadphones(hrHeadphones);
          break;
        case 'bluetooth':
          strategy = await this.handleBluetoothHeadphones(hrHeadphones);
          break;
        case 'jack':
          strategy = await this.handleJackHeadphones(hrHeadphones);
          break;
        case 'wireless':
          strategy = await this.handleWirelessHeadphones(hrHeadphones);
          break;
        default:
          strategy = await this.handleUnknownHeadphones(hrHeadphones);
      }
      
      const duration = performance.now() - startTime;
      PerformanceMonitor.recordAnalysisLatency(duration);
      
      Logger.info('HR headphone analysis completed', {
        strategy: strategy.strategy,
        duration: `${duration.toFixed(2)}ms`
      });
      
      return strategy;
      
    } catch (error) {
      const appError = new AppError(
        'Failed to handle HR headphones',
        'HR_HEADPHONE_HANDLER_ERROR',
        true, // retriable
        { originalError: error }
      );
      
      Logger.error('HR headphone handler failed', appError);
      throw appError;
    }
  }
  
  private async handleUSBHeadphones(headphones: HeadphoneInfo): Promise<HRHeadphoneStrategy> {
    // USB наушники обычно подключаются к компьютеру
    // HR речь может попадать в системный звук
    
    const strategy: HRHeadphoneStrategy = {
      strategy: 'usb_headphones',
      message: 'HR using USB headphones - monitoring system audio for HR speech',
      actions: [
        'Monitor system audio for HR speech patterns',
        'Use voice activity detection to filter HR speech',
        'Focus on candidate speech from video call',
        'Enable HR speech suppression in system audio'
      ],
      configuration: {
        monitorSystemAudio: true,
        suppressHRInSystemAudio: true,
        candidateSource: 'system_audio_filtered',
        hrSource: 'usb_headphone_mic'
      }
    };
    
    // Настраиваем фильтрацию HR речи из системного звука
    await this.configureHRSuppression(strategy.configuration);
    
    return strategy;
  }
  
  private async handleBluetoothHeadphones(headphones: HeadphoneInfo): Promise<HRHeadphoneStrategy> {
    // Bluetooth наушники могут быть подключены к телефону или компьютеру
    
    const strategy: HRHeadphoneStrategy = {
      strategy: 'bluetooth_headphones',
      message: 'HR using Bluetooth headphones - checking connection target',
      actions: [
        'Determine if headphones connected to computer or phone',
        'If computer: monitor system audio for HR speech',
        'If phone: HR speech will not be captured',
        'Focus on candidate speech from video call'
      ],
      configuration: {
        monitorSystemAudio: true,
        suppressHRInSystemAudio: false, // Может быть не нужно
        candidateSource: 'system_audio',
        hrSource: 'bluetooth_mic_or_none'
      }
    };
    
    // Проверяем, подключены ли наушники к компьютеру
    const isConnectedToComputer = await this.checkBluetoothConnection(headphones);
    if (!isConnectedToComputer) {
      strategy.configuration.hrSource = 'none';
      strategy.message += ' - HR speech not captured (connected to phone)';
    }
    
    return strategy;
  }
  
  private async handleJackHeadphones(headphones: HeadphoneInfo): Promise<HRHeadphoneStrategy> {
    // Jack наушники обычно подключаются к компьютеру
    
    return {
      strategy: 'jack_headphones',
      message: 'HR using jack headphones - monitoring for HR speech',
      actions: [
        'Monitor system audio for HR speech',
        'Use audio analysis to distinguish HR from candidate',
        'Focus on candidate speech from video call'
      ],
      configuration: {
        monitorSystemAudio: true,
        suppressHRInSystemAudio: true,
        candidateSource: 'system_audio_filtered',
        hrSource: 'jack_headphone_mic'
      }
    };
  }
  
  private async handleWirelessHeadphones(headphones: HeadphoneInfo): Promise<HRHeadphoneStrategy> {
    // Беспроводные наушники (AirPods, etc.)
    
    return {
      strategy: 'wireless_headphones',
      message: 'HR using wireless headphones - advanced filtering required',
      actions: [
        'Use advanced voice separation algorithms',
        'Monitor both system audio and headphone mic',
        'Apply machine learning for speaker identification',
        'Focus on candidate speech with high confidence'
      ],
      configuration: {
        monitorSystemAudio: true,
        suppressHRInSystemAudio: true,
        useAdvancedFiltering: true,
        candidateSource: 'system_audio_ml_filtered',
        hrSource: 'wireless_mic_ml_identified'
      }
    };
  }
  
  private async handleUnknownHeadphones(headphones: HeadphoneInfo): Promise<HRHeadphoneStrategy> {
    return {
      strategy: 'unknown_headphones',
      message: 'HR using unknown headphone type - using adaptive detection',
      actions: [
        'Use adaptive voice detection',
        'Monitor all available audio sources',
        'Learn HR voice patterns during interview',
        'Apply dynamic filtering based on learned patterns'
      ],
      configuration: {
        monitorSystemAudio: true,
        suppressHRInSystemAudio: false,
        useAdaptiveDetection: true,
        candidateSource: 'adaptive_detection',
        hrSource: 'adaptive_detection'
      }
    };
  }
  
  private isHRHeadphone(headphones: HeadphoneInfo): boolean {
    // Определяем, являются ли наушники HR наушниками
    // Обычно это наушники с микрофоном, подключенные к компьютеру
    return headphones.hasHeadphones && 
           headphones.characteristics.hasMicrophone && 
           headphones.isActive;
  }
  
  private async configureHRSuppression(config: any): Promise<void> {
    // Настраиваем подавление HR речи в системном звуке
    if (config.suppressHRInSystemAudio) {
      try {
        Logger.info('Configuring HR speech suppression in system audio');
        // Реализация алгоритма подавления HR речи
        // Это может включать анализ частотных характеристик, паттернов речи и т.д.
        console.log('🔇 Configuring HR speech suppression in system audio');
      } catch (error) {
        Logger.warn('Failed to configure HR suppression', { error });
      }
    }
  }
  
  private async checkBluetoothConnection(headphones: HeadphoneInfo): Promise<boolean> {
    // Проверяем, подключены ли Bluetooth наушники к компьютеру
    // Это можно сделать через Web Bluetooth API или анализ устройств
    try {
      const devices = await ErrorHandler.withRetry(
        () => navigator.mediaDevices.enumerateDevices(),
        2,
        500
      );
      
      const bluetoothDevices = devices.filter(d => 
        d.label.toLowerCase().includes('bluetooth') && 
        d.kind === 'audioinput'
      );
      
      const isConnected = bluetoothDevices.length > 0;
      
      Logger.debug('Bluetooth connection check', {
        bluetoothDevicesFound: bluetoothDevices.length,
        isConnected
      });
      
      return isConnected;
    } catch (error) {
      Logger.warn('Could not check Bluetooth connection', { error });
      return false;
    }
  }
  
  // Публичные методы для интеграции
  async getOptimalConfiguration(): Promise<HRHeadphoneStrategy> {
    try {
      return await this.handleHRWithHeadphones();
    } catch (error) {
      Logger.warn('Failed to get optimal configuration, using fallback', { error });
      
      // Fallback конфигурация
      return {
        strategy: 'no_headphones',
        message: 'Using fallback configuration due to detection failure',
        actions: [
          'Use standard microphone setup',
          'Monitor system audio',
          'Apply basic filtering'
        ],
        configuration: {
          monitorSystemAudio: true,
          suppressHRInSystemAudio: false,
          candidateSource: 'system_audio',
          hrSource: 'hr_microphone'
        }
      };
    }
  }
  
  // Очистка ресурсов
  cleanup(): void {
    Logger.info('HRHeadphoneHandler cleaned up');
  }
}
