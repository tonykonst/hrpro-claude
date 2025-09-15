# Implementation Progress: Audio Capture Feature
## Status: READY TO BEGIN DEVELOPMENT

## Current Progress: Planning Complete ✅

### Completed Research & Documentation
- **Codebase Analysis**: Current audio capabilities using Deepgram + MediaRecorder pipeline
- **Technology Research**: Browser and Electron audio capture methods thoroughly investigated
- **GitHub Examples**: 7 repositories analyzed with working implementations
- **Architecture Planning**: Integration points and new services designed
- **Risk Assessment**: Technical challenges identified with mitigation strategies

## Phase 1 Implementation Plan: Browser-Based Capture

### Step 1: Chrome Extension Development (Week 1)
**Based on**: teamplanes/audio-capture-extension example

**Files to Create:**
```
src/extensions/chrome-audio-capture/
├── manifest.json           # Extension configuration
├── background.js          # Service worker for audio capture
├── content-script.js      # Inject into video call pages
└── popup/                 # Extension UI (optional)
```

**Key Implementation:**
```javascript
// Background script - audio capture logic
chrome.tabCapture.capture({audio: true}, (stream) => {
  // Send audio stream to main application
  const mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (event) => {
    // Forward to Electron main process
    chrome.runtime.sendMessage({
      type: 'AUDIO_DATA',
      data: event.data
    });
  };
});
```

### Step 2: Web API Fallback Implementation (Week 1)
**Based on**: addpipe/getDisplayMedia-demo example

**Files to Create:**
```
src/services/audio-capture/
├── browser-capture.ts     # Main browser capture service
├── display-media.ts       # getDisplayMedia wrapper
└── permission-manager.ts  # Permission handling
```

**Key Implementation:**
```typescript
// Browser capture service
class BrowserCaptureService {
  async captureTabAudio(): Promise<MediaStream> {
    try {
      // Try Chrome extension first
      if (this.hasExtension()) {
        return await this.captureViaExtension();
      }
      // Fallback to getDisplayMedia
      return await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: { mediaSource: 'tab' }
      });
    } catch (error) {
      console.error('Browser capture failed:', error);
      throw error;
    }
  }
}
```

### Step 3: Integration with Existing Pipeline (Week 2)
**Extend Current Services:**

**Update useAudioRecording.ts:**
```typescript
export interface UseAudioRecordingReturn {
  // Existing properties
  hasPermission: boolean;
  
  // New audio capture methods
  captureSystemAudio: () => Promise<void>;
  captureTabAudio: () => Promise<void>;
  audioSources: AudioSource[];
  selectedSource: AudioSource | null;
}
```

**Update Transcription Services:**
```typescript
// Add support for multiple audio sources
const connectToDeepgram = async (audioSource: AudioSource) => {
  // Existing Deepgram connection logic
  // Extended to handle different audio source types
};
```

### Step 4: UI Components (Week 2-3)
**New Components to Create:**
```
src/components/audio-capture/
├── AudioSourceSelector.tsx    # Dropdown for source selection
├── CapturePermissions.tsx     # Permission guidance
└── AudioQualityIndicator.tsx  # Quality monitoring
```

**AudioSourceSelector.tsx Example:**
```typescript
interface AudioSource {
  id: string;
  name: string;
  type: 'microphone' | 'tab' | 'system' | 'application';
  available: boolean;
}

export const AudioSourceSelector: React.FC = () => {
  const [sources, setSources] = useState<AudioSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<AudioSource | null>(null);
  
  return (
    <div className="audio-source-selector">
      <select onChange={handleSourceChange}>
        {sources.map(source => (
          <option key={source.id} value={source.id} disabled={!source.available}>
            {source.name}
          </option>
        ))}
      </select>
    </div>
  );
};
```

## Phase 2 Planning: Electron System Audio

### macOS Implementation (Future)
**Based on**: O4FDev/electron-system-audio-recorder

**Native Swift Integration:**
```
src/native/macos/
├── ScreenCaptureKitRecorder.swift
├── AudioCaptureManager.swift
└── build-scripts/
```

### Windows Implementation (Future)
**Based on**: Windows WASAPI integration

