/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                    FEATURE FLAG INTEGRATION TESTS                         ║
 * ╠════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                            ║
 * ║  Tests to ensure feature flags work correctly and provide graceful        ║
 * ║  degradation when browser capture is disabled.                            ║
 * ║                                                                            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getFeatureFlags,
  setFeatureFlag,
  resetFeatureFlags,
  isFeatureEnabled,
  isAnyBrowserCaptureAvailable,
  getAvailableCaptureMethods,
} from '../config/featureFlags';
import { captureService } from '../services/featureFlaggedCapture';

describe('Feature Flag Integration', () => {
  beforeEach(() => {
    resetFeatureFlags();
  });
  
  afterEach(() => {
    resetFeatureFlags();
  });
  
  describe('Master Switch Behavior', () => {
    it('should disable all browser features when master switch is off', () => {
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
      
      const flags = getFeatureFlags();
      expect(flags.ENABLE_BROWSER_CAPTURE).toBe(false);
      expect(flags.ENABLE_CHROME_EXTENSION).toBe(false);
      expect(flags.ENABLE_SAFARI_CAPTURE).toBe(false);
      expect(flags.ENABLE_FIREFOX_CAPTURE).toBe(false);
    });
    
    it('should only return microphone when browser capture is disabled', () => {
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
      
      const methods = getAvailableCaptureMethods();
      expect(methods).toEqual(['microphone']);
      expect(isAnyBrowserCaptureAvailable()).toBe(false);
    });
    
    it('should allow individual browser features when master switch is on', () => {
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
      setFeatureFlag('ENABLE_CHROME_EXTENSION', true);
      setFeatureFlag('ENABLE_SAFARI_CAPTURE', false);
      
      const flags = getFeatureFlags();
      expect(flags.ENABLE_BROWSER_CAPTURE).toBe(true);
      expect(flags.ENABLE_CHROME_EXTENSION).toBe(true);
      expect(flags.ENABLE_SAFARI_CAPTURE).toBe(false);
    });
  });
  
  describe('Capture Service Integration', () => {
    it('should only provide microphone source when browser capture is disabled', () => {
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
      
      const sources = captureService.getAvailableSources();
      expect(sources).toHaveLength(1);
      expect(sources[0].id).toBe('microphone');
      expect(sources[0].type).toBe('microphone');
    });
    
    it('should provide multiple sources when browser capture is enabled', () => {
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
      setFeatureFlag('ENABLE_CHROME_EXTENSION', true);
      
      // Mock Chrome browser
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        configurable: true,
      });
      
      const sources = captureService.getAvailableSources();
      expect(sources.length).toBeGreaterThan(1);
      expect(sources.some(s => s.type === 'browser-tab')).toBe(true);
    });
    
    it('should fall back to microphone when requested source is unavailable', async () => {
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
      setFeatureFlag('ENABLE_AUTO_SOURCE_FALLBACK', true);
      
      // Mock getUserMedia
      const mockStream = {
        getTracks: () => [],
        getAudioTracks: () => [{ stop: vi.fn() }],
      };
      
      global.navigator.mediaDevices = {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      } as any;
      
      const result = await captureService.startCapture({
        source: 'browser-tab', // This source won't be available
        quality: 'high',
      });
      
      expect(result.source).toBe('microphone');
      expect(result.fallbackUsed).toBe(true);
    });
  });
  
  describe('Environment Variable Integration', () => {
    it('should respect environment variables', () => {
      // Simulate environment variable
      process.env.REACT_APP_ENABLE_BROWSER_CAPTURE = 'false';
      
      // Reset to pick up env var
      resetFeatureFlags();
      
      const flags = getFeatureFlags();
      expect(flags.ENABLE_BROWSER_CAPTURE).toBe(false);
      
      // Clean up
      delete process.env.REACT_APP_ENABLE_BROWSER_CAPTURE;
    });
    
    it('should prioritize runtime flags over environment variables', () => {
      process.env.REACT_APP_ENABLE_BROWSER_CAPTURE = 'false';
      resetFeatureFlags();
      
      // Runtime override
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
      
      const flags = getFeatureFlags();
      expect(flags.ENABLE_BROWSER_CAPTURE).toBe(true);
      
      // Clean up
      delete process.env.REACT_APP_ENABLE_BROWSER_CAPTURE;
    });
  });
  
  describe('Graceful Degradation', () => {
    it('should not throw errors when all features are disabled', () => {
      // Disable everything
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
      setFeatureFlag('ENABLE_SYSTEM_AUDIO', false);
      setFeatureFlag('ENABLE_CHROME_EXTENSION', false);
      setFeatureFlag('ENABLE_SAFARI_CAPTURE', false);
      setFeatureFlag('ENABLE_FIREFOX_CAPTURE', false);
      
      // These should not throw
      expect(() => {
        const methods = getAvailableCaptureMethods();
        const sources = captureService.getAvailableSources();
        const available = isAnyBrowserCaptureAvailable();
      }).not.toThrow();
      
      // Should still have microphone
      const methods = getAvailableCaptureMethods();
      expect(methods).toContain('microphone');
    });
    
    it('should handle capture errors gracefully', async () => {
      setFeatureFlag('ENABLE_AUTO_SOURCE_FALLBACK', false);
      
      // Mock getUserMedia to fail
      global.navigator.mediaDevices = {
        getUserMedia: vi.fn().mockRejectedValue(new Error('Permission denied')),
      } as any;
      
      const result = await captureService.startCapture({
        source: 'microphone',
        quality: 'high',
      });
      
      expect(result.stream).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Permission denied');
    });
  });
  
  describe('Feature Groups', () => {
    it('should correctly identify when any browser capture is available', () => {
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
      setFeatureFlag('ENABLE_CHROME_EXTENSION', false);
      setFeatureFlag('ENABLE_SAFARI_CAPTURE', true);
      setFeatureFlag('ENABLE_FIREFOX_CAPTURE', false);
      
      expect(isAnyBrowserCaptureAvailable()).toBe(true);
    });
    
    it('should return false when no browser capture methods are enabled', () => {
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
      setFeatureFlag('ENABLE_CHROME_EXTENSION', false);
      setFeatureFlag('ENABLE_SAFARI_CAPTURE', false);
      setFeatureFlag('ENABLE_FIREFOX_CAPTURE', false);
      
      expect(isAnyBrowserCaptureAvailable()).toBe(false);
    });
  });
});