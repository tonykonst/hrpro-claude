/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                    BROWSER CAPTURE FUNCTIONAL TESTS                        ║
 * ╠════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                            ║
 * ║  Functional testing for cross-browser audio capture system.               ║
 * ║  These tests verify the system behavior without relying on                ║
 * ║  complex mocking that interferes with module loading.                     ║
 * ║                                                                            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Simple mock setup
const mockNavigator = {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  vendor: 'Google Inc.',
  platform: 'MacIntel',
  maxTouchPoints: 0,
  mediaDevices: {
    getDisplayMedia: vi.fn(),
    getUserMedia: vi.fn(),
    getSupportedConstraints: vi.fn(() => ({})),
  },
};

const mockMediaRecorder = vi.fn();
mockMediaRecorder.isTypeSupported = vi.fn(() => true);

// Mock globals before imports
vi.stubGlobal('navigator', mockNavigator);
vi.stubGlobal('MediaRecorder', mockMediaRecorder);
vi.stubGlobal('AudioContext', vi.fn());

// Now import the modules
import { 
  getFeatureFlags, 
  setFeatureFlag, 
  resetFeatureFlags, 
  isFeatureEnabled,
  getAvailableCaptureMethods,
  isAnyBrowserCaptureAvailable 
} from '../config/featureFlags';

