import { useCallback } from 'react';
import { useTranscriptionCore } from './useTranscriptionCore';
import { useTranscriptionState } from './useTranscriptionState';
import { useTranscriptionCallbacks } from './useTranscriptionCallbacks';
import { useTranscriptionRecordingElectron } from './useTranscriptionRecordingElectron';
import { useTranscriptionServices } from './useTranscriptionServices';
import { Logger } from '../../utils/logger';
import { AppError, ErrorHandler } from '../../utils/errors';

/**
 * Main transcription hook using OFFICIAL Electron desktopCapturer API
 * Based on Electron official documentation
 * 
 * @example
 * ```tsx
 * const transcription = useTranscriptionElectron();
 * 
 * // Start recording
 * await transcription.startRecording();
 * 
 * // Stop recording  
 * await transcription.stopRecording();
 * ```
 */
export function useTranscriptionElectron() {
  // Core transcription state and logic
  const {
    transcript,
    partialTranscript,
    insights,
    isRecording,
    setTranscript,
    setPartialTranscript,
    setInsights,
    setIsRecording,
    clearTranscript,
    clearInsights,
    clearError,
    isConnected,
    error
  } = useTranscriptionState();

  // Services (Deepgram, Claude, etc.)
  const services = useTranscriptionServices();

  // Transcription callbacks
  const { onTranscriptUpdate, onInsightUpdate } = useTranscriptionCallbacks({
    setTranscript,
    setPartialTranscript,
    setInsights,
    deepgramRef: services.deepgramRef,
    claudeRef: services.claudeRef,
    analysisContextRef: services.analysisContextRef
  });

  // Core transcription logic
  const transcriptionCore = useTranscriptionCore({
    transcript,
    partialTranscript,
    insights,
    isRecording,
    deepgramRef: services.deepgramRef,
    claudeRef: services.claudeRef,
    cleanupRef: recording.cleanupRef,
    handleTranscriptEvent: services.handleTranscriptEvent,
    transcriptRef: services.transcriptRef,
    insightsRef: services.insightsRef,
    setTranscript,
    setPartialTranscript,
    setInsights,
    setIsRecording,
    onTranscriptUpdate,
    onInsightUpdate
  });

  // Recording functionality using OFFICIAL Electron API
  const recording = useTranscriptionRecordingElectron({
    deepgramRef: services.deepgramRef,
    setIsRecording,
    initAudioAnalyser: services.initAudioAnalyser,
    stopAudioAnalyser: services.stopAudioAnalyser,
    connectToDeepgram: transcriptionCore.connectToDeepgram
  });

  /**
   * Start recording with OFFICIAL Electron audio capture
   */
  const startRecording = useCallback(async (): Promise<void> => {
    try {
      Logger.info('Starting Electron audio recording');
      
      // Start recording using OFFICIAL Electron desktopCapturer
      await recording.startRecording();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error('Failed to start Electron recording', { error: errorMessage });
      
      // Log error (no ErrorHandler.handleError method exists)
      Logger.error('Failed to start recording', { 
        error: errorMessage,
        code: 'RECORDING_START_ERROR'
      });
      
      throw error;
    }
  }, [recording]);

  /**
   * Stop recording
   */
  const stopRecording = useCallback(async (): Promise<void> => {
    try {
      Logger.info('Stopping Electron audio recording');
      await recording.stopRecording();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error('Failed to stop recording', { error: errorMessage });
      
      // Log error (no ErrorHandler.handleError method exists)
      Logger.error('Failed to stop recording', { 
        error: errorMessage,
        code: 'RECORDING_STOP_ERROR'
      });
    }
  }, [recording]);

  return {
    // State
    transcript,
    partialTranscript,
    insights,
    isRecording,
    isConnected,
    error,

    // Actions
    startRecording,
    stopRecording,
    clearTranscript,
    clearInsights,
    clearError,

    // Core functionality
    ...transcriptionCore,

    // Recording status
    isInitialized: recording.isInitialized,
    initializationError: recording.initializationError
  };
}
