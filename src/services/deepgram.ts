// Deepgram Streaming Service with LLM Post-Editor
// Заменяет mock Deepgram на реальный WebSocket API с исправлением текста

import {
  PostEditorService,
  PostEditorConfig,
  CorrectionContext,
  createPostEditorService,
} from './post-editor';
import { AdaptiveASRManager } from './adaptive-asr';
import { getTranscriptLogger } from './transcript-logger';
import { Logger } from '../utils/logger';
import { AppError, ErrorHandler } from '../utils/errors';
import { PerformanceMonitor } from '../utils/performance-monitor';

export interface DeepgramConfig {
  apiKey: string;
  model: string;
  language: string;
  punctuation: boolean;
  interim_results: boolean;
  smart_format: boolean;
  endpointing: number;
  vad_events: boolean;
  no_delay: boolean;
  interim_results_period: number;
  keywords: string;
}

export interface TranscriptEvent {
  type: 'partial' | 'final' | 'corrected';
  text: string;
  confidence: number;
  timestamp: number;
  segment_id?: string;
  original_text?: string;
}

export class DeepgramService {
  private ws: WebSocket | null = null;
  private config: DeepgramConfig;
  private onTranscript: (event: TranscriptEvent) => void;
  private onError: (error: string) => void;
  private postEditor: PostEditorService | null = null;
  private segmentCounter: number = 0;
  private adaptiveASR: AdaptiveASRManager;
  private sessionStartTime: number = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastActivityTime: number = 0;

  constructor(
    config: DeepgramConfig,
    onTranscript: (event: TranscriptEvent) => void,
    onError: (error: string) => void,
    postEditorConfig?: PostEditorConfig,
    correctionContext?: CorrectionContext
  ) {
    this.config = config;
    this.onTranscript = onTranscript;
    this.onError = onError;
    this.sessionStartTime = Date.now();

    // Initialize adaptive ASR system
    this.adaptiveASR = new AdaptiveASRManager();

    // Initialize post-editor if config provided
    if (postEditorConfig) {
      this.postEditor = createPostEditorService(
        postEditorConfig,
        correctionContext
      );
      Logger.info('Post-editor initialized', {
        model: postEditorConfig.model,
        maxRPS: postEditorConfig.maxRequestsPerSecond,
        timeout: postEditorConfig.timeoutMs,
      });
    }

    Logger.info('Adaptive ASR initialized', {
      model: config.model,
      language: config.language,
      optimizations: 'enabled',
    });
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Deepgram WebSocket URL с официальным автоопределением языка
        const params = new URLSearchParams({
          model: this.config.model,
          punctuation: this.config.punctuation.toString(),
          interim_results: this.config.interim_results.toString(),
          smart_format: this.config.smart_format.toString(),
          encoding: 'linear16',
          sample_rate: '16000',
          channels: '1',
        });

        // Официальное автоопределение языка Deepgram
        if (this.config.language && this.config.language.trim() !== '') {
          // Если указан конкретный язык - используем его
          params.append('language', this.config.language);
        } else {
          // Если язык не указан - включаем автоопределение
          params.append('detect_language', 'true');
        }

        // Добавляем keywords только если они не пустые
        if (this.config.keywords && this.config.keywords.trim() !== '') {
          params.append('keywords', this.config.keywords);
        }

        // Добавляем дополнительные параметры только если они поддерживаются
        if (this.config.endpointing) {
          params.append('endpointing', this.config.endpointing.toString());
        }
        if (this.config.vad_events) {
          params.append('vad_events', this.config.vad_events.toString());
        }
        if (this.config.no_delay) {
          params.append('no_delay', this.config.no_delay.toString());
        }
        if (this.config.interim_results_period) {
          params.append(
            'interim_results_period',
            this.config.interim_results_period.toString()
          );
        }

        const wsUrl = `wss://api.deepgram.com/v1/listen?${params}`;

        Logger.debug('Final config', {
          model: this.config.model,
          language: this.config.language || 'auto',
          endpointing: this.config.endpointing,
          vad_events: this.config.vad_events,
          no_delay: this.config.no_delay,
          interim_results_period: this.config.interim_results_period,
        });
        Logger.debug('WebSocket URL', { url: wsUrl });
        Logger.info('API Key configured');

        this.ws = new WebSocket(wsUrl, ['token', this.config.apiKey]);

        this.ws.onopen = () => {
          Logger.info('WebSocket connected successfully');
          this.lastActivityTime = Date.now();

          // Запускаем heartbeat для стабильности соединения
          this.startHeartbeat();

          resolve();
        };

        this.ws.onerror = error => {
          console.error('❌ [DEEPGRAM] WebSocket error:', error);
          reject(new Error(`WebSocket connection error: ${error}`));
        };

        this.ws.onclose = event => {
          console.warn('⚠️ [DEEPGRAM] WebSocket closed:', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          });

          // Если соединение закрылось неожиданно, логируем для анализа
          if (!event.wasClean) {
            console.error('🚨 [DEEPGRAM] Unexpected WebSocket closure:', {
              code: event.code,
              reason: event.reason,
              timestamp: new Date().toISOString(),
            });
          }
        };