describe('Browser Capture Functional Tests', () => {
  beforeEach(() => {
    resetFeatureFlags();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetFeatureFlags();
  });

  // ============================================================================
  // FEATURE FLAG FUNCTIONAL TESTS
  // ============================================================================

  describe('Feature Flag System Integration', () => {
    it('should enable all browser capture features by default', () => {
      const flags = getFeatureFlags();
      
      expect(flags.ENABLE_BROWSER_CAPTURE).toBe(true);
      expect(flags.ENABLE_CHROME_EXTENSION).toBe(true);
      expect(flags.ENABLE_SAFARI_CAPTURE).toBe(true);
      expect(flags.ENABLE_FIREFOX_CAPTURE).toBe(true);
    });

    it('should allow runtime flag modifications', () => {
      // Test initial state
      expect(isFeatureEnabled('ENABLE_BROWSER_CAPTURE')).toBe(true);
      
      // Disable browser capture
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
      expect(isFeatureEnabled('ENABLE_BROWSER_CAPTURE')).toBe(false);
      
      // Re-enable
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
      expect(isFeatureEnabled('ENABLE_BROWSER_CAPTURE')).toBe(true);
    });

    it('should cascade feature disabling when master flag is disabled', () => {
      // Enable all initially
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
      setFeatureFlag('ENABLE_CHROME_EXTENSION', true);
      setFeatureFlag('ENABLE_SAFARI_CAPTURE', true);
      
      // Disable master flag
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
      
      const flags = getFeatureFlags();
      expect(flags.ENABLE_BROWSER_CAPTURE).toBe(false);
      expect(flags.ENABLE_CHROME_EXTENSION).toBe(false);
      expect(flags.ENABLE_SAFARI_CAPTURE).toBe(false);
      expect(flags.ENABLE_FIREFOX_CAPTURE).toBe(false);
    });

    it('should provide correct available capture methods', () => {
      const methods = getAvailableCaptureMethods();
      
      expect(methods).toContain('microphone'); // Always available as fallback
      expect(methods.length).toBeGreaterThan(1); // Should have browser methods too
      
      // When browser capture is disabled, should only have microphone
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
      const disabledMethods = getAvailableCaptureMethods();
      expect(disabledMethods).toEqual(['microphone']);
    });

    it('should correctly report browser capture availability', () => {
      expect(isAnyBrowserCaptureAvailable()).toBe(true);

      setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
      expect(isAnyBrowserCaptureAvailable()).toBe(false);

      // Re-enable master flag but disable individual browser flags
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
      setFeatureFlag('ENABLE_CHROME_EXTENSION', false);
      setFeatureFlag('ENABLE_FIREFOX_CAPTURE', false);
      setFeatureFlag('ENABLE_SAFARI_CAPTURE', false);
      expect(isAnyBrowserCaptureAvailable()).toBe(true);
    });

    it('should handle feature flag state persistence', () => {
      // Set multiple flags
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
      setFeatureFlag('ENABLE_DEBUG_MODE', true);
      setFeatureFlag('ENABLE_TELEMETRY', true);
      
      // Verify persistence
      expect(isFeatureEnabled('ENABLE_BROWSER_CAPTURE')).toBe(false);
      expect(isFeatureEnabled('ENABLE_DEBUG_MODE')).toBe(true);
      expect(isFeatureEnabled('ENABLE_TELEMETRY')).toBe(true);
      
      // Reset should restore defaults
      resetFeatureFlags();
      const resetFlags = getFeatureFlags();
      expect(resetFlags.ENABLE_BROWSER_CAPTURE).toBe(true);
      expect(resetFlags.ENABLE_DEBUG_MODE).toBe(false);
      expect(resetFlags.ENABLE_TELEMETRY).toBe(false);
    });
  });

  // ============================================================================
  // CROSS-BROWSER COMPATIBILITY TESTS
  // ============================================================================

  describe('Browser Compatibility Matrix', () => {
    const testBrowsers = [
      {
        name: 'Chrome Desktop',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        vendor: 'Google Inc.',
        expectedSupport: true,
        expectedMethods: ['chrome-tab', 'chrome-screen', 'microphone']
      },
      {
        name: 'Safari Desktop',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
        vendor: 'Apple Computer, Inc.',
        expectedSupport: true,
        expectedMethods: ['safari-screen', 'microphone']
      },
      {
        name: 'Firefox Desktop',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
        vendor: '',
        expectedSupport: true,
        expectedMethods: ['firefox-screen', 'microphone']
      },
      {
        name: 'Edge Desktop',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        vendor: 'Microsoft Corporation',
        expectedSupport: true,
        expectedMethods: ['chrome-tab', 'chrome-screen', 'microphone']
      },
      {
        name: 'iPhone Safari',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
        vendor: 'Apple Computer, Inc.',
        expectedSupport: false,
        expectedMethods: ['microphone']
      },
      {
        name: 'Android Chrome',
        userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        vendor: 'Google Inc.',
        expectedSupport: false,
        expectedMethods: ['microphone']
      }
    ];

    testBrowsers.forEach(browser => {
      it(`should handle ${browser.name} correctly`, () => {
        // Update navigator mock
        vi.stubGlobal('navigator', {
          ...mockNavigator,
          userAgent: browser.userAgent,
          vendor: browser.vendor,
        });

        const methods = getAvailableCaptureMethods();
        const hasCapture = isAnyBrowserCaptureAvailable();

        expect(hasCapture).toBe(browser.expectedSupport);
        expect(methods).toContain('microphone'); // Always fallback

        if (browser.expectedSupport) {
          expect(methods.length).toBeGreaterThan(1);
        } else {
          // Mobile should only have microphone when browser capture disabled
          setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
          const mobileMethods = getAvailableCaptureMethods();
          expect(mobileMethods).toEqual(['microphone']);
        }
      });
    });
  });

  // ============================================================================
  // ERROR HANDLING AND FALLBACK TESTS
  // ============================================================================

  describe('Error Handling and Fallbacks', () => {
    it('should handle missing MediaRecorder gracefully', () => {
      // Remove MediaRecorder
      vi.stubGlobal('MediaRecorder', undefined);

      // System should still function for basic feature detection
      expect(() => getFeatureFlags()).not.toThrow();
      expect(() => isFeatureEnabled('ENABLE_BROWSER_CAPTURE')).not.toThrow();
      
      // Methods should still be available (may fallback to microphone only)
      const methods = getAvailableCaptureMethods();
      expect(methods).toContain('microphone');
    });

    it('should handle missing mediaDevices gracefully', () => {
      // Remove mediaDevices
      vi.stubGlobal('navigator', {
        ...mockNavigator,
        mediaDevices: undefined,
      });

      // Should still provide basic functionality
      expect(() => getFeatureFlags()).not.toThrow();
      expect(() => getAvailableCaptureMethods()).not.toThrow();
    });

    it('should provide appropriate fallbacks when features are disabled', () => {
      // Test various disabled states
      const scenarios = [
        {
          name: 'All browser capture disabled',
          flags: { ENABLE_BROWSER_CAPTURE: false },
          expectedMethods: ['microphone']
        },
        {
          name: 'Chrome extension disabled',
          flags: { ENABLE_CHROME_EXTENSION: false },
          expectedMethodsInclude: ['chrome-tab', 'chrome-screen', 'microphone']
        },
        {
          name: 'Only Safari disabled', 
          flags: { ENABLE_SAFARI_CAPTURE: false },
          expectedMethodsInclude: ['microphone'],
          expectedMethodsExclude: ['safari-screen']
        }
      ];

      scenarios.forEach(scenario => {
        // Reset and apply flags
        resetFeatureFlags();
        Object.entries(scenario.flags).forEach(([flag, value]) => {
          setFeatureFlag(flag as any, value);
        });

        const methods = getAvailableCaptureMethods();

        if (scenario.expectedMethods) {
          expect(methods).toEqual(scenario.expectedMethods);
        }

        if (scenario.expectedMethodsInclude) {
          scenario.expectedMethodsInclude.forEach(method => {
            expect(methods).toContain(method);
          });
        }

        if (scenario.expectedMethodsExclude) {
          scenario.expectedMethodsExclude.forEach(method => {
            expect(methods).not.toContain(method);
          });
        }
      });
    });
  });

  // ============================================================================
  // PERFORMANCE AND RELIABILITY TESTS
  // ============================================================================

  describe('Performance and Reliability', () => {
    it('should handle rapid flag changes efficiently', () => {
      const startTime = performance.now();

      // Perform many flag operations
      for (let i = 0; i < 1000; i++) {
        setFeatureFlag('ENABLE_BROWSER_CAPTURE', i % 2 === 0);
        getFeatureFlags();
        isFeatureEnabled('ENABLE_BROWSER_CAPTURE');
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete 1000 operations quickly
      expect(duration).toBeLessThan(100); // Less than 100ms
    });

    it('should maintain consistent state under concurrent access', () => {
      // Simulate concurrent flag changes
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(Promise.resolve().then(() => {
          setFeatureFlag('ENABLE_BROWSER_CAPTURE', i % 2 === 0);
          return getFeatureFlags();
        }));
      }

      return Promise.all(promises).then(results => {
        // All results should be valid flag objects
        results.forEach(flags => {
          expect(flags).toHaveProperty('ENABLE_BROWSER_CAPTURE');
          expect(typeof flags.ENABLE_BROWSER_CAPTURE).toBe('boolean');
        });
      });
    });

    it('should handle memory efficiently during extended use', () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Perform many operations
      for (let i = 0; i < 10000; i++) {
        getFeatureFlags();
        getAvailableCaptureMethods();
        isAnyBrowserCaptureAvailable();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Memory growth should be minimal (accounting for test overhead)
      if (initialMemory > 0 && finalMemory > 0) {
        const growthPercent = ((finalMemory - initialMemory) / initialMemory) * 100;
        expect(growthPercent).toBeLessThan(10); // Less than 10% growth
      }
    });
  });
});