/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                    CAPTURE SERVICE INTEGRATION MODULE                      ║
 * ╠════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                            ║
 * ║  Integration layer that proxies audio capture through the browser         ║
 * ║  capture service. Feature flags are handled internally by the             ║
 * ║  BrowserCaptureService itself.                                           ║
 * ║                                                                            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import { getBrowserCaptureService, type AudioSource } from './browserCaptureService';

// =============================================================================
// CAPTURE INTEGRATION CLASS
// =============================================================================

class CaptureIntegration {
  private service = getBrowserCaptureService();

  /**
   * Get available audio sources for the current browser
   */
  async getAudioSources(): Promise<AudioSource[]> {
    const capabilities = this.service.getCapabilities();
    return capabilities.availableSources;
  }

  /**
   * Start audio capture. BrowserCaptureService will handle any required
   * fallbacks when features are disabled.
   */
  async startCapture(source: AudioSource = 'microphone'): Promise<MediaStream | null> {
    const result = await this.service.startCapture(source);
    return result.stream;
  }

  /**
   * Stop any ongoing capture
   */
  stopCapture(): void {
    this.service.stopCapture();
  }

  /**
   * Check if browser-level capture is available
   */
  isBrowserCaptureAvailable(): boolean {
    const capabilities = this.service.getCapabilities();
    return capabilities.canCaptureBrowserAudio;
  }

  /**
   * Get detailed capture capabilities
   */
  getCapabilities() {
    return this.service.getCapabilities();
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const captureIntegration = new CaptureIntegration();

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

/**
 * Quick check if browser capture is available
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
 * Start capture using the specified source
 */
export async function startAudioCapture(
  source: AudioSource = 'microphone'
): Promise<MediaStream | null> {
  return captureIntegration.startCapture(source);
}

/**
 * Stop all capture
 */
export function stopAudioCapture(): void {
  captureIntegration.stopCapture();
}
