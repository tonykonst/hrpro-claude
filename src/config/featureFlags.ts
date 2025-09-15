/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                        FEATURE FLAG CONFIGURATION                          ║
 * ╠════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                            ║
 * ║  This is the central feature flag system for browser audio capture.       ║
 * ║  Features can be controlled through:                                      ║
 * ║                                                                            ║
 * ║  1. Environment Variables (.env file)                                     ║
 * ║  2. Runtime Configuration (UI toggles)                                    ║
 * ║  3. Code Comments (for development)                                       ║
 * ║                                                                            ║
 * ║  TO DISABLE BROWSER CAPTURE COMPLETELY:                                   ║
 * ║  ----------------------------------------                                  ║
 * ║  Option 1: Set in .env file:                                             ║
 * ║    REACT_APP_ENABLE_BROWSER_CAPTURE=false                                ║
 * ║                                                                            ║
 * ║  Option 2: Comment out the line below:                                   ║
 * ║    // BROWSER_CAPTURE: true,  // <-- Comment this line                   ║
 * ║                                                                            ║
 * ║  Option 3: Use runtime control (see useFeatureFlags hook)                ║
 * ║                                                                            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
// FEATURE FLAG TYPES
// ============================================================================

export interface FeatureFlags {
  // Master Switches
  ENABLE_BROWSER_CAPTURE: boolean;        // Controls ALL browser capture features
  ENABLE_SYSTEM_AUDIO: boolean;           // Future: System audio capture (Phase 2)
  
  // Browser-Specific Features
  ENABLE_CHROME_EXTENSION: boolean;       // Chrome extension for tab capture
  ENABLE_SAFARI_CAPTURE: boolean;         // Safari screen capture with audio
  ENABLE_FIREFOX_CAPTURE: boolean;        // Firefox screen capture support
  
  // UI Features
  ENABLE_AUDIO_SOURCE_SELECTOR: boolean;  // Audio source selection dropdown
  ENABLE_CROSS_BROWSER_UI: boolean;       // Browser-specific UI adaptations
  ENABLE_AUDIO_VISUALIZER: boolean;       // Audio level meters and visualizers
  ENABLE_PERMISSION_PROMPTS: boolean;     // Custom permission request dialogs
  
  // Advanced Features
  ENABLE_AUTO_SOURCE_FALLBACK: boolean;   // Auto-switch sources on failure
  ENABLE_QUALITY_ADAPTATION: boolean;     // Adaptive quality based on performance
  ENABLE_DEBUG_MODE: boolean;              // Debug overlays and logging
  ENABLE_TELEMETRY: boolean;              // Usage analytics (privacy-safe)
}

// ============================================================================
// DEFAULT FEATURE FLAGS
// ============================================================================

/**
 * DEFAULT CONFIGURATION
 * 
 * TO DISABLE ALL BROWSER CAPTURE:
 * ================================
 * Comment out or set to false the ENABLE_BROWSER_CAPTURE flag below.
 * This will disable ALL browser audio capture functionality throughout
 * the application without breaking anything.
 */
const DEFAULT_FLAGS: FeatureFlags = {
  // ┌─────────────────────────────────────────────────────────────────────┐
  // │ MASTER SWITCH - Comment out or set to false to disable everything  │
  // └─────────────────────────────────────────────────────────────────────┘
  ENABLE_BROWSER_CAPTURE: true,  // <-- COMMENT THIS LINE TO DISABLE ALL BROWSER CAPTURE
  
  // ┌─────────────────────────────────────────────────────────────────────┐
  // │ FUTURE FEATURES (Phase 2) - Not yet implemented                    │
  // └─────────────────────────────────────────────────────────────────────┘
  ENABLE_SYSTEM_AUDIO: false,  // Coming in Phase 2
  
  // ┌─────────────────────────────────────────────────────────────────────┐
  // │ BROWSER-SPECIFIC FEATURES - Comment out to disable per browser     │
  // └─────────────────────────────────────────────────────────────────────┘
  ENABLE_CHROME_EXTENSION: true,     // Chrome/Edge extension support
  ENABLE_SAFARI_CAPTURE: true,       // Safari screen capture
  ENABLE_FIREFOX_CAPTURE: false,      // Firefox support (disabled by default)
  
  // ┌─────────────────────────────────────────────────────────────────────┐
  // │ UI FEATURES - Comment out to hide UI elements                      │
  // └─────────────────────────────────────────────────────────────────────┘
  ENABLE_AUDIO_SOURCE_SELECTOR: true,  // Source selection dropdown
  ENABLE_CROSS_BROWSER_UI: true,       // Browser-specific UI
  ENABLE_AUDIO_VISUALIZER: true,       // Audio level visualization
  ENABLE_PERMISSION_PROMPTS: false,    // Custom permission dialogs
  
  // ┌─────────────────────────────────────────────────────────────────────┐
  // │ ADVANCED FEATURES - For production optimization                    │
  // └─────────────────────────────────────────────────────────────────────┘
  ENABLE_AUTO_SOURCE_FALLBACK: true,   // Automatic fallback on errors
  ENABLE_QUALITY_ADAPTATION: true,     // Dynamic quality adjustment
  ENABLE_DEBUG_MODE: false,             // Debug information overlay
  ENABLE_TELEMETRY: false,              // Anonymous usage statistics
};

