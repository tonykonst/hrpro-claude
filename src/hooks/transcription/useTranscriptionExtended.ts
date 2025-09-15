import { useState, useCallback } from 'react';
import { useTranscriptionState } from './useTranscriptionState';
import { useTranscriptionServices } from './useTranscriptionServices';
import { useTranscriptionCallbacks } from './useTranscriptionCallbacks';
import { useTranscriptionCore } from './useTranscriptionCore';
import { useTranscriptionRecordingExtended, AudioSourceType } from './useTranscriptionRecordingExtended';
import { useAudioAnalyser } from '../useAudioAnalyser';
import { LegacyInsight } from '../../types/events';

/**
 * Configuration options for extended transcription
 */
export interface UseTranscriptionExtendedOptions {
  // Feature flags
  enableBrowserCapture?: boolean; // Enable browser/tab audio capture
  enableAutoSourceSwitch?: boolean; // Auto-switch to best available source
  enablePermissionPrompts?: boolean; // Show custom permission prompts
  
  // Default settings
  defaultAudioSource?: AudioSourceType;
  preferredBrowser?: 'chrome' | 'safari' | 'auto';
  
  // Callbacks
  onAudioSourceChange?: (source: AudioSourceType) => void;
  onPermissionRequest?: (type: 'microphone' | 'screen') => void;
  onPermissionResult?: (granted: boolean) => void;
  onBrowserNotSupported?: () => void;
}

/**
 * Extended transcription hook with cross-browser audio capture support
 * 
 * This hook extends the original useTranscription to support multiple audio sources
 * while maintaining full backward compatibility. When browser capture is disabled,
 * it behaves exactly like the original hook.
 * 
 * @example
 * ```tsx
 * // Basic usage (backward compatible - microphone only)
 * const transcription = useTranscriptionExtended();
 * 
 * // With browser audio capture enabled
 * const transcription = useTranscriptionExtended({
 *   enableBrowserCapture: true,
 *   defaultAudioSource: 'browser'
 * });
 * 
 * // Switch audio source
 * transcription.switchAudioSource('tab');
 * 
 * // Check available sources
 * const sources = transcription.getAvailableAudioSources();
 * ```
 */
export const useTranscriptionExtended = (options: UseTranscriptionExtendedOptions = {}) => {
  const {
    enableBrowserCapture = false,
    enableAutoSourceSwitch = false,
    enablePermissionPrompts = false,
    defaultAudioSource = 'microphone',
    preferredBrowser = 'auto',
    onAudioSourceChange,
    onPermissionRequest,
    onPermissionResult,
    onBrowserNotSupported
  } = options;
  
  // State management
  const state = useTranscriptionState();
  
  // Service references
  const services = useTranscriptionServices();
  
  // Audio analyser
  const { audioLevel, initAudioAnalyser, stopAudioAnalyser } = useAudioAnalyser();
  
  // Track current audio source
  const [currentAudioSource, setCurrentAudioSource] = useState<AudioSourceType>(defaultAudioSource);
  const [browserCaptureAvailable, setBrowserCaptureAvailable] = useState<boolean>(false);
  
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
    insightsRef: state.insightsRef
  });
  
  // Handle audio source change
  const handleAudioSourceChange = useCallback((source: AudioSourceType) => {
    console.log('🔄 [TranscriptionExtended] Audio source changed:', source);
    setCurrentAudioSource(source);
    onAudioSourceChange?.(source);
  }, [onAudioSourceChange]);
  
  // Extended recording functionality with browser capture support
  const recording = useTranscriptionRecordingExtended({
    streamRef: services.streamRef,
    audioContextRef: services.audioContextRef,
    processorRef: services.processorRef,
    cleanupRef: services.cleanupRef,
    deepgramRef: services.deepgramRef,
    setIsRecording: state.setIsRecording,
    initAudioAnalyser,
    stopAudioAnalyser,
    connectToDeepgram: core.connectToDeepgram,
    
    // Extended options
    audioSource: currentAudioSource,
    enableBrowserCapture,
    onAudioSourceChange: handleAudioSourceChange,
    onPermissionRequest,
    onPermissionResult
  });
  
  // Check browser capture availability on mount
  useState(() => {
    if (enableBrowserCapture) {
      const isSupported = recording.isBrowserCaptureSupported();
      setBrowserCaptureAvailable(isSupported);
      
      if (!isSupported) {
        console.warn('⚠️ [TranscriptionExtended] Browser audio capture not supported');
        onBrowserNotSupported?.();
        
        // Fall back to microphone if auto-switch is enabled
        if (enableAutoSourceSwitch && currentAudioSource !== 'microphone') {
          console.log('🔄 [TranscriptionExtended] Auto-switching to microphone');
          setCurrentAudioSource('microphone');
        }
      }
    }
  });
  
  // Enhanced start recording with source validation
  const startRecording = useCallback(async (): Promise<void> => {
    console.log('🎬 [TranscriptionExtended] Starting recording...', {
      source: currentAudioSource,
      browserCaptureEnabled: enableBrowserCapture,
      browserCaptureAvailable
    });
    
    // Validate audio source
    if (currentAudioSource !== 'microphone' && !browserCaptureAvailable) {
      console.warn('⚠️ [TranscriptionExtended] Browser capture not available, falling back to microphone');
      setCurrentAudioSource('microphone');
      
      // If we can't use the requested source, notify the user
      if (!enableAutoSourceSwitch) {
        throw new Error('Browser audio capture is not available. Please use microphone or enable a different browser.');
      }
    }
    
    // Call the extended recording function
    await recording.startRecording();
  }, [currentAudioSource, enableBrowserCapture, browserCaptureAvailable, enableAutoSourceSwitch, recording]);
  
  // Get recording status with source info
  const getRecordingStatus = useCallback(() => {
    return {
      isRecording: state.isRecording,
      audioSource: currentAudioSource,
      audioLevel: recording.audioLevel || audioLevel,
      hasAudio: recording.hasAudio,
      isCapturing: recording.isCapturing,
      browserCaptureEnabled: enableBrowserCapture,
      browserCaptureAvailable
    };
  }, [state.isRecording, currentAudioSource, recording, audioLevel, enableBrowserCapture, browserCaptureAvailable]);
  
  // Get browser capture info
  const getBrowserCaptureInfo = useCallback(() => {
    if (!enableBrowserCapture) {
      return {
        available: false,
        method: null,
        limitations: [],
        instructions: 'Browser capture is disabled',
        extensionRequired: false,
        extensionInstalled: false
      };
    }
    
    return {
      available: browserCaptureAvailable,
      method: recording.browserCaptureMethod,
      limitations: recording.browserLimitations,
      instructions: recording.browserInstructions,
      extensionRequired: recording.browserCaptureMethod === 'chrome-extension',
      extensionInstalled: recording.isExtensionInstalled
    };
  }, [enableBrowserCapture, browserCaptureAvailable, recording]);
  
  return {
    // Original transcription states
    transcript: state.transcript,
    partialTranscript: state.partialTranscript,
    insights: state.insights,
    isRecording: state.isRecording,
    audioLevel: recording.audioLevel || audioLevel,
    
    // Original methods
    setTranscript: state.setTranscript,
    setPartialTranscript: state.setPartialTranscript,
    setInsights: state.setInsights,
    setIsRecording: state.setIsRecording,
    
    // Enhanced recording functions
    startRecording,
    stopRecording: recording.stopRecording,
    connectToDeepgram: core.connectToDeepgram,
    analyzeWithClaude: callbacks.analyzeWithClaude,
    
    // Extended functionality (new)
    currentAudioSource,
    switchAudioSource: recording.switchAudioSource,
    getAvailableAudioSources: recording.getAvailableAudioSources,
    getRecordingStatus,
    getBrowserCaptureInfo,
    
    // Browser capture specific
    isBrowserCaptureSupported: recording.isBrowserCaptureSupported,
    installExtension: recording.installExtension,
    
    // Error handling
    error: recording.error,
    resetError: recording.resetError
  };
};

