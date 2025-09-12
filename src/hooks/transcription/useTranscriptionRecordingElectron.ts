import { useCallback, useState, useRef, useEffect } from 'react';
import { configService } from '../../services/config';
import { useAudioAnalyser } from '../useAudioAnalyser';
import { AppError, ErrorHandler } from '../../utils/errors';
import { Logger } from '../../utils/logger';
import { PerformanceMonitor } from '../../utils/performance-monitor';
import { ElectronAudioService, createElectronAudioService } from '../../services/audio/ElectronAudioService';

/**
 * Electron recording functionality using OFFICIAL desktopCapturer API
 * Based on Electron official documentation
 * 
 * @example
 * ```tsx
 * const recording = useTranscriptionRecordingElectron({
 *   deepgramRef,
 *   setIsRecording,
 *   initAudioAnalyser,
 *   stopAudioAnalyser,
 *   connectToDeepgram
 * });
 * ```
 */
interface UseTranscriptionRecordingElectronProps {
  deepgramRef: React.MutableRefObject<any>;
  setIsRecording: (recording: boolean) => void;
  initAudioAnalyser: (stream: MediaStream) => void;
  stopAudioAnalyser: () => void;
  connectToDeepgram: () => Promise<() => void>;
}

export function useTranscriptionRecordingElectron({
  deepgramRef,
  setIsRecording,
  initAudioAnalyser,
  stopAudioAnalyser,
  connectToDeepgram
}: UseTranscriptionRecordingElectronProps) {
  
  // State
  const [electronAudioService, setElectronAudioService] = useState<ElectronAudioService | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  
  // Refs
  const cleanupRef = useRef<(() => void) | null>(null);
  const performanceMonitor = useRef(PerformanceMonitor);

  /**
   * Initialize Electron audio service
   */
  const initializeElectronAudio = useCallback(async (): Promise<void> => {
    try {
      Logger.info('Initializing Electron audio service');
      
      const audioConfig = configService.getConfig().audio;
      const electronService = createElectronAudioService({
        sampleRate: 16000,
        channels: 1,
        bufferSize: 4096
      });

      // Set up event listeners
      electronService.on('audioData', handleElectronAudioData);
      electronService.on('error', handleElectronAudioError);
      electronService.on('captureStarted', handleCaptureStarted);
      electronService.on('captureStopped', handleCaptureStopped);

      setElectronAudioService(electronService);
      setIsInitialized(true);
      setInitializationError(null);
      
      Logger.info('Electron audio service initialized successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error('Failed to initialize Electron audio service', { error: errorMessage });
      
      setInitializationError(errorMessage);
      setIsInitialized(false);
      
      throw new AppError(
        'Failed to initialize Electron audio service',
        'ELECTRON_AUDIO_INIT_ERROR',
        false,
        { originalError: errorMessage }
      );
    }
  }, []);

  /**
   * Handle audio data from Electron service
   */
  const handleElectronAudioData = useCallback((audioEvent: any) => {
    const startTime = performanceMonitor.current.startLatencyMeasurement();
    try {
      
      if (!deepgramRef.current || !audioEvent.data) {
        return;
      }

      // Convert Int16Array to ArrayBuffer for Deepgram
      const buffer = audioEvent.data.buffer;
      
      // Send to Deepgram
      if (deepgramRef.current.send) {
        deepgramRef.current.send(buffer);
      }

      // Record performance metrics
      performanceMonitor.current.endLatencyMeasurement(startTime, 'audio');
      performanceMonitor.current.recordAudioLatency(10);

    } catch (error) {
      Logger.error('Error processing Electron audio data', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }, [deepgramRef]);

  /**
   * Handle Electron audio errors
   */
  const handleElectronAudioError = useCallback((error: Error) => {
    Logger.error('Electron audio service error', { 
      error: error.message,
      stack: error.stack 
    });
    
    // Log error (no ErrorHandler.handleError method exists)
    Logger.error('Electron audio capture error', { 
      error: error.message,
      code: 'ELECTRON_AUDIO_ERROR'
    });
  }, []);

  /**
   * Handle capture started
   */
  const handleCaptureStarted = useCallback(() => {
    Logger.info('Electron audio capture started');
    setIsRecording(true);
  }, [setIsRecording]);

  /**
   * Handle capture stopped
   */
  const handleCaptureStopped = useCallback(() => {
    Logger.info('Electron audio capture stopped');
    setIsRecording(false);
  }, [setIsRecording]);

  /**
   * Get Electron audio status
   */
  const getElectronAudioStatus = useCallback(() => {
    if (!electronAudioService) {
      return { 
        isAvailable: false, 
        isCapturing: false, 
        error: 'Service not initialized' 
      };
    }

    return {
      isAvailable: isInitialized,
      isCapturing: electronAudioService.isCurrentlyCapturing(),
      config: electronAudioService.getConfig(),
      error: initializationError
    };
  }, [electronAudioService, isInitialized, initializationError]);

  // Initialize on mount
  useEffect(() => {
    initializeElectronAudio().catch(error => {
      Logger.error('Failed to auto-initialize Electron audio', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    });

    return () => {
      if (electronAudioService) {
        electronAudioService.destroy();
      }
    };
  }, [initializeElectronAudio]);

  // Cleanup function dependencies
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  /**
   * Start recording with OFFICIAL Electron audio capture
   */
  const startRecording = useCallback(async (): Promise<void> => {
    const startTime = performanceMonitor.current.startLatencyMeasurement();
    try {
      
      Logger.info('Starting Electron audio recording');

      // Initialize Electron audio service if not already done
      if (!isInitialized) {
        await initializeElectronAudio();
      }

      if (!electronAudioService) {
        throw new AppError(
          'Electron audio service not available',
          'ELECTRON_AUDIO_SERVICE_UNAVAILABLE',
          false
        );
      }

      // Connect to Deepgram
      const cleanup = await connectToDeepgram();
      cleanupRef.current = cleanup;

      // Start Electron audio capture using OFFICIAL API
      await electronAudioService.startCapture();

      // Initialize audio analyser with mock stream for visualization
      // (We'll create a mock stream since desktopCapturer provides the real stream)
      const mockStream = new MediaStream();
      initAudioAnalyser(mockStream);

      // Record performance
      performanceMonitor.current.endLatencyMeasurement(startTime, 'recording_start');

      Logger.info('Electron audio recording started successfully');

    } catch (error) {
      Logger.error('Failed to start Electron recording', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      // Cleanup on error
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      
      throw error;
    }
  }, [
    isInitialized,
    electronAudioService,
    initializeElectronAudio,
    connectToDeepgram,
    initAudioAnalyser,
    setIsRecording
  ]);

  /**
   * Stop recording
   */
  const stopRecording = useCallback(async (): Promise<void> => {
    try {
      Logger.info('Stopping Electron audio recording');

      // Stop Electron audio service
      if (electronAudioService) {
        await electronAudioService.stopCapture();
      }

      // Stop audio analyser
      stopAudioAnalyser();

      // Cleanup Deepgram connection
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }

      Logger.info('Electron audio recording stopped successfully');

    } catch (error) {
      Logger.error('Failed to stop Electron recording', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }, [electronAudioService, stopAudioAnalyser]);

  return {
    startRecording,
    stopRecording,
    isInitialized,
    initializationError,
    getElectronAudioStatus,
    electronAudioService,
    cleanupRef
  };
}
