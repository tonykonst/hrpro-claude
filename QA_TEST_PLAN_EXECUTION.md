# QA TEST PLAN - Audio Transcription Fixes Validation

**Test Date:** 2025-09-15
**QA Engineer:** Claude Code QA Agent
**Build Version:** Development Build
**Environment:** macOS Darwin 24.0.0, Chrome/Electron

## Test Overview

Testing the implemented fixes for:
1. **System Audio Capture** - AudioSourceSelector integration and browser audio capture
2. **Transcript Persistence** - UI state management to preserve transcripts after stopping

## Test Environment Setup

### ✅ Pre-Test Verification
- [x] Development server running successfully (npm run dev)
- [x] Application loads without critical errors
- [x] Feature flags configuration verified:
  - `REACT_APP_ENABLE_BROWSER_CAPTURE=true`
  - `REACT_APP_ENABLE_AUDIO_SOURCE_SELECTOR=true`
- [x] No compilation errors in console output

### 📋 Configuration Analysis

**Implementation Changes Verified:**
- [x] `App.tsx` uses `useTranscriptionExtended()` hook
- [x] `ControlPanel.tsx` has transcript persistence logic
- [x] `AudioSourceSelector.tsx` component exists and integrated
- [x] Feature flags properly configured in `.env`

---

## TEST 1: System Audio Capture 🎵

### Test Objective
Verify that AudioSourceSelector appears in UI and enables system audio source switching.

### Test Steps
1. **UI Component Presence**
   - [ ] AudioSourceSelector visible in control panel
   - [ ] Dropdown contains audio source options
   - [ ] Microphone option available
   - [ ] Browser/system audio options shown when feature enabled

2. **Audio Source Selection**
   - [ ] Can switch from microphone to system audio
   - [ ] Source change is reflected in UI
   - [ ] Browser prompts for appropriate permissions

3. **System Audio Capture**
   - [ ] Play audio/video on computer (YouTube, music)
   - [ ] Select system audio source
   - [ ] Start recording
   - [ ] Verify system audio is captured in transcript

### Expected Results
- AudioSourceSelector dropdown appears with options
- Can switch between microphone and system audio sources
- System audio (playing media) gets transcribed when selected

### Actual Results
*To be filled during testing*

### Status: ⏳ PENDING

---

## TEST 2: Transcript Persistence 📝

### Test Objective
Verify transcripts remain visible in UI after stopping recording session.

### Test Steps
1. **Start Transcription Session**
   - [ ] Start recording (microphone or system audio)
   - [ ] Let recording run for 10-15 seconds
   - [ ] Verify transcript text appears in real-time

2. **Generate Transcript Content**
   - [ ] Speak or play audio to generate transcript
   - [ ] Verify partial transcript updates appear
   - [ ] Confirm final transcript text is populated

3. **Stop Recording and Check Persistence**
   - [ ] Click stop recording button
   - [ ] **CRITICAL**: Verify transcript window remains visible
   - [ ] Check that transcript text is not cleared
   - [ ] Confirm insights (if any) are preserved

4. **UI State Validation**
   - [ ] Transcript section still displayed
   - [ ] Can scroll through transcript history
   - [ ] Start button becomes available again

### Expected Results
- Transcript window/section remains visible after stopping
- All captured text persists and is accessible
- No data loss when transitioning from recording to stopped state

### Actual Results
*To be filled during testing*

### Status: ⏳ PENDING

---

## TEST 3: Overall Functionality ⚙️

### Test Objective
Validate complete user flow and check for regressions.

### Test Steps
1. **Complete User Flow**
   - [ ] Application launch
   - [ ] Audio source selection (if available)
   - [ ] Permission handling
   - [ ] Start recording
   - [ ] Real-time transcription
   - [ ] Stop recording
   - [ ] Result persistence

2. **Error Handling**
   - [ ] Graceful handling of permission denials
   - [ ] Network connectivity issues
   - [ ] Audio device changes during recording

3. **UI/UX Verification**
   - [ ] Intuitive interface layout
   - [ ] Clear visual feedback for recording state
   - [ ] Responsive design elements

### Status: ⏳ PENDING

---

## TEST 4: Build and Console Verification 🔧

### Test Objective
Ensure clean build with no critical errors or warnings.

### Test Steps
1. **Build Status**
   - [x] `npm run dev` completes successfully
   - [x] Vite dev server starts on http://localhost:5173
   - [x] Electron application launches

2. **Console Analysis**
   - [ ] Browser Developer Tools console check
   - [ ] No critical JavaScript errors
   - [ ] No React/TypeScript compilation errors
   - [ ] Warnings acceptable and documented

3. **Performance Check**
   - [ ] Application loads within acceptable time
   - [ ] No memory leaks during basic operation
   - [ ] CPU usage reasonable

### Current Console Status
```
✅ Vite dev server: Running on http://localhost:5173/
✅ Electron app: Launched successfully
✅ Global shortcuts: Registered
✅ Control panel: Loaded
⚠️  AVCaptureDeviceTypeExternal warnings (non-critical)
```

### Status: ⏳ PENDING

---

## Quality Criteria

### ✅ PASS Criteria
- AudioSourceSelector appears and functions correctly
- System audio capture works with appropriate permissions
- Transcript persistence works (text remains after stop)
- No critical errors in console
- User flow completes successfully

### ❌ FAIL Criteria
- AudioSourceSelector missing from UI
- Cannot capture system audio
- Transcripts disappear after stopping recording
- Critical JavaScript errors prevent functionality
- Major UI/UX regressions

---

## Test Results Summary

*To be completed after test execution*

### Overall Assessment: ⏳ IN PROGRESS

**Critical Issues Found:** TBD
**High Priority Issues:** TBD
**Medium Priority Issues:** TBD
**Low Priority Issues:** TBD

### Recommendations
*To be provided after testing*

---

**Next Steps:**
1. Execute manual testing steps
2. Document actual results vs expected results
3. Create bug reports for any issues found
4. Provide final PASS/FAIL assessment