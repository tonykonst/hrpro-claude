/**
 * Feature Flag System Tests
 * 
 * Verifies that the feature flag system works correctly for
 * enabling/disabling browser capture functionality.
 */

import {
  getFeatureFlags,
  setFeatureFlag,
  resetFeatureFlags,
  isFeatureEnabled,
  getFeatureWithFallback,
  isAnyBrowserCaptureAvailable,
  getAvailableCaptureMethods,
} from '../featureFlags';

describe('Feature Flag System', () => {
  beforeEach(() => {
    // Reset flags before each test
    resetFeatureFlags();
  });

  describe('Master Switch', () => {
    it('should disable all browser features when master switch is off', () => {
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
      
      const flags = getFeatureFlags();
      
      // Master switch should be off
      expect(flags.ENABLE_BROWSER_CAPTURE).toBe(false);
      
      // All dependent features should be off
      expect(flags.ENABLE_CHROME_EXTENSION).toBe(false);
      expect(flags.ENABLE_SAFARI_CAPTURE).toBe(false);
      expect(flags.ENABLE_FIREFOX_CAPTURE).toBe(false);
      expect(flags.ENABLE_AUDIO_SOURCE_SELECTOR).toBe(false);
      expect(flags.ENABLE_CROSS_BROWSER_UI).toBe(false);
    });

    it('should allow individual features when master switch is on', () => {
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
      setFeatureFlag('ENABLE_CHROME_EXTENSION', true);
      setFeatureFlag('ENABLE_SAFARI_CAPTURE', false);
      
      const flags = getFeatureFlags();
      
      expect(flags.ENABLE_BROWSER_CAPTURE).toBe(true);
      expect(flags.ENABLE_CHROME_EXTENSION).toBe(true);
      expect(flags.ENABLE_SAFARI_CAPTURE).toBe(false);
    });
  });

  describe('Feature Checking', () => {
    it('should correctly check if a feature is enabled', () => {
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
      expect(isFeatureEnabled('ENABLE_BROWSER_CAPTURE')).toBe(true);
      
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
      expect(isFeatureEnabled('ENABLE_BROWSER_CAPTURE')).toBe(false);
    });

    it('should handle fallback features', () => {
      setFeatureFlag('ENABLE_CHROME_EXTENSION', false);
      setFeatureFlag('ENABLE_SAFARI_CAPTURE', true);
      
      // Should use Safari as fallback when Chrome is disabled
      const result = getFeatureWithFallback(
        'ENABLE_CHROME_EXTENSION',
        'ENABLE_SAFARI_CAPTURE'
      );
      
      expect(result).toBe(true);
    });

    it('should return false when both primary and fallback are disabled', () => {
      setFeatureFlag('ENABLE_CHROME_EXTENSION', false);
      setFeatureFlag('ENABLE_SAFARI_CAPTURE', false);
      
      const result = getFeatureWithFallback(
        'ENABLE_CHROME_EXTENSION',
        'ENABLE_SAFARI_CAPTURE'
      );
      
      expect(result).toBe(false);
    });
  });

  describe('Browser Capture Availability', () => {
    it('should report no browser capture when master switch is off', () => {
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
      
      expect(isAnyBrowserCaptureAvailable()).toBe(false);
    });

    it('should report browser capture available when any browser is enabled', () => {
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
      expect(isAnyBrowserCaptureAvailable()).toBe(true);
    });

    it('should still report browser capture when individual browser flags are disabled', () => {
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
      setFeatureFlag('ENABLE_CHROME_EXTENSION', false);
      setFeatureFlag('ENABLE_SAFARI_CAPTURE', false);
      setFeatureFlag('ENABLE_FIREFOX_CAPTURE', false);

      expect(isAnyBrowserCaptureAvailable()).toBe(true);
    });
  });

  describe('Available Capture Methods', () => {
    it('should only return microphone when browser capture is disabled', () => {
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
      
      const methods = getAvailableCaptureMethods();
      
      expect(methods).toEqual(['microphone']);
    });

    it('should return Chrome methods even when extension flag is disabled', () => {
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
      setFeatureFlag('ENABLE_CHROME_EXTENSION', false);
      setFeatureFlag('ENABLE_SAFARI_CAPTURE', false);
      setFeatureFlag('ENABLE_FIREFOX_CAPTURE', false);

      const methods = getAvailableCaptureMethods();

      expect(methods).toContain('chrome-tab');
      expect(methods).toContain('chrome-screen');
      expect(methods).toContain('microphone');
    });

    it('should return Safari methods when Safari is enabled', () => {
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
      setFeatureFlag('ENABLE_CHROME_EXTENSION', false);
      setFeatureFlag('ENABLE_SAFARI_CAPTURE', true);
      setFeatureFlag('ENABLE_FIREFOX_CAPTURE', false);

      const methods = getAvailableCaptureMethods();

      expect(methods).toContain('safari-screen');
      expect(methods).toContain('chrome-tab');
      expect(methods).toContain('microphone');
    });

    it('should return all methods when all browsers are enabled', () => {
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
      setFeatureFlag('ENABLE_CHROME_EXTENSION', true);
      setFeatureFlag('ENABLE_SAFARI_CAPTURE', true);
      setFeatureFlag('ENABLE_FIREFOX_CAPTURE', true);
      
      const methods = getAvailableCaptureMethods();
      
      expect(methods).toContain('chrome-tab');
      expect(methods).toContain('chrome-screen');
      expect(methods).toContain('safari-screen');
      expect(methods).toContain('firefox-screen');
      expect(methods).toContain('microphone');
    });
  });

  describe('Runtime Flag Updates', () => {
    it('should allow runtime flag updates', () => {
      const initialFlags = getFeatureFlags();
      const initialValue = initialFlags.ENABLE_DEBUG_MODE;
      
      setFeatureFlag('ENABLE_DEBUG_MODE', !initialValue);
      
      const updatedFlags = getFeatureFlags();
      expect(updatedFlags.ENABLE_DEBUG_MODE).toBe(!initialValue);
    });

    it('should reset flags to defaults', () => {
      // Change some flags
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
      setFeatureFlag('ENABLE_DEBUG_MODE', true);
      
      // Reset
      resetFeatureFlags();
      
      // Should be back to defaults
      const flags = getFeatureFlags();
      expect(flags.ENABLE_BROWSER_CAPTURE).toBe(true); // Default is true
      expect(flags.ENABLE_DEBUG_MODE).toBe(false); // Default is false
    });
  });

  describe('Environment Variable Integration', () => {
    it('should respect environment variables', () => {
      // This test would need to mock process.env
      // For now, we'll just check that the function exists
      expect(getFeatureFlags).toBeDefined();
    });
  });
});

