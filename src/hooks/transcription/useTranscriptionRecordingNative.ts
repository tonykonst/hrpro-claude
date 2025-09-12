import { useCallback, useState, useRef, useEffect } from 'react';
import { configService } from '../../services/config';
import { useAudioAnalyser } from '../useAudioAnalyser';
import { AppError, ErrorHandler } from '../../utils/errors';
import { Logger } from '../../utils/logger';
import { PerformanceMonitor } from '../../utils/performance-monitor';
import { NativeAudioService, createNativeAudioService } from '../../services/audio/NativeAudioService';

/**
 * Native recording functionality for transcription hook (v0.54)
 * Uses native audio capture instead of web APIs for system audio
 * 
 * @example
 * ```tsx
 * const recording = useTranscriptionRecordingNative({
 *   deepgramRef,
 *   setIsRecording,
 *   initAudioAnalyser,
 *   stopAudioAnalyser,
 *   connectToDeepgram
 * });
 * ```
 */
interface UseTranscriptionRecordingNativeProps {
  deepgramRef: React.MutableRefObject<any>;
  setIsRecording: (recording: boolean) => void;
  initAudioAnalyser: (stream: MediaStream) => void;
  stopAudioAnalyser: () => void;
  connectToDeepgram: () => Promise<() => void>;
}

