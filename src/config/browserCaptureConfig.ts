/**
 * Browser Audio Capture Configuration
 * 
 * This file contains all configuration options for the cross-browser audio capture system.
 * Feature flags can be controlled via environment variables or hardcoded for testing.
 */

export interface BrowserCaptureConfig {
  // Feature Flags
  features: {
    enableBrowserCapture: boolean;
    enableAutoSourceSwitch: boolean;
    enablePermissionPrompts: boolean;
    enableExtensionSupport: boolean;
    enableSafariScreenCapture: boolean;
    enableDebugMode: boolean;
  };
  
  // Default Settings
  defaults: {
    audioSource: 'microphone' | 'browser' | 'tab' | 'screen';
    preferredBrowser: 'chrome' | 'safari' | 'auto';
    audioQuality: 'low' | 'medium' | 'high';
    captureTimeout: number; // milliseconds
  };
  
  // Audio Processing
  audio: {
    sampleRate: number;
    channels: number;
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
    bufferSize: number;
  };
  
  // Browser-Specific Settings
  chrome: {
    extensionId: string;
    extensionUrl: string;
    tabCaptureConstraints: MediaTrackConstraints;
  };
  
  safari: {
    minVersion: number;
    screenCaptureDelay: number; // milliseconds
    audioCheckInterval: number; // milliseconds
  };
  
  // UI Configuration
  ui: {
    showSourceSelector: boolean;
    showAudioLevelMeter: boolean;
    showPermissionDialogs: boolean;
    showLimitations: boolean;
    compactModeThreshold: number; // pixels
  };
}

/**
 * Get browser capture configuration from environment or defaults
 */
export const getBrowserCaptureConfig = (): BrowserCaptureConfig => {
  // Check environment variables (can be set in .env file)
  const getEnvBoolean = (key: string, defaultValue: boolean): boolean => {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value === 'true' || value === '1';
  };
  
  const getEnvNumber = (key: string, defaultValue: number): number => {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const num = parseInt(value, 10);
    return isNaN(num) ? defaultValue : num;
  };
  
  const getEnvString = <T extends string>(key: string, defaultValue: T): T => {
    const value = process.env[key];
    return (value as T) || defaultValue;
  };
  
  return {
    features: {
      // Main feature flag - controls whether browser capture is available
      enableBrowserCapture: getEnvBoolean('REACT_APP_ENABLE_BROWSER_CAPTURE', true),
      
      // Auto-switch to best available source if preferred source fails
      enableAutoSourceSwitch: getEnvBoolean('REACT_APP_ENABLE_AUTO_SOURCE_SWITCH', true),
      
      // Show custom permission prompts before requesting browser permissions
      enablePermissionPrompts: getEnvBoolean('REACT_APP_ENABLE_PERMISSION_PROMPTS', false),
      
      // Enable Chrome extension support for tab capture
      enableExtensionSupport: getEnvBoolean('REACT_APP_ENABLE_EXTENSION_SUPPORT', true),
      
      // Enable Safari screen capture with audio
      enableSafariScreenCapture: getEnvBoolean('REACT_APP_ENABLE_SAFARI_SCREEN_CAPTURE', true),
      
      // Show debug information in UI
      enableDebugMode: getEnvBoolean('REACT_APP_ENABLE_DEBUG_MODE', process.env.NODE_ENV === 'development')
    },
    
    defaults: {
      // Default audio source when starting
      audioSource: getEnvString('REACT_APP_DEFAULT_AUDIO_SOURCE', 'microphone'),
      
      // Preferred browser for audio capture
      preferredBrowser: getEnvString('REACT_APP_PREFERRED_BROWSER', 'auto'),
      
      // Audio quality preset
      audioQuality: getEnvString('REACT_APP_AUDIO_QUALITY', 'high'),
      
      // Timeout for capture operations
      captureTimeout: getEnvNumber('REACT_APP_CAPTURE_TIMEOUT', 30000)
    },
    
    audio: {
      // Audio sampling rate (Hz)
      sampleRate: getEnvNumber('REACT_APP_AUDIO_SAMPLE_RATE', 16000),
      
      // Number of audio channels
      channels: getEnvNumber('REACT_APP_AUDIO_CHANNELS', 1),
      
      // Echo cancellation
      echoCancellation: getEnvBoolean('REACT_APP_AUDIO_ECHO_CANCELLATION', false),
      
      // Noise suppression
      noiseSuppression: getEnvBoolean('REACT_APP_AUDIO_NOISE_SUPPRESSION', false),
      
      // Auto gain control
      autoGainControl: getEnvBoolean('REACT_APP_AUDIO_AUTO_GAIN_CONTROL', false),
      
      // Audio buffer size
      bufferSize: getEnvNumber('REACT_APP_AUDIO_BUFFER_SIZE', 4096)
    },
    
    chrome: {
      // Chrome extension ID (update with actual ID after publishing)
      extensionId: getEnvString('REACT_APP_CHROME_EXTENSION_ID', 'YOUR_EXTENSION_ID_HERE'),
      
      // Chrome Web Store URL
      extensionUrl: getEnvString(
        'REACT_APP_CHROME_EXTENSION_URL',
        'https://chrome.google.com/webstore/detail/hrpro-audio-capture/YOUR_EXTENSION_ID_HERE'
      ),
      
      // Tab capture audio constraints
      tabCaptureConstraints: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 16000,
        channelCount: 1
      }
    },
    
    safari: {
      // Minimum Safari version required
      minVersion: getEnvNumber('REACT_APP_SAFARI_MIN_VERSION', 13),
      
      // Delay after starting screen capture before checking audio
      screenCaptureDelay: getEnvNumber('REACT_APP_SAFARI_SCREEN_CAPTURE_DELAY', 1000),
      
      // Interval for checking audio availability
      audioCheckInterval: getEnvNumber('REACT_APP_SAFARI_AUDIO_CHECK_INTERVAL', 500)
    },
    
    ui: {
      // Show audio source selector in UI
      showSourceSelector: getEnvBoolean('REACT_APP_SHOW_SOURCE_SELECTOR', true),
      
      // Show audio level meter
      showAudioLevelMeter: getEnvBoolean('REACT_APP_SHOW_AUDIO_LEVEL_METER', true),
      
      // Show custom permission dialogs
      showPermissionDialogs: getEnvBoolean('REACT_APP_SHOW_PERMISSION_DIALOGS', true),
      
      // Show browser limitations
      showLimitations: getEnvBoolean('REACT_APP_SHOW_LIMITATIONS', true),
      
      // Screen width threshold for compact mode
      compactModeThreshold: getEnvNumber('REACT_APP_COMPACT_MODE_THRESHOLD', 768)
    }
  };
};

