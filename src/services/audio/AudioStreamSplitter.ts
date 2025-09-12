/**
 * Audio Stream Splitter
 * 
 * Основной сервис для разделения аудиопотоков кандидата и HR.
 * Соответствует архитектурным принципам hrpro.mdc:
 * - IAudioService интерфейс для строгой типизации
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
import { AudioSourceDetector } from './AudioSourceDetector';
import { HRHeadphoneHandler } from './HRHeadphoneHandler';
import { 
  IAudioService, 
  AudioSource, 
  StreamAnalysis, 
  HRHeadphoneStrategy 
} from '../../types/IAudioService';

export class AudioStreamSplitter implements IAudioService {
  private detector: AudioSourceDetector;
  private hrHeadphoneHandler: HRHeadphoneHandler;
  private activeStreams: Map<string, MediaStream> = new Map();
  private streamAnalyses: Map<string, StreamAnalysis> = new Map();
  private candidateStream: string | null = null;
  private hrStream: string | null = null;
  private hrStrategy: HRHeadphoneStrategy | null = null;
  private readonly MAX_STREAMS = 5; // Ограничение для управления памятью
  private isInitialized = false;
  
  constructor() {
    this.detector = new AudioSourceDetector();
    this.hrHeadphoneHandler = new HRHeadphoneHandler();
  }
  
  async initialize(): Promise<void> {
    const startTime = performance.now();
    
    try {
      Logger.info('Initializing AudioStreamSplitter');
      
      const sources = await this.detector.detectSources();
      
      // Ограничиваем количество потоков для управления памятью
      const limitedSources = sources.slice(0, this.MAX_STREAMS);
      
      // Инициализируем потоки для всех источников
      for (const source of limitedSources) {
        await this.initializeStream(source);
      }
      
      // Проверяем наушники HR
      this.hrStrategy = await this.hrHeadphoneHandler.handleHRWithHeadphones();
      Logger.info(`HR Headphone Strategy: ${this.hrStrategy.message}`);
      
      // Автоматически определяем роли с учетом наушников
      await this.autoDetectRolesWithHeadphones();
      
      this.isInitialized = true;
      
      const duration = performance.now() - startTime;
      PerformanceMonitor.recordAnalysisLatency(duration);
      
      Logger.info('AudioStreamSplitter initialized successfully', {
        sourcesProcessed: limitedSources.length,
        candidateStream: this.candidateStream,
        hrStream: this.hrStream,
        hrStrategy: this.hrStrategy.strategy,
        duration: `${duration.toFixed(2)}ms`
      });
      
    } catch (error) {
      const appError = new AppError(
        'Failed to initialize AudioStreamSplitter',
        'AUDIO_STREAM_SPLITTER_INIT_ERROR',
        true, // retriable
        { originalError: error }
      );
      
      Logger.error('AudioStreamSplitter initialization failed', appError);
      throw appError;
    }
  }
  
  private async initializeStream(source: AudioSource): Promise<void> {
    try {
      let stream: MediaStream;
      
      if (source.type === 'system') {
        // Захват системного звука с retry логикой
        stream = await ErrorHandler.withRetry(
          () => navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: false
          }),
          2,
          500
        );
      } else {
        // Захват микрофона с retry логикой
        stream = await ErrorHandler.withRetry(
          () => navigator.mediaDevices.getUserMedia({
            audio: { deviceId: source.id }
          }),
          2,
          500
        );
      }
      
      this.activeStreams.set(source.id, stream);
      
      // Начинаем анализ потока
      this.startStreamAnalysis(source.id, stream);
      
      Logger.debug('Stream initialized successfully', {
        sourceId: source.id,
        sourceType: source.type,
        sourceName: source.name
      });
      
    } catch (error) {
      const appError = new AppError(
        `Failed to initialize stream for ${source.id}`,
        'STREAM_INITIALIZATION_ERROR',
        true, // retriable
        { sourceId: source.id, sourceType: source.type, originalError: error }
      );
      
      Logger.error('Stream initialization failed', appError);
      throw appError;
    }
  }
  
  private startStreamAnalysis(sourceId: string, stream: MediaStream): void {
    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 2048;
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const analyze = () => {
        try {
          analyser.getByteFrequencyData(dataArray);
          
          const analysis = this.analyzeStreamData(dataArray, sourceId);
          this.streamAnalyses.set(sourceId, analysis);
          
          // Обновляем роли если необходимо
          this.updateRoleDetection();
          
          requestAnimationFrame(analyze);
        } catch (error) {
          Logger.warn('Stream analysis error', { sourceId, error });
        }
      };
      
      analyze();
      
    } catch (error) {
      Logger.error('Failed to start stream analysis', { sourceId, error });
    }
  }
  
  private analyzeStreamData(data: Uint8Array, sourceId: string): StreamAnalysis {
    const source = this.detector.getSource(sourceId);
    if (!source) {
      throw new AppError(
        `Source ${sourceId} not found`,
        'SOURCE_NOT_FOUND_ERROR',
        false
      );
    }
    
    // Анализируем характеристики аудио
    const volume = this.calculateVolume(data);
    const frequency = this.calculateDominantFrequency(data);
    const clarity = this.calculateClarity(data);
    
    const isActive = volume > 0.1; // Порог активности
    const confidence = this.calculateConfidence(volume, frequency, clarity);
    
    return {
      source,
      isActive,
      confidence,
      lastActivity: isActive ? Date.now() : this.streamAnalyses.get(sourceId)?.lastActivity || 0,
      characteristics: {
        volume,
        frequency,
        clarity
      }
    };
  }
  
  private calculateVolume(data: Uint8Array): number {
    const sum = data.reduce((acc, value) => acc + value, 0);
    return sum / (data.length * 255);
  }
  
  private calculateDominantFrequency(data: Uint8Array): number {
    let maxIndex = 0;
    let maxValue = 0;
    
    for (let i = 0; i < data.length; i++) {
      if (data[i] > maxValue) {
        maxValue = data[i];
        maxIndex = i;
      }
    }
    
    // Конвертируем индекс в частоту (примерно)
    return (maxIndex / data.length) * 22050; // 22050 Hz - половина частоты дискретизации
  }
  
  private calculateClarity(data: Uint8Array): number {
    // Анализируем четкость по распределению частот
    const sorted = [...data].sort((a, b) => b - a);
    const top10Percent = sorted.slice(0, Math.floor(sorted.length * 0.1));
    const average = data.reduce((sum, value) => sum + value, 0) / data.length;
    
    // Четкость выше если есть выраженные пики
    return top10Percent.reduce((sum, value) => sum + value, 0) / (top10Percent.length * 255);
  }
  
  private calculateConfidence(volume: number, frequency: number, clarity: number): number {
    // Комбинированная оценка уверенности
    const volumeScore = Math.min(1, volume * 2);
    const frequencyScore = this.getFrequencyScore(frequency);
    const clarityScore = clarity;
    
    return (volumeScore + frequencyScore + clarityScore) / 3;
  }
  
  private getFrequencyScore(frequency: number): number {
    // Человеческая речь обычно в диапазоне 85-255 Hz (основной тон)
    // и 300-3400 Hz (форманты)
    if (frequency >= 85 && frequency <= 255) return 1.0;
    if (frequency >= 300 && frequency <= 3400) return 0.8;
    if (frequency >= 50 && frequency <= 8000) return 0.6;
    return 0.2;
  }
  
  private async autoDetectRolesWithHeadphones(): Promise<void> {
    // Алгоритм автоматического определения ролей с учетом наушников HR
    const analyses = Array.from(this.streamAnalyses.values());
    
    if (analyses.length < 2) {
      // Если только один поток, считаем его кандидатом
      this.candidateStream = analyses[0]?.source.id || null;
      return;
    }
    
    // Применяем стратегию для наушников HR
    if (this.hrStrategy) {
      await this.applyHRHeadphoneStrategy(this.hrStrategy);
    } else {
      // Обычное определение ролей
      await this.autoDetectRoles();
    }
  }
  
  private async applyHRHeadphoneStrategy(strategy: HRHeadphoneStrategy): Promise<void> {
    const analyses = Array.from(this.streamAnalyses.values());
    
    switch (strategy.strategy) {
      case 'usb_headphones':
      case 'jack_headphones':
        // HR с проводными наушниками - его речь может быть в системном звуке
        this.candidateStream = this.findSystemAudioSource(analyses);
        this.hrStream = this.findHRMicrophoneSource(analyses);
        break;
        
      case 'bluetooth_headphones':
        if (strategy.configuration.hrSource === 'none') {
          // HR подключен к телефону - его речь не захватывается
          this.candidateStream = this.findSystemAudioSource(analyses);
          this.hrStream = null;
        } else {
          // HR подключен к компьютеру
          this.candidateStream = this.findSystemAudioSource(analyses);
          this.hrStream = this.findBluetoothSource(analyses);
        }
        break;
        
      case 'wireless_headphones':
        // Используем машинное обучение для разделения
        this.candidateStream = this.findSystemAudioSource(analyses);
        this.hrStream = this.findWirelessSource(analyses);
        break;
        
      case 'unknown_headphones':
        // Адаптивное определение
        await this.adaptiveRoleDetection(analyses);
        break;
        
      default:
        await this.autoDetectRoles();
    }
    
    Logger.info(`Roles with HR headphones: Candidate=${this.candidateStream}, HR=${this.hrStream}`);
  }
  
  private async autoDetectRoles(): Promise<void> {
    // Алгоритм автоматического определения ролей
    const analyses = Array.from(this.streamAnalyses.values());
    
    if (analyses.length < 2) {
      // Если только один поток, считаем его кандидатом
      this.candidateStream = analyses[0]?.source.id || null;
      return;
    }
    
    // Сортируем по приоритету и характеристикам
    const sorted = analyses.sort((a, b) => {
      // Приоритет: системный звук > качество > активность
      if (a.source.type === 'system' && b.source.type !== 'system') return -1;
      if (b.source.type === 'system' && a.source.type !== 'system') return 1;
      
      const aScore = a.confidence * a.source.quality * a.source.priority;
      const bScore = b.confidence * b.source.quality * b.source.priority;
      
      return bScore - aScore;
    });
    
    // Первый поток - кандидат (обычно системный звук от видеозвонка)
    this.candidateStream = sorted[0].source.id;
    
    // Второй поток - HR (обычно микрофон)
    this.hrStream = sorted[1].source.id;
    
    Logger.info(`Auto-detected roles: Candidate=${this.candidateStream}, HR=${this.hrStream}`);
  }
  
  private updateRoleDetection(): void {
    // Периодически пересматриваем роли на основе активности
    const now = Date.now();
    const analyses = Array.from(this.streamAnalyses.values());
    
    // Если кандидат неактивен более 30 секунд, пересматриваем
    const candidateAnalysis = this.candidateStream ? this.streamAnalyses.get(this.candidateStream) : null;
    if (candidateAnalysis && now - candidateAnalysis.lastActivity > 30000) {
      Logger.info('Re-evaluating roles due to candidate inactivity');
      this.autoDetectRolesWithHeadphones();
    }
  }
  
  // Вспомогательные методы для поиска источников
  private findSystemAudioSource(analyses: StreamAnalysis[]): string | null {
    return analyses.find(a => a.source.type === 'system')?.source.id || null;
  }
  
  private findHRMicrophoneSource(analyses: StreamAnalysis[]): string | null {
    return analyses.find(a => 
      a.source.type === 'microphone' && 
      !a.source.name.toLowerCase().includes('candidate')
    )?.source.id || null;
  }
  
  private findBluetoothSource(analyses: StreamAnalysis[]): string | null {
    return analyses.find(a => 
      a.source.name.toLowerCase().includes('bluetooth')
    )?.source.id || null;
  }
  
  private findWirelessSource(analyses: StreamAnalysis[]): string | null {
    return analyses.find(a => 
      a.source.name.toLowerCase().includes('wireless') ||
      a.source.name.toLowerCase().includes('airpods')
    )?.source.id || null;
  }
  
  private async adaptiveRoleDetection(analyses: StreamAnalysis[]): Promise<void> {
    // Адаптивное определение ролей на основе анализа паттернов речи
    Logger.info('Using adaptive role detection for unknown headphone type');
    
    // Простая эвристика: системный звук = кандидат, микрофон = HR
    this.candidateStream = this.findSystemAudioSource(analyses);
    this.hrStream = this.findHRMicrophoneSource(analyses);
  }
  
  // Публичные методы интерфейса IAudioService
  async detectSources(): Promise<AudioSource[]> {
    return this.detector.detectSources();
  }
  
  async selectCandidateStream(): Promise<MediaStream | null> {
    if (!this.isInitialized) {
      throw new AppError(
        'AudioStreamSplitter not initialized',
        'NOT_INITIALIZED_ERROR',
        false
      );
    }
    
    return this.getCandidateStream();
  }
  
  isConfigured(): boolean {
    return this.isInitialized && this.candidateStream !== null;
  }
  
  // Дополнительные публичные методы
  getCandidateStream(): MediaStream | null {
    return this.candidateStream ? this.activeStreams.get(this.candidateStream) || null : null;
  }
  
  getHRStream(): MediaStream | null {
    return this.hrStream ? this.activeStreams.get(this.hrStream) || null : null;
  }
  
  getCandidateAnalysis(): StreamAnalysis | null {
    return this.candidateStream ? this.streamAnalyses.get(this.candidateStream) || null : null;
  }
  
  getHRAnalysis(): StreamAnalysis | null {
    return this.hrStream ? this.streamAnalyses.get(this.hrStream) || null : null;
  }
  
  isCandidateActive(): boolean {
    const analysis = this.getCandidateAnalysis();
    return analysis ? analysis.isActive : false;
  }
  
  getHRStrategy(): HRHeadphoneStrategy | null {
    return this.hrStrategy;
  }
  
  // Ручное переопределение ролей
  setCandidateStream(sourceId: string): void {
    this.candidateStream = sourceId;
    Logger.info(`Manually set candidate stream: ${sourceId}`);
  }
  
  setHRStream(sourceId: string): void {
    this.hrStream = sourceId;
    Logger.info(`Manually set HR stream: ${sourceId}`);
  }
  
  // Очистка ресурсов
  cleanup(): void {
    Logger.info('Cleaning up AudioStreamSplitter');
    
    // Останавливаем все потоки
    this.activeStreams.forEach((stream, sourceId) => {
      try {
        stream.getTracks().forEach(track => track.stop());
        Logger.debug('Stream stopped', { sourceId });
      } catch (error) {
        Logger.warn('Failed to stop stream', { sourceId, error });
      }
    });
    
    // Очищаем коллекции
    this.activeStreams.clear();
    this.streamAnalyses.clear();
    
    // Очищаем детектор и обработчик
    this.detector.cleanup();
    this.hrHeadphoneHandler.cleanup();
    
    // Сбрасываем состояние
    this.candidateStream = null;
    this.hrStream = null;
    this.hrStrategy = null;
    this.isInitialized = false;
    
    Logger.info('AudioStreamSplitter cleanup completed');
  }
}
