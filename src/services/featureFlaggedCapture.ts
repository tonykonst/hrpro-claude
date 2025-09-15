/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                   FEATURE-FLAGGED CAPTURE SERVICE                         ║
 * ╠════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                            ║
 * ║  Wrapper service that respects feature flags for audio capture.          ║
 * ║  Provides graceful degradation when features are disabled.               ║
 * ║                                                                            ║
 * ║  IMPORTANT: This service will automatically fall back to microphone       ║
 * ║  when browser capture is disabled, ensuring the app never breaks.        ║
 * ║                                                                            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import { isFeatureEnabled, getAvailableCaptureMethods } from '../config/featureFlags';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface AudioSource {
  id: string;
  label: string;
  type: 'microphone' | 'browser-tab' | 'screen-with-audio' | 'system';
  available: boolean;
  requiresExtension?: boolean;
  browserSpecific?: string[];
}

export interface CaptureOptions {
  source: string;
  quality?: 'low' | 'medium' | 'high';
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface CaptureResult {
  stream: MediaStream | null;
  source: string;
  error?: Error;
  fallbackUsed?: boolean;
}

// ============================================================================
// FEATURE-FLAGGED CAPTURE SERVICE
// ============================================================================

class FeatureFlaggedCaptureService {
  private currentStream: MediaStream | null = null;
  private currentSource: string = 'microphone';
  
  /**
   * Get available audio sources based on feature flags
   */
  getAvailableSources(): AudioSource[] {
    const sources: AudioSource[] = [];
    
    // Microphone is always available
    sources.push({
      id: 'microphone',
      label: 'Microphone',
      type: 'microphone',
      available: true,
    });
    
    // Check if browser capture is enabled
    if (!isFeatureEnabled('ENABLE_BROWSER_CAPTURE')) {
      console.log('[FeatureFlaggedCapture] Browser capture disabled by feature flag');
      return sources;
    }
    
    // Check browser-specific features
    const userAgent = navigator.userAgent.toLowerCase();
    const isChrome = userAgent.includes('chrome') || userAgent.includes('edg');
    const isSafari = userAgent.includes('safari') && !userAgent.includes('chrome');
    const isFirefox = userAgent.includes('firefox');
    
    // Chrome/Edge tab capture
    if (isChrome && isFeatureEnabled('ENABLE_CHROME_EXTENSION')) {
      sources.push({
        id: 'browser-tab',
        label: 'Browser Tab Audio',
        type: 'browser-tab',
        available: true,
        requiresExtension: true,
        browserSpecific: ['chrome', 'edge'],
      });
    }
    
    // Safari screen capture with audio
    if (isSafari && isFeatureEnabled('ENABLE_SAFARI_CAPTURE')) {
      sources.push({
        id: 'screen-with-audio',
        label: 'Screen with Audio',
        type: 'screen-with-audio',
        available: true,
        browserSpecific: ['safari'],
      });
    }
    
    // Firefox screen capture
    if (isFirefox && isFeatureEnabled('ENABLE_FIREFOX_CAPTURE')) {
      sources.push({
        id: 'screen-with-audio',
        label: 'Screen with Audio',
        type: 'screen-with-audio',
        available: true,
        browserSpecific: ['firefox'],
      });
    }
    
    // Future: System audio (Phase 2)
    if (isFeatureEnabled('ENABLE_SYSTEM_AUDIO')) {
      sources.push({
        id: 'system',
        label: 'System Audio (Coming Soon)',
        type: 'system',
        available: false,
      });
    }
    
    return sources;
  }
  
  /**
   * Start audio capture with feature flag checks
   */
  async startCapture(options: CaptureOptions): Promise<CaptureResult> {
    try {
      // Stop any existing capture
      this.stopCapture();
      
      // Check if requested source is available
      const availableSources = this.getAvailableSources();
      const requestedSource = availableSources.find(s => s.id === options.source);
      
      if (!requestedSource || !requestedSource.available) {
        console.warn(`[FeatureFlaggedCapture] Source "${options.source}" not available, falling back to microphone`);
        return this.fallbackToMicrophone(options);
      }
      
      // Try to capture based on source type
      let stream: MediaStream | null = null;
      
      switch (requestedSource.type) {
        case 'microphone':
          stream = await this.captureMicrophone(options);
          break;
          
        case 'browser-tab':
          if (isFeatureEnabled('ENABLE_CHROME_EXTENSION')) {
            stream = await this.captureBrowserTab(options);
          }
          break;
          
        case 'screen-with-audio':
          if (isFeatureEnabled('ENABLE_SAFARI_CAPTURE') || isFeatureEnabled('ENABLE_FIREFOX_CAPTURE')) {
            stream = await this.captureScreenWithAudio(options);
          }
          break;
          
        case 'system':
          // Not yet implemented
          console.warn('[FeatureFlaggedCapture] System audio not yet implemented');
          break;
      }
      
      if (!stream) {
        // Fall back to microphone if capture failed
        if (isFeatureEnabled('ENABLE_AUTO_SOURCE_FALLBACK')) {
          console.log('[FeatureFlaggedCapture] Auto-fallback to microphone');
          return this.fallbackToMicrophone(options);
        } else {
          throw new Error(`Failed to capture from ${options.source}`);
        }
      }
      
      this.currentStream = stream;
      this.currentSource = options.source;
      
      return {
        stream,
        source: options.source,
      };
      
    } catch (error) {
      console.error('[FeatureFlaggedCapture] Capture error:', error);
      
      // Try fallback if enabled
      if (isFeatureEnabled('ENABLE_AUTO_SOURCE_FALLBACK')) {
        return this.fallbackToMicrophone(options);
      }
      
      return {
        stream: null,
        source: options.source,
        error: error as Error,
      };
    }
  }
  
