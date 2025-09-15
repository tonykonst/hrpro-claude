/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                    BROWSER CAPTURE SERVICE WITH FEATURE FLAGS             ║
 * ╠════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                            ║
 * ║  Centralized browser audio capture service with feature flag control.     ║
 * ║                                                                            ║
 * ║  TO DISABLE BROWSER CAPTURE:                                              ║
 * ║  ----------------------------                                             ║
 * ║  Option 1: Set REACT_APP_ENABLE_BROWSER_CAPTURE=false in .env            ║
 * ║  Option 2: Comment out ENABLE_BROWSER_CAPTURE in featureFlags.ts         ║
 * ║  Option 3: Use feature flag UI controls in development                    ║
 * ║                                                                            ║
 * ║  When disabled, all methods gracefully fall back to microphone input.     ║
 * ║                                                                            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import { 
  getFeatureFlags, 
  isFeatureEnabled,
  getAvailableCaptureMethods 
} from '../config/featureFlags';
import { SafariCaptureService } from './safari-capture';
import { detectBrowser } from '../utils/browserDetection';

// ============================================================================
// SERVICE TYPES
// ============================================================================

export type AudioSource = 
  | 'microphone' 
  | 'browser-tab' 
  | 'screen-with-audio' 
  | 'system-audio';

export interface CaptureCapabilities {
  canCaptureBrowserAudio: boolean;
  canCaptureSystemAudio: boolean;
  canCaptureTab: boolean;
  canCaptureScreen: boolean;
  availableSources: AudioSource[];
  limitations: string[];
  requiresExtension: boolean;
  extensionInstalled: boolean;
}

export interface CaptureResult {
  stream: MediaStream | null;
  source: AudioSource;
  error?: Error;
  fallbackUsed?: boolean;
}

// ============================================================================
// BROWSER CAPTURE SERVICE CLASS
// ============================================================================

/**
 * Main browser capture service with feature flag integration
 */
export class BrowserCaptureService {
  private safariService: SafariCaptureService | null = null;
  private currentStream: MediaStream | null = null;
  private currentSource: AudioSource = 'microphone';
  private isCapturing: boolean = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize service based on feature flags
   */
  private initialize(): void {
    const flags = getFeatureFlags();
    
    // ========================================================================
    // MASTER FEATURE FLAG CHECK
    // If ENABLE_BROWSER_CAPTURE is false, service operates in fallback mode
    // ========================================================================
    if (!flags.ENABLE_BROWSER_CAPTURE) {
      console.log('[BrowserCapture] Service disabled via feature flag - microphone only mode');
      return;
    }

    // Initialize browser-specific services based on flags
    const browser = detectBrowser();
    
    if (flags.ENABLE_SAFARI_CAPTURE && browser.name.includes('safari')) {
      this.safariService = new SafariCaptureService();
      console.log('[BrowserCapture] Safari capture service initialized');
    }
    
    // Future: Initialize Chrome extension service
    // if (flags.ENABLE_CHROME_EXTENSION && browser.name.includes('chrome')) {
    //   this.chromeService = new ChromeCaptureService();
    // }
  }

  /**
   * Get current capture capabilities based on browser and feature flags
   */
  public getCapabilities(): CaptureCapabilities {
    const flags = getFeatureFlags();
    const browser = detectBrowser();
    
    // ========================================================================
    // FALLBACK MODE - When browser capture is disabled
    // ========================================================================
    if (!flags.ENABLE_BROWSER_CAPTURE) {
      return {
        canCaptureBrowserAudio: false,
        canCaptureSystemAudio: false,
        canCaptureTab: false,
        canCaptureScreen: false,
        availableSources: ['microphone'],
        limitations: ['Browser audio capture is disabled'],
        requiresExtension: false,
        extensionInstalled: false,
      };
    }

    const capabilities: CaptureCapabilities = {
      canCaptureBrowserAudio: false,
      canCaptureSystemAudio: false,
      canCaptureTab: false,
      canCaptureScreen: false,
      availableSources: ['microphone'],
      limitations: [],
      requiresExtension: false,
      extensionInstalled: false,
    };

    // Check Safari capabilities
    if (flags.ENABLE_SAFARI_CAPTURE && browser.name.includes('safari')) {
      capabilities.canCaptureScreen = true;
      capabilities.canCaptureBrowserAudio = true;
      capabilities.availableSources.push('screen-with-audio');
      capabilities.limitations.push('Requires screen sharing to capture audio');
    }

    // Check Chrome/Edge capabilities (tab capture works without extension)
    if (browser.name.includes('chrome') || browser.name.includes('edge') || browser.name.includes('opera')) {
      capabilities.canCaptureTab = true;
      capabilities.canCaptureBrowserAudio = true;
      capabilities.canCaptureScreen = true;
      capabilities.availableSources.push('browser-tab');
      capabilities.availableSources.push('screen-with-audio');

      // Extension support remains optional for advanced automation
      if (flags.ENABLE_CHROME_EXTENSION) {
        capabilities.extensionInstalled = this.checkChromeExtension();
      }
    }

    // Check Firefox capabilities
    if (flags.ENABLE_FIREFOX_CAPTURE && browser.name.includes('firefox')) {
      capabilities.canCaptureScreen = true;
      capabilities.availableSources.push('screen-with-audio');
      capabilities.limitations.push('Limited audio capture support');
    }

    // Future: System audio (Phase 2)
    if (flags.ENABLE_SYSTEM_AUDIO) {
      // Will be implemented in Phase 2
      capabilities.limitations.push('System audio capture coming in Phase 2');
    }

    return capabilities;
  }