### Linux Implementation (Future)
**Based on**: PulseAudio integration

## Feature Flags Implementation

### Runtime Configuration
```typescript
// Feature flags service
interface AudioCaptureFlags {
  browserCapture: boolean;
  systemCapture: boolean;
  tabCapture: boolean;
  applicationCapture: boolean;
}

const defaultFlags: AudioCaptureFlags = {
  browserCapture: false,  // Comment out initially as requested
  systemCapture: false,
  tabCapture: false,
  applicationCapture: false,
};
```

### UI Controls
```typescript
// Settings panel for enabling/disabling features
export const AudioCaptureSettings: React.FC = () => {
  const [flags, setFlags] = useAudioCaptureFlags();
  
  return (
    <div className="audio-capture-settings">
      <label>
        <input 
          type="checkbox" 
          checked={flags.browserCapture}
          onChange={(e) => setFlags({...flags, browserCapture: e.target.checked})}
        />
        Enable Browser Audio Capture
      </label>
      {/* Additional feature toggles */}
    </div>
  );
};
```

## Testing Strategy

### Unit Tests
```
src/services/audio-capture/__tests__/
├── browser-capture.test.ts
├── permission-manager.test.ts
└── audio-mixing.test.ts
```

### Integration Tests
```
src/__tests__/integration/
├── audio-capture-flow.test.ts
├── transcription-integration.test.ts
└── ui-component-interaction.test.ts
```

### Manual Testing Checklist
- [ ] Chrome extension captures Zoom audio
- [ ] Chrome extension captures Google Meet audio
- [ ] getDisplayMedia fallback works without extension
- [ ] Audio quality maintained through pipeline
- [ ] Permissions handled gracefully
- [ ] Error states provide helpful guidance
- [ ] Feature flags work correctly
- [ ] Integration with existing transcription works

## Development Notes

### Current Architecture Integration Points
1. **useTranscriptionRecording**: Extend to support multiple audio sources
2. **Deepgram Service**: Already supports arbitrary MediaStream inputs
3. **Audio Analysis**: useAudioAnalyser can be extended for new sources
4. **UI State**: Control panel can accommodate new audio source controls

### Logging Strategy
```typescript
// Comprehensive logging for audio capture debugging
console.log('🎤 [AudioCapture] Browser capture initiated');
console.log('📊 [AudioCapture] Available sources:', sources);
console.log('🔊 [AudioCapture] Audio quality:', qualityMetrics);
console.error('❌ [AudioCapture] Capture failed:', error);
```

### Error Handling Patterns
```typescript
try {
  const stream = await captureTabAudio();
  console.log('✅ Tab audio capture successful');
} catch (error) {
  console.error('❌ Tab audio capture failed:', error);
  // Provide user-friendly error message
  showNotification('Audio capture failed. Please check permissions.');
  // Attempt fallback method
  return await fallbackCaptureMethod();
}
```

## Ready for Development

### Prerequisites Met ✅
- [x] Research complete with 7+ GitHub examples
- [x] Architecture planned and integration points identified
- [x] Phase 1 implementation plan detailed
- [x] Risk mitigation strategies defined
- [x] Feature flag system designed for easy commenting out

### Next Steps
1. **Create feature branch**: `feature/audio-capture-video-calls`
2. **Start with Chrome Extension**: Implement basic tab capture
3. **Add getDisplayMedia fallback**: Web-based capture method
4. **Integrate with existing pipeline**: Connect to Deepgram service
5. **Add UI controls**: Audio source selection and permissions
6. **Implement feature flags**: Allow easy disabling as requested
7. **Test with video conferencing**: Zoom, Google Meet, Teams
8. **Document real-time progress**: Update this file during development

### Development Environment Ready
- Electron + React + TypeScript environment supports all required APIs
- Existing MediaRecorder + Deepgram pipeline can accept new audio sources
- Chrome extension development tools available
- Testing infrastructure can be extended

---

**Status**: Ready for developer implementation  
**Priority**: High (Phase 1)  
**Estimated Timeline**: 2-3 weeks for Phase 1 browser capture  
**Blocking Issues**: None identified