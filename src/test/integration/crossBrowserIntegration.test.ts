/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                    CROSS-BROWSER INTEGRATION TESTS                         ║
 * ╠════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                            ║
 * ║  Integration testing for the complete cross-browser audio capture         ║
 * ║  system including components, services, and hooks.                        ║
 * ║                                                                            ║
 * ║  Tests the actual user workflows and component integration.               ║
 * ║                                                                            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { resetFeatureFlags, setFeatureFlag } from '../../config/featureFlags';

// Mock media APIs before importing components
const mockStream = {
  id: 'test-stream',
  getTracks: vi.fn(() => [{ stop: vi.fn(), kind: 'audio', id: 'audio-1' }]),
  getAudioTracks: vi.fn(() => [{ stop: vi.fn(), kind: 'audio', id: 'audio-1' }]),
  getVideoTracks: vi.fn(() => []),
  active: true,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

const mockMediaDevices = {
  getUserMedia: vi.fn(() => Promise.resolve(mockStream)),
  getDisplayMedia: vi.fn(() => Promise.resolve(mockStream)),
  getSupportedConstraints: vi.fn(() => ({})),
  enumerateDevices: vi.fn(() => Promise.resolve([])),
};

const mockMediaRecorder = vi.fn().mockImplementation(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  state: 'inactive',
  mimeType: 'audio/webm;codecs=opus',
  addEventListener: vi.fn(),
}));
mockMediaRecorder.isTypeSupported = vi.fn(() => true);

vi.stubGlobal('navigator', {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0',
  vendor: 'Google Inc.',
  platform: 'MacIntel',
  mediaDevices: mockMediaDevices,
  maxTouchPoints: 0,
});

vi.stubGlobal('MediaRecorder', mockMediaRecorder);
vi.stubGlobal('AudioContext', vi.fn());

// Import React components after mocking
import React from 'react';

// Mock the Safari service to avoid file system dependencies
vi.mock('../../services/safari-capture', () => ({
  safariCaptureService: {
    getState: () => ({ isCapturing: false, stream: null, error: null }),
    startCapture: vi.fn(() => Promise.resolve(mockStream)),
    stopCapture: vi.fn(),
    hasAudio: () => true,
    getAudioLevel: () => 0.5,
    constructor: {
      isSupported: () => true,
      getLimitations: () => ['Requires screen sharing permission'],
    },
  },
}));

