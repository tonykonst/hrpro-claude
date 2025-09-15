# Feature Flags Guide - Browser Audio Capture

## Quick Start - Disabling Browser Capture

### Method 1: Environment Variable (Recommended for Production)
```bash
# In your .env file:
REACT_APP_ENABLE_BROWSER_CAPTURE=false
```

### Method 2: Code Comments (Quick Development Toggle)
```typescript
// In src/config/featureFlags.ts, line 70:
// ENABLE_BROWSER_CAPTURE: true,  // <-- Comment this line to disable
```

### Method 3: Runtime Control (UI Toggle)
Press `Ctrl+Shift+F` (or `Cmd+Shift+F` on Mac) to open the feature flag panel.

### Method 4: Console Commands (Development)
```javascript
// In browser console:
__quickDisable.disableAllBrowserCapture()
__quickDisable.enableMinimalMode()
```

## Complete Feature Flag Reference

### Master Switches

| Flag | Environment Variable | Description |
|------|---------------------|-------------|
| `ENABLE_BROWSER_CAPTURE` | `REACT_APP_ENABLE_BROWSER_CAPTURE` | Master switch for ALL browser capture features |
| `ENABLE_SYSTEM_AUDIO` | `REACT_APP_ENABLE_SYSTEM_AUDIO` | Future system audio capture (Phase 2) |

### Browser-Specific Features

| Flag | Environment Variable | Description |
|------|---------------------|-------------|
| `ENABLE_CHROME_EXTENSION` | `REACT_APP_ENABLE_CHROME_EXTENSION` | Chrome/Edge extension support |
| `ENABLE_SAFARI_CAPTURE` | `REACT_APP_ENABLE_SAFARI_CAPTURE` | Safari screen capture with audio |
| `ENABLE_FIREFOX_CAPTURE` | `REACT_APP_ENABLE_FIREFOX_CAPTURE` | Firefox screen capture support |

### UI Features

| Flag | Environment Variable | Description |
|------|---------------------|-------------|
| `ENABLE_AUDIO_SOURCE_SELECTOR` | `REACT_APP_ENABLE_AUDIO_SOURCE_SELECTOR` | Audio source selection dropdown |
| `ENABLE_CROSS_BROWSER_UI` | `REACT_APP_ENABLE_CROSS_BROWSER_UI` | Browser-specific UI adaptations |
| `ENABLE_AUDIO_VISUALIZER` | `REACT_APP_ENABLE_AUDIO_VISUALIZER` | Audio level meters and visualizers |
| `ENABLE_PERMISSION_PROMPTS` | `REACT_APP_ENABLE_PERMISSION_PROMPTS` | Custom permission request dialogs |

### Advanced Features

| Flag | Environment Variable | Description |
|------|---------------------|-------------|
| `ENABLE_AUTO_SOURCE_FALLBACK` | `REACT_APP_ENABLE_AUTO_SOURCE_FALLBACK` | Auto-switch sources on failure |
| `ENABLE_QUALITY_ADAPTATION` | `REACT_APP_ENABLE_QUALITY_ADAPTATION` | Adaptive quality based on performance |
| `ENABLE_DEBUG_MODE` | `REACT_APP_ENABLE_DEBUG_MODE` | Debug overlays and logging |
| `ENABLE_TELEMETRY` | `REACT_APP_ENABLE_TELEMETRY` | Usage analytics (privacy-safe) |

## Usage in Code

### Using React Hooks

```typescript
import { useFeatureFlags, useFeatureFlag, useBrowserCapture } from './hooks/useFeatureFlags';

// Check single flag
const isChromeEnabled = useFeatureFlag('ENABLE_CHROME_EXTENSION');

// Use browser capture info
const { enabled, available, methods } = useBrowserCapture();

// Full feature flag control
const { flags, toggleFlag, applyPreset } = useFeatureFlags();
```

### Direct API Usage

