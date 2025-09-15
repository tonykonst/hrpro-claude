import { useCallback, useRef, useEffect } from 'react';
import { ITranscriptionService } from '../../types/ITranscriptionService';
import { ClaudeAnalysisService, AnalysisContext, createClaudeService } from '../../services/claude';
import { TranscriptionServiceFactory } from '../../services/transcription/TranscriptionServiceFactory';
import { configService } from '../../services/config';
import { PostEditorConfig, CorrectionContext } from '../../services/post-editor';
import { TranscriptEvent } from '../../services/deepgram';
import { MemoryManager } from '../../utils/memory-manager';
import { Logger } from '../../utils/logger';

/**
 * Core transcription functionality
 * 
 * @example
 * ```tsx
 * const core = useTranscriptionCore({
 *   deepgramRef,
 *   claudeRef,
 *   analysisContextRef,
 *   cleanupRef,
 *   handleTranscriptEvent
 * });
 * ```
 */
interface UseTranscriptionCoreProps {
  deepgramRef: React.MutableRefObject<ITranscriptionService | null>;
  claudeRef: React.MutableRefObject<ClaudeAnalysisService | null>;
  analysisContextRef: React.MutableRefObject<AnalysisContext | null>;
  cleanupRef: React.MutableRefObject<(() => void) | null>;
  handleTranscriptEvent: (event: TranscriptEvent) => Promise<void>;
  transcriptRef: React.MutableRefObject<string[]>;
  insightsRef: React.MutableRefObject<any[]>;
}

export const useTranscriptionCore = ({
  deepgramRef,
  claudeRef,
  analysisContextRef,
  cleanupRef,
  handleTranscriptEvent,
  transcriptRef,
  insightsRef
}: UseTranscriptionCoreProps) => {
  const memoryCleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Clean up memory periodically
   */
  const performMemoryCleanup = useCallback(() => {
    if (transcriptRef.current && insightsRef.current) {
      const result = MemoryManager.cleanupOldData(transcriptRef.current, insightsRef.current);
      
      if (result.removedCount.transcript > 0 || result.removedCount.insights > 0) {
        transcriptRef.current = result.cleanedTranscript;
        insightsRef.current = result.cleanedInsights;
        
        Logger.info('Memory cleanup performed', {
          removedTranscript: result.removedCount.transcript,
          removedInsights: result.removedCount.insights,
          currentTranscriptLength: transcriptRef.current.length,
          currentInsightsLength: insightsRef.current.length
        });
      }
    }
  }, [transcriptRef, insightsRef]);

  /**
   * Start periodic memory cleanup
   */
  const startMemoryCleanup = useCallback(() => {
    if (memoryCleanupIntervalRef.current) {
      clearInterval(memoryCleanupIntervalRef.current);
    }
    
    // Clean up every 30 seconds
    memoryCleanupIntervalRef.current = setInterval(performMemoryCleanup, 30000);
    Logger.info('Memory cleanup started (30s interval)');
  }, [performMemoryCleanup]);

  /**
   * Stop periodic memory cleanup
   */
  const stopMemoryCleanup = useCallback(() => {
    if (memoryCleanupIntervalRef.current) {
      clearInterval(memoryCleanupIntervalRef.current);
      memoryCleanupIntervalRef.current = null;
      Logger.info('Memory cleanup stopped');
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMemoryCleanup();
    };
  }, [stopMemoryCleanup]);

  /**
   * Connect to Deepgram service
   */
  const connectToDeepgram = useCallback(async (): Promise<() => void> => {
    Logger.info('Starting Deepgram connection...');
    
    // Загружаем конфигурацию с переменными окружения из electronAPI
    await configService.getConfigWithEnv();
    
    // Логируем конфигурацию в dev режиме
    if (configService.isDevelopment) {
      Logger.debug('Development mode - logging config...');
      configService.logConfig();
    }
    
    // Проверяем доступность Deepgram
    if (!configService.isDeepgramConfigured()) {
      throw new Error('DEEPGRAM API key not configured! Please add DEEPGRAM_API_KEY to .env file');
    }
    
    Logger.info('API key configured, proceeding with real connection...');

    // Инициализируем Claude сервис если доступен
    if (configService.isClaudeConfigured()) {
      try {
        const claudeConfig = configService.getClaudeConfig();
        claudeRef.current = createClaudeService(claudeConfig);
        analysisContextRef.current = new AnalysisContext();
        Logger.info('Claude service initialized', {
          model: claudeConfig.model,
          maxTokens: claudeConfig.maxTokens,
          temperature: claudeConfig.temperature
        });
      } catch (error) {
        Logger.warn('Claude service failed to initialize', { error: error instanceof Error ? error.message : String(error) });
      }
    } else {
      Logger.warn('Claude API key not configured, insights will be limited...');
    }

    try {
      Logger.info('Connecting to real Deepgram...');
      
      const deepgramConfig = configService.getDeepgramConfig();
      Logger.debug('Using config', {
        model: deepgramConfig.model,
        language: deepgramConfig.language,
        interim_results: deepgramConfig.interim_results,
        endpointing: deepgramConfig.endpointing
      });
      
      // Подготавливаем конфигурацию постредактора
      let postEditorConfig: PostEditorConfig | undefined;
      let correctionContext: CorrectionContext | undefined;
      
      if (configService.isPostEditorConfigured()) {
        postEditorConfig = configService.getPostEditorConfig();
        correctionContext = {
          jobTerms: [],
          synonymDictionary: {}
        };
        Logger.info('Post-editor enabled', {
          model: postEditorConfig.model,
          timeout: postEditorConfig.timeoutMs
        });
      } else {
        Logger.info('Post-editor not configured, skipping...');
      }
      
      // Создаем транскрипционный сервис через фабрику
      const deepgram = TranscriptionServiceFactory.create({
        provider: 'deepgram',
        apiKey: deepgramConfig.apiKey,
        onTranscript: handleTranscriptEvent,
        onError: (error: string) => {
          Logger.error('Deepgram error', { error });
        }
      });
      
      // Сохраняем ссылку на сервис
      deepgramRef.current = deepgram;
      
      // Подключаемся к Deepgram
      await deepgram.connect();
      
      Logger.info('Connected successfully!');
      
      // Запускаем очистку памяти
      startMemoryCleanup();
      
      // Возвращаем функцию очистки
      const cleanup = () => {
        Logger.info('Cleaning up connection...');
        stopMemoryCleanup();
        if (deepgramRef.current) {
          deepgramRef.current.disconnect();
          deepgramRef.current = null;
        }
        if (claudeRef.current) {
          claudeRef.current = null;
        }
        if (analysisContextRef.current) {
          analysisContextRef.current = null;
        }
      };
      
      cleanupRef.current = cleanup;
      return cleanup;
      
    } catch (error) {
      Logger.error('Connection failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }, [deepgramRef, claudeRef, analysisContextRef, cleanupRef, handleTranscriptEvent, startMemoryCleanup, stopMemoryCleanup]);

  return {
    connectToDeepgram
  };
};