        this.ws.onmessage = async event => {
          try {
            // Проверяем, что соединение еще активно
            if (this.ws?.readyState !== WebSocket.OPEN) {
              console.warn(
                '⚠️ [DEEPGRAM] Received message on closed connection, ignoring'
              );
              return;
            }

            Logger.debug('Message received', { data: event.data });
            const data = JSON.parse(event.data);

            // Обновляем время последней активности для heartbeat
            this.lastActivityTime = Date.now();

            if (
              data.channel?.alternatives?.[0]?.transcript &&
              data.channel.alternatives[0].transcript.trim()
            ) {
              const transcript = data.channel.alternatives[0].transcript.trim();
              const confidence = data.channel.alternatives[0].confidence || 0;
              const is_final = data.is_final || false;
              const latency = Date.now() - this.sessionStartTime;

              // Получаем официальные данные о языке от Deepgram
              const detectedLanguage = data.channel?.detected_language;
              const languageConfidence = data.channel?.language_confidence;

              Logger.debug('Deepgram language detection', {
                detectedLanguage,
                languageConfidence,
                transcript: transcript.substring(0, 50) + (transcript.length > 50 ? '...' : ''),
                confidence,
                is_final
              });

              // Адаптивный анализ транскрипта (теперь с официальными данными о языке)
              const analysis = this.adaptiveASR.analyzeTranscript(
                transcript,
                confidence,
                latency,
                detectedLanguage,
                languageConfidence
              );

              Logger.debug('Adaptive ASR analysis', {
                transcript:
                  transcript.substring(0, 50) +
                  (transcript.length > 50 ? '...' : ''),
                confidence,
                is_final,
                language: analysis.languageStats.language,
                shouldOptimize: analysis.shouldOptimize,
                recommendations: analysis.recommendations,
              });

              // Логируем информацию о языке от Deepgram
              if (detectedLanguage) {
                Logger.info('Deepgram detected language', {
                  detectedLanguage,
                  languageConfidence,
                  transcript: transcript.substring(0, 30) + '...',
                  is_final
                });
              }

              const segmentId = `segment_${++this.segmentCounter}_${Date.now()}`;

              const transcriptEvent = {
                type: is_final ? 'final' : 'partial',
                text: transcript,
                confidence,
                timestamp: Date.now(),
                segment_id: segmentId,
              } as const;

              // Логируем в файл (только если transcript не пустой)
              if (transcript && transcript.trim()) {
                getTranscriptLogger().logTranscript({
                  timestamp: transcriptEvent.timestamp,
                  type: transcriptEvent.type,
                  text: transcript,
                  confidence,
                  segment_id: segmentId,
                  language: analysis.languageStats.language,
                });
              }

              // Отправляем оригинальный транскрипт
              const transcriptMeasurement = PerformanceMonitor.startLatencyMeasurement();
              this.onTranscript(transcriptEvent);
              PerformanceMonitor.endLatencyMeasurement(transcriptMeasurement, 'transcription');
              PerformanceMonitor.recordSuccess();

              // Проверяем нужность коррекции ТОЛЬКО для финальных сегментов
              // или критически плохих partial сегментов (улучшено для быстрой речи)
              if (this.postEditor && transcript.trim().length > 0) {
                const shouldCheckPartial =
                  !is_final && confidence < 0.4 && transcript.length > 80; // Более строгие критерии
                const shouldCheckFinal = is_final && confidence < 0.8; // Не все финальные, только подозрительные

                if (shouldCheckFinal || shouldCheckPartial) {
                  try {
                    const analysis = this.postEditor.analyzeSegment(
                      transcript,
                      confidence
                    );

                    if (analysis.needsCorrection) {
                      console.log('🔧 Triggering post-editing:', {
                        segment_id: segmentId,
                        reasons: analysis.reasons,
                        confidence: confidence,
                        is_final: is_final,
                      });

                      // Отправляем на коррекцию в фоне
                      this.correctSegmentAsync(
                        transcript,
                        analysis,
                        segmentId,
                        confidence
                      );
                    }
                  } catch (error) {
                    console.warn('⚠️ Post-editor analysis failed:', error);
                  }
                }
              }
            } else if (data.type === 'Results') {
              Logger.debug('Deepgram Results event', { data });
            } else {
              Logger.debug('Deepgram other event', { data });
            }
          } catch (error) {
            const appError = new AppError(
              'Failed to parse Deepgram response',
              'DEEPGRAM_PARSE_ERROR',
              false,
              { 
                originalError: error instanceof Error ? error.message : String(error),
                rawData: event.data 
              }
            );
            Logger.error('Error parsing Deepgram response', { 
              error: appError.message,
              code: appError.code,
              context: appError.context
            });
            this.onError(appError.message);
          }
        };