// ============================================================================
// ENVIRONMENT VARIABLE MAPPING
// ============================================================================

/**
 * Maps environment variables to feature flags
 * Add new flags here when adding features
 */
const ENV_VAR_MAP: Record<keyof FeatureFlags, string> = {
  ENABLE_BROWSER_CAPTURE: 'REACT_APP_ENABLE_BROWSER_CAPTURE',
  ENABLE_SYSTEM_AUDIO: 'REACT_APP_ENABLE_SYSTEM_AUDIO',
  ENABLE_CHROME_EXTENSION: 'REACT_APP_ENABLE_CHROME_EXTENSION',
  ENABLE_SAFARI_CAPTURE: 'REACT_APP_ENABLE_SAFARI_CAPTURE',
  ENABLE_FIREFOX_CAPTURE: 'REACT_APP_ENABLE_FIREFOX_CAPTURE',
  ENABLE_AUDIO_SOURCE_SELECTOR: 'REACT_APP_ENABLE_AUDIO_SOURCE_SELECTOR',
  ENABLE_CROSS_BROWSER_UI: 'REACT_APP_ENABLE_CROSS_BROWSER_UI',
  ENABLE_AUDIO_VISUALIZER: 'REACT_APP_ENABLE_AUDIO_VISUALIZER',
  ENABLE_PERMISSION_PROMPTS: 'REACT_APP_ENABLE_PERMISSION_PROMPTS',
  ENABLE_AUTO_SOURCE_FALLBACK: 'REACT_APP_ENABLE_AUTO_SOURCE_FALLBACK',
  ENABLE_QUALITY_ADAPTATION: 'REACT_APP_ENABLE_QUALITY_ADAPTATION',
  ENABLE_DEBUG_MODE: 'REACT_APP_ENABLE_DEBUG_MODE',
  ENABLE_TELEMETRY: 'REACT_APP_ENABLE_TELEMETRY',
};

// ============================================================================
// FEATURE FLAG UTILITIES
// ============================================================================

/**
 * Gets a boolean value from environment variable
 * Safe for both Node.js and browser environments
 */
function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  // Check if running in browser environment
  if (typeof process === 'undefined' || !process.env) {
    // In browser, check if Vite injected the env var
    const globalEnv = (globalThis as any).__VITE_ENV__ || {};
    const value = globalEnv[key];
    if (value === undefined) return defaultValue;
    return value === 'true' || value === '1';
  }
  
  // Node.js environment
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
}

/**
 * Runtime feature flag storage (can be modified at runtime)
 */
let runtimeFlags: Partial<FeatureFlags> = {};

/**
 * Get current feature flags (combines defaults, env vars, and runtime)
 */
