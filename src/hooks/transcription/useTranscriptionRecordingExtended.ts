import { useCallback, useRef, useState } from 'react';
import { configService } from '../../services/config';
import { useAudioAnalyser } from '../useAudioAnalyser';
import { useCrossBrowserAudio } from '../useCrossBrowserAudio';

export type AudioSourceType = 'microphone' | 'browser' | 'tab' | 'screen';

/**
 * Extended recording functionality for transcription hook with cross-browser audio capture support
 * 
 * This hook extends the original useTranscriptionRecording to support multiple audio sources:
 * - Microphone (original functionality)
 * - Browser tab audio capture (Chrome/Safari)
 * - Screen capture with audio
 * 
 * @example
 * ```tsx
 * const recording = useTranscriptionRecordingExtended({
 *   streamRef,
 *   audioContextRef,
 *   processorRef,
 *   cleanupRef,
 *   deepgramRef,
 *   setIsRecording,
 *   initAudioAnalyser,
 *   stopAudioAnalyser,
 *   connectToDeepgram,
 *   audioSource: 'browser', // or 'microphone', 'tab', 'screen'
 *   enableBrowserCapture: true // feature flag
 * });
 * ```
 */
interface UseTranscriptionRecordingExtendedProps {
  streamRef: React.MutableRefObject<MediaStream | null>;
  audioContextRef: React.MutableRefObject<AudioContext | null>;
  processorRef: React.MutableRefObject<ScriptProcessorNode | AudioWorkletNode | null>;
  cleanupRef: React.MutableRefObject<(() => void) | null>;
  deepgramRef: React.MutableRefObject<any>;
  setIsRecording: (recording: boolean) => void;
  initAudioAnalyser: (stream: MediaStream) => void;
  stopAudioAnalyser: () => void;
  connectToDeepgram: () => Promise<() => void>;
  
  // New parameters for extended functionality
  audioSource?: AudioSourceType;
  enableBrowserCapture?: boolean; // Feature flag
  onAudioSourceChange?: (source: AudioSourceType) => void;
  onPermissionRequest?: (type: 'microphone' | 'screen') => void;
  onPermissionResult?: (granted: boolean) => void;
}

