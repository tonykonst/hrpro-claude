import { useState, useCallback, useEffect, useRef } from 'react';
import { safariCaptureService, CaptureState } from '../services/safari-capture';

export interface UseSafariCaptureOptions {
  audioOnly?: boolean;
  onStreamReady?: (stream: MediaStream) => void;
  onStreamEnded?: () => void;
  onError?: (error: Error) => void;
  autoRetry?: boolean;
  retryDelay?: number;
}

export interface UseSafariCaptureReturn {
  // State
  isCapturing: boolean;
  hasAudio: boolean;
  stream: MediaStream | null;
  error: Error | null;
  audioLevel: number;
  
  // Actions
  startCapture: () => Promise<void>;
  stopCapture: () => void;
  toggleCapture: () => Promise<void>;
  resetError: () => void;
  
  // Utilities
  isSupported: boolean;
  limitations: string[];
}

export const useSafariCapture = (options: UseSafariCaptureOptions = {}): UseSafariCaptureReturn => {
  const {
    audioOnly = true,
    onStreamReady,
    onStreamEnded,
    onError,
    autoRetry = false,
    retryDelay = 3000
  } = options;

  // State
  const [captureState, setCaptureState] = useState<CaptureState>(safariCaptureService.getState());
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [error, setError] = useState<Error | null>(null);
  
  // Refs
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const audioLevelIntervalRef = useRef<NodeJS.Timeout>();
  const isMountedRef = useRef<boolean>(true);

  // Check if Safari capture is supported
  const isSupported = safariCaptureService.constructor.isSupported();
  const limitations = safariCaptureService.constructor.getLimitations();

  // Start capture
  const startCapture = useCallback(async () => {
    try {
      setError(null);
      
      const stream = await safariCaptureService.startCapture({
        audioOnly,
        onStreamReady: (stream) => {
          if (isMountedRef.current) {
            setCaptureState(safariCaptureService.getState());
            onStreamReady?.(stream);
            
            // Start monitoring audio levels
            startAudioLevelMonitoring();
          }
        },
        onStreamEnded: () => {
          if (isMountedRef.current) {
            setCaptureState(safariCaptureService.getState());
            stopAudioLevelMonitoring();
            onStreamEnded?.();
            
            // Auto-retry if enabled and audio was lost
            if (autoRetry && !isMountedRef.current) {
              retryTimeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) {
                  startCapture();
                }
              }, retryDelay);
            }
          }
        },
        onError: (error) => {
          if (isMountedRef.current) {
            setError(error);
            setCaptureState(safariCaptureService.getState());
            onError?.(error);
          }
        }
      });
      
      if (isMountedRef.current) {
        setCaptureState(safariCaptureService.getState());
      }
      
    } catch (err) {
      const error = err as Error;
      console.error('[useSafariCapture] Failed to start capture:', error);
      
      if (isMountedRef.current) {
        setError(error);
        onError?.(error);
      }
      
      // Handle specific errors
      if (error.name === 'NotAllowedError') {
        setError(new Error('Screen capture permission denied. Please allow screen sharing and try again.'));
      } else if (error.name === 'NotFoundError') {
        setError(new Error('No audio source found. Please ensure audio is playing in the selected tab.'));
      } else if (error.name === 'NotReadableError') {
        setError(new Error('Could not access the selected screen or window. It may be restricted.'));
      }
    }
  }, [audioOnly, onStreamReady, onStreamEnded, onError, autoRetry, retryDelay]);

  // Stop capture
  const stopCapture = useCallback(() => {
    // Clear any pending retries
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = undefined;
    }
    
    // Stop monitoring
    stopAudioLevelMonitoring();
    
    // Stop the capture service
    safariCaptureService.stopCapture();
    
    if (isMountedRef.current) {
      setCaptureState(safariCaptureService.getState());
      setAudioLevel(0);
    }
  }, []);

  // Toggle capture
  const toggleCapture = useCallback(async () => {
    if (captureState.isCapturing) {
      stopCapture();
    } else {
      await startCapture();
    }
  }, [captureState.isCapturing, startCapture, stopCapture]);

  // Reset error
  const resetError = useCallback(() => {
    setError(null);
  }, []);

  // Start monitoring audio levels
  const startAudioLevelMonitoring = useCallback(() => {
    stopAudioLevelMonitoring();
    
    audioLevelIntervalRef.current = setInterval(() => {
      if (isMountedRef.current && safariCaptureService.hasAudio()) {
        const level = safariCaptureService.getAudioLevel();
        setAudioLevel(level);
      }
    }, 100); // Update every 100ms
  }, []);

  // Stop monitoring audio levels
  const stopAudioLevelMonitoring = useCallback(() => {
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = undefined;
    }
  }, []);

  // Update state when service state changes
  useEffect(() => {
    const updateState = () => {
      if (isMountedRef.current) {
        setCaptureState(safariCaptureService.getState());
      }
    };
    
    // Poll for state changes (Safari doesn't have all events we need)
    const stateInterval = setInterval(updateState, 500);
    
    return () => {
      clearInterval(stateInterval);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      // Clear timeouts
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      
      // Stop monitoring
      stopAudioLevelMonitoring();
      
      // Stop capture if active
      if (safariCaptureService.getState().isCapturing) {
        safariCaptureService.stopCapture();
      }
    };
  }, [stopAudioLevelMonitoring]);

  return {
    // State
    isCapturing: captureState.isCapturing,
    hasAudio: safariCaptureService.hasAudio(),
    stream: captureState.stream,
    error,
    audioLevel,
    
    // Actions
    startCapture,
    stopCapture,
    toggleCapture,
    resetError,
    
    // Utilities
    isSupported,
    limitations
  };
};