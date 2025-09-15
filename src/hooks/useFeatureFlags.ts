/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                        FEATURE FLAGS REACT HOOK                           ║
 * ╠════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                            ║
 * ║  React hook for managing feature flags with runtime updates.              ║
 * ║  Provides reactive updates when flags change.                             ║
 * ║                                                                            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FeatureFlags,
  getFeatureFlags,
  setFeatureFlag,
  resetFeatureFlags,
  isFeatureEnabled,
  isAnyBrowserCaptureAvailable,
  getAvailableCaptureMethods,
  logFeatureFlags,
} from '../config/featureFlags';

// Event emitter for feature flag changes
class FeatureFlagEmitter extends EventTarget {
  emitChange(flag?: keyof FeatureFlags) {
    this.dispatchEvent(new CustomEvent('change', { detail: { flag } }));
  }
}

const emitter = new FeatureFlagEmitter();

/**
 * Hook for accessing and managing feature flags
 */
export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlags>(getFeatureFlags());
  
  // Update local state when flags change
  useEffect(() => {
    const handleChange = () => {
      setFlags(getFeatureFlags());
    };
    
    emitter.addEventListener('change', handleChange);
    return () => emitter.removeEventListener('change', handleChange);
  }, []);
  
  // Toggle a specific feature flag
  const toggleFlag = useCallback((flag: keyof FeatureFlags) => {
    const currentValue = isFeatureEnabled(flag);
    setFeatureFlag(flag, !currentValue);
    emitter.emitChange(flag);
    
    // Log change for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(`[FeatureFlags] Toggled ${flag}: ${!currentValue}`);
    }
  }, []);
  
  // Set a specific feature flag value
  const updateFlag = useCallback((flag: keyof FeatureFlags, value: boolean) => {
    setFeatureFlag(flag, value);
    emitter.emitChange(flag);
  }, []);
  
  // Reset all flags to defaults
  const reset = useCallback(() => {
    resetFeatureFlags();
    emitter.emitChange();
    console.log('[FeatureFlags] Reset to defaults');
  }, []);
  
  // Batch update multiple flags
  const updateMultiple = useCallback((updates: Partial<FeatureFlags>) => {
    Object.entries(updates).forEach(([flag, value]) => {
      setFeatureFlag(flag as keyof FeatureFlags, value as boolean);
    });
    emitter.emitChange();
  }, []);
  
  // Check if browser capture is available
  const isBrowserCaptureAvailable = useMemo(() => {
    return isAnyBrowserCaptureAvailable();
  }, [flags]);
  
  // Get available capture methods
  const availableCaptureMethods = useMemo(() => {
    return getAvailableCaptureMethods();
  }, [flags]);
  
  // Apply preset configurations
  const applyPreset = useCallback((preset: 'production' | 'development' | 'testing' | 'minimal') => {
    const presets: Record<string, Partial<FeatureFlags>> = {
      production: {
        ENABLE_BROWSER_CAPTURE: true,
        ENABLE_AUTO_SOURCE_FALLBACK: true,
        ENABLE_QUALITY_ADAPTATION: true,
        ENABLE_DEBUG_MODE: false,
        ENABLE_TELEMETRY: true,
      },
      development: {
        ENABLE_BROWSER_CAPTURE: true,
        ENABLE_DEBUG_MODE: true,
        ENABLE_TELEMETRY: false,
      },
      testing: {
        ENABLE_BROWSER_CAPTURE: false,
        ENABLE_AUTO_SOURCE_FALLBACK: false,
        ENABLE_DEBUG_MODE: true,
        ENABLE_TELEMETRY: false,
      },
      minimal: {
        ENABLE_BROWSER_CAPTURE: false,
        ENABLE_CHROME_EXTENSION: false,
        ENABLE_SAFARI_CAPTURE: false,
        ENABLE_FIREFOX_CAPTURE: false,
        ENABLE_AUDIO_SOURCE_SELECTOR: false,
        ENABLE_CROSS_BROWSER_UI: false,
        ENABLE_AUDIO_VISUALIZER: false,
        ENABLE_PERMISSION_PROMPTS: false,
        ENABLE_AUTO_SOURCE_FALLBACK: false,
        ENABLE_QUALITY_ADAPTATION: false,
        ENABLE_DEBUG_MODE: false,
        ENABLE_TELEMETRY: false,
      },
    };
    
    const presetConfig = presets[preset];
    if (presetConfig) {
      updateMultiple(presetConfig);
      console.log(`[FeatureFlags] Applied preset: ${preset}`);
    }
  }, [updateMultiple]);
  
  // Export current configuration as JSON
  const exportConfig = useCallback(() => {
    return JSON.stringify(flags, null, 2);
  }, [flags]);
  
  // Import configuration from JSON
  const importConfig = useCallback((json: string) => {
    try {
      const imported = JSON.parse(json) as Partial<FeatureFlags>;
      updateMultiple(imported);
      console.log('[FeatureFlags] Imported configuration');
      return true;
    } catch (error) {
      console.error('[FeatureFlags] Failed to import configuration:', error);
      return false;
    }
  }, [updateMultiple]);
  
  return {
    flags,
    toggleFlag,
    updateFlag,
    updateMultiple,
    reset,
    isBrowserCaptureAvailable,
    availableCaptureMethods,
    applyPreset,
    exportConfig,
    importConfig,
    logFeatureFlags,
  };
}

/**
 * Hook for checking a specific feature flag
 */
export function useFeatureFlag(flag: keyof FeatureFlags): boolean {
  const { flags } = useFeatureFlags();
  return flags[flag];
}

/**
 * Hook for checking if browser capture is available
 */
export function useBrowserCapture() {
  const { flags, isBrowserCaptureAvailable, availableCaptureMethods } = useFeatureFlags();
  
  return {
    enabled: flags.ENABLE_BROWSER_CAPTURE,
    available: isBrowserCaptureAvailable,
    methods: availableCaptureMethods,
    chromeEnabled: flags.ENABLE_CHROME_EXTENSION,
    safariEnabled: flags.ENABLE_SAFARI_CAPTURE,
    firefoxEnabled: flags.ENABLE_FIREFOX_CAPTURE,
  };
}