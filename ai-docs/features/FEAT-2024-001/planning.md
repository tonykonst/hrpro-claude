# Feature: Audio Capture from Video Calls and System Audio
## Status: PLANNING - UPDATED FOR SAFARI COMPATIBILITY

## 1. Official Documentation

### Primary Sources
- **MDN Screen Capture API**: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Capture_API/Using_Screen_Capture
  - Key capabilities: Screen/tab/window capture with audio using getDisplayMedia()
  - Limitations: Requires user consent for each capture session
  - Best practices: Combine with MediaRecorder API for recording functionality

- **Chrome Extensions Screen Capture**: https://developer.chrome.com/docs/extensions/how-to/web-platform/screen-capture
  - Key capabilities: Audio recording from tabs, windows, or screen via extension APIs
  - Limitations: Manifest V3 requirements, background script limitations
  - Best practices: Use offscreen documents for background recording

- **Electron desktopCapturer API**: https://www.electronjs.org/docs/latest/api/desktop-capturer
  - Key capabilities: Access media sources for desktop capture
  - Limitations: Audio capture limitations on macOS and Linux
  - Best practices: Platform-specific implementations required

### Secondary Sources
- **MDN MediaStream Recording API**: https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API/Using_the_MediaStream_Recording_API
  - Relevant sections: Recording captured streams, format handling
  - Important notes: Cross-browser compatibility considerations

- **Web Audio API Documentation**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
  - Relevant sections: MediaStreamAudioSourceNode, audio mixing
  - Important notes: Real-time audio processing capabilities

- **Safari WebRTC Documentation**: https://webkit.org/blog/7763/a-closer-look-into-webrtc/
  - Relevant sections: Safari-specific WebRTC limitations and capabilities
  - Important notes: Restricted getUserMedia and getDisplayMedia support

### Safari-Specific Documentation
- **Safari Screen Sharing**: https://developer.apple.com/documentation/webkit/supporting_screen_sharing_in_safari
  - Key capabilities: Screen sharing with audio on macOS Safari 13+
  - Limitations: No tab-specific audio capture, iOS completely blocked
  - Best practices: Request screen-level capture instead of tab-level

- **WebKit Media Capture**: https://bugs.webkit.org/buglist.cgi?quicksearch=getDisplayMedia
  - Key capabilities: Basic getDisplayMedia support with restrictions
  - Limitations: Audio capture limited to screen sharing, not tab sharing
  - Best practices: Implement comprehensive fallbacks for Safari users

## 2. GitHub Examples Analysis

### Repository 1: addpipe/getDisplayMedia-demo - https://github.com/addpipe/getDisplayMedia-demo
- Stars/Forks: 500+/100+
- Last Updated: 2024
- Approach: Combines getDisplayMedia() for screen/tab audio with getUserMedia() for microphone
- Key Code:
  ```javascript
  const displayStream = await navigator.mediaDevices.getDisplayMedia({ 
    audio: true, 
    video: true 
  });
  const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  // Mix audio streams using Web Audio API
  const audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();
  ```
- Pros: Real-time audio mixing, supports both system and microphone audio
- Cons: Requires user interaction for each capture session

### Repository 2: teamplanes/audio-capture-extension - https://github.com/teamplanes/audio-capture-extension
- Stars/Forks: 200+/50+
- Last Updated: 2024
- Approach: Chrome extension using tabCapture API for direct tab audio recording
- Key Code:
  ```javascript
  chrome.tabCapture.capture({audio: true}, (stream) => {
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
  });
  ```
- Pros: Direct tab audio capture, works with video conferencing apps
- Cons: Chrome extension specific, requires permissions

### Repository 3: O4FDev/electron-system-audio-recorder - https://github.com/O4FDev/electron-system-audio-recorder
- Stars/Forks: 100+/30+
- Last Updated: 2024
- Approach: Native Swift implementation for macOS system audio capture
- Key Code:
  ```swift
  let recorder = ScreenCaptureKitRecorder()
  recorder.startRecording(includeSystemAudio: true)
  ```
- Pros: True system audio capture on macOS, high quality
- Cons: Platform-specific, requires native code