        this.ws.onerror = error => {
          const appError = new AppError(
            'WebSocket connection error',
            'DEEPGRAM_WEBSOCKET_ERROR',
            true, // Retriable
            { 
              originalError: error instanceof Error ? error.message : String(error),
              wsUrl: wsUrl,
              apiKeyConfigured: !!this.config.apiKey
            }
          );
          Logger.error('Deepgram WebSocket error', { 
            error: appError.message,
            code: appError.code,
            context: appError.context
          });
          this.onError(appError.message);
          reject(appError);
        };

        this.ws.onclose = () => {
          Logger.info('Deepgram WebSocket closed');
        };
      } catch (error) {
        const appError = new AppError(
          'Failed to initialize Deepgram connection',
          'DEEPGRAM_INIT_ERROR',
          true, // Retriable
          { 
            originalError: error instanceof Error ? error.message : String(error),
            config: {
              model: this.config.model,
              language: this.config.language,
              hasApiKey: !!this.config.apiKey
            }
          }
        );
        Logger.error('Failed to initialize Deepgram connection', { 
          error: appError.message,
          code: appError.code,
          context: appError.context
        });
        reject(appError);
      }
    });
  }

  sendAudio(audioData: ArrayBuffer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const measurement = PerformanceMonitor.startLatencyMeasurement();
      this.ws.send(audioData);
      PerformanceMonitor.endLatencyMeasurement(measurement, 'audio');
      PerformanceMonitor.recordSuccess();
    } else {
      PerformanceMonitor.recordError();
      Logger.warn('Attempted to send audio to closed WebSocket');
    }
  }

  // Применение адаптивных оптимизаций (упрощено - Deepgram сам управляет языком)
  private applyOptimizations(recommendations: any): void {
    try {
      if (recommendations.adaptiveParams) {
        Logger.debug('🎯 Adaptive parameters:', recommendations.adaptiveParams);
        // Используем адаптивные параметры для постредактора
        if (
          this.postEditor &&
          recommendations.adaptiveParams.confidence_threshold
        ) {
          // Обновляем порог уверенности для постредактора
          // (можно добавить метод updateThreshold в PostEditorService)
        }
      }
    } catch (error) {
      Logger.warn('⚠️ Failed to apply optimizations:', error);
    }
  }

  // Асинхронная коррекция сегмента
  private async correctSegmentAsync(
    originalText: string,
    analysis: any,
    segmentId: string,
    originalConfidence: number
  ): Promise<void> {
    if (!this.postEditor) return;

    try {
      const correction = await this.postEditor.correctText(
        originalText,
        analysis
      );

      if (correction.wasChanged) {
        console.log('✅ Text corrected:', {
          segment_id: segmentId,
          original:
            originalText.substring(0, 50) +
            (originalText.length > 50 ? '...' : ''),
          corrected:
            correction.correctedText.substring(0, 50) +
            (correction.correctedText.length > 50 ? '...' : ''),
          processing_time: correction.processingTimeMs + 'ms',
        });

        const correctedEvent = {
          type: 'corrected',
          text: correction.correctedText,
          confidence: correction.confidence,
          timestamp: Date.now(),
          segment_id: segmentId,
          original_text: originalText,
        } as const;

        // Логируем исправление в файл
        getTranscriptLogger().logTranscript({
          timestamp: correctedEvent.timestamp,
          type: 'corrected',
          text: correction.correctedText,
          confidence: correction.confidence,
          segment_id: segmentId,
          original_text: originalText,
        });

        // Отправляем исправленный вариант как отдельное событие
        this.onTranscript(correctedEvent);
      } else {
        console.log('ℹ️ No correction needed:', {
          segment_id: segmentId,
          processing_time: correction.processingTimeMs + 'ms',
        });
      }
    } catch (error) {
      console.warn('⚠️ Segment correction failed:', {
        segment_id: segmentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private startHeartbeat(): void {
    // Очищаем предыдущий интервал если есть
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Heartbeat каждые 30 секунд для поддержания соединения
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const now = Date.now();
        const timeSinceLastActivity = now - this.lastActivityTime;

        // Если прошло больше 2 минут без активности, отправляем ping
        if (timeSinceLastActivity > 120000) {
          console.log('💓 [DEEPGRAM] Sending heartbeat ping...');
          try {
            this.ws.send(JSON.stringify({ type: 'ping', timestamp: now }));
          } catch (error) {
            console.warn('⚠️ [DEEPGRAM] Heartbeat ping failed:', error);
          }
        }
      }
    }, 30000);

    console.log('💓 [DEEPGRAM] Heartbeat started (30s interval)');
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('💓 [DEEPGRAM] Heartbeat stopped');
    }
  }

  disconnect(): void {
    // Останавливаем heartbeat
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
      console.log('✅ [DEEPGRAM] WebSocket disconnected');
    }

    // Завершаем сессию логирования
    try {
      getTranscriptLogger().endSession();
      console.log('📊 Transcript session completed and saved');
    } catch (error) {
      console.warn('⚠️ Failed to end transcript session:', error);
    }
  }

}