/**
 * Check if browser capture is enabled
 */
export const isBrowserCaptureEnabled = (): boolean => {
  const config = getBrowserCaptureConfig();
  return config.features.enableBrowserCapture;
};

/**
 * Get audio constraints based on configuration
 */
export const getAudioConstraints = (quality?: 'low' | 'medium' | 'high'): MediaTrackConstraints => {
  const config = getBrowserCaptureConfig();
  const selectedQuality = quality || config.defaults.audioQuality;
  
  const qualitySettings = {
    low: { sampleRate: 8000, channelCount: 1 },
    medium: { sampleRate: 16000, channelCount: 1 },
    high: { sampleRate: 48000, channelCount: 2 }
  };
  
  const settings = qualitySettings[selectedQuality];
  
  return {
    echoCancellation: config.audio.echoCancellation,
    noiseSuppression: config.audio.noiseSuppression,
    autoGainControl: config.audio.autoGainControl,
    sampleRate: settings.sampleRate,
    channelCount: settings.channelCount
  };
};

/**
 * Get display media constraints for screen capture
 */
export const getDisplayMediaConstraints = (audioOnly: boolean = false): DisplayMediaStreamOptions => {
  const audioConstraints = getAudioConstraints();
  
  return {
    audio: audioConstraints as MediaTrackConstraints,
    video: audioOnly ? false : {
      displaySurface: 'browser' as DisplayCaptureSurfaceType,
      logicalSurface: true,
      cursor: 'never' as CursorCaptureConstraint
    }
  };
};

/**
 * Check if current browser supports audio capture
 */
export const checkBrowserSupport = (): {
  supported: boolean;
  method: 'extension' | 'screen' | 'none';
  limitations: string[];
} => {
  const userAgent = navigator.userAgent.toLowerCase();
  
  // Check for Chrome/Edge
  if (userAgent.includes('chrome') || userAgent.includes('edg')) {
    return {
      supported: true,
      method: 'extension',
      limitations: ['Requires extension for tab audio', 'Screen share includes audio option']
    };
  }
  
  // Check for Safari
  if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
    const safariMatch = userAgent.match(/version\/(\d+)/);
    const version = safariMatch ? parseInt(safariMatch[1], 10) : 0;
    
    if (version >= 13) {
      return {
        supported: true,
        method: 'screen',
        limitations: ['Requires screen share', 'May not capture all audio sources']
      };
    }
  }
  
  // Check for Firefox
  if (userAgent.includes('firefox')) {
    return {
      supported: true,
      method: 'screen',
      limitations: ['Limited audio capture support', 'Screen share required']
    };
  }
  
  return {
    supported: false,
    method: 'none',
    limitations: ['Browser does not support audio capture']
  };
};

// Export configuration instance
export const browserCaptureConfig = getBrowserCaptureConfig();