/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                    CAPTURE SERVICE INTEGRATION MODULE                      ║
 * ╠════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                            ║
 * ║  Central integration point for all capture services with feature flags.   ║
 * ║  Ensures consistent behavior across the application.                      ║
 * ║                                                                            ║
 * ║  KEY FEATURES:                                                            ║
 * ║  - Automatic fallback to microphone when browser capture disabled        ║
 * ║  - Graceful degradation without errors                                   ║
 * ║  - Runtime feature flag checking                                         ║
 * ║  - Unified API for all capture methods                                   ║
 * ║                                                                            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import { isFeatureEnabled, getFeatureFlags } from '../config/featureFlags';
import { captureService } from './featureFlaggedCapture';
import { BrowserCaptureService } from './browserCaptureService';

// ============================================================================
// CAPTURE INTEGRATION CLASS
// ============================================================================

/**
 * Integration layer that ensures all capture services respect feature flags
 */
class CaptureIntegration {
  private browserCaptureService: BrowserCaptureService | null = null;
  private initialized = false;
  
  /**
   * Initialize capture services based on feature flags
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    const flags = getFeatureFlags();
    
    // ========================================================================
    // FEATURE FLAG CHECK BLOCK
    // Comment out the next line to disable browser capture initialization
    // ========================================================================
    if (flags.ENABLE_BROWSER_CAPTURE) {
      console.log('[CaptureIntegration] Initializing browser capture services');
      this.browserCaptureService = new BrowserCaptureService();
    } else {
      console.log('[CaptureIntegration] Browser capture disabled - microphone only mode');
      this.browserCaptureService = null;
    }
    
    this.initialized = true;
  }
  
  /**
   * Get available audio sources
   */
  async getAudioSources(): Promise<any[]> {
    await this.initialize();
    
    // Check feature flag at runtime
    if (!isFeatureEnabled('ENABLE_BROWSER_CAPTURE')) {
      // Return only microphone source
      return [{
        id: 'microphone',
        label: 'Microphone',
        type: 'microphone',
        available: true,
      }];
    }
    
    // Get sources from feature-flagged service
    return captureService.getAvailableSources();
  }
  
  /**
   * Start audio capture with automatic fallback
   */
  async startCapture(source: string): Promise<MediaStream | null> {
    await this.initialize();
    
    // ========================================================================
    // BROWSER CAPTURE DISABLED CHECK
    // Always falls back to microphone when disabled
    // ========================================================================
    if (!isFeatureEnabled('ENABLE_BROWSER_CAPTURE')) {
      console.log('[CaptureIntegration] Browser capture disabled - using microphone');
      return this.captureMicrophone();
    }
    
    // Use feature-flagged capture service
    const result = await captureService.startCapture({
      source,
      quality: 'high',
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    });
    
    if (result.fallbackUsed) {
      console.log('[CaptureIntegration] Fell back to microphone capture');
    }
    
    return result.stream;
  }
  
  /**
   * Stop all capture
   */
  stopCapture(): void {
    captureService.stopCapture();
    
    if (this.browserCaptureService) {
      this.browserCaptureService.stopCapture();
    }
  }
  
  /**
   * Check if browser capture is available
   */
  isBrowserCaptureAvailable(): boolean {
    // Runtime check of feature flag
    return isFeatureEnabled('ENABLE_BROWSER_CAPTURE');
  }
  
  /**
   * Get capture capabilities
   */
  getCapabilities(): any {
    const flags = getFeatureFlags();
    
    return {
      browserCapture: flags.ENABLE_BROWSER_CAPTURE,
      chromeExtension: flags.ENABLE_CHROME_EXTENSION,
      safariCapture: flags.ENABLE_SAFARI_CAPTURE,
      firefoxCapture: flags.ENABLE_FIREFOX_CAPTURE,
      systemAudio: flags.ENABLE_SYSTEM_AUDIO,
      audioSourceSelector: flags.ENABLE_AUDIO_SOURCE_SELECTOR,
      autoFallback: flags.ENABLE_AUTO_SOURCE_FALLBACK,
    };
  }
  
  /**
   * Direct microphone capture (always available)
   */
  private async captureMicrophone(): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 16000,
        channelCount: 1,
      },
      video: false,
    };
    
    return await navigator.mediaDevices.getUserMedia(constraints);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const captureIntegration = new CaptureIntegration();

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Quick check if browser capture is enabled
 */
export function canCaptureBrowserAudio(): boolean {
  return captureIntegration.isBrowserCaptureAvailable();
}

/**
 * Get available capture sources
 */
export async function getCaptureSources() {
  return captureIntegration.getAudioSources();
}

/**
 * Start capture with automatic fallback
 */
export async function startAudioCapture(source: string = 'microphone'): Promise<MediaStream | null> {
  return captureIntegration.startCapture(source);
}

/**
 * Stop all capture
 */
export function stopAudioCapture(): void {
  captureIntegration.stopCapture();
}