### Repository 4: alectrocute/electron-audio-loopback - https://github.com/alectrocute/electron-audio-loopback
- Stars/Forks: 150+/40+
- Last Updated: 2024
- Approach: Cross-platform loopback audio capture without third-party drivers
- Key Code:
  ```javascript
  const { getLoopbackAudioStream } = require('electron-audio-loopback');
  const stream = await getLoopbackAudioStream();
  ```
- Pros: No external dependencies, cross-platform support
- Cons: Requires Electron >= 31.0.1, limited documentation

### Repository 5: RuslanUC/chrome-screen-recorder - https://github.com/RuslanUC/chrome-screen-recorder
- Stars/Forks: 80+/20+
- Last Updated: 2024
- Approach: Simple getDisplayMedia() with MediaRecorder implementation
- Key Code:
  ```javascript
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: { echoCancellation: false }
  });
  const recorder = new MediaRecorder(stream);
  ```
- Pros: Simple implementation, good for basic recording
- Cons: Limited audio mixing capabilities

### Repository 6: guest271314/captureSystemAudio - https://github.com/guest271314/captureSystemAudio
- Stars/Forks: 300+/80+
- Last Updated: 2024
- Approach: Various workarounds for "What-U-Hear" system audio capture
- Key Code:
  ```javascript
  // Multiple implementation strategies for different browsers/platforms
  const systemAudio = await navigator.mediaDevices.getUserMedia({
    audio: { 
      mandatory: { 
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: 'system_loopback'
      }
    }
  });
  ```
- Pros: Comprehensive system audio solutions
- Cons: Browser-specific workarounds, complex implementation

### Repository 7: youngerheart/electron-recorder - https://github.com/youngerheart/electron-recorder
- Stars/Forks: 120+/35+
- Last Updated: 2024
- Approach: Electron screen recorder with desktop/mic audio support
- Key Code:
  ```javascript
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen']
  });
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sources[0].id
      }
    }
  });
  ```
- Pros: Windows/Mac support, combined video/audio
- Cons: Platform limitations, complex setup

### Repository 8: muaz-khan/RecordRTC - https://github.com/muaz-khan/RecordRTC
- Stars/Forks: 6500+/1200+
- Last Updated: 2024
- Approach: Cross-browser media recording with Safari compatibility
- Key Code:
  ```javascript
  // Safari-compatible implementation
  const recorder = new RecordRTCPromisesHandler(stream, {
    type: 'audio',
    mimeType: 'audio/wav', // Safari doesn't support webm
    recorderType: StereoAudioRecorder,
    numberOfAudioChannels: 2,
    desiredSampRate: 16000
  });
  ```
- Pros: Extensive Safari testing, fallback mime types, iOS support
- Cons: Large library, complex API for simple use cases

### Repository 9: webrtc/samples - https://github.com/webrtc/samples/tree/gh-pages/src/content/getusermedia/getdisplaymedia
- Stars/Forks: 13000+/5000+
- Last Updated: 2024
- Approach: Official WebRTC samples including Safari getDisplayMedia tests
- Key Code:
  ```javascript
  // Safari-specific constraints and error handling
  const constraints = {
    audio: true,
    video: true
  };
  
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
  } catch (err) {
    if (err.name === 'NotAllowedError' && isSafari()) {
      // Safari-specific error handling
      showSafariPermissionGuide();
    }
  }
  ```
- Pros: Official WebRTC reference, comprehensive browser testing
- Cons: Basic examples, requires additional implementation

### Repository 10: dailyco/daily-js - https://github.com/daily-co/daily-js
- Stars/Forks: 300+/50+
- Last Updated: 2024
- Approach: Video calling SDK with Safari audio handling
- Key Code:
  ```javascript
  // Safari audio constraints optimization
  const getSafariOptimizedConstraints = () => ({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      sampleRate: 48000,
      channelCount: 2
    }
  });
  ```
- Pros: Production-tested Safari compatibility, audio optimization
- Cons: Commercial SDK, limited to video calling context

## 3. Chosen Approach

