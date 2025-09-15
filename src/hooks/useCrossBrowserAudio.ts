import { useState, useCallback, useEffect, useMemo } from 'react';
import { detectBrowser, BrowserInfo } from '../utils/browserDetection';
import { useSafariCapture } from './useSafariCapture';

export type CaptureMethod = 'safari-screen' | 'chrome-extension' | 'generic-screen' | 'unsupported';

export interface CrossBrowserAudioState {
  // Browser info
  browser: BrowserInfo;
  captureMethod: CaptureMethod;
  
  // Capture state
  isCapturing: boolean;
  hasAudio: boolean;
  stream: MediaStream | null;
  audioLevel: number;
  
  // Error handling
  error: Error | null;
  
  // Feature support
  isSupported: boolean;
  limitations: string[];
  instructions: string;
}

export interface UseCrossBrowserAudioOptions {
  onStreamReady?: (stream: MediaStream) => void;
  onStreamEnded?: () => void;
  onError?: (error: Error) => void;
  onAudioLevelChange?: (level: number) => void;
  preferredMethod?: CaptureMethod;
  audioOnly?: boolean;
}

export interface UseCrossBrowserAudioReturn extends CrossBrowserAudioState {
  // Actions
  startCapture: () => Promise<void>;
  stopCapture: () => void;
  toggleCapture: () => Promise<void>;
  resetError: () => void;
  
  // Chrome extension specific
  isExtensionInstalled: boolean;
  installExtension: () => void;
}

