/**
 * Performance Tests for Cross-Browser Audio Capture System
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Setup minimal mocking
vi.stubGlobal('navigator', {
  userAgent: 'Mozilla/5.0 Chrome/120.0.0.0',
  vendor: 'Google Inc.',
  platform: 'MacIntel',
  mediaDevices: {
    getDisplayMedia: vi.fn(),
    getUserMedia: vi.fn(),
  },
});

vi.stubGlobal('MediaRecorder', { isTypeSupported: vi.fn(() => true) });

import { 
  getFeatureFlags, 
  setFeatureFlag, 
  resetFeatureFlags,
  getAvailableCaptureMethods
} from '../config/featureFlags';

describe('Performance Tests', () => {
  beforeEach(() => {
    resetFeatureFlags();
  });

  it('should handle rapid feature flag operations efficiently', () => {
    const iterations = 1000;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      setFeatureFlag('ENABLE_BROWSER_CAPTURE', i % 2 === 0);
      getFeatureFlags();
      getAvailableCaptureMethods();
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const avgDuration = duration / iterations;

    expect(duration).toBeLessThan(100); // Total under 100ms
    expect(avgDuration).toBeLessThan(0.1); // Average under 0.1ms per operation

    console.log(`Performance: ${iterations} operations in ${duration.toFixed(2)}ms (avg: ${avgDuration.toFixed(4)}ms)`);
  });

  it('should maintain performance with complex flag combinations', () => {
    const startTime = performance.now();
    
    const flagCombinations = [
      { ENABLE_BROWSER_CAPTURE: true, ENABLE_CHROME_EXTENSION: true },
      { ENABLE_BROWSER_CAPTURE: true, ENABLE_SAFARI_CAPTURE: true },
      { ENABLE_BROWSER_CAPTURE: false },
      { ENABLE_BROWSER_CAPTURE: true, ENABLE_FIREFOX_CAPTURE: true },
    ];

    for (let i = 0; i < 250; i++) {
      const combo = flagCombinations[i % flagCombinations.length];
      Object.entries(combo).forEach(([flag, value]) => {
        setFeatureFlag(flag as any, value);
      });
      getFeatureFlags();
    }

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(50);
  });
});