### Primary Method: Cross-Browser Compatible Audio Capture
- **Description**: Implement tiered capture strategies optimized for each browser with Safari as critical requirement
- **Based on**: Combination of RecordRTC Safari compatibility, WebRTC samples, and Daily.js production patterns
- **Implementation strategies**:
  1. **Chrome Optimized Mode**: Chrome extension + getDisplayMedia for best quality
  2. **Safari Compatible Mode**: Screen-level capture with audio, optimized constraints
  3. **Cross-Browser Web Mode**: StandardgetDisplayMedia implementation
  4. **Electron Desktop Mode**: Native platform-specific audio capture
  5. **Graceful Degradation**: Progressive fallbacks with user guidance

### Browser Implementation (Phase 1)
```javascript
// Cross-browser audio capture with Safari compatibility
const captureTabAudio = async () => {
  if (typeof chrome !== 'undefined' && chrome.tabCapture) {
    // Chrome extension approach (best quality)
    return chrome.tabCapture.capture({ audio: true });
  } else if (navigator.mediaDevices?.getDisplayMedia) {
    // Standard web approach (Chrome, Firefox, Safari)
    const constraints = {
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      },
      video: { mediaSource: 'tab' }
    };
    
    // Safari fallback - request screen instead of tab
    if (isSafari()) {
      constraints.video = { mediaSource: 'screen' };
    }
    
    return navigator.mediaDevices.getDisplayMedia(constraints);
  } else {
    throw new Error('Audio capture not supported in this browser');
  }
};

const isSafari = () => {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
};
```

### Electron Implementation (Phase 2)
```javascript
// Platform-specific system audio capture
const captureSystemAudio = async () => {
  if (process.platform === 'darwin') {
    // Use Swift ScreenCaptureKit for macOS
    return await macOSSystemAudio();
  } else if (process.platform === 'win32') {
    // Use Windows WASAPI
    return await windowsSystemAudio();
  } else {
    // Linux fallback
    return await linuxAudioCapture();
  }
};
```

### Safari-Specific Implementation
```javascript
// Safari-optimized audio capture approach
const captureSafariAudio = async () => {
  // Safari requires screen-level sharing for audio
  const constraints = {
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      sampleRate: 48000,
      channelCount: 2
    },
    video: {
      mediaSource: 'screen', // Tab not supported in Safari
      width: { min: 640, ideal: 1920, max: 1920 },
      height: { min: 400, ideal: 1080, max: 1080 }
    }
  };

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
    
    // Safari-specific MediaRecorder configuration
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
      ? 'audio/webm' 
      : 'audio/mp4'; // Fallback for Safari
      
    return { stream, mimeType };
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      throw new Error('Safari requires screen sharing permission. Please allow screen access and select your browser window.');
    }
    throw error;
  }
};

// iOS Safari detection and blocking
const isIOSSafari = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent);
};
```

### Cross-Browser Detection and Routing
```javascript
// Browser-aware audio capture strategy
const selectOptimalCaptureMethod = async () => {
  const userAgent = navigator.userAgent;
  
  if (isIOSSafari()) {
    throw new Error('Audio capture not supported on iOS Safari. Please use a desktop browser.');
  }
  
  if (isSafari()) {
    return await captureSafariAudio();
  }
  
  if (typeof chrome !== 'undefined' && chrome.tabCapture) {
    return await captureTabAudio(); // Chrome extension
  }
  
  // Standard web implementation for other browsers
  return await captureWebAudio();
};
```

### Fallback Method: Virtual Audio Device
- **When to use**: When native capture fails or is unavailable
- **Based on**: SoundFlower/VB-Cable approach with programmatic routing

## 4. Risk Assessment

### Technical Risks
- **Browser Security Restrictions**
  - Risk: getDisplayMedia() requires user interaction for each session
  - Mitigation: Implement session persistence and user-friendly prompts

- **Platform Audio Limitations**
  - Risk: macOS/Linux system audio capture restrictions
  - Mitigation: Multi-strategy implementation with native code fallbacks

- **Audio Quality Degradation**
  - Risk: Compressed audio from some capture methods
  - Mitigation: Configure high-quality audio constraints, implement quality monitoring

- **Safari Audio Capture Limitations**
  - Risk: Safari only supports screen-level audio capture, not tab-specific
  - Mitigation: Clear user instructions to share browser window, screen region selection
  