export const useTranscriptionRecordingExtended = ({
  streamRef,
  audioContextRef,
  processorRef,
  cleanupRef,
  deepgramRef,
  setIsRecording,
  initAudioAnalyser,
  stopAudioAnalyser,
  connectToDeepgram,
  audioSource = 'microphone',
  enableBrowserCapture = false,
  onAudioSourceChange,
  onPermissionRequest,
  onPermissionResult
}: UseTranscriptionRecordingExtendedProps) => {
  
  // Track current audio source
  const [currentAudioSource, setCurrentAudioSource] = useState<AudioSourceType>(audioSource);
  const browserCaptureCleanupRef = useRef<(() => void) | null>(null);
  
  // Cross-browser audio capture hook (only used when browser capture is enabled)
  const browserAudio = useCrossBrowserAudio({
    onStreamReady: async (stream) => {
      console.log('🎙️ [Extended Recording] Browser audio stream ready');
      streamRef.current = stream;
      
      // Initialize audio analyser for visual feedback
      initAudioAnalyser(stream);
      
      // Set up audio processing pipeline
      await setupAudioPipeline(stream);
    },
    onStreamEnded: () => {
      console.log('🛑 [Extended Recording] Browser audio stream ended');
      cleanupAudioPipeline();
    },
    onError: (error) => {
      console.error('❌ [Extended Recording] Browser audio capture error:', error);
      setIsRecording(false);
    },
    audioOnly: true
  });

  /**
   * Set up audio processing pipeline (shared between microphone and browser capture)
   */
  const setupAudioPipeline = useCallback(async (stream: MediaStream): Promise<void> => {
    try {
      // Connect to Deepgram
      const cleanup = await connectToDeepgram();
      cleanupRef.current = cleanup;
      
      // Create audio context with appropriate sample rate
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      
      console.log('🔊 [Extended Recording] Setting up audio pipeline...');
      
      try {
        // Try to use AudioWorklet (modern approach)
        await audioContext.audioWorklet.addModule('/audioWorklet.js');
        
        const source = audioContext.createMediaStreamSource(stream);
        const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
        
        // Handle audio data
        workletNode.port.onmessage = (event) => {
          if (event.data.type === 'pcm-data' && deepgramRef.current) {
            deepgramRef.current.sendAudio(event.data.data);
          }
        };
        
        source.connect(workletNode);
        processorRef.current = workletNode;
        
        console.log('✅ [Extended Recording] AudioWorklet pipeline ready');
        
      } catch (workletError) {
        console.warn('⚠️ [Extended Recording] AudioWorklet failed, falling back to ScriptProcessor:', workletError);
        
        // Fallback to ScriptProcessor
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        
        processor.onaudioprocess = (event) => {
          const inputData = event.inputBuffer.getChannelData(0);
          
          // Convert Float32 to Int16
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
          }
          
          // Send data to Deepgram
          if (deepgramRef.current) {
            deepgramRef.current.sendAudio(pcm16.buffer);
          }
        };
        
        source.connect(processor);
        processor.connect(audioContext.destination);
        processorRef.current = processor;
        
        console.log('✅ [Extended Recording] ScriptProcessor pipeline ready');
      }
      
    } catch (error) {
      console.error('❌ [Extended Recording] Failed to set up audio pipeline:', error);
      throw error;
    }
  }, [audioContextRef, processorRef, deepgramRef, connectToDeepgram, cleanupRef]);

  /**
   * Clean up audio processing pipeline
   */
  const cleanupAudioPipeline = useCallback(() => {
    // Stop audio processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Stop stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Stop audio analyser
    stopAudioAnalyser();
    
    // Disconnect from Deepgram
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
  }, [processorRef, audioContextRef, streamRef, stopAudioAnalyser, cleanupRef]);

  /**
   * Start recording from microphone (original functionality)
   */
  const startMicrophoneRecording = useCallback(async (): Promise<void> => {
    console.log('🎤 [Extended Recording] Starting microphone recording...');
    
    try {
      onPermissionRequest?.('microphone');
      
      // Get microphone access
      const audioConstraints = configService.getAudioConstraints();
      const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
      streamRef.current = stream;
      
      console.log('✅ [Extended Recording] Microphone access granted');
      onPermissionResult?.(true);
      
      // Initialize audio analyser
      initAudioAnalyser(stream);
      
      // Set up audio pipeline
      await setupAudioPipeline(stream);
      
      console.log('🎉 [Extended Recording] Microphone recording started successfully!');
      
    } catch (error) {
      console.error('❌ [Extended Recording] Failed to start microphone recording:', error);
      onPermissionResult?.(false);
      throw error;
    }
  }, [streamRef, initAudioAnalyser, setupAudioPipeline, onPermissionRequest, onPermissionResult]);

  /**
   * Start recording from browser/tab audio
   */
  const startBrowserRecording = useCallback(async (): Promise<void> => {
    console.log('🌐 [Extended Recording] Starting browser audio capture...');
    
    try {
      onPermissionRequest?.('screen');
      
      // Start browser audio capture
      await browserAudio.startCapture();
      
      // Store cleanup function for browser capture
      browserCaptureCleanupRef.current = browserAudio.stopCapture;
      
      console.log('✅ [Extended Recording] Browser audio capture started');
      onPermissionResult?.(true);
      
    } catch (error) {
      console.error('❌ [Extended Recording] Failed to start browser audio capture:', error);
      onPermissionResult?.(false);
      throw error;
    }
  }, [browserAudio, onPermissionRequest, onPermissionResult]);

  /**
   * Start recording based on selected audio source
   */
  const startRecording = useCallback(async (): Promise<void> => {
    console.log('🎬 [Extended Recording] Starting recording...', { 
      source: currentAudioSource,
      browserCaptureEnabled: enableBrowserCapture 
    });
    
    try {
      // Update UI state
      setIsRecording(true);
      
      // Start recording based on audio source
      if (!enableBrowserCapture || currentAudioSource === 'microphone') {
        // Use original microphone recording
        await startMicrophoneRecording();
      } else if (
        currentAudioSource === 'browser' ||
        currentAudioSource === 'tab' ||
        currentAudioSource === 'screen' ||
        currentAudioSource === 'browser-tab' ||
        currentAudioSource === 'screen-with-audio' ||
        currentAudioSource.includes('browser') ||
        currentAudioSource.includes('tab') ||
        currentAudioSource.includes('screen')
      ) {
        // Use browser audio capture for any browser/tab/screen source
        await startBrowserRecording();
      } else {
        console.warn(`⚠️ [Extended Recording] Unsupported audio source: ${currentAudioSource}, falling back to microphone`);
        // Fall back to microphone if source is not supported
        setCurrentAudioSource('microphone');
        await startMicrophoneRecording();
      }
      
    } catch (error) {
      console.error('❌ [Extended Recording] Failed to start recording:', error);
      setIsRecording(false);
      throw error;
    }
  }, [currentAudioSource, enableBrowserCapture, setIsRecording, startMicrophoneRecording, startBrowserRecording]);

  /**
   * Stop recording
   */
  const stopRecording = useCallback((): void => {
    console.log('⏹️ [Extended Recording] Stopping recording...');
    
    try {
      // Stop browser capture if active
      if (browserCaptureCleanupRef.current) {
        browserCaptureCleanupRef.current();
        browserCaptureCleanupRef.current = null;
      }
      
      // Clean up audio pipeline
      cleanupAudioPipeline();
      
      // Update UI state
      setIsRecording(false);
      
      console.log('✅ [Extended Recording] Recording stopped successfully!');
      
    } catch (error) {
      console.error('❌ [Extended Recording] Error stopping recording:', error);
      setIsRecording(false);
    }
  }, [cleanupAudioPipeline, setIsRecording]);

  /**
   * Switch audio source
   */
  const switchAudioSource = useCallback((source: AudioSourceType): void => {
    console.log('🔄 [Extended Recording] Switching audio source to:', source);
    
    // Stop current recording if active
    if (streamRef.current) {
      stopRecording();
    }
    
    // Update audio source
    setCurrentAudioSource(source);
    onAudioSourceChange?.(source);
  }, [streamRef, stopRecording, onAudioSourceChange]);

  /**
   * Check if browser audio capture is supported
   */
  const isBrowserCaptureSupported = useCallback((): boolean => {
    if (!enableBrowserCapture) return false;
    return browserAudio.isSupported;
  }, [enableBrowserCapture, browserAudio.isSupported]);

  /**
   * Get available audio sources
   */
  const getAvailableAudioSources = useCallback((): AudioSourceType[] => {
    const sources: AudioSourceType[] = ['microphone'];
    
    if (enableBrowserCapture && browserAudio.isSupported) {
      // Add browser-specific sources based on capabilities
      if (browserAudio.browser.name === 'safari') {
        sources.push('screen'); // Safari uses screen capture for audio
      } else if (browserAudio.browser.supportsExtensions) {
        sources.push('tab', 'browser'); // Chrome supports tab/browser capture
      } else {
        sources.push('screen'); // Generic screen capture
      }
    }
    
    return sources;
  }, [enableBrowserCapture, browserAudio]);

  return {
    // Core recording functions
    startRecording,
    stopRecording,
    
    // Audio source management
    currentAudioSource,
    switchAudioSource,
    getAvailableAudioSources,
    
    // Browser capture specific
    isBrowserCaptureSupported,
    browserCaptureMethod: browserAudio.captureMethod,
    browserLimitations: browserAudio.limitations,
    browserInstructions: browserAudio.instructions,
    
    // Extension management (Chrome only)
    isExtensionInstalled: browserAudio.isExtensionInstalled,
    installExtension: browserAudio.installExtension,
    
    // State
    isCapturing: browserAudio.isCapturing,
    hasAudio: browserAudio.hasAudio,
    audioLevel: browserAudio.audioLevel,
    error: browserAudio.error,
    resetError: browserAudio.resetError
  };
};