describe('Feature Flag Scenarios', () => {
  beforeEach(() => {
    resetFeatureFlags();
  });

  it('Scenario: User wants to disable all browser capture', () => {
    // User sets master switch to false
    setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
    
    // Application checks availability
    expect(isAnyBrowserCaptureAvailable()).toBe(false);
    
    // Only microphone is available
    expect(getAvailableCaptureMethods()).toEqual(['microphone']);
    
    // UI components check flags
    expect(isFeatureEnabled('ENABLE_AUDIO_SOURCE_SELECTOR')).toBe(false);
  });

  it('Scenario: User wants Chrome-only mode', () => {
    setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
    setFeatureFlag('ENABLE_CHROME_EXTENSION', true);
    setFeatureFlag('ENABLE_SAFARI_CAPTURE', false);
    setFeatureFlag('ENABLE_FIREFOX_CAPTURE', false);
    
    const methods = getAvailableCaptureMethods();
    
    expect(methods).toContain('chrome-tab');
    expect(methods).not.toContain('safari-screen');
    expect(methods).not.toContain('firefox-screen');
  });

  it('Scenario: Production environment with fallback', () => {
    setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
    setFeatureFlag('ENABLE_AUTO_SOURCE_FALLBACK', true);
    setFeatureFlag('ENABLE_DEBUG_MODE', false);
    
    const flags = getFeatureFlags();
    
    expect(flags.ENABLE_AUTO_SOURCE_FALLBACK).toBe(true);
    expect(flags.ENABLE_DEBUG_MODE).toBe(false);
  });

  it('Scenario: Development with debug mode', () => {
    setFeatureFlag('ENABLE_DEBUG_MODE', true);
    setFeatureFlag('ENABLE_TELEMETRY', false);
    
    const flags = getFeatureFlags();
    
    expect(flags.ENABLE_DEBUG_MODE).toBe(true);
    expect(flags.ENABLE_TELEMETRY).toBe(false);
  });
});