import { useState, useCallback, useRef } from 'react';
import { LegacyInsight } from '../../types/events';

/**
 * State management for transcription hook
 * 
 * @example
 * ```tsx
 * const transcriptionState = useTranscriptionState();
 * ```
 */
export const useTranscriptionState = () => {
  // Состояния транскрипции
  const [transcript, setTranscriptState] = useState<string>('');
  const [partialTranscript, setPartialTranscriptState] = useState<string>('');
  const [insights, setInsightsState] = useState<LegacyInsight[]>([]);
  const [isRecording, setIsRecordingState] = useState<boolean>(false);
  
  // Refs для MemoryManager
  const transcriptRef = useRef<string[]>([]);
  const insightsRef = useRef<LegacyInsight[]>([]);

  // Обертки для сеттеров с поддержкой функций
  const setTranscript = useCallback((value: string | ((prev: string) => string)) => {
    if (typeof value === 'function') {
      setTranscriptState(value);
    } else {
      setTranscriptState(value);
      // Обновляем ref для MemoryManager
      transcriptRef.current = value.split(' ');
    }
  }, []);

  const setPartialTranscript = useCallback((value: string | ((prev: string) => string)) => {
    if (typeof value === 'function') {
      setPartialTranscriptState(value);
    } else {
      setPartialTranscriptState(value);
    }
  }, []);

  const setInsights = useCallback((value: LegacyInsight[] | ((prev: LegacyInsight[]) => LegacyInsight[])) => {
    if (typeof value === 'function') {
      setInsightsState(value);
    } else {
      setInsightsState(value);
      // Обновляем ref для MemoryManager
      insightsRef.current = value;
    }
  }, []);

  const setIsRecording = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    if (typeof value === 'function') {
      setIsRecordingState(value);
    } else {
      setIsRecordingState(value);
    }
  }, []);

  // Дополнительные методы для native hooks
  const clearTranscript = useCallback(() => {
    setTranscript('');
  }, [setTranscript]);

  const clearInsights = useCallback(() => {
    setInsights([]);
  }, [setInsights]);

  const clearError = useCallback(() => {
    // Placeholder for error clearing
  }, []);

  return {
    // Состояния
    transcript,
    partialTranscript,
    insights,
    isRecording,
    isConnected: false, // Placeholder
    error: null, // Placeholder
    
    // Сеттеры
    setTranscript,
    setPartialTranscript,
    setInsights,
    setIsRecording,
    
    // Методы очистки
    clearTranscript,
    clearInsights,
    clearError,
    
    // Refs для MemoryManager
    transcriptRef,
    insightsRef
  };
};
