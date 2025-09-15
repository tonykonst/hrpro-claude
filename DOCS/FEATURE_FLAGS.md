# Feature Flag Documentation

## 🎛️ Browser Audio Capture Feature Flag System

This document explains how to control the browser audio capture functionality using our comprehensive feature flag system.

---

## 📋 Table of Contents

1. [Quick Start - Disabling Browser Capture](#quick-start---disabling-browser-capture)
2. [Feature Flag Overview](#feature-flag-overview)
3. [Configuration Methods](#configuration-methods)
4. [Available Feature Flags](#available-feature-flags)
5. [Usage in Code](#usage-in-code)
6. [Development Tools](#development-tools)
7. [Testing Configurations](#testing-configurations)
8. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start - Disabling Browser Capture

### Method 1: Environment Variable (Recommended for Production)
```bash
# In your .env file
REACT_APP_ENABLE_BROWSER_CAPTURE=false
```

### Method 2: Code Comment (Quick Development Toggle)
```typescript
// In src/config/featureFlags.ts
const DEFAULT_FLAGS: FeatureFlags = {
  // ENABLE_BROWSER_CAPTURE: true,  // <-- Comment this line
  // ... other flags
};
```

### Method 3: Runtime Control (Development UI)
```typescript
// In your component
import { FeatureFlagPanel } from '../hooks/useFeatureFlags';

// Add to your app (development only)
{process.env.NODE_ENV === 'development' && <FeatureFlagPanel />}
```

---

## 🎯 Feature Flag Overview

The feature flag system provides multiple levels of control:

1. **Master Switch**: `ENABLE_BROWSER_CAPTURE` - Controls ALL browser capture features
2. **Browser-Specific**: Individual flags for Chrome, Safari, Firefox
3. **UI Components**: Control visibility of UI elements
4. **Advanced Features**: Quality adaptation, telemetry, debug mode

### Hierarchy

```
ENABLE_BROWSER_CAPTURE (Master)
├── ENABLE_CHROME_EXTENSION
├── ENABLE_SAFARI_CAPTURE
├── ENABLE_FIREFOX_CAPTURE
├── ENABLE_AUDIO_SOURCE_SELECTOR
├── ENABLE_CROSS_BROWSER_UI
├── ENABLE_AUDIO_VISUALIZER
└── ENABLE_AUTO_SOURCE_FALLBACK
```

When the master switch is OFF, all dependent features are automatically disabled.

---

## ⚙️ Configuration Methods

### 1. Environment Variables (.env)

Create or modify `.env` file in project root:

```bash
# Master control
REACT_APP_ENABLE_BROWSER_CAPTURE=true

# Browser-specific
REACT_APP_ENABLE_CHROME_EXTENSION=true
REACT_APP_ENABLE_SAFARI_CAPTURE=true
REACT_APP_ENABLE_FIREFOX_CAPTURE=true

# UI Features
REACT_APP_ENABLE_AUDIO_SOURCE_SELECTOR=true
REACT_APP_ENABLE_CROSS_BROWSER_UI=true
REACT_APP_ENABLE_AUDIO_VISUALIZER=true
```

### 2. Code Configuration

Edit `src/config/featureFlags.ts`:

```typescript
const DEFAULT_FLAGS: FeatureFlags = {
  ENABLE_BROWSER_CAPTURE: true,  // Set to false to disable
  ENABLE_CHROME_EXTENSION: true,
  // ... other flags
};
```

### 3. Runtime Control

Use the `useFeatureFlags` hook:

```typescript
import { useFeatureFlags } from './hooks/useFeatureFlags';

function MyComponent() {
  const { setFlag, isEnabled } = useFeatureFlags();
  
  // Disable browser capture at runtime
  setFlag('ENABLE_BROWSER_CAPTURE', false);
  
  // Check if enabled
  if (isEnabled('ENABLE_BROWSER_CAPTURE')) {
    // Show browser capture UI
  }
}
```

---

## 🏳️ Available Feature Flags

### Master Switches

| Flag | Default | Description |
|------|---------|-------------|
| `ENABLE_BROWSER_CAPTURE` | `true` | Master switch for ALL browser capture features |
| `ENABLE_SYSTEM_AUDIO` | `false` | System audio capture (Phase 2 - not implemented) |

### Browser-Specific

| Flag | Default | Description |
|------|---------|-------------|
| `ENABLE_CHROME_EXTENSION` | `true` | Chrome/Edge extension for tab capture |
| `ENABLE_SAFARI_CAPTURE` | `true` | Safari screen capture with audio |
| `ENABLE_FIREFOX_CAPTURE` | `true` | Firefox screen capture support |

### UI Features

| Flag | Default | Description |
|------|---------|-------------|
| `ENABLE_AUDIO_SOURCE_SELECTOR` | `true` | Show audio source dropdown |
| `ENABLE_CROSS_BROWSER_UI` | `true` | Browser-specific UI adaptations |
| `ENABLE_AUDIO_VISUALIZER` | `true` | Audio level meters |
| `ENABLE_PERMISSION_PROMPTS` | `false` | Custom permission dialogs |

### Advanced Features

| Flag | Default | Description |
|------|---------|-------------|
| `ENABLE_AUTO_SOURCE_FALLBACK` | `true` | Auto-switch to microphone on error |
| `ENABLE_QUALITY_ADAPTATION` | `true` | Dynamic quality based on performance |
| `ENABLE_DEBUG_MODE` | `false` | Show debug information |
| `ENABLE_TELEMETRY` | `false` | Anonymous usage statistics |

---

## 💻 Usage in Code

### Basic Usage

```typescript
import { useFeatureFlags } from './hooks/useFeatureFlags';

function AudioCaptureComponent() {
  const { isEnabled } = useFeatureFlags();
  
  if (!isEnabled('ENABLE_BROWSER_CAPTURE')) {
    return <MicrophoneOnlyUI />;
  }
  
  return <BrowserCaptureUI />;
}
```

### Conditional Rendering

```typescript
import { FeatureFlag } from './hooks/useFeatureFlags';

function App() {
  return (
    <div>
      <FeatureFlag flag="ENABLE_BROWSER_CAPTURE">
        <BrowserCapturePanel />
      </FeatureFlag>
      
      <FeatureFlag 
        flag="ENABLE_SAFARI_CAPTURE"
        fallbackComponent={<MicrophoneInput />}
      >
        <SafariCaptureUI />
      </FeatureFlag>
    </div>
  );
}
```

### HOC Pattern

```typescript
import { withFeatureFlag } from './hooks/useFeatureFlags';

const BrowserCapturePanel = withFeatureFlag('ENABLE_BROWSER_CAPTURE')(
  YourComponent
);
```

### Service Integration

```typescript
import { getBrowserCaptureService } from './services/browserCaptureService';

async function startCapture() {
  const service = getBrowserCaptureService();
  const capabilities = service.getCapabilities();
  
  if (!capabilities.canCaptureBrowserAudio) {
    console.log('Browser capture disabled, using microphone');
    return service.startCapture('microphone');
  }
  
  return service.startCapture('browser-tab');
}
```

---

## 🛠️ Development Tools

### Feature Flag Panel

Add to your app for runtime control:

```typescript
import { FeatureFlagPanel } from './hooks/useFeatureFlags';

function App() {
  return (
    <>
      {/* Your app content */}
      
      {/* Feature flag panel (dev only) */}
      {process.env.NODE_ENV === 'development' && <FeatureFlagPanel />}
    </>
  );
}
```

### Console Commands

```javascript
// In browser console (development mode)

// Check current flags
window.__featureFlags?.logFlags();

// Toggle a flag
window.__featureFlags?.setFlag('ENABLE_BROWSER_CAPTURE', false);

// Export configuration
window.__featureFlags?.exportFlags();

// Import configuration
window.__featureFlags?.importFlags('{"ENABLE_BROWSER_CAPTURE": false}');
```

---

## 🧪 Testing Configurations

### Test Without Browser Capture

```bash
# .env.test
REACT_APP_ENABLE_BROWSER_CAPTURE=false
```

### Test Safari Only

```bash
REACT_APP_ENABLE_BROWSER_CAPTURE=true
REACT_APP_ENABLE_CHROME_EXTENSION=false
REACT_APP_ENABLE_SAFARI_CAPTURE=true
REACT_APP_ENABLE_FIREFOX_CAPTURE=false
```

### Test With Fallback

```bash
REACT_APP_ENABLE_BROWSER_CAPTURE=true
REACT_APP_ENABLE_AUTO_SOURCE_FALLBACK=true
```

### Test Debug Mode

```bash
REACT_APP_ENABLE_DEBUG_MODE=true
```

---

## 🔧 Troubleshooting

### Browser Capture Not Working

1. Check if master flag is enabled:
   ```javascript
   isFeatureEnabled('ENABLE_BROWSER_CAPTURE')
   ```

2. Check browser-specific flag:
   ```javascript
   isFeatureEnabled('ENABLE_CHROME_EXTENSION')
   ```

3. Check capabilities:
   ```javascript
   const service = getBrowserCaptureService();
   console.log(service.getCapabilities());
   ```

### Feature Not Disabling

1. Check flag hierarchy - master flag overrides all
2. Clear browser cache and restart dev server
3. Verify .env file is being loaded
4. Check for runtime overrides

### Fallback Not Working

1. Ensure `ENABLE_AUTO_SOURCE_FALLBACK` is true
2. Check microphone permissions
3. Verify fallback implementation in service

---

## 📝 Examples

### Complete Disable Example

```typescript
// .env
REACT_APP_ENABLE_BROWSER_CAPTURE=false

// Component will automatically use microphone
function App() {
  const { isBrowserCaptureAvailable } = useFeatureFlags();
  
  console.log(isBrowserCaptureAvailable); // false
  // All browser capture UI hidden
  // Service falls back to microphone
}
```

### Partial Disable Example

```typescript
// Disable only Chrome extension
REACT_APP_ENABLE_CHROME_EXTENSION=false

// Other capture methods still available
const methods = getAvailableCaptureMethods();
// ['safari-screen', 'microphone'] (no 'chrome-tab')
```

### Production Configuration

```bash
# .env.production
REACT_APP_ENABLE_BROWSER_CAPTURE=true
REACT_APP_ENABLE_DEBUG_MODE=false
REACT_APP_ENABLE_AUTO_SOURCE_FALLBACK=true
REACT_APP_ENABLE_TELEMETRY=true
```

---

## 📚 Additional Resources

- [Feature Flags Configuration](../src/config/featureFlags.ts)
- [Feature Flags Hook](../src/hooks/useFeatureFlags.ts)
- [Browser Capture Service](../src/services/browserCaptureService.ts)
- [Environment Variables](./.env.example)

---

## 🤝 Contributing

When adding new features:

1. Add flag to `FeatureFlags` interface
2. Add default value in `DEFAULT_FLAGS`
3. Add environment variable mapping in `ENV_VAR_MAP`
4. Update this documentation
5. Add flag checks in relevant code

---

## 📄 License

This feature flag system is part of the HRPro Interview Assistant project.