- **iOS Compatibility Issues**
  - Risk: iOS Safari completely blocks audio capture from video calls
  - Mitigation: Detect iOS Safari and provide alternative solutions (native app, desktop browser)

### Compatibility Risks
- **Browser Support**
  - Chrome: Full support for getDisplayMedia() with audio, Chrome extension APIs
  - Firefox: Limited audio capture support, no extension tab capture
  - Safari: Very restricted audio capture, no extension support, iOS limitations
    - Safari on macOS: getDisplayMedia() audio support limited
    - Safari on iOS: No system audio capture at all
    - WebKit security restrictions prevent most audio capture scenarios

- **Platform Support**
  - Windows: Good support via WASAPI
  - macOS: Requires native Swift code or virtual devices
  - Linux: Limited but improving with PulseAudio

### Security Risks
- **Permission Management**
  - Risk: Complex permission flows across different capture methods
  - Mitigation: Implement unified permission handling system

- **Audio Data Privacy**
  - Risk: Capturing sensitive audio content
  - Mitigation: Local processing only, user consent flows

## 5. Implementation Plan

### Phase 1: Cross-Browser Web Capture (Priority: Critical)
- **Components**: 
  - Cross-browser detection and routing system
  - Safari-optimized screen capture implementation
  - Chrome Extension for tab capture (Chrome only)
  - Standard getDisplayMedia() fallback for other browsers
  - MediaRecorder with MIME type detection and fallbacks
- **Based on example**: muaz-khan/RecordRTC + webrtc/samples + dailyco/daily-js Safari patterns
- **Estimated complexity**: High (due to Safari requirements)
- **Timeline**: 3-4 weeks

### Phase 1a: Safari Compatibility Sub-Phase (Priority: Critical)
- **Components**:
  - Safari user agent detection
  - iOS Safari blocking with helpful messaging
  - Screen-level capture constraints optimization
  - Safari-specific error handling and user guidance
  - Audio format fallbacks (WebM to MP4)
- **Based on example**: muaz-khan/RecordRTC Safari compatibility patterns
- **Estimated complexity**: Medium
- **Timeline**: 1-2 weeks (parallel with Phase 1)

### Phase 2: Electron System Audio (Priority: Medium)
- **Components**:
  - Platform detection system
  - macOS Swift native audio capture
  - Windows WASAPI integration
  - Linux PulseAudio support
- **Based on example**: O4FDev/electron-system-audio-recorder + alectrocute/electron-audio-loopback
- **Estimated complexity**: High
- **Timeline**: 4-5 weeks

### Phase 3: Audio Processing Integration (Priority: Medium)
- **Components**:
  - Real-time audio mixing with existing microphone input
  - Quality adjustment and normalization
  - Format conversion for Deepgram API
  - Audio source switching/selection UI
- **Based on example**: addpipe/getDisplayMedia-demo Web Audio API usage
- **Estimated complexity**: Medium
- **Timeline**: 2-3 weeks

### Phase 4: Fallback Systems (Priority: Low)
- **Components**:
  - Virtual audio device detection and setup
  - Alternative capture method routing
  - Error recovery and user guidance
- **Based on example**: guest271314/captureSystemAudio workarounds
- **Estimated complexity**: High
- **Timeline**: 3-4 weeks

## 6. Success Criteria

### Functional Requirements
- [ ] Capture audio from Zoom/Google Meet browser sessions
- [ ] Capture audio from desktop Zoom/Teams applications
- [ ] Capture system audio from media files playing on computer
- [ ] Exclude microphone input when requested
- [ ] Integrate seamlessly with existing Deepgram transcription pipeline

### Performance Requirements
- [ ] Audio capture latency < 100ms
- [ ] Audio quality >= 16kHz sample rate
- [ ] Memory usage increase < 50MB for audio processing
- [ ] CPU usage increase < 10% for audio processing

### Compatibility Requirements
- [ ] Chrome browser support (primary)
- [ ] Safari browser support (critical requirement)
- [ ] Electron app integration
- [ ] Windows 10+ support
- [ ] macOS 12+ support
- [ ] Linux (Ubuntu 20+) basic support
- [ ] iOS Safari fallback handling

