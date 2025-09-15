/**
 * Browser Detection Utility
 * Provides cross-browser compatibility detection for audio capture features
 */

export interface BrowserInfo {
  name: 'chrome' | 'safari' | 'firefox' | 'edge' | 'opera' | 'unknown';
  version: string;
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  supportsScreenCapture: boolean;
  supportsTabCapture: boolean;
  supportsExtensions: boolean;
  preferredCaptureMethod: 'extension' | 'screen' | 'none';
}

/**
 * Detects the current browser and its capabilities
 */
export function detectBrowser(): BrowserInfo {
  const userAgent = navigator.userAgent.toLowerCase();
  const vendor = navigator.vendor?.toLowerCase() || '';
  
  // Detect browser name and version
  let name: BrowserInfo['name'] = 'unknown';
  let version = '';
  
  // Chrome detection (must check before Safari as Chrome includes Safari in UA)
  if (userAgent.includes('chrome') && vendor.includes('google')) {
    name = 'chrome';
    const match = userAgent.match(/chrome\/(\d+\.\d+)/);
    version = match ? match[1] : '';
  }
  // Edge detection
  else if (userAgent.includes('edg/')) {
    name = 'edge';
    const match = userAgent.match(/edg\/(\d+\.\d+)/);
    version = match ? match[1] : '';
  }
  // Opera detection
  else if (userAgent.includes('opr/') || userAgent.includes('opera')) {
    name = 'opera';
    const match = userAgent.match(/(?:opr|opera)\/(\d+\.\d+)/);
    version = match ? match[1] : '';
  }
  // Safari detection
  else if (userAgent.includes('safari') && vendor.includes('apple')) {
    name = 'safari';
    const match = userAgent.match(/version\/(\d+\.\d+)/);
    version = match ? match[1] : '';
  }
  // Firefox detection
  else if (userAgent.includes('firefox')) {
    name = 'firefox';
    const match = userAgent.match(/firefox\/(\d+\.\d+)/);
    version = match ? match[1] : '';
  }
  
  // Mobile detection
  const isMobile = /mobile|android|iphone|ipad|ipod|windows phone/i.test(userAgent);
  
  // iOS detection
  const isIOS = /iphone|ipad|ipod/i.test(userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad Pro detection
  
  // Android detection
  const isAndroid = /android/i.test(userAgent);
  
  // Feature detection
  const supportsScreenCapture = 'getDisplayMedia' in navigator.mediaDevices;
  
  // Chrome extensions are only supported on desktop Chrome, Edge, Opera
  const supportsTabCapture = !isMobile && (name === 'chrome' || name === 'edge' || name === 'opera');
  const supportsExtensions = supportsTabCapture;
  
  // Determine preferred capture method
  let preferredCaptureMethod: BrowserInfo['preferredCaptureMethod'] = 'none';
  
  if (!isMobile) {
    if (supportsTabCapture) {
      // Chrome-based browsers: prefer extension for better quality
      preferredCaptureMethod = 'extension';
    } else if (supportsScreenCapture) {
      // Safari/Firefox: use screen capture
      preferredCaptureMethod = 'screen';
    }
  }
  
  return {
    name,
    version,
    isMobile,
    isIOS,
    isAndroid,
    supportsScreenCapture,
    supportsTabCapture,
    supportsExtensions,
    preferredCaptureMethod
  };
}

/**
 * Checks if the browser supports audio capture from screen sharing
 */
export function supportsAudioCapture(): boolean {
  const browser = detectBrowser();
  
  // iOS doesn't support audio capture at all
  if (browser.isIOS) {
    return false;
  }
  
  // Mobile browsers generally don't support screen audio capture
  if (browser.isMobile) {
    return false;
  }
  
  // Desktop browsers with screen capture support
  return browser.supportsScreenCapture;
}

/**
 * Gets the recommended audio constraints for the current browser
 */
export function getAudioConstraints(browser?: BrowserInfo): MediaStreamConstraints {
  const browserInfo = browser || detectBrowser();
  
  if (browserInfo.name === 'safari') {
    // Safari-specific constraints
    return {
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 48000
      },
      video: false
    };
  }
  
  // Chrome and other browsers
  return {
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      sampleRate: 48000,
      channelCount: 2
    },
    video: false
  };
}

/**
 * Gets display media constraints for screen capture with audio
 */
export function getDisplayMediaConstraints(browser?: BrowserInfo): DisplayMediaStreamOptions {
  const browserInfo = browser || detectBrowser();
  
  if (browserInfo.name === 'safari') {
    // Safari requires different constraints
    return {
      audio: true,
      video: {
        displaySurface: 'browser' as DisplayCaptureSurfaceType,
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    };
  }
  
  // Chrome and other browsers
  return {
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    } as MediaTrackConstraints,
    video: {
      displaySurface: 'browser' as DisplayCaptureSurfaceType,
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    }
  };
}

/**
 * Checks if the browser needs user gesture for screen capture
 */
export function requiresUserGesture(browser?: BrowserInfo): boolean {
  const browserInfo = browser || detectBrowser();
  
  // All browsers require user gesture for getDisplayMedia
  return true;
}

/**
 * Gets browser-specific instructions for audio capture
 */
export function getCaptureInstructions(browser?: BrowserInfo): string {
  const browserInfo = browser || detectBrowser();
  
  if (browserInfo.isIOS) {
    return 'Audio capture is not supported on iOS devices. Please use a desktop browser.';
  }
  
  if (browserInfo.isMobile) {
    return 'Audio capture is not supported on mobile devices. Please use a desktop browser.';
  }
  
  switch (browserInfo.name) {
    case 'safari':
      return 'Click "Start Capture" and select the window or screen with your video call. Make sure to check "Share Audio" in the dialog.';
    
    case 'chrome':
    case 'edge':
    case 'opera':
      return 'Click "Start Capture" and select the browser tab with your video call. IMPORTANT: Check the "Share tab audio" checkbox in the dialog to capture audio.';
    
    case 'firefox':
      return 'Click "Start Capture" and select the window with your video call. Audio capture may have limitations in Firefox.';
    
    default:
      return 'Click "Start Capture" and select the window or tab with your video call.';
  }
}