// Factory with configurable parameters
export const createDeepgramService = (
  apiKey: string,
  onTranscript: (event: TranscriptEvent) => void,
  onError: (error: string) => void,
  configOverrides?: Partial<DeepgramConfig>,
  postEditorConfig?: PostEditorConfig,
  correctionContext?: CorrectionContext
): DeepgramService => {
  // БЕЗ дефолтных значений - только то, что передается из config.ts
  const config: DeepgramConfig = {
    apiKey,
    model: configOverrides?.model || 'nova-2-meeting',
    language: configOverrides?.language || '',
    punctuation: configOverrides?.punctuation ?? true,
    interim_results: configOverrides?.interim_results ?? true,
    smart_format: configOverrides?.smart_format ?? true,
    endpointing: configOverrides?.endpointing ?? 800,
    vad_events: configOverrides?.vad_events ?? true,
    no_delay: configOverrides?.no_delay ?? true,
    interim_results_period: configOverrides?.interim_results_period ?? 100,
    keywords: configOverrides?.keywords || '',
  };

  console.log('🔧 [DEEPGRAM FACTORY] Final config:', {
    model: config.model,
    language: config.language || 'auto',
    punctuation: config.punctuation,
    interim_results: config.interim_results,
    smart_format: config.smart_format,
    endpointing: config.endpointing,
    vad_events: config.vad_events,
    no_delay: config.no_delay,
    interim_results_period: config.interim_results_period,
    keywords: config.keywords ? 'configured' : 'not set',
  });
  return new DeepgramService(
    config,
    onTranscript,
    onError,
    postEditorConfig,
    correctionContext
  );
};