export function getFeatureFlags(): FeatureFlags {
  const flags: FeatureFlags = { ...DEFAULT_FLAGS };
  
  // Apply environment variable overrides
  for (const [flag, envVar] of Object.entries(ENV_VAR_MAP)) {
    const key = flag as keyof FeatureFlags;
    flags[key] = getEnvBoolean(envVar, DEFAULT_FLAGS[key]);
  }
  
  // Apply runtime overrides (highest priority)
  Object.assign(flags, runtimeFlags);
  
  // Enforce dependencies
  if (!flags.ENABLE_BROWSER_CAPTURE) {
    // If master switch is off, disable all dependent features
    flags.ENABLE_CHROME_EXTENSION = false;
    flags.ENABLE_SAFARI_CAPTURE = false;
    flags.ENABLE_FIREFOX_CAPTURE = false;
    flags.ENABLE_AUDIO_SOURCE_SELECTOR = false;
    flags.ENABLE_CROSS_BROWSER_UI = false;
    flags.ENABLE_AUDIO_VISUALIZER = false;
    flags.ENABLE_PERMISSION_PROMPTS = false;
    flags.ENABLE_AUTO_SOURCE_FALLBACK = false;
  }
  
  return flags;
}

/**
 * Update runtime feature flags
 */
export function setFeatureFlag(flag: keyof FeatureFlags, value: boolean): void {
  runtimeFlags[flag] = value;
  
  // Log change in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[FeatureFlags] ${flag} set to ${value}`);
  }
}

/**
 * Reset runtime flags to defaults
 */
export function resetFeatureFlags(): void {
  runtimeFlags = {};
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return getFeatureFlags()[flag];
}

/**
 * Get feature flag with fallback for graceful degradation
 */
export function getFeatureWithFallback(
  primaryFlag: keyof FeatureFlags,
  fallbackFlag?: keyof FeatureFlags
): boolean {
  const flags = getFeatureFlags();
  
  if (flags[primaryFlag]) {
    return true;
  }
  
  if (fallbackFlag && flags[fallbackFlag]) {
    console.log(`[FeatureFlags] Using fallback: ${fallbackFlag} for ${primaryFlag}`);
    return true;
  }
  
  return false;
}

// ============================================================================
// FEATURE FLAG GROUPS
// ============================================================================

/**
 * Check if any browser capture is available
 */
export function isAnyBrowserCaptureAvailable(): boolean {
  const flags = getFeatureFlags();
  return flags.ENABLE_BROWSER_CAPTURE && (
    flags.ENABLE_CHROME_EXTENSION ||
    flags.ENABLE_SAFARI_CAPTURE ||
    flags.ENABLE_FIREFOX_CAPTURE
  );
}

/**
 * Get available capture methods based on flags
 */
export function getAvailableCaptureMethods(): string[] {
  const flags = getFeatureFlags();
  const methods: string[] = [];
  
  if (!flags.ENABLE_BROWSER_CAPTURE) {
    return ['microphone'];  // Fallback to microphone only
  }
  
  if (flags.ENABLE_CHROME_EXTENSION) {
    methods.push('chrome-tab', 'chrome-screen');
  }
  
  if (flags.ENABLE_SAFARI_CAPTURE) {
    methods.push('safari-screen');
  }
  
  if (flags.ENABLE_FIREFOX_CAPTURE) {
    methods.push('firefox-screen');
  }
  
  // Always include microphone as fallback
  methods.push('microphone');
  
  return methods;
}

// ============================================================================
// DEVELOPMENT HELPERS
// ============================================================================

/**
 * Log current feature flag state (development only)
 */
export function logFeatureFlags(): void {
  if (process.env.NODE_ENV === 'development') {
    const flags = getFeatureFlags();
    console.group('[FeatureFlags] Current Configuration');
    for (const [key, value] of Object.entries(flags)) {
      console.log(`  ${key}: ${value}`);
    }
    console.groupEnd();
  }
}

/**
 * Export feature flags to JSON (for debugging)
 */
export function exportFeatureFlags(): string {
  return JSON.stringify(getFeatureFlags(), null, 2);
}

/**
 * Import feature flags from JSON (for testing)
 */
export function importFeatureFlags(json: string): void {
  try {
    const imported = JSON.parse(json) as Partial<FeatureFlags>;
    runtimeFlags = imported;
    console.log('[FeatureFlags] Imported configuration');
  } catch (error) {
    console.error('[FeatureFlags] Failed to import configuration:', error);
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  getFeatureFlags,
  setFeatureFlag,
  resetFeatureFlags,
  isFeatureEnabled,
  getFeatureWithFallback,
  isAnyBrowserCaptureAvailable,
  getAvailableCaptureMethods,
  logFeatureFlags,
  exportFeatureFlags,
  importFeatureFlags,
};