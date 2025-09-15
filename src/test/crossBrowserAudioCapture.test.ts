/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                    CROSS-BROWSER AUDIO CAPTURE TEST SUITE                  ║
 * ╠════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                            ║
 * ║  Comprehensive testing for browser detection, feature flags,               ║
 * ║  audio capture methods, format handling, and integration.                 ║
 * ║                                                                            ║
 * ║  Test Categories:                                                          ║
 * ║  - Browser Detection & Capabilities                                       ║
 * ║  - Feature Flag System                                                    ║
 * ║  - Cross-Browser Capture Methods                                          ║
 * ║  - Audio Format Compatibility                                             ║
 * ║  - Error Handling & Fallbacks                                             ║
 * ║  - Performance & Resource Usage                                           ║
 * ║  - Integration Testing                                                    ║
 * ║                                                                            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { detectBrowser, supportsAudioCapture, getCaptureInstructions } from '../utils/browserDetection';
import { getFeatureFlags, setFeatureFlag, resetFeatureFlags, isFeatureEnabled } from '../config/featureFlags';
import { audioFormatHandler } from '../services/audio-format-handler';
import { BrowserCaptureService } from '../services/browserCaptureService';
import { setupMediaDevicesMocks, createMockMediaStream } from './mocks/mediaDevices';

// Setup media devices mocks
let mockMediaDevices: any;
let mockMediaRecorder: any;
let mockAudioContext: any;

describe('Cross-Browser Audio Capture System', () => {
  beforeEach(() => {
    // Setup mocks first
    const mocks = setupMediaDevicesMocks();
    mockMediaDevices = mocks.mockMediaDevices;
    mockMediaRecorder = mocks.mockMediaRecorder;
    mockAudioContext = mocks.mockAudioContext;
    
    resetFeatureFlags();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetFeatureFlags();
  });

  // ============================================================================
  // BROWSER DETECTION TESTS
  // ============================================================================
  
  describe('Browser Detection', () => {
    it('should correctly detect Chrome browser', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        writable: true,
      });
      Object.defineProperty(navigator, 'vendor', {
        value: 'Google Inc.',
        writable: true,
      });

      const browser = detectBrowser();
      
      expect(browser.name).toBe('chrome');
      expect(browser.supportsExtensions).toBe(true);
      expect(browser.supportsTabCapture).toBe(true);
      expect(browser.preferredCaptureMethod).toBe('screen');
      expect(browser.isMobile).toBe(false);
      expect(browser.isIOS).toBe(false);
    });

    it('should correctly detect Safari browser', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
        writable: true,
      });
      Object.defineProperty(navigator, 'vendor', {
        value: 'Apple Computer, Inc.',
        writable: true,
      });

      const browser = detectBrowser();
      
      expect(browser.name).toBe('safari');
      expect(browser.supportsExtensions).toBe(false);
      expect(browser.supportsTabCapture).toBe(false);
      expect(browser.preferredCaptureMethod).toBe('screen');
      expect(browser.isMobile).toBe(false);
      expect(browser.isIOS).toBe(false);
    });

    it('should correctly detect Firefox browser', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/119.0',
        writable: true,
      });
      Object.defineProperty(navigator, 'vendor', {
        value: '',
        writable: true,
      });

      const browser = detectBrowser();
      
      expect(browser.name).toBe('firefox');
      expect(browser.supportsExtensions).toBe(false);
      expect(browser.supportsTabCapture).toBe(false);
      expect(browser.preferredCaptureMethod).toBe('screen');
      expect(browser.isMobile).toBe(false);
    });

    it('should correctly detect Edge browser', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        writable: true,
      });

      const browser = detectBrowser();
      
      expect(browser.name).toBe('edge');
      expect(browser.supportsExtensions).toBe(true);
      expect(browser.supportsTabCapture).toBe(true);
      expect(browser.preferredCaptureMethod).toBe('screen');
    });

    it('should correctly detect iOS Safari', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
        writable: true,
      });

      const browser = detectBrowser();
      
      expect(browser.name).toBe('safari');
      expect(browser.isMobile).toBe(true);
      expect(browser.isIOS).toBe(true);
      expect(browser.supportsExtensions).toBe(false);
      expect(browser.supportsTabCapture).toBe(false);
      expect(browser.preferredCaptureMethod).toBe('none');
    });

    it('should detect iPad Pro correctly', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
        writable: true,
      });
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        writable: true,
      });
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 5,
        writable: true,
      });

      const browser = detectBrowser();
      
      expect(browser.isIOS).toBe(true);
    });
  });

  describe('Audio Capture Support Detection', () => {
    it('should return false for iOS devices', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)',
        writable: true,
      });

      const supported = supportsAudioCapture();
      expect(supported).toBe(false);
    });

    it('should return false for mobile devices', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36',
        writable: true,
      });

      const supported = supportsAudioCapture();
      expect(supported).toBe(false);
    });

    it('should return true for desktop browsers with screen capture', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0',
        writable: true,
      });

      const supported = supportsAudioCapture();
      expect(supported).toBe(true);
    });
  });

  describe('Browser-Specific Instructions', () => {
    it('should return iOS message for iOS devices', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)',
        writable: true,
      });

      const instructions = getCaptureInstructions();
      expect(instructions).toContain('Audio capture is not supported on iOS devices');
    });

    it('should return mobile message for mobile devices', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36',
        writable: true,
      });

      const instructions = getCaptureInstructions();
      expect(instructions).toContain('Audio capture is not supported on mobile devices');
    });

    it('should return Safari-specific instructions', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
        writable: true,
      });

      const instructions = getCaptureInstructions();
      expect(instructions).toContain('Share Audio');
      expect(instructions).toContain('window or screen');
    });

    it('should return Chrome tab capture instructions', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0',
        writable: true,
      });

      const instructions = getCaptureInstructions();
      expect(instructions).toContain('Share tab audio');
      expect(instructions).not.toContain('extension');
    });
  });

  // ============================================================================
  // FEATURE FLAG TESTS
  // ============================================================================

  describe('Feature Flag System', () => {
    it('should have default flags enabled', () => {
      const flags = getFeatureFlags();
      
      expect(flags.ENABLE_BROWSER_CAPTURE).toBe(true);
      expect(flags.ENABLE_CHROME_EXTENSION).toBe(true);
      expect(flags.ENABLE_SAFARI_CAPTURE).toBe(true);
      expect(flags.ENABLE_FIREFOX_CAPTURE).toBe(true);
      expect(flags.ENABLE_AUTO_SOURCE_FALLBACK).toBe(true);
    });

    it('should allow runtime flag updates', () => {
      expect(isFeatureEnabled('ENABLE_BROWSER_CAPTURE')).toBe(true);
      
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
      expect(isFeatureEnabled('ENABLE_BROWSER_CAPTURE')).toBe(false);
      
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
      expect(isFeatureEnabled('ENABLE_BROWSER_CAPTURE')).toBe(true);
    });

    it('should disable dependent features when master switch is off', () => {
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
      
      const flags = getFeatureFlags();
      expect(flags.ENABLE_BROWSER_CAPTURE).toBe(false);
      expect(flags.ENABLE_CHROME_EXTENSION).toBe(false);
      expect(flags.ENABLE_SAFARI_CAPTURE).toBe(false);
      expect(flags.ENABLE_FIREFOX_CAPTURE).toBe(false);
      expect(flags.ENABLE_AUDIO_SOURCE_SELECTOR).toBe(false);
    });

    it('should reset flags to defaults', () => {
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
      setFeatureFlag('ENABLE_DEBUG_MODE', true);
      
      resetFeatureFlags();
      
      const flags = getFeatureFlags();
      expect(flags.ENABLE_BROWSER_CAPTURE).toBe(true);
      expect(flags.ENABLE_DEBUG_MODE).toBe(false);
    });
  });

  // ============================================================================
  // AUDIO FORMAT HANDLER TESTS
  // ============================================================================

  describe('Audio Format Handler', () => {

    it('should detect supported formats', () => {
      const formats = audioFormatHandler.getSupportedFormats();
      
      expect(formats.length).toBeGreaterThan(0);
      
      const webmOpus = formats.find(f => f.format === 'webm' && f.codec === 'opus');
      expect(webmOpus).toBeDefined();
      expect(webmOpus?.supported).toBe(true);
      
      const mp4Aac = formats.find(f => f.format === 'mp4' && f.codec === 'aac');
      expect(mp4Aac).toBeDefined();
      expect(mp4Aac?.supported).toBe(true);
    });

    it('should select best format for Chrome', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Chrome/120.0.0.0',
        writable: true,
      });

      const bestFormat = audioFormatHandler.getBestFormat();
      
      expect(bestFormat).toBeDefined();
      expect(bestFormat?.format).toBe('webm');
      expect(bestFormat?.codec).toBe('opus');
      expect(bestFormat?.quality).toBe('high');
    });

    it('should select best format for Safari', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Safari/605.1.15',
        writable: true,
      });

      const bestFormat = audioFormatHandler.getBestFormat();
      
      expect(bestFormat).toBeDefined();
      expect(bestFormat?.format).toBe('mp4');
      expect(bestFormat?.codec).toBe('aac');
    });

    it('should get browser-specific recommended settings', () => {
      // Test Safari settings
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Safari/605.1.15',
        writable: true,
      });
      
      const safariSettings = audioFormatHandler.getRecommendedSettings();
      expect(safariSettings.format).toBe('mp4');
      expect(safariSettings.codec).toBe('aac');
      expect(safariSettings.sampleRate).toBe(48000);

      // Test Chrome settings
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Chrome/120.0.0.0',
        writable: true,
      });
      
      const chromeSettings = audioFormatHandler.getRecommendedSettings();
      expect(chromeSettings.format).toBe('webm');
      expect(chromeSettings.codec).toBe('opus');
    });
  });

  // ============================================================================
  // BROWSER CAPTURE SERVICE TESTS
  // ============================================================================

  describe('Browser Capture Service', () => {
    let captureService: BrowserCaptureService;

    beforeEach(() => {
      captureService = new BrowserCaptureService();
      
      // Reset mock resolved values
      const mockStream = createMockMediaStream();
      mockMediaDevices.getDisplayMedia.mockResolvedValue(mockStream);
      mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);
    });

    it('should get correct capabilities for Chrome', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Chrome/120.0.0.0',
        writable: true,
      });

      const capabilities = captureService.getCapabilities();
      
      expect(capabilities.canCaptureScreen).toBe(true);
      expect(capabilities.requiresExtension).toBe(false);
      expect(capabilities.availableSources).toContain('microphone');
      expect(capabilities.availableSources).toContain('screen-with-audio');
      expect(capabilities.availableSources).toContain('browser-tab');
    });

    it('should get correct capabilities for Safari', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Safari/605.1.15',
        writable: true,
      });

      const capabilities = captureService.getCapabilities();
      
      expect(capabilities.canCaptureScreen).toBe(true);
      expect(capabilities.canCaptureBrowserAudio).toBe(true);
      expect(capabilities.requiresExtension).toBe(false);
      expect(capabilities.availableSources).toContain('screen-with-audio');
      expect(capabilities.limitations).toContain('Requires screen sharing to capture audio');
    });

    it('should fall back to microphone when browser capture disabled', () => {
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
      
      const capabilities = captureService.getCapabilities();
      
      expect(capabilities.canCaptureBrowserAudio).toBe(false);
      expect(capabilities.canCaptureSystemAudio).toBe(false);
      expect(capabilities.canCaptureTab).toBe(false);
      expect(capabilities.availableSources).toEqual(['microphone']);
      expect(capabilities.limitations).toContain('Browser audio capture is disabled');
    });

    it('should start microphone capture as fallback', async () => {
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
      
      const result = await captureService.startCapture('browser-tab');
      
      expect(result.source).toBe('microphone');
      expect(result.fallbackUsed).toBe(true);
      expect(result.stream).toBeDefined();
      expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
    });

    it('should handle screen capture for Safari', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Safari/605.1.15',
        writable: true,
      });

      const result = await captureService.startCapture('screen-with-audio');
      
      expect(result.source).toBe('screen-with-audio');
      expect(result.stream).toBeDefined();
    });

    it('should handle capture errors gracefully', async () => {
      const error = new Error('Permission denied');
      mockMediaDevices.getDisplayMedia.mockRejectedValue(error);
      mockMediaDevices.getUserMedia.mockResolvedValue(createMockMediaStream());

      setFeatureFlag('ENABLE_AUTO_SOURCE_FALLBACK', true);

      const result = await captureService.startCapture('screen-with-audio');
      
      expect(result.fallbackUsed).toBe(true);
      expect(result.source).toBe('microphone');
      expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
    });

    it('should stop capture properly', async () => {
      const mockStream = createMockMediaStream();
      mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);
      
      await captureService.startCapture('microphone');
      await captureService.stopCapture();
      
      const status = captureService.getStatus();
      expect(status.isCapturing).toBe(false);
      expect(status.stream).toBe(null);
      expect(mockStream.getTracks()[0].stop).toHaveBeenCalled();
    });

    it('should switch audio sources', async () => {
      const mockMicStream = createMockMediaStream();
      const mockScreenStream = createMockMediaStream();
      
      mockMediaDevices.getUserMedia.mockResolvedValue(mockMicStream);
      mockMediaDevices.getDisplayMedia.mockResolvedValue(mockScreenStream);
      
      // Start with microphone
      await captureService.startCapture('microphone');
      let status = captureService.getStatus();
      expect(status.currentSource).toBe('microphone');
      
      // Switch to screen capture
      await captureService.switchSource('screen-with-audio');
      status = captureService.getStatus();
      expect(status.currentSource).toBe('screen-with-audio');
    });
  });

  // ============================================================================
  // PERFORMANCE TESTS
  // ============================================================================

  describe('Performance Tests', () => {
    it('should detect browsers efficiently', () => {
      const startTime = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        detectBrowser();
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should complete 1000 detections in under 100ms
      expect(totalTime).toBeLessThan(100);
    });

    it('should get feature flags efficiently', () => {
      const startTime = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        getFeatureFlags();
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should complete 1000 flag reads in under 50ms
      expect(totalTime).toBeLessThan(50);
    });

    it('should handle format detection efficiently', () => {
      const startTime = performance.now();
      
      for (let i = 0; i < 100; i++) {
        audioFormatHandler.getSupportedFormats();
        audioFormatHandler.getBestFormat();
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should complete 100 format checks in under 100ms
      expect(totalTime).toBeLessThan(100);
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration Tests', () => {
    it('should integrate browser detection with capture service', () => {
      const browser = detectBrowser();
      const service = new BrowserCaptureService();
      const capabilities = service.getCapabilities();
      
      expect(capabilities.requiresExtension).toBe(false);
      if (browser.supportsScreenCapture) {
        expect(capabilities.canCaptureScreen).toBe(true);
      }

      expect(capabilities.availableSources).toContain('microphone');
    });

    it('should integrate feature flags with capture service', () => {
      const service = new BrowserCaptureService();
      
      // Disable all browser capture
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
      
      const capabilities = service.getCapabilities();
      expect(capabilities.canCaptureBrowserAudio).toBe(false);
      expect(capabilities.availableSources).toEqual(['microphone']);
      
      // Re-enable and test
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
      const enabledCapabilities = service.getCapabilities();
      expect(enabledCapabilities.availableSources.length).toBeGreaterThan(1);
    });

    it('should handle graceful degradation across the system', async () => {
      // Simulate environment where everything fails
      mockMediaDevices.getDisplayMedia.mockRejectedValue(new Error('Not allowed'));
      mockMediaDevices.getUserMedia.mockRejectedValue(new Error('No microphone'));
      
      const service = new BrowserCaptureService();
      
      // Should still attempt fallback
      const result = await service.startCapture('screen-with-audio');
      
      expect(result.error).toBeDefined();
      expect(result.stream).toBe(null);
      
      // Service should remain stable
      const status = service.getStatus();
      expect(status.isCapturing).toBe(false);
    });
  });
});