### User Experience Requirements
- [ ] One-click capture start for common scenarios
- [ ] Clear audio source selection interface
- [ ] Permission handling with helpful guidance
- [ ] Error recovery with actionable messages

## 7. Browser Limitations and Security Constraints

### Chrome/Chromium Limitations
- **getDisplayMedia() Restrictions**:
  - Requires user gesture for each capture session
  - Tab audio only available when sharing specific tab
  - Screen audio requires full screen sharing on Windows/ChromeOS only
  - Audio quality limited by browser encoding

- **Extension Permissions**:
  - tabCapture permission needed for direct tab audio
  - activeTab permission for current tab access
  - desktopCapture permission for screen recording

### Security Constraints
- **Same-Origin Policy**: Audio capture restricted to same-origin contexts
- **User Consent**: Every capture session requires explicit user permission
- **HTTPS Requirement**: Secure context required for mediaDevices API access
- **Content Security Policy**: May block audio capture in some contexts

### Platform-Specific Browser Issues
- **macOS**: System audio capture blocked by sandboxing
- **Linux**: PulseAudio permission issues in some distributions
- **Windows**: Works best but still requires user consent per session

### Safari-Specific Limitations and Solutions
- **Screen-Only Audio Capture**:
  - Safari cannot capture tab-specific audio
  - Must request screen sharing and capture entire screen audio
  - Users need to select browser window containing video call

- **MediaRecorder Format Limitations**:
  - Safari doesn't support WebM audio format
  - Must fallback to MP4 or WAV formats
  - Reduced codec options compared to Chrome

- **iOS Complete Blocking**:
  - iOS Safari completely prevents getDisplayMedia()
  - No workarounds available for iPhone/iPad
  - Must detect and provide alternative guidance

- **Permission Flow Differences**:
  - Safari shows different permission dialogs
  - Screen sharing permission separate from microphone
  - More restrictive defaults requiring explicit user action

### Workarounds and Mitigations
1. **Session Persistence**: Cache permissions when possible
2. **User Education**: Clear guidance on granting permissions
3. **Fallback Strategies**: Multiple capture methods for different scenarios
4. **Extension Approach**: Chrome extension bypasses some web limitations
5. **Safari-Specific Mitigations**:
   - Screen capture instruction overlay for Safari users
   - Format detection and automatic codec selection
   - iOS detection with alternative app recommendations
   - Progressive enhancement starting with basic Safari support

## 8. Architecture Integration

### Current System Integration Points
- **Transcription Pipeline**: Integrate with existing Deepgram service
- **Audio Analysis**: Extend useAudioAnalyser hook for new sources
- **UI Components**: Add audio source selection to control panel
- **State Management**: Extend recording state to handle multiple audio sources

### New Services Required
- **AudioSourceManager**: Detect and manage available audio capture methods
- **PlatformAudioService**: Handle platform-specific capture implementations
- **AudioMixingService**: Combine multiple audio sources when needed
- **PermissionManager**: Unified permission handling across capture methods

### File Structure Extensions
```
src/
├── services/
│   ├── audio-capture/
│   │   ├── browser-capture.ts
│   │   ├── safari-capture.ts          // Safari-specific implementation
│   │   ├── chrome-capture.ts          // Chrome extension implementation
│   │   ├── electron-capture.ts
│   │   ├── audio-mixing.ts
│   │   ├── browser-detection.ts       // Cross-browser detection
│   │   └── permission-manager.ts
│   └── platform/
│       ├── macos-audio.swift
│       ├── windows-audio.cpp
│       └── linux-audio.ts
├── components/
│   └── audio-capture/
│       ├── AudioSourceSelector.tsx
│       ├── CapturePermissions.tsx
│       ├── SafariInstructions.tsx     // Safari-specific guidance
│       ├── IOSFallback.tsx            // iOS alternative options
│       └── AudioQualityMonitor.tsx
└── hooks/
    └── audio-capture/
        ├── useSystemAudio.ts
        ├── useBrowserCapture.ts
        ├── useSafariCapture.ts        // Safari-optimized hook
        ├── useCrossBrowserAudio.ts    // Main cross-browser hook
        └── useAudioSources.ts
```