import React from 'react';
import { useTranscriptionExtended, useTranscriptionCompat } from '../hooks/transcription/useTranscriptionExtended';
import { TranscriptionWithBrowserCapture } from '../components/TranscriptionWithBrowserCapture';
import { isBrowserCaptureEnabled } from '../config/browserCaptureConfig';

/**
 * Example 1: Drop-in replacement for existing code
 * 
 * If you have existing code using useTranscription, you can use useTranscriptionCompat
 * for 100% backward compatibility while the browser capture feature is disabled.
 */
export const ExistingTranscriptionComponent: React.FC = () => {
  // This works exactly like the original useTranscription hook
  const transcription = useTranscriptionCompat();
  
  return (
    <div className="p-4">
      <h3>Legacy Transcription (Microphone Only)</h3>
      <button 
        onClick={transcription.isRecording ? transcription.stopRecording : transcription.startRecording}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        {transcription.isRecording ? 'Stop' : 'Start'} Recording
      </button>
      <div className="mt-4">
        <p>Transcript: {transcription.transcript}</p>
      </div>
    </div>
  );
};

/**
 * Example 2: Progressive enhancement with feature flag
 * 
 * Use feature flags to gradually roll out browser capture support
 */
export const ProgressiveTranscriptionComponent: React.FC = () => {
  // Check if browser capture is enabled via configuration
  const browserCaptureEnabled = isBrowserCaptureEnabled();
  
  // Use extended hook with feature flag
  const transcription = useTranscriptionExtended({
    enableBrowserCapture: browserCaptureEnabled,
    defaultAudioSource: browserCaptureEnabled ? 'browser' : 'microphone'
  });
  
  const handleStartRecording = async () => {
    try {
      await transcription.startRecording();
    } catch (error) {
      console.error('Recording failed:', error);
      // Handle error - maybe show a toast or alert
    }
  };
  
  return (
    <div className="p-4 space-y-4">
      <h3>Progressive Enhancement Transcription</h3>
      
      {/* Show feature status */}
      <div className="text-sm text-gray-600">
        Browser Capture: {browserCaptureEnabled ? '✅ Enabled' : '❌ Disabled'}
      </div>
      
      {/* Audio source selector (only shown when browser capture is enabled) */}
      {browserCaptureEnabled && (
        <div className="flex gap-2">
          {transcription.getAvailableAudioSources().map(source => (
            <button
              key={source}
              onClick={() => transcription.switchAudioSource(source)}
              className={`px-3 py-1 rounded ${
                transcription.currentAudioSource === source 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200'
              }`}
            >
              {source}
            </button>
          ))}
        </div>
      )}
      
      {/* Recording controls */}
      <div className="flex gap-2">
        <button 
          onClick={transcription.isRecording ? transcription.stopRecording : handleStartRecording}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          {transcription.isRecording ? 'Stop' : 'Start'} Recording
        </button>
        
        {transcription.isRecording && (
          <div className="flex items-center gap-2">
            <div className="animate-pulse w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Recording from {transcription.currentAudioSource}</span>
          </div>
        )}
      </div>
      
      {/* Transcript display */}
      <div className="p-4 bg-gray-100 rounded">
        <h4 className="font-semibold mb-2">Transcript</h4>
        <p>{transcription.transcript || 'No transcript yet...'}</p>
        {transcription.partialTranscript && (
          <p className="text-gray-500 italic">{transcription.partialTranscript}</p>
        )}
      </div>
      
      {/* Error handling */}
      {transcription.error && (
        <div className="p-3 bg-red-100 border border-red-300 rounded">
          <p className="text-red-700">{transcription.error.message}</p>
          <button 
            onClick={transcription.resetError}
            className="text-sm text-red-600 underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Example 3: Full-featured implementation
 * 
 * Use the pre-built TranscriptionWithBrowserCapture component for a complete solution
 */
export const FullFeaturedTranscription: React.FC = () => {
  const handleTranscriptUpdate = (transcript: string) => {
    console.log('New transcript:', transcript);
    // Send to your backend, update state, etc.
  };
  
  const handleInsightGenerated = (insights: any[]) => {
    console.log('New insights:', insights);
    // Process insights, show notifications, etc.
  };
  
  return (
    <div className="container mx-auto py-8">
      <h2 className="text-2xl font-bold mb-6">Full-Featured Transcription</h2>
      
      <TranscriptionWithBrowserCapture
        enableBrowserCapture={true}
        enableAutoSourceSwitch={true}
        onTranscriptUpdate={handleTranscriptUpdate}
        onInsightGenerated={handleInsightGenerated}
      />
    </div>
  );
};

/**
 * Example 4: Compact mode for headers/toolbars
 */
export const CompactTranscription: React.FC = () => {
  return (
    <div className="bg-gray-800 p-4">
      <div className="container mx-auto flex items-center justify-between">
        <h1 className="text-white text-xl font-bold">My App</h1>
        
        {/* Compact transcription controls */}
        <TranscriptionWithBrowserCapture
          enableBrowserCapture={true}
          compactMode={true}
        />
      </div>
    </div>
  );
};

/**
 * Example 5: Custom implementation with all features
 */
export const CustomTranscription: React.FC = () => {
  const transcription = useTranscriptionExtended({
    enableBrowserCapture: true,
    enableAutoSourceSwitch: true,
    defaultAudioSource: 'browser',
    
    onAudioSourceChange: (source) => {
      console.log(`Audio source changed to: ${source}`);
      // Update analytics, user preferences, etc.
    },
    
    onPermissionRequest: (type) => {
      console.log(`Requesting ${type} permission`);
      // Show custom permission UI
    },
    
    onPermissionResult: (granted) => {
      console.log(`Permission ${granted ? 'granted' : 'denied'}`);
      // Handle permission result
    },
    
    onBrowserNotSupported: () => {
      console.warn('Browser not supported');
      // Show fallback UI or redirect to supported browser
    }
  });
  
  // Get detailed status
  const status = transcription.getRecordingStatus();
  const browserInfo = transcription.getBrowserCaptureInfo();
  
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Custom Transcription Implementation</h2>
      
      {/* Browser support info */}
      {!browserInfo.available && (
        <div className="mb-4 p-4 bg-yellow-100 border border-yellow-300 rounded">
          <p className="font-semibold">Browser audio capture not available</p>
          <p className="text-sm mt-1">Please use Chrome with our extension or Safari 13+</p>
        </div>
      )}
      
      {/* Extension prompt for Chrome */}
      {browserInfo.extensionRequired && !browserInfo.extensionInstalled && (
        <div className="mb-4 p-4 bg-blue-100 border border-blue-300 rounded">
          <p className="font-semibold">Chrome Extension Required</p>
          <p className="text-sm mt-1">For best audio quality, install our Chrome extension</p>
          <button 
            onClick={transcription.installExtension}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
          >
            Install Extension
          </button>
        </div>
      )}
      
      {/* Audio source tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {transcription.getAvailableAudioSources().map(source => (
              <button
                key={source}
                onClick={() => transcription.switchAudioSource(source)}
                className={`
                  py-2 px-1 border-b-2 font-medium text-sm
                  ${transcription.currentAudioSource === source
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
                disabled={transcription.isRecording}
              >
                {source.charAt(0).toUpperCase() + source.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </div>
      
      {/* Instructions for current source */}
      {browserInfo.instructions && (
        <div className="mb-4 p-3 bg-gray-100 rounded">
          <p className="text-sm">{browserInfo.instructions}</p>
        </div>
      )}
      
      {/* Recording controls with status */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={async () => {
            if (transcription.isRecording) {
              transcription.stopRecording();
            } else {
              try {
                await transcription.startRecording();
              } catch (error) {
                console.error('Failed to start recording:', error);
              }
            }
          }}
          className={`
            px-6 py-3 rounded-lg font-semibold text-white transition-colors
            ${transcription.isRecording 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-green-500 hover:bg-green-600'
            }
          `}
        >
          {transcription.isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
        
        {/* Status indicators */}
        {transcription.isRecording && (
          <>
            <div className="flex items-center gap-2">
              <div className="animate-pulse w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-sm font-medium">
                {status.hasAudio ? 'Capturing audio' : 'Waiting for audio...'}
              </span>
            </div>
            
            {/* Audio level */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Level:</span>
              <div className="w-24 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-full rounded-full transition-all duration-100"
                  style={{ width: `${status.audioLevel * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Live transcript */}
      <div className="p-4 bg-white border border-gray-200 rounded-lg min-h-[200px]">
        <h3 className="font-semibold mb-2">Live Transcript</h3>
        {transcription.transcript ? (
          <div>
            <p className="text-gray-800">{transcription.transcript}</p>
            {transcription.partialTranscript && (
              <p className="text-gray-500 italic mt-2">
                {transcription.partialTranscript}
              </p>
            )}
          </div>
        ) : (
          <p className="text-gray-400 italic">
            Start recording to see transcript...
          </p>
        )}
      </div>
      
      {/* Insights */}
      {transcription.insights.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold mb-3">AI Insights</h3>
          <div className="space-y-2">
            {transcription.insights.map((insight, i) => (
              <div key={i} className="p-3 bg-blue-50 border border-blue-200 rounded">
                <div className="flex items-start gap-2">
                  <span className="text-xl">{insight.icon}</span>
                  <div>
                    <p className="font-medium">{insight.title}</p>
                    <p className="text-sm text-gray-600 mt-1">{insight.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Main example showcase component
 */
export const TranscriptionExamples: React.FC = () => {
  const [example, setExample] = React.useState<'legacy' | 'progressive' | 'full' | 'compact' | 'custom'>('progressive');
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Example selector */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <span className="font-semibold">Example:</span>
            <select 
              value={example} 
              onChange={(e) => setExample(e.target.value as any)}
              className="px-3 py-1 border border-gray-300 rounded"
            >
              <option value="legacy">Legacy (Backward Compatible)</option>
              <option value="progressive">Progressive Enhancement</option>
              <option value="full">Full Featured</option>
              <option value="compact">Compact Mode</option>
              <option value="custom">Custom Implementation</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Render selected example */}
      <div className="py-8">
        {example === 'legacy' && <ExistingTranscriptionComponent />}
        {example === 'progressive' && <ProgressiveTranscriptionComponent />}
        {example === 'full' && <FullFeaturedTranscription />}
        {example === 'compact' && <CompactTranscription />}
        {example === 'custom' && <CustomTranscription />}
      </div>
    </div>
  );
};

export default TranscriptionExamples;