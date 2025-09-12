import { useTranscriptionState } from './useTranscriptionState';
import { useTranscriptionServices } from './useTranscriptionServices';
import { useTranscriptionCallbacks } from './useTranscriptionCallbacks';
import { useTranscriptionCore } from './useTranscriptionCore';
import { useTranscriptionRecordingNative } from './useTranscriptionRecordingNative';
import { useAudioAnalyser } from '../useAudioAnalyser';
import { LegacyInsight } from '../../types/events';
import { configService } from '../../services/config';

/**
 * Native transcription hook (v0.54) that uses native audio capture
 * instead of web APIs for system audio capture
 * 
 * @example
 * ```tsx
 * const transcription = useTranscriptionNative();
 * 
 * // Start recording with native audio
 * await transcription.startRecording();
 * 
 * // Stop recording
 * transcription.stopRecording();
 * 
 * // Access transcript
 * console.log(transcription.transcript);
 * ```
 * 
 * @returns {UseTranscriptionReturn} Transcription state and methods
 */
export const useTranscriptionNative = () => {
  // State management
  const state = useTranscriptionState();
  
  // Service references
  const services = useTranscriptionServices();
  
  // Audio analyser
  const { audioLevel, initAudioAnalyser, stopAudioAnalyser } = useAudioAnalyser();
  
  // Callbacks
  const callbacks = useTranscriptionCallbacks({
    setTranscript: state.setTranscript,
    setPartialTranscript: state.setPartialTranscript,
    setInsights: state.setInsights,
    deepgramRef: services.deepgramRef,
    claudeRef: services.claudeRef,
    analysisContextRef: services.analysisContextRef
  });
  
  // Core functionality
  const core = useTranscriptionCore({
    deepgramRef: services.deepgramRef,
    claudeRef: services.claudeRef,
    analysisContextRef: services.analysisContextRef,
    cleanupRef: services.cleanupRef,
    handleTranscriptEvent: callbacks.handleTranscriptEvent,
    transcriptRef: state.transcriptRef,
    insightsRef: state.insightsRef,
    setTranscript: state.setTranscript,
    setPartialTranscript: state.setPartialTranscript,
    setInsights: state.setInsights,
    setIsRecording: state.setIsRecording,
    onTranscriptUpdate: callbacks.onTranscriptUpdate,
    onInsightUpdate: callbacks.onInsightUpdate
  });
  
  // Native recording functionality
  const recording = useTranscriptionRecordingNative({
    deepgramRef: services.deepgramRef,
    setIsRecording: state.setIsRecording,
    initAudioAnalyser,
    stopAudioAnalyser,
    connectToDeepgram: core.connectToDeepgram
  });

  /**
   * Start recording with native audio capture
   */
  const startRecording = async (): Promise<void> => {
    try {
      // Start native recording directly - no configuration check needed
      // Native audio capture is always enabled for this hook
      await recording.startRecording();
      
    } catch (error) {
      console.error('Failed to start native recording:', error);
      throw error;
    }
  };

  /**
   * Stop recording
   */
  const stopRecording = async (): Promise<void> => {
    try {
      await recording.stopRecording();
    } catch (error) {
      console.error('Failed to stop native recording:', error);
    }
  };

  /**
   * Get native audio status
   */
  const getNativeAudioStatus = () => {
    return recording.getNativeAudioStatus();
  };

  /**
   * Check if native audio is available
   */
  const isNativeAudioAvailable = (): boolean => {
    const status = getNativeAudioStatus();
    return status.isAvailable && status.isInitialized;
  };

  /**
   * Get native audio device information
   */
  const getNativeAudioDeviceInfo = () => {
    const status = getNativeAudioStatus();
    return status.deviceInfo;
  };

  return {
    // State
    transcript: state.transcript,
    partialTranscript: state.partialTranscript,
    insights: state.insights,
    isRecording: state.isRecording,
    isConnected: state.isConnected,
    error: state.error,
    audioLevel,
    
    // Native audio specific
    isNativeAudioAvailable: isNativeAudioAvailable(),
    nativeAudioStatus: getNativeAudioStatus(),
    nativeAudioDeviceInfo: getNativeAudioDeviceInfo(),
    initializationError: recording.initializationError,
    
    // Methods
    startRecording,
    stopRecording,
    clearTranscript: state.clearTranscript,
    clearInsights: state.clearInsights,
    clearError: state.clearError,
    
    // Service references (for advanced usage)
    deepgramRef: services.deepgramRef,
    claudeRef: services.claudeRef,
    nativeAudioService: recording.nativeAudioService
  };
};

export default useTranscriptionNative;