export const useCrossBrowserAudio = (options: UseCrossBrowserAudioOptions = {}): UseCrossBrowserAudioReturn => {
  const {
    onStreamReady,
    onStreamEnded,
    onError,
    onAudioLevelChange,
    preferredMethod,
    audioOnly = true
  } = options;

  // Detect browser
  const browser = useMemo(() => detectBrowser(), []);
  
  // Determine capture method based on browser
  const determineCaptureMethod = useCallback((): CaptureMethod => {
    // iOS is not supported
    if (browser.isIOS || browser.isMobile) {
      return 'unsupported';
    }

    // User preference takes priority if valid
    if (preferredMethod && preferredMethod !== 'unsupported') {
      return preferredMethod;
    }

    // Safari uses screen capture
    if (browser.name === 'safari') {
      return 'safari-screen';
    }

    // Chrome-based browsers use getDisplayMedia (расширение НЕ обязательно!)
    if (browser.supportsScreenCapture && (browser.name.includes('chrome') || browser.name.includes('edge'))) {
      return 'chrome-extension'; // Название оставляем для совместимости, но работает БЕЗ расширения
    }

    // Fallback to generic screen capture
    if (browser.supportsScreenCapture) {
      return 'generic-screen';
    }

    return 'unsupported';
  }, [browser, preferredMethod]);

  const [captureMethod] = useState<CaptureMethod>(determineCaptureMethod());
  
  // Safari capture hook (only used for Safari)
  const safariCapture = useSafariCapture({
    audioOnly,
    onStreamReady,
    onStreamEnded,
    onError
  });

  // State for non-Safari browsers
  const [genericState, setGenericState] = useState({
    isCapturing: false,
    hasAudio: false,
    stream: null as MediaStream | null,
    audioLevel: 0,
    error: null as Error | null
  });

  // Chrome extension state
  const [isExtensionInstalled, setIsExtensionInstalled] = useState(false);

  // Check for Chrome extension
  useEffect(() => {
    if (browser.supportsExtensions) {
      // Check if extension is installed by looking for injected element
      const checkExtension = () => {
        const extensionElement = document.getElementById('hrpro-audio-capture-extension');
        setIsExtensionInstalled(!!extensionElement);
      };
      
      checkExtension();
      
      // Re-check periodically in case extension is installed later
      const interval = setInterval(checkExtension, 2000);
      
      return () => clearInterval(interval);
    }
  }, [browser.supportsExtensions]);

  // Generic screen capture for non-Safari browsers
  const startGenericCapture = useCallback(async () => {
    try {
      setGenericState(prev => ({ ...prev, error: null }));

      // ВАЖНО: getDisplayMedia ТРЕБУЕТ video: true для работы
      // Даже если нужно только аудио
      const constraints: DisplayMediaStreamOptions = {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          suppressLocalAudioPlayback: false  // Продолжать воспроизведение звука
        } as MediaTrackConstraints,
        video: {
          displaySurface: 'browser' as DisplayCaptureSurfaceType
        }
      };

      // Добавляем Chrome-специфичные опции
      if (browser.name.includes('chrome') || browser.name.includes('edge')) {
        // @ts-ignore - эти опции специфичны для Chrome
        constraints.systemAudio = 'include';
        constraints.preferCurrentTab = false;
      }

      console.log('[CrossBrowserAudio] Starting capture with constraints:', constraints);
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);

      // Check for audio track
      const audioTracks = stream.getAudioTracks();
      const hasAudio = audioTracks.length > 0;

      if (!hasAudio) {
        console.warn('[CrossBrowserAudio] No audio track captured. User may not have selected "Share tab audio" option.');
      } else {
        console.log('[CrossBrowserAudio] Audio track captured:', audioTracks[0].label);
      }

      // Если нужно только аудио, останавливаем видео трек
      if (audioOnly) {
        const videoTracks = stream.getVideoTracks();
        videoTracks.forEach(track => {
          console.log('[CrossBrowserAudio] Stopping video track:', track.label);
          track.stop();
          stream.removeTrack(track);
        });
      }

      setGenericState(prev => ({
        ...prev,
        isCapturing: true,
        hasAudio,
        stream
      }));

      // Set up track ended handler
      stream.getTracks().forEach(track => {
        track.addEventListener('ended', () => {
          setGenericState(prev => ({
            ...prev,
            isCapturing: false,
            hasAudio: false,
            stream: null,
            audioLevel: 0
          }));
          onStreamEnded?.();
        });
      });

      onStreamReady?.(stream);

    } catch (error) {
      const err = error as Error;
      console.error('[CrossBrowserAudio] Capture failed:', err);
      setGenericState(prev => ({
        ...prev,
        error: err
      }));
      onError?.(err);
    }
  }, [audioOnly, browser, onStreamReady, onStreamEnded, onError]);

  // Chrome extension capture OR fallback to getDisplayMedia
  const startExtensionCapture = useCallback(async () => {
    // Если расширение установлено, пытаемся использовать его
    if (isExtensionInstalled) {
      try {
        // Send message to extension
        window.postMessage({
          type: 'HRPRO_START_CAPTURE',
          audioOnly
        }, '*');

        // Listen for response
        const handleMessage = (event: MessageEvent) => {
          if (event.data.type === 'HRPRO_CAPTURE_STARTED' && event.data.stream) {
            setGenericState(prev => ({
              ...prev,
              isCapturing: true,
              hasAudio: true,
              stream: event.data.stream
            }));
            onStreamReady?.(event.data.stream);
          } else if (event.data.type === 'HRPRO_CAPTURE_ERROR') {
            const error = new Error(event.data.error);
            setGenericState(prev => ({ ...prev, error }));
            onError?.(error);
          }
        };

        window.addEventListener('message', handleMessage);

        // Cleanup
        return () => window.removeEventListener('message', handleMessage);
      } catch (error) {
        console.error('[CrossBrowserAudio] Extension capture failed, falling back to getDisplayMedia');
      }
    }

    // Используем getDisplayMedia как основной метод (работает БЕЗ расширения!)
    console.log('[CrossBrowserAudio] Using getDisplayMedia for Chrome tab capture (no extension required)');
    await startGenericCapture();
  }, [isExtensionInstalled, audioOnly, onStreamReady, onError, startGenericCapture]);

  // Unified start capture
  const startCapture = useCallback(async () => {
    switch (captureMethod) {
      case 'safari-screen':
        await safariCapture.startCapture();
        break;
      
      case 'chrome-extension':
        await startExtensionCapture();
        break;
      
      case 'generic-screen':
        await startGenericCapture();
        break;
      
      case 'unsupported':
        const error = new Error('Audio capture is not supported on this device/browser');
        setGenericState(prev => ({ ...prev, error }));
        onError?.(error);
        break;
    }
  }, [captureMethod, safariCapture, startExtensionCapture, startGenericCapture, onError]);

  // Unified stop capture
  const stopCapture = useCallback(() => {
    switch (captureMethod) {
      case 'safari-screen':
        safariCapture.stopCapture();
        break;
      
      case 'chrome-extension':
        window.postMessage({ type: 'HRPRO_STOP_CAPTURE' }, '*');
        setGenericState(prev => ({
          ...prev,
          isCapturing: false,
          hasAudio: false,
          stream: null,
          audioLevel: 0
        }));
        break;
      
      case 'generic-screen':
        if (genericState.stream) {
          genericState.stream.getTracks().forEach(track => track.stop());
        }
        setGenericState(prev => ({
          ...prev,
          isCapturing: false,
          hasAudio: false,
          stream: null,
          audioLevel: 0
        }));
        break;
    }
  }, [captureMethod, safariCapture, genericState.stream]);

  // Toggle capture
  const toggleCapture = useCallback(async () => {
    const isCapturing = captureMethod === 'safari-screen' 
      ? safariCapture.isCapturing 
      : genericState.isCapturing;
    
    if (isCapturing) {
      stopCapture();
    } else {
      await startCapture();
    }
  }, [captureMethod, safariCapture.isCapturing, genericState.isCapturing, startCapture, stopCapture]);

  // Reset error
  const resetError = useCallback(() => {
    if (captureMethod === 'safari-screen') {
      safariCapture.resetError();
    } else {
      setGenericState(prev => ({ ...prev, error: null }));
    }
  }, [captureMethod, safariCapture]);

  // Install extension
  const installExtension = useCallback(() => {
    // Open Chrome Web Store page for the extension
    window.open('https://chrome.google.com/webstore/detail/hrpro-audio-capture/[EXTENSION_ID]', '_blank');
  }, []);

  // Get limitations based on capture method
  const getLimitations = useCallback((): string[] => {
    switch (captureMethod) {
      case 'safari-screen':
        return safariCapture.limitations;
      
      case 'chrome-extension':
        return [
          'Chrome extension is optional for enhanced features',
          'Works in Chrome, Edge, and Opera WITHOUT extension',
          'Select browser tab and enable "Share tab audio" option'
        ];
      
      case 'generic-screen':
        return [
          'Requires selecting the correct window/tab',
          'May not capture all audio sources',
          'Audio quality depends on browser implementation'
        ];
      
      case 'unsupported':
        return ['Audio capture is not supported on this platform'];
      
      default:
        return [];
    }
  }, [captureMethod, safariCapture.limitations]);

  // Get instructions based on capture method
  const getInstructions = useCallback((): string => {
    switch (captureMethod) {
      case 'safari-screen':
        return 'Select the window/tab with your video call and ensure "Share Audio" is checked.';
      
      case 'chrome-extension':
        if (!isExtensionInstalled) {
          return 'Click Start Capture, select the browser tab with your meeting, and CHECK "Share tab audio" option.';
        }
        return 'Click Start Capture to begin recording audio from the current tab.';
      
      case 'generic-screen':
        return 'Select the browser tab with your video call and check "Share tab audio" if available.';
      
      case 'unsupported':
        return 'Please use a desktop browser (Chrome, Safari, Edge, or Firefox) to capture audio.';
      
      default:
        return '';
    }
  }, [captureMethod, isExtensionInstalled]);

  // Monitor audio levels
  useEffect(() => {
    if (captureMethod === 'safari-screen') {
      // Safari hook handles its own audio level monitoring
      if (onAudioLevelChange && safariCapture.audioLevel > 0) {
        onAudioLevelChange(safariCapture.audioLevel);
      }
    } else if (genericState.stream && genericState.hasAudio) {
      // Monitor audio levels for generic capture
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(genericState.stream);
      
      source.connect(analyser);
      analyser.fftSize = 256;
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const level = average / 255;
        
        setGenericState(prev => ({ ...prev, audioLevel: level }));
        onAudioLevelChange?.(level);
      };
      
      const interval = setInterval(updateLevel, 100);
      
      return () => {
        clearInterval(interval);
        source.disconnect();
        audioContext.close();
      };
    }
  }, [captureMethod, safariCapture.audioLevel, genericState.stream, genericState.hasAudio, onAudioLevelChange]);

  // Determine current state based on capture method
  const currentState = captureMethod === 'safari-screen' ? {
    isCapturing: safariCapture.isCapturing,
    hasAudio: safariCapture.hasAudio,
    stream: safariCapture.stream,
    audioLevel: safariCapture.audioLevel,
    error: safariCapture.error,
    isSupported: safariCapture.isSupported
  } : {
    isCapturing: genericState.isCapturing,
    hasAudio: genericState.hasAudio,
    stream: genericState.stream,
    audioLevel: genericState.audioLevel,
    error: genericState.error,
    isSupported: captureMethod !== 'unsupported'
  };

  return {
    // Browser info
    browser,
    captureMethod,
    
    // Capture state
    ...currentState,
    
    // Feature support
    limitations: getLimitations(),
    instructions: getInstructions(),
    
    // Actions
    startCapture,
    stopCapture,
    toggleCapture,
    resetError,
    
    // Chrome extension specific
    isExtensionInstalled,
    installExtension
  };
};