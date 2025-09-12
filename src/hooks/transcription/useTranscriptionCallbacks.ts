import { useCallback } from 'react';
import { TranscriptEvent } from '../../services/deepgram';
import { ITranscriptionService } from '../../types/ITranscriptionService';
import { ClaudeAnalysisService, AnalysisContext, InsightResponse } from '../../services/claude';
import { LegacyInsight } from '../../types/events';

/**
 * Callback functions for transcription hook
 * 
 * @example
 * ```tsx
 * const callbacks = useTranscriptionCallbacks({
 *   setTranscript,
 *   setPartialTranscript,
 *   setInsights,
 *   deepgramRef,
 *   claudeRef,
 *   analysisContextRef
 * });
 * ```
 */
interface UseTranscriptionCallbacksProps {
  setTranscript: (transcript: string | ((prev: string) => string)) => void;
  setPartialTranscript: (partialTranscript: string | ((prev: string) => string)) => void;
  setInsights: (insights: LegacyInsight[] | ((prev: LegacyInsight[]) => LegacyInsight[])) => void;
  deepgramRef: React.MutableRefObject<ITranscriptionService | null>;
  claudeRef: React.MutableRefObject<ClaudeAnalysisService | null>;
  analysisContextRef: React.MutableRefObject<AnalysisContext | null>;
}

export const useTranscriptionCallbacks = ({
  setTranscript,
  setPartialTranscript,
  setInsights,
  deepgramRef,
  claudeRef,
  analysisContextRef
}: UseTranscriptionCallbacksProps) => {
  
  /**
   * Analyze transcript with Claude AI
   */
  const analyzeWithClaude = useCallback(async (newText: string): Promise<void> => {
    if (!claudeRef.current || !analysisContextRef.current) return;
    
    console.log('🤖 [CLAUDE] Analyzing text:', {
      text: newText.substring(0, 50) + '...',
      length: newText.length
    });
    
    try {
      // Добавляем текст в контекст
      analysisContextRef.current.addTranscript(newText);
      const context = analysisContextRef.current.getContext();
      
      const analysisRequest = {
        transcript: newText,
        contextWindow: context.contextWindow,
        entities: context.entities,
        topicHistory: context.topicHistory
      };
      
      // Получаем анализ от Claude
      const analysis: InsightResponse = await claudeRef.current.analyzeTranscript(analysisRequest);
      
      // Добавляем топик в историю
      analysisContextRef.current.addTopic(analysis.topic);
      
      // Конвертируем в legacy формат для UI
      const legacyInsight: LegacyInsight = {
        id: Date.now().toString(),
        text: analysis.note,
        type: analysis.type  // 'strength' | 'risk' | 'question'
      };
      
      // Обновляем UI (показываем последние 3 insights)
      setInsights((prev: LegacyInsight[]) => [...prev.slice(-2), legacyInsight]);
      
      console.log('✅ [CLAUDE] Analysis complete:', {
        topic: analysis.topic,
        type: analysis.type,
        confidence: analysis.confidence
      });
      
    } catch (error) {
      console.error('❌ [CLAUDE] Analysis failed:', error);
    }
  }, [claudeRef, analysisContextRef, setInsights]);

  /**
   * Handle transcript events from Deepgram
   */
  const handleTranscriptEvent = useCallback(async (event: TranscriptEvent) => {
    console.log('📝 [TRANSCRIPT] Received Deepgram event:', {
      type: event.type,
      text: event.text?.substring(0, 50) + '...',
      confidence: event.confidence,
      timestamp: new Date().toLocaleTimeString()
    });
    
    if (event.type === 'partial') {
      const newPartial = event.text;
      setPartialTranscript(newPartial);
      console.log('🔄 [PARTIAL] Deepgram partial:', newPartial);
    } else if (event.type === 'final') {
      // Обновляем отображаемый транскрипт
      setTranscript((prev: string) => (prev + ' ' + event.text).trim());
      setPartialTranscript('');
      
      console.log('✅ [FINAL] Deepgram final result:', {
        text: event.text,
        confidence: event.confidence,
        length: event.text.length,
        wordCount: event.text.split(' ').length
      });
      
      // Анализируем с помощью Claude если доступен
      if (event.text.length > 10) {
        await analyzeWithClaude(event.text);
      }
    }
  }, [setTranscript, setPartialTranscript, analyzeWithClaude]);

  // Placeholder methods for native hooks
  const onTranscriptUpdate = useCallback((callback: (data: any) => void) => {
    // Placeholder implementation
  }, []);

  const onInsightUpdate = useCallback((callback: (data: any) => void) => {
    // Placeholder implementation
  }, []);

  return {
    analyzeWithClaude,
    handleTranscriptEvent,
    onTranscriptUpdate,
    onInsightUpdate
  };
};