  /**
   * Start audio capture with automatic source selection
   */
  public async startCapture(
    preferredSource?: AudioSource,
    options: any = {}
  ): Promise<CaptureResult> {
    const flags = getFeatureFlags();
    
    // ========================================================================
    // GRACEFUL DEGRADATION - Fall back to microphone if disabled
    // ========================================================================
    if (!flags.ENABLE_BROWSER_CAPTURE) {
      console.log('[BrowserCapture] Falling back to microphone (feature disabled)');
      return this.captureMicrophone();
    }

    // Stop any existing capture
    await this.stopCapture();

    const source = preferredSource || this.currentSource;
    let result: CaptureResult;

    try {
      switch (source) {
        case 'browser-tab':
          result = await this.captureBrowserTab();
          break;
          
        case 'screen-with-audio':
          result = await this.captureScreenWithAudio();
          break;
          
        case 'system-audio':
          // Phase 2 feature
          throw new Error('System audio capture not yet implemented');
          
        case 'microphone':
        default:
          result = await this.captureMicrophone();
          break;
      }

      // Auto-fallback if enabled and primary source failed
      if (!result.stream && flags.ENABLE_AUTO_SOURCE_FALLBACK) {
        console.log('[BrowserCapture] Primary source failed, trying fallback...');
        result = await this.captureMicrophone();
        result.fallbackUsed = true;
      }

      if (result.stream) {
        this.currentStream = result.stream;
        this.currentSource = result.source;
        this.isCapturing = true;
      }

      return result;
    } catch (error) {
      console.error('[BrowserCapture] Capture failed:', error);
      
      // Try fallback if enabled
      if (flags.ENABLE_AUTO_SOURCE_FALLBACK) {
        console.log('[BrowserCapture] Attempting fallback to microphone...');
        const fallbackResult = await this.captureMicrophone();
        fallbackResult.fallbackUsed = true;
        return fallbackResult;
      }
      
      return {
        stream: null,
        source,
        error: error as Error,
      };
    }
  }

  /**
   * Capture browser tab audio (Chrome with extension OR fallback to getDisplayMedia)
   */
  private async captureBrowserTab(): Promise<CaptureResult> {
    const flags = getFeatureFlags();
    const browser = detectBrowser();

    // Проверяем поддержку расширения
    if (flags.ENABLE_CHROME_EXTENSION && this.checkChromeExtension()) {
      // TODO: Implement actual Chrome extension communication
      console.log('[BrowserCapture] Chrome extension detected, but integration pending');
    }

    // Используем getDisplayMedia как основной метод (работает без расширения!)
    console.log('[BrowserCapture] Using getDisplayMedia for tab audio capture');

    try {
      // Для захвата табового аудио используем те же настройки
      const displayMediaOptions: DisplayMediaStreamOptions = {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          suppressLocalAudioPlayback: false
        } as MediaTrackConstraints,
        video: {
          displaySurface: 'browser' as DisplayCaptureSurfaceType
        }
      };

      // Chrome-специфичные опции
      if (browser.name.includes('chrome') || browser.name.includes('edge')) {
        // @ts-ignore
        displayMediaOptions.systemAudio = 'exclude'; // Исключаем системное аудио для табов
        displayMediaOptions.preferCurrentTab = true; // Предпочитаем текущую вкладку
      }

      const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

      // Проверяем аудио
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio captured. Please select a browser tab and enable "Share tab audio".');
      }

      // Удаляем видео если не нужно
      if (!flags.ENABLE_CROSS_BROWSER_UI) {
        stream.getVideoTracks().forEach(track => {
          track.stop();
          stream.removeTrack(track);
        });
      }