```typescript
import { isFeatureEnabled, getAvailableCaptureMethods } from './config/featureFlags';

if (isFeatureEnabled('ENABLE_BROWSER_CAPTURE')) {
  // Browser capture code here
}

const methods = getAvailableCaptureMethods();
// Returns: ['chrome-tab', 'microphone'] etc.
```

### Using the Capture Service

```typescript
import { captureService, isBrowserCaptureAvailable } from './services/featureFlaggedCapture';

// Check availability
if (isBrowserCaptureAvailable()) {
  // Get sources
  const sources = captureService.getAvailableSources();
  
  // Start capture (auto-fallback to microphone if needed)
  const result = await captureService.startCapture({
    source: 'browser-tab',
    quality: 'high'
  });
  
  if (result.fallbackUsed) {
    console.log('Fell back to microphone');
  }
}
```

## Preset Configurations

### Production
```javascript
// All features enabled, no debug
applyPreset('production');
```

### Development
```javascript
// Debug enabled, telemetry off
applyPreset('development');
```

### Testing
```javascript
// Minimal features for testing
applyPreset('testing');
```

### Minimal
```javascript
// Microphone only, no browser capture
applyPreset('minimal');
```

## Quick Disable Utilities

Import in your main app file:
```typescript
import './config/quickDisable';

// Then uncomment the function you want:
// disableAllBrowserCapture();
// enableMinimalMode();
// enableDebugMode();
```

## Comment Blocks for Easy Toggling

The codebase includes clear comment blocks for easy feature toggling:

```typescript
// ┌─────────────────────────────────────────────────────────────────────┐
// │ MASTER SWITCH - Comment out or set to false to disable everything  │
// └─────────────────────────────────────────────────────────────────────┘
ENABLE_BROWSER_CAPTURE: true,  // <-- COMMENT THIS LINE TO DISABLE
```

## Runtime UI Control

### Enable Feature Flag Panel

1. Set in `.env`:
```bash
REACT_APP_SHOW_FEATURE_PANEL=true
```

2. Or press keyboard shortcut:
   - Windows/Linux: `Ctrl+Shift+F`
   - Mac: `Cmd+Shift+F`

### Panel Features
- Toggle individual flags
- Apply preset configurations
- Export/import configurations
- View available capture methods

## Graceful Degradation

When browser capture is disabled:
1. App automatically falls back to microphone
2. No errors are thrown
3. UI adapts to show only available options
4. Performance is optimized

## Environment-Specific Setup

### Development
```bash
# .env.development
REACT_APP_ENABLE_BROWSER_CAPTURE=true
REACT_APP_ENABLE_DEBUG_MODE=true
REACT_APP_SHOW_FEATURE_PANEL=true
```

### Production
```bash
# .env.production
REACT_APP_ENABLE_BROWSER_CAPTURE=true
REACT_APP_ENABLE_DEBUG_MODE=false
REACT_APP_ENABLE_TELEMETRY=true
```

### Testing
```bash
# .env.test
REACT_APP_ENABLE_BROWSER_CAPTURE=false
REACT_APP_ENABLE_DEBUG_MODE=true
```

## Troubleshooting

### Browser capture not working?
1. Check if `ENABLE_BROWSER_CAPTURE` is true
2. Verify browser-specific flag is enabled
3. Check browser compatibility
4. Look for console errors

### Features not toggling?
1. Restart dev server after `.env` changes
2. Check for typos in environment variables
3. Verify feature dependencies

### UI not showing feature options?
1. Check `ENABLE_AUDIO_SOURCE_SELECTOR`
2. Verify `ENABLE_CROSS_BROWSER_UI`
3. Check browser detection logic

## Best Practices

1. **Use environment variables** for production deployments
2. **Use runtime toggles** for A/B testing
3. **Use code comments** for quick development testing
4. **Always test fallback** behavior when disabling features
5. **Document flag changes** in commit messages