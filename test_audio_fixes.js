/**
 * COMPREHENSIVE QA TEST SCRIPT
 * Tests the audio transcription fixes implemented
 */

console.log('🧪 [QA TEST] Starting comprehensive audio transcription test...');

// Test 1: Verify Feature Flags
console.log('\n=== TEST 1: Feature Flags Verification ===');

// Check if we're in browser environment
if (typeof window !== 'undefined' && window.process?.env) {
  console.log('Environment variables:');
  console.log(`REACT_APP_ENABLE_BROWSER_CAPTURE: ${process.env.REACT_APP_ENABLE_BROWSER_CAPTURE}`);
  console.log(`REACT_APP_ENABLE_AUDIO_SOURCE_SELECTOR: ${process.env.REACT_APP_ENABLE_AUDIO_SOURCE_SELECTOR}`);
}

// Test 2: Component Availability Check
console.log('\n=== TEST 2: Component Availability ===');

// Check if AudioSourceSelector is available in DOM
const audioSourceSelectors = document.querySelectorAll('[class*="AudioSource"], select[value*="microphone"], select[value*="browser"]');
console.log(`AudioSourceSelector elements found: ${audioSourceSelectors.length}`);

if (audioSourceSelectors.length > 0) {
  audioSourceSelectors.forEach((element, index) => {
    console.log(`  [${index}] ${element.tagName} - ${element.className || 'no class'}`);
    if (element.tagName === 'SELECT') {
      console.log(`    Options: ${element.options.length}`);
      Array.from(element.options).forEach(option => {
        console.log(`      - ${option.value}: ${option.text}`);
      });
    }
  });
} else {
  console.log('⚠️  No AudioSourceSelector elements found in DOM');
}

// Test 3: Control Panel Elements
console.log('\n=== TEST 3: Control Panel Elements ===');

const controlPanels = document.querySelectorAll('[class*="control-panel"], [class*="ControlPanel"]');
console.log(`Control panel elements: ${controlPanels.length}`);

const startButtons = document.querySelectorAll('button[class*="start"], button[class*="Start"]');
console.log(`Start buttons found: ${startButtons.length}`);

const transcriptAreas = document.querySelectorAll('[class*="transcript"], [class*="Transcript"]');
console.log(`Transcript areas found: ${transcriptAreas.length}`);

// Test 4: Check for React Component Tree
console.log('\n=== TEST 4: React Component Analysis ===');

// Look for React fiber nodes
const reactRoot = document.querySelector('#root, [data-reactroot]');
if (reactRoot) {
  console.log('✅ React root found');

  // Check if there are any React error boundaries
  const errorBoundaries = document.querySelectorAll('[data-react-error-boundary]');
  console.log(`React error boundaries: ${errorBoundaries.length}`);

  // Look for specific components in DOM
  const knownComponents = [
    'AudioSourceSelector',
    'ControlPanel',
    'TranscriptSection',
    'RecordingControls',
    'StartButton'
  ];

  knownComponents.forEach(component => {
    const elements = document.querySelectorAll(`[class*="${component}"], [data-testid*="${component}"]`);
    console.log(`${component} instances: ${elements.length}`);
  });
} else {
  console.log('❌ No React root found');
}

// Test 5: Browser API Availability
console.log('\n=== TEST 5: Browser API Support ===');

console.log(`getUserMedia available: ${!!navigator.mediaDevices?.getUserMedia}`);
console.log(`getDisplayMedia available: ${!!navigator.mediaDevices?.getDisplayMedia}`);
console.log(`AudioContext available: ${!!(window.AudioContext || window.webkitAudioContext)}`);
console.log(`Web Speech API available: ${!!(window.SpeechRecognition || window.webkitSpeechRecognition)}`);

// Test 6: Check Console for Errors
console.log('\n=== TEST 6: Console Error Check ===');

let errorCount = 0;
let warningCount = 0;

// Override console methods to count errors
const originalError = console.error;
const originalWarn = console.warn;

console.error = function(...args) {
  errorCount++;
  originalError.apply(console, ['[ERROR]', ...args]);
};

console.warn = function(...args) {
  warningCount++;
  originalWarn.apply(console, ['[WARN]', ...args]);
};

// Restore after 1 second
setTimeout(() => {
  console.error = originalError;
  console.warn = originalWarn;
  console.log(`Errors detected: ${errorCount}`);
  console.log(`Warnings detected: ${warningCount}`);
}, 1000);

// Test 7: Feature Flag Runtime Check
console.log('\n=== TEST 7: Runtime Feature Flags ===');

// Try to access global feature flags if available
if (typeof window !== 'undefined' && window.__featureFlags) {
  console.log('✅ Feature flags system available');
  const flags = window.__featureFlags.getFlags();
  console.log('Current flags:', flags);
} else {
  console.log('⚠️  Feature flags system not available in global scope');
}

console.log('\n🧪 [QA TEST] Test script execution completed');
console.log('Check the logs above for any issues or missing components');