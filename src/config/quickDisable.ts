/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                         QUICK DISABLE UTILITIES                           ║
 * ╠════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                            ║
 * ║  Quick utilities for disabling browser capture features during            ║
 * ║  development or debugging.                                                ║
 * ║                                                                            ║
 * ║  USAGE:                                                                   ║
 * ║  -------                                                                  ║
 * ║  1. Import at the top of your main app file:                            ║
 * ║     import './config/quickDisable';                                      ║
 * ║                                                                            ║
 * ║  2. Uncomment the function you want to use                              ║
 * ║                                                                            ║
 * ║  3. Restart your dev server                                              ║
 * ║                                                                            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import { setFeatureFlag } from './featureFlags';

// ============================================================================
// QUICK DISABLE FUNCTIONS
// ============================================================================

/**
 * UNCOMMENT TO DISABLE ALL BROWSER CAPTURE
 * =========================================
 * This disables ALL browser audio capture features and falls back to microphone
 */
// disableAllBrowserCapture();

/**
 * UNCOMMENT TO DISABLE SPECIFIC BROWSERS
 * =======================================
 */
// disableChromeCapture();
// disableSafariCapture();
// disableFirefoxCapture();

/**
 * UNCOMMENT TO DISABLE UI FEATURES
 * =================================
 */
// disableAudioSourceSelector();
// disableAudioVisualizer();
// disableCrossBrowserUI();

/**
 * UNCOMMENT FOR MINIMAL MODE
 * ===========================
 * Only microphone, no browser features, minimal UI
 */
// enableMinimalMode();

/**
 * UNCOMMENT FOR DEBUG MODE
 * ========================
 * Enables all debug features and logging
 */
// enableDebugMode();

// ============================================================================
// IMPLEMENTATION FUNCTIONS
// ============================================================================

/**
 * Disable all browser capture features
 */
export function disableAllBrowserCapture(): void {
  console.log('🔴 DISABLING ALL BROWSER CAPTURE FEATURES');
  setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
  setFeatureFlag('ENABLE_CHROME_EXTENSION', false);
  setFeatureFlag('ENABLE_SAFARI_CAPTURE', false);
  setFeatureFlag('ENABLE_FIREFOX_CAPTURE', false);
  setFeatureFlag('ENABLE_AUDIO_SOURCE_SELECTOR', false);
  setFeatureFlag('ENABLE_CROSS_BROWSER_UI', false);
  console.log('✅ Browser capture disabled - using microphone only');
}

/**
 * Disable Chrome-specific features
 */
export function disableChromeCapture(): void {
  console.log('🔴 Disabling Chrome capture features');
  setFeatureFlag('ENABLE_CHROME_EXTENSION', false);
}

/**
 * Disable Safari-specific features
 */
export function disableSafariCapture(): void {
  console.log('🔴 Disabling Safari capture features');
  setFeatureFlag('ENABLE_SAFARI_CAPTURE', false);
}

/**
 * Disable Firefox-specific features
 */
export function disableFirefoxCapture(): void {
  console.log('🔴 Disabling Firefox capture features');
  setFeatureFlag('ENABLE_FIREFOX_CAPTURE', false);
}

/**
 * Disable audio source selector UI
 */
export function disableAudioSourceSelector(): void {
  console.log('🔴 Disabling audio source selector');
  setFeatureFlag('ENABLE_AUDIO_SOURCE_SELECTOR', false);
}

/**
 * Disable audio visualizer
 */
export function disableAudioVisualizer(): void {
  console.log('🔴 Disabling audio visualizer');
  setFeatureFlag('ENABLE_AUDIO_VISUALIZER', false);
}

/**
 * Disable cross-browser UI adaptations
 */
export function disableCrossBrowserUI(): void {
  console.log('🔴 Disabling cross-browser UI');
  setFeatureFlag('ENABLE_CROSS_BROWSER_UI', false);
}

/**
 * Enable minimal mode (microphone only, no fancy features)
 */
export function enableMinimalMode(): void {
  console.log('🟡 ENABLING MINIMAL MODE');
  
  // Disable all browser features
  setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
  setFeatureFlag('ENABLE_CHROME_EXTENSION', false);
  setFeatureFlag('ENABLE_SAFARI_CAPTURE', false);
  setFeatureFlag('ENABLE_FIREFOX_CAPTURE', false);
  
  // Disable UI features
  setFeatureFlag('ENABLE_AUDIO_SOURCE_SELECTOR', false);
  setFeatureFlag('ENABLE_CROSS_BROWSER_UI', false);
  setFeatureFlag('ENABLE_AUDIO_VISUALIZER', false);
  setFeatureFlag('ENABLE_PERMISSION_PROMPTS', false);
  
  // Disable advanced features
  setFeatureFlag('ENABLE_AUTO_SOURCE_FALLBACK', false);
  setFeatureFlag('ENABLE_QUALITY_ADAPTATION', false);
  setFeatureFlag('ENABLE_DEBUG_MODE', false);
  setFeatureFlag('ENABLE_TELEMETRY', false);
  
  console.log('✅ Minimal mode enabled - microphone only');
}