export const useTranscriptionRecordingNative = ({
  deepgramRef,
  setIsRecording,
  initAudioAnalyser,
  stopAudioAnalyser,
  connectToDeepgram
}: UseTranscriptionRecordingNativeProps) => {
  const [nativeAudioService, setNativeAudioService] = useState<NativeAudioService | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  
  const cleanupRef = useRef<(() => void) | null>(null);
  const performanceMonitor = useRef(PerformanceMonitor);

  /**
   * Initialize native audio service
   */
  const initializeNativeAudio = useCallback(async (): Promise<void> => {
    try {
      Logger.info('Initializing native audio service');
      
      const audioConfig = configService.getConfig().audio;
      const nativeService = createNativeAudioService({
        sampleRate: 16000,
        channels: 1,
        bufferSize: 4096,
        enableLoopback: true
      });

      // Set up event listeners
      nativeService.on('audioData', handleNativeAudioData);
      nativeService.on('error', handleNativeAudioError);
      nativeService.on('captureStarted', handleCaptureStarted);
      nativeService.on('captureStopped', handleCaptureStopped);

      setNativeAudioService(nativeService);
      setIsInitialized(true);
      setInitializationError(null);
      
      Logger.info('Native audio service initialized successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error('Failed to initialize native audio service', { error: errorMessage });
      
      setInitializationError(errorMessage);
      setIsInitialized(false);
      
      throw new AppError(
        'Native audio capture initialization failed',
        'NATIVE_AUDIO_INIT_ERROR',
        false,
        { 
          originalError: errorMessage,
          platform: process.platform,
          instructions: 'Native audio capture requires Windows or macOS with proper permissions'
        }
      );
    }
  }, []);

  /**
   * Handle audio data from native service
   */
  const handleNativeAudioData = useCallback((audioData: any) => {
    try {
      if (deepgramRef.current && audioData.data) {
        // Convert Int16Array to ArrayBuffer for Deepgram
        const buffer = audioData.data.buffer.slice(
          audioData.data.byteOffset,
          audioData.data.byteOffset + audioData.data.byteLength
        );
        
        deepgramRef.current.sendAudio(buffer);
        
        // Update performance metrics
        performanceMonitor.current.recordAudioLatency(10); // Placeholder latency
      }
    } catch (error) {
      Logger.error('Error processing native audio data', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }, [deepgramRef]);

  /**
   * Handle native audio errors
   */
  const handleNativeAudioError = useCallback((error: Error) => {
    Logger.error('Native audio service error', { 
      error: error.message,
      stack: error.stack 
    });
    
    // Stop recording on critical errors
    stopRecording();
  }, []);

  /**
   * Handle capture started
   */
  const handleCaptureStarted = useCallback(() => {
    Logger.info('Native audio capture started');
    setIsRecording(true);
  }, [setIsRecording]);

  /**
   * Handle capture stopped
   */
  const handleCaptureStopped = useCallback(() => {
    Logger.info('Native audio capture stopped');
    setIsRecording(false);
  }, [setIsRecording]);

  /**
   * Start recording with native audio capture
   */
  const startRecording = useCallback(async (): Promise<void> => {
    const startTime = performanceMonitor.current.startLatencyMeasurement();
    try {
      
      Logger.info('Starting native audio recording');

      // Initialize native audio service if not already done
      if (!isInitialized) {
        await initializeNativeAudio();
      }

      if (!nativeAudioService) {
        throw new AppError(
          'Native audio service not available',
          'NATIVE_AUDIO_SERVICE_UNAVAILABLE',
          false
        );
      }

      // Connect to Deepgram
      const cleanup = await connectToDeepgram();
      cleanupRef.current = cleanup;

      // Start native audio capture
      await nativeAudioService.startCapture();

      // Initialize audio analyser with mock stream for visualization
      // (Native audio doesn't provide MediaStream, so we create a mock)
      const mockStream = createMockMediaStream();
      initAudioAnalyser(mockStream);

      performanceMonitor.current.endLatencyMeasurement(startTime, 'audio');
      Logger.info('Native audio recording started successfully');

    } catch (error) {
      performanceMonitor.current.endLatencyMeasurement(startTime, 'audio');
      
      Logger.error('Failed to start native audio recording', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Cleanup on error
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      
      setIsRecording(false);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        'Failed to start native audio recording',
        'NATIVE_AUDIO_START_ERROR',
        true,
        { 
          originalError: error instanceof Error ? error.message : String(error) 
        }
      );
    }
  }, [
    isInitialized,
    nativeAudioService,
    initializeNativeAudio,
    connectToDeepgram,
    initAudioAnalyser,
    setIsRecording
  ]);

  /**
   * Stop recording
   */
  const stopRecording = useCallback(async (): Promise<void> => {
    try {
      Logger.info('Stopping native audio recording');

      // Stop native audio capture
      if (nativeAudioService) {
        await nativeAudioService.stopCapture();
      }

      // Stop audio analyser
      stopAudioAnalyser();

      // Cleanup Deepgram connection
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }

      setIsRecording(false);
      
      Logger.info('Native audio recording stopped successfully');

    } catch (error) {
      Logger.error('Error stopping native audio recording', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }, [nativeAudioService, stopAudioAnalyser, setIsRecording]);

  /**
   * Create mock MediaStream for audio analyser visualization
   */
  const createMockMediaStream = useCallback((): MediaStream => {
    // Create a silent audio track for visualization purposes
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.frequency.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    
    oscillator.connect(gainNode);
    
    const destination = audioContext.createMediaStreamDestination();
    gainNode.connect(destination);
    
    oscillator.start();
    
    return destination.stream;
  }, []);

  /**
   * Get native audio service status
   */
  const getNativeAudioStatus = useCallback(() => {
    if (!nativeAudioService) {
      return {
        isAvailable: false,
        isInitialized: false,
        isCapturing: false,
        deviceInfo: null,
        error: initializationError
      };
    }

    return {
      isAvailable: true,
      isInitialized: isInitialized,
      isCapturing: nativeAudioService.isCurrentlyCapturing(),
      deviceInfo: nativeAudioService.getDeviceInfo(),
      error: null
    };
  }, [nativeAudioService, isInitialized, initializationError]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (nativeAudioService) {
        nativeAudioService.destroy();
      }
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [nativeAudioService]);

  return {
    startRecording,
    stopRecording,
    isInitialized,
    initializationError,
    getNativeAudioStatus,
    nativeAudioService
  };
};

export default useTranscriptionRecordingNative;