  /**
   * Stop current capture
   */
  stopCapture(): void {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
      this.currentStream = null;
    }
    this.currentSource = 'microphone';
  }
  
  /**
   * Get current capture state
   */
  getCaptureState(): {
    isCapturing: boolean;
    source: string;
    hasAudio: boolean;
  } {
    return {
      isCapturing: this.currentStream !== null,
      source: this.currentSource,
      hasAudio: this.currentStream?.getAudioTracks().length > 0,
    };
  }
  
  // ============================================================================
  // PRIVATE CAPTURE METHODS
  // ============================================================================
  
  /**
   * Capture from microphone
   */
  private async captureMicrophone(options: CaptureOptions): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: options.echoCancellation ?? false,
        noiseSuppression: options.noiseSuppression ?? false,
        autoGainControl: options.autoGainControl ?? false,
        sampleRate: this.getQualitySampleRate(options.quality),
        channelCount: 1,
      },
      video: false,
    };
    
    return await navigator.mediaDevices.getUserMedia(constraints);
  }
  
  /**
   * Capture browser tab audio (Chrome/Edge with extension)
   */
  private async captureBrowserTab(options: CaptureOptions): Promise<MediaStream | null> {
    // This would integrate with the Chrome extension
    // For now, return null to trigger fallback
    console.log('[FeatureFlaggedCapture] Browser tab capture requires extension');
    
    // Check if extension is installed
    if (!this.isExtensionInstalled()) {
      if (isFeatureEnabled('ENABLE_PERMISSION_PROMPTS')) {
        this.showExtensionPrompt();
      }
      return null;
    }
    
    // TODO: Implement actual extension communication
    return null;
  }
  
  /**
   * Capture screen with audio
   */
  private async captureScreenWithAudio(options: CaptureOptions): Promise<MediaStream | null> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: this.getQualitySampleRate(options.quality),
        } as MediaTrackConstraints,
        video: true,
      } as DisplayMediaStreamOptions);
      
      // Check if audio track is present
      if (stream.getAudioTracks().length === 0) {
        console.warn('[FeatureFlaggedCapture] No audio track in screen capture');
        stream.getTracks().forEach(track => track.stop());
        return null;
      }
      
      // Optionally stop video track if we only need audio
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
      }
      
      return stream;
    } catch (error) {
      console.error('[FeatureFlaggedCapture] Screen capture error:', error);
      return null;
    }
  }
  
  /**
   * Fall back to microphone capture
   */
  private async fallbackToMicrophone(options: CaptureOptions): Promise<CaptureResult> {
    try {
      const stream = await this.captureMicrophone({
        ...options,
        source: 'microphone',
      });
      
      this.currentStream = stream;
      this.currentSource = 'microphone';
      
      return {
        stream,
        source: 'microphone',
        fallbackUsed: true,
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
   * Get sample rate based on quality setting
   */
  private getQualitySampleRate(quality?: 'low' | 'medium' | 'high'): number {
    const rates = {
      low: 8000,
      medium: 16000,
      high: 48000,
    };
    return rates[quality || 'medium'];
  }
  
  /**
   * Check if Chrome extension is installed
   */
  private isExtensionInstalled(): boolean {
    // This would check for the extension
    // For now, return false
    return false;
  }
  
  /**
   * Show extension installation prompt
   */
  private showExtensionPrompt(): void {
    // This would show a UI prompt to install the extension
    console.log('[FeatureFlaggedCapture] Extension required for tab capture');
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const captureService = new FeatureFlaggedCaptureService();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Check if browser capture is available
 */
export function isBrowserCaptureAvailable(): boolean {
  if (!isFeatureEnabled('ENABLE_BROWSER_CAPTURE')) {
    return false;
  }
  
  const methods = getAvailableCaptureMethods();
  return methods.some(m => m !== 'microphone');
}

/**
 * Get recommended audio source for current browser
 */
export function getRecommendedSource(): string {
  const sources = captureService.getAvailableSources();
  
  // Prefer browser-specific sources over microphone
  const browserSource = sources.find(s => 
    s.type !== 'microphone' && 
    s.type !== 'system' && 
    s.available
  );
  
  return browserSource?.id || 'microphone';
}

/**
 * Check if a specific capture method is supported
 */
export function isCaptureMethodSupported(method: string): boolean {
  const sources = captureService.getAvailableSources();
  return sources.some(s => s.id === method && s.available);
}