      return {
        stream,
        source: 'browser-tab',
      };
    } catch (error) {
      console.error('[BrowserCapture] Tab capture failed:', error);
      throw error;
    }
  }

  /**
   * Capture screen with audio
   */
  private async captureScreenWithAudio(): Promise<CaptureResult> {
    const browser = detectBrowser();
    const flags = getFeatureFlags();

    // Use Safari-specific service if available
    if (browser.name.includes('safari') && this.safariService && flags.ENABLE_SAFARI_CAPTURE) {
      try {
        const stream = await this.safariService.startCapture({
          audioOnly: true,
        });

        return {
          stream,
          source: 'screen-with-audio',
        };
      } catch (error) {
        throw error;
      }
    }

    // Generic screen capture for Chrome/Firefox
    try {
      // ВАЖНО: getDisplayMedia ТРЕБУЕТ video: true для работы
      // Даже если нужно только аудио, video должно быть true
      const displayMediaOptions: DisplayMediaStreamOptions = {
        audio: {
          // Отключаем обработку для чистого захвата
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          // Продолжать воспроизведение звука для пользователя
          suppressLocalAudioPlayback: false
        } as MediaTrackConstraints,
        video: {
          // Предпочитаем захват браузерной вкладки
          displaySurface: 'browser' as DisplayCaptureSurfaceType,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      // Добавляем дополнительные опции для Chrome
      if (browser.name.includes('chrome') || browser.name.includes('edge')) {
        // @ts-ignore - эти опции специфичны для Chrome
        displayMediaOptions.systemAudio = 'include';
        displayMediaOptions.preferCurrentTab = false;
      }

      console.log('[BrowserCapture] Starting screen capture with audio...', displayMediaOptions);
      const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

      // Проверяем наличие аудио трека
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        console.warn('[BrowserCapture] No audio track captured. User may not have selected "Share tab audio" option.');
      } else {
        console.log('[BrowserCapture] Audio track captured successfully:', audioTracks[0].label);
      }

      // Если не нужен UI, удаляем видео трек после захвата
      if (!flags.ENABLE_CROSS_BROWSER_UI) {
        const videoTracks = stream.getVideoTracks();
        videoTracks.forEach(track => {
          console.log('[BrowserCapture] Stopping video track:', track.label);
          track.stop();
          stream.removeTrack(track);
        });
      }

      return {
        stream,
        source: 'screen-with-audio',
      };
    } catch (error) {
      console.error('[BrowserCapture] Screen capture failed:', error);
      throw error;
    }
  }

  /**
   * Capture microphone (fallback)
   */
  private async captureMicrophone(): Promise<CaptureResult> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      return {
        stream,
        source: 'microphone',
      };
    } catch (error) {
      return {
        stream: null,
        source: 'microphone',
        error: error as Error,
      };
    }
  }

  /**
   * Stop current capture
   */
  public async stopCapture(): Promise<void> {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
      this.currentStream = null;
    }

    if (this.safariService) {
      await this.safariService.stopCapture();
    }

    this.isCapturing = false;
    this.currentSource = 'microphone';
  }

  /**
   * Check if Chrome extension is installed
   */
  private checkChromeExtension(): boolean {
    // TODO: Implement actual extension check
    // This would involve sending a message to the extension
    // and checking for a response
    
    // For now, return false (not installed)
    return false;
  }

  /**
   * Get current capture status
   */
  public getStatus(): {
    isCapturing: boolean;
    currentSource: AudioSource;
    stream: MediaStream | null;
  } {
    return {
      isCapturing: this.isCapturing,
      currentSource: this.currentSource,
      stream: this.currentStream,
    };
  }

  /**
   * Switch audio source while capturing
   */
  public async switchSource(newSource: AudioSource): Promise<CaptureResult> {
    const flags = getFeatureFlags();
    
    if (!flags.ENABLE_BROWSER_CAPTURE && newSource !== 'microphone') {
      console.log('[BrowserCapture] Cannot switch to browser source (feature disabled)');
      return {
        stream: this.currentStream,
        source: this.currentSource,
        error: new Error('Browser capture is disabled'),
      };
    }

    // Restart capture with new source
    return this.startCapture(newSource);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let serviceInstance: BrowserCaptureService | null = null;

/**
 * Get singleton instance of browser capture service
 */
export function getBrowserCaptureService(): BrowserCaptureService {
  if (!serviceInstance) {
    serviceInstance = new BrowserCaptureService();
  }
  return serviceInstance;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick check if browser capture is available
 */
export function isBrowserCaptureAvailable(): boolean {
  const service = getBrowserCaptureService();
  const capabilities = service.getCapabilities();
  return capabilities.canCaptureBrowserAudio;
}

/**
 * Get available audio sources for current browser
 */
export function getAvailableAudioSources(): AudioSource[] {
  const service = getBrowserCaptureService();
  const capabilities = service.getCapabilities();
  return capabilities.availableSources;
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  BrowserCaptureService,
  getBrowserCaptureService,
  isBrowserCaptureAvailable,
  getAvailableAudioSources,
};