/**
 * Enable debug mode
 */
export function enableDebugMode(): void {
  console.log('🟢 ENABLING DEBUG MODE');
  setFeatureFlag('ENABLE_DEBUG_MODE', true);
  
  // Log all current flags
  if (typeof window !== 'undefined') {
    (window as any).__debugFeatureFlags = true;
  }
  
  console.log('✅ Debug mode enabled - check console for detailed logs');
}

/**
 * Enable specific browser only
 */
export function enableOnlyChrome(): void {
  console.log('🟡 Enabling Chrome-only mode');
  setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
  setFeatureFlag('ENABLE_CHROME_EXTENSION', true);
  setFeatureFlag('ENABLE_SAFARI_CAPTURE', false);
  setFeatureFlag('ENABLE_FIREFOX_CAPTURE', false);
}

export function enableOnlySafari(): void {
  console.log('🟡 Enabling Safari-only mode');
  setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
  setFeatureFlag('ENABLE_CHROME_EXTENSION', false);
  setFeatureFlag('ENABLE_SAFARI_CAPTURE', true);
  setFeatureFlag('ENABLE_FIREFOX_CAPTURE', false);
}

export function enableOnlyFirefox(): void {
  console.log('🟡 Enabling Firefox-only mode');
  setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
  setFeatureFlag('ENABLE_CHROME_EXTENSION', false);
  setFeatureFlag('ENABLE_SAFARI_CAPTURE', false);
  setFeatureFlag('ENABLE_FIREFOX_CAPTURE', true);
}

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

/**
 * Production configuration
 */
export function useProductionConfig(): void {
  console.log('⚙️ Applying production configuration');
  setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
  setFeatureFlag('ENABLE_AUTO_SOURCE_FALLBACK', true);
  setFeatureFlag('ENABLE_QUALITY_ADAPTATION', true);
  setFeatureFlag('ENABLE_DEBUG_MODE', false);
  setFeatureFlag('ENABLE_TELEMETRY', true);
}

/**
 * Development configuration
 */
export function useDevelopmentConfig(): void {
  console.log('⚙️ Applying development configuration');
  setFeatureFlag('ENABLE_BROWSER_CAPTURE', true);
  setFeatureFlag('ENABLE_DEBUG_MODE', true);
  setFeatureFlag('ENABLE_TELEMETRY', false);
}

/**
 * Testing configuration
 */
export function useTestingConfig(): void {
  console.log('⚙️ Applying testing configuration');
  setFeatureFlag('ENABLE_BROWSER_CAPTURE', false);
  setFeatureFlag('ENABLE_AUTO_SOURCE_FALLBACK', false);
  setFeatureFlag('ENABLE_DEBUG_MODE', true);
  setFeatureFlag('ENABLE_TELEMETRY', false);
}

// ============================================================================
// GLOBAL WINDOW EXPORTS (for console debugging)
// ============================================================================

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__quickDisable = {
    disableAllBrowserCapture,
    disableChromeCapture,
    disableSafariCapture,
    disableFirefoxCapture,
    disableAudioSourceSelector,
    disableAudioVisualizer,
    disableCrossBrowserUI,
    enableMinimalMode,
    enableDebugMode,
    enableOnlyChrome,
    enableOnlySafari,
    enableOnlyFirefox,
    useProductionConfig,
    useDevelopmentConfig,
    useTestingConfig,
  };
  
  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                     QUICK DISABLE UTILITIES LOADED                        ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  You can now use these commands in the console:                           ║
║                                                                            ║
║  __quickDisable.disableAllBrowserCapture()  - Disable all browser capture ║
║  __quickDisable.enableMinimalMode()         - Microphone only mode        ║
║  __quickDisable.enableDebugMode()           - Enable debug logging        ║
║  __quickDisable.enableOnlyChrome()          - Chrome-only mode           ║
║  __quickDisable.enableOnlySafari()          - Safari-only mode           ║
║                                                                            ║
║  Or uncomment the function calls at the top of this file.                 ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
  `);
}