/**
 * Return type for extended transcription hook
 */
export interface UseTranscriptionExtendedReturn {
  // Original states
  transcript: string;
  partialTranscript: string;
  insights: LegacyInsight[];
  isRecording: boolean;
  audioLevel: number;
  
  // Original methods
  setTranscript: (transcript: string) => void;
  setPartialTranscript: (partialTranscript: string) => void;
  setInsights: (insights: LegacyInsight[]) => void;
  setIsRecording: (isRecording: boolean) => void;
  
  // Original functions
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  connectToDeepgram: () => Promise<() => void>;
  analyzeWithClaude: (newText: string) => Promise<void>;
  
  // Extended functionality
  currentAudioSource: AudioSourceType;
  switchAudioSource: (source: AudioSourceType) => void;
  getAvailableAudioSources: () => AudioSourceType[];
  getRecordingStatus: () => {
    isRecording: boolean;
    audioSource: AudioSourceType;
    audioLevel: number;
    hasAudio: boolean;
    isCapturing: boolean;
    browserCaptureEnabled: boolean;
    browserCaptureAvailable: boolean;
  };
  getBrowserCaptureInfo: () => {
    available: boolean;
    method: string | null;
    limitations: string[];
    instructions: string;
    extensionRequired: boolean;
    extensionInstalled: boolean;
  };
  
  // Browser capture specific
  isBrowserCaptureSupported: () => boolean;
  installExtension: () => void;
  
  // Error handling
  error: Error | null;
  resetError: () => void;
}

/**
 * Backward compatibility wrapper
 * 
 * Use this to maintain compatibility with existing code that uses useTranscription
 * 
 * @example
 * ```tsx
 * // In existing code, replace:
 * // import { useTranscription } from './hooks/transcription/useTranscription';
 * 
 * // With:
 * import { useTranscriptionCompat as useTranscription } from './hooks/transcription/useTranscriptionExtended';
 * ```
 */
export const useTranscriptionCompat = () => {
  // Use extended hook with browser capture disabled for full backward compatibility
  const extended = useTranscriptionExtended({
    enableBrowserCapture: false,
    defaultAudioSource: 'microphone'
  });
  
  // Return only the original interface
  return {
    transcript: extended.transcript,
    partialTranscript: extended.partialTranscript,
    insights: extended.insights,
    isRecording: extended.isRecording,
    audioLevel: extended.audioLevel,
    setTranscript: extended.setTranscript,
    setPartialTranscript: extended.setPartialTranscript,
    setInsights: extended.setInsights,
    setIsRecording: extended.setIsRecording,
    startRecording: extended.startRecording,
    stopRecording: extended.stopRecording,
    connectToDeepgram: extended.connectToDeepgram,
    analyzeWithClaude: extended.analyzeWithClaude
  };
};