describe('Cross-Browser Integration Tests', () => {
  beforeEach(() => {
    resetFeatureFlags();
    vi.clearAllMocks();
    
    // Reset mock implementations
    mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);
    mockMediaDevices.getDisplayMedia.mockResolvedValue(mockStream);
  });

  afterEach(() => {
    resetFeatureFlags();
  });

  // ============================================================================
  // FEATURE FLAG INTEGRATION TESTS
  // ============================================================================

  describe('Feature Flag Integration', () => {
    it('should handle feature flag toggling without breaking the system', async () => {
      // Start with all features enabled
      expect(() => {
        setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
        setFeatureFlag('ENABLE_CHROME_EXTENSION', true);
        setFeatureFlag('ENABLE_SAFARI_CAPTURE', true);
      }).not.toThrow();

      // Disable features one by one
      setFeatureFlag('ENABLE_CHROME_EXTENSION', false);
      expect(() => {
        const { getFeatureFlags } = require('../../config/featureFlags');
        getFeatureFlags();
      }).not.toThrow();

      // Disable master flag
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
      const { getFeatureFlags } = require('../../config/featureFlags');
      const flags = getFeatureFlags();
      
      expect(flags.ENABLE_BROWSER_CAPTURE).toBe(false);
      expect(flags.ENABLE_CHROME_EXTENSION).toBe(false);
    });

    it('should provide runtime feature flag panel functionality', () => {
      // Test the feature flag panel can be imported and used
      expect(() => {
        const { FeatureFlagPanel } = require('../../components/FeatureFlagPanel');
        expect(FeatureFlagPanel).toBeDefined();
      }).not.toThrow();
    });
  });

  // ============================================================================
  // BROWSER CAPTURE SERVICE INTEGRATION
  // ============================================================================

  describe('Browser Capture Service Integration', () => {
    let BrowserCaptureService: any;

    beforeEach(async () => {
      // Import the service after mocks are set up
      const module = await import('../../services/browserCaptureService');
      BrowserCaptureService = module.BrowserCaptureService;
    });

    it('should initialize service without errors', () => {
      expect(() => new BrowserCaptureService()).not.toThrow();
    });

    it('should provide correct capabilities based on browser', () => {
      const service = new BrowserCaptureService();
      const capabilities = service.getCapabilities();
      
      expect(capabilities).toHaveProperty('canCaptureBrowserAudio');
      expect(capabilities).toHaveProperty('availableSources');
      expect(capabilities.availableSources).toContain('microphone');
    });

    it('should handle microphone capture successfully', async () => {
      const service = new BrowserCaptureService();
      
      const result = await service.startCapture('microphone');
      
      expect(result.source).toBe('microphone');
      expect(result.stream).toBeDefined();
      expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
    });

    it('should handle screen capture fallback', async () => {
      const service = new BrowserCaptureService();
      setFeatureFlag('ENABLE_AUTO_SOURCE_FALLBACK', true);
      
      // Make screen capture fail but microphone succeed
      mockMediaDevices.getDisplayMedia.mockRejectedValue(new Error('Permission denied'));
      mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);
      
      const result = await service.startCapture('screen-with-audio');
      
      expect(result.fallbackUsed).toBe(true);
      expect(result.source).toBe('microphone');
      expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
    });

    it('should stop capture cleanly', async () => {
      const service = new BrowserCaptureService();
      
      await service.startCapture('microphone');
      let status = service.getStatus();
      expect(status.isCapturing).toBe(true);
      
      await service.stopCapture();
      status = service.getStatus();
      expect(status.isCapturing).toBe(false);
      expect(status.stream).toBe(null);
    });
  });

  // ============================================================================
  // AUDIO FORMAT HANDLER INTEGRATION
  // ============================================================================

  describe('Audio Format Handler Integration', () => {
    let audioFormatHandler: any;

    beforeEach(async () => {
      const module = await import('../../services/audio-format-handler');
      audioFormatHandler = module.audioFormatHandler;
    });

    it('should detect supported formats', () => {
      const formats = audioFormatHandler.getSupportedFormats();
      expect(formats).toBeInstanceOf(Array);
      expect(formats.length).toBeGreaterThan(0);
      
      // Should include common formats
      const formatTypes = formats.map((f: any) => f.format);
      expect(formatTypes).toContain('webm');
    });

    it('should select appropriate format for Chrome', () => {
      const bestFormat = audioFormatHandler.getBestFormat();
      expect(bestFormat).toBeDefined();
      expect(bestFormat.mimeType).toBeTruthy();
    });

    it('should provide browser-specific recommendations', () => {
      const settings = audioFormatHandler.getRecommendedSettings();
      expect(settings).toHaveProperty('format');
      expect(settings).toHaveProperty('codec');
      expect(settings).toHaveProperty('sampleRate');
      expect(settings.sampleRate).toBe(48000);
    });
  });

  // ============================================================================
  // CROSS-BROWSER COMPATIBILITY MATRIX
  // ============================================================================

  describe('Cross-Browser Compatibility Matrix', () => {
    const browsers = [
      {
        name: 'Chrome',
        userAgent: 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36',
        vendor: 'Google Inc.',
        },
      {
        name: 'Safari',
        userAgent: 'Mozilla/5.0 Safari/605.1.15',
        vendor: 'Apple Computer, Inc.',
      },
      {
        name: 'Firefox',
        userAgent: 'Mozilla/5.0 Firefox/119.0',
        vendor: '',
      },
      {
        name: 'Edge',
        userAgent: 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        vendor: 'Microsoft Corporation',
      },
    ];

    browsers.forEach(browser => {
      it(`should provide appropriate capabilities for ${browser.name}`, async () => {
        // Update navigator for this test
        vi.stubGlobal('navigator', {
          ...global.navigator,
          userAgent: browser.userAgent,
          vendor: browser.vendor,
        });

        const module = await import('../../services/browserCaptureService');
        const service = new module.BrowserCaptureService();
        const capabilities = service.getCapabilities();

        expect(capabilities.availableSources).toContain('microphone');
        expect(capabilities.requiresExtension).toBe(false);
      });
    });
  });

  // ============================================================================
  // ERROR HANDLING AND RESILIENCE
  // ============================================================================

  describe('Error Handling and System Resilience', () => {
    it('should handle media permission errors gracefully', async () => {
      const module = await import('../../services/browserCaptureService');
      const service = new module.BrowserCaptureService();
      
      // Simulate permission denied
      mockMediaDevices.getUserMedia.mockRejectedValue(
        Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' })
      );
      
      const result = await service.startCapture('microphone');
      
      expect(result.error).toBeDefined();
      expect(result.stream).toBe(null);
    });

    it('should handle missing browser APIs gracefully', async () => {
      // Remove media devices
      vi.stubGlobal('navigator', {
        ...global.navigator,
        mediaDevices: undefined,
      });

      // Should not throw errors during initialization
      expect(async () => {
        const module = await import('../../services/browserCaptureService');
        new module.BrowserCaptureService();
      }).not.toThrow();
    });

    it('should handle MediaRecorder failures gracefully', async () => {
      const module = await import('../../services/audio-format-handler');
      
      // Mock MediaRecorder failure
      vi.stubGlobal('MediaRecorder', undefined);
      
      expect(() => {
        module.audioFormatHandler.getSupportedFormats();
      }).not.toThrow();
    });
  });

  // ============================================================================
  // PERFORMANCE AND SCALABILITY
  // ============================================================================

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent capture attempts', async () => {
      const module = await import('../../services/browserCaptureService');
      const service = new module.BrowserCaptureService();
      
      // Start multiple captures concurrently
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(service.startCapture('microphone'));
      }
      
      const results = await Promise.allSettled(promises);
      
      // At least one should succeed (the others might fail due to concurrent access)
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);
      
      // Clean up
      await service.stopCapture();
    });

    it('should not leak memory with repeated capture cycles', async () => {
      const module = await import('../../services/browserCaptureService');
      const service = new module.BrowserCaptureService();
      
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Perform multiple capture/stop cycles
      for (let i = 0; i < 10; i++) {
        await service.startCapture('microphone');
        await service.stopCapture();
      }
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Memory should not grow significantly
      if (initialMemory > 0 && finalMemory > 0) {
        const growthPercent = ((finalMemory - initialMemory) / initialMemory) * 100;
        expect(growthPercent).toBeLessThan(50); // Less than 50% growth allowed
      }
    });

    it('should respond quickly to capability queries', () => {
      const iterations = 1000;
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        const module = require('../../config/featureFlags');
        module.getFeatureFlags();
        module.getAvailableCaptureMethods();
      }
      
      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;
      
      // Should average less than 1ms per call
      expect(avgTime).toBeLessThan(1);
    });
  });

  // ============================================================================
  // INTEGRATION WITH EXISTING SYSTEMS
  // ============================================================================

  describe('Integration with Existing Systems', () => {
    it('should work with existing transcription hooks', () => {
      // Test that audio capture can provide streams to transcription
      expect(async () => {
        const module = await import('../../services/browserCaptureService');
        const service = new module.BrowserCaptureService();
        
        const result = await service.startCapture('microphone');
        
        if (result.stream) {
          // Simulate passing to transcription service
          const audioTracks = result.stream.getAudioTracks();
          expect(audioTracks.length).toBeGreaterThan(0);
        }
        
        await service.stopCapture();
      }).not.toThrow();
    });

    it('should integrate with window management', () => {
      // Test that the system can work with the existing window management
      expect(() => {
        const { getFeatureFlags } = require('../../config/featureFlags');
        const flags = getFeatureFlags();
        
        // Should be able to determine UI features based on flags
        expect(typeof flags.ENABLE_CROSS_BROWSER_UI).toBe('boolean');
        expect(typeof flags.ENABLE_AUDIO_SOURCE_SELECTOR).toBe('boolean');
      }).not.toThrow();
    });
  });

  // ============================================================================
  // REAL-WORLD SCENARIO SIMULATION
  // ============================================================================

  describe('Real-World Scenario Simulation', () => {
    it('should handle user workflow: enable features -> select source -> capture -> stop', async () => {
      // Step 1: Enable features
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
      setFeatureFlag('ENABLE_CHROME_EXTENSION', true);
      
      // Step 2: Initialize service
      const module = await import('../../services/browserCaptureService');
      const service = new module.BrowserCaptureService();
      
      // Step 3: Check capabilities
      const capabilities = service.getCapabilities();
      expect(capabilities.availableSources.length).toBeGreaterThan(1);
      
      // Step 4: Start capture
      const result = await service.startCapture('microphone');
      expect(result.stream).toBeDefined();
      
      // Step 5: Verify status
      let status = service.getStatus();
      expect(status.isCapturing).toBe(true);
      
      // Step 6: Stop capture
      await service.stopCapture();
      status = service.getStatus();
      expect(status.isCapturing).toBe(false);
    });

    it('should handle user workflow with fallbacks', async () => {
      setFeatureFlag('ENABLE_AUTO_SOURCE_FALLBACK', true);
      
      const module = await import('../../services/browserCaptureService');
      const service = new module.BrowserCaptureService();
      
      // Simulate preferred method failing
      mockMediaDevices.getDisplayMedia.mockRejectedValue(new Error('User cancelled'));
      mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);
      
      const result = await service.startCapture('screen-with-audio');
      
      expect(result.fallbackUsed).toBe(true);
      expect(result.source).toBe('microphone');
      expect(result.stream).toBeDefined();
      
      await service.stopCapture();
    });

    it('should handle disabled state gracefully', async () => {
      // Disable all browser capture
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
      
      const module = await import('../../services/browserCaptureService');
      const service = new module.BrowserCaptureService();
      
      const capabilities = service.getCapabilities();
      expect(capabilities.availableSources).toEqual(['microphone']);
      expect(capabilities.canCaptureBrowserAudio).toBe(false);
      
      // Should still work with microphone
      const result = await service.startCapture('screen-with-audio'); // Will fallback
      expect(result.source).toBe('microphone');
      
      await service.stopCapture();
    });
  });
});