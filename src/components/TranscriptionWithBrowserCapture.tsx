import React, { useState, useEffect } from 'react';
import { useTranscriptionExtended } from '../hooks/transcription/useTranscriptionExtended';
import { AudioSourceSelector, AudioSourceSelectorCompact } from './AudioSourceSelector';
import { useFeatureFlags, FeatureFlag } from '../hooks/useFeatureFlags';

interface TranscriptionWithBrowserCaptureProps {
  // Feature flags (can be controlled via props or environment)
  enableBrowserCapture?: boolean;
  enableAutoSourceSwitch?: boolean;
  compactMode?: boolean;
  
  // Callbacks
  onTranscriptUpdate?: (transcript: string) => void;
  onInsightGenerated?: (insights: any[]) => void;
}

/**
 * ============================================================================
 * FEATURE FLAG INTEGRATION
 * ============================================================================
 * This component respects the global feature flag system.
 * 
 * TO DISABLE BROWSER CAPTURE:
 * 1. Set REACT_APP_ENABLE_BROWSER_CAPTURE=false in .env
 * 2. OR comment out ENABLE_BROWSER_CAPTURE in featureFlags.ts
 * 3. OR use runtime controls via FeatureFlagPanel
 * 
 * When disabled, component automatically falls back to microphone-only mode.
 * ============================================================================
 */

/**
 * Transcription component with integrated browser audio capture
 * 
 * This component demonstrates how to use the extended transcription hook
 * with browser audio capture support. It provides a complete UI for:
 * - Selecting audio sources (microphone, browser, tab, screen)
 * - Managing recording state
 * - Displaying transcripts and insights
 * - Handling browser-specific requirements (extensions, permissions)
 * 
 * @example
 * ```tsx
 * // Basic usage with browser capture enabled
 * <TranscriptionWithBrowserCapture 
 *   enableBrowserCapture={true}
 * />
 * 
 * // Compact mode for integration in headers/toolbars
 * <TranscriptionWithBrowserCapture 
 *   enableBrowserCapture={true}
 *   compactMode={true}
 * />
 * ```
 */
export const TranscriptionWithBrowserCapture: React.FC<TranscriptionWithBrowserCaptureProps> = ({
  enableBrowserCapture: propEnableBrowserCapture,
  enableAutoSourceSwitch: propEnableAutoSourceSwitch,
  compactMode = false,
  onTranscriptUpdate,
  onInsightGenerated
}) => {
  // ========================================================================
  // FEATURE FLAG INTEGRATION
  // ========================================================================
  const { isEnabled, flags } = useFeatureFlags();
  
  // Combine prop overrides with global feature flags
  const enableBrowserCapture = propEnableBrowserCapture !== undefined 
    ? propEnableBrowserCapture 
    : isEnabled('ENABLE_BROWSER_CAPTURE');
    
  const enableAutoSourceSwitch = propEnableAutoSourceSwitch !== undefined
    ? propEnableAutoSourceSwitch
    : isEnabled('ENABLE_AUTO_SOURCE_FALLBACK');
  
  // Check if audio source selector should be shown
  const showAudioSourceSelector = enableBrowserCapture && isEnabled('ENABLE_AUDIO_SOURCE_SELECTOR');
  const showAudioVisualizer = isEnabled('ENABLE_AUDIO_VISUALIZER');
  const showDebugMode = isEnabled('ENABLE_DEBUG_MODE');
  // Permission states
  const [permissionRequested, setPermissionRequested] = useState<'microphone' | 'screen' | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Record<string, boolean>>({});
  
  // UI states
  const [showTranscript, setShowTranscript] = useState(true);
  const [showInsights, setShowInsights] = useState(true);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // Use extended transcription hook with browser capture
  const transcription = useTranscriptionExtended({
    enableBrowserCapture,
    enableAutoSourceSwitch,
    defaultAudioSource: enableBrowserCapture ? 'browser' : 'microphone',
    
    // Permission callbacks
    onPermissionRequest: (type) => {
      console.log(`📋 Permission requested: ${type}`);
      setPermissionRequested(type);
    },
    
    onPermissionResult: (granted) => {
      console.log(`✅ Permission result: ${granted}`);
      if (permissionRequested) {
        setPermissionStatus(prev => ({
          ...prev,
          [permissionRequested]: granted
        }));
        setPermissionRequested(null);
      }
    },
    
    onBrowserNotSupported: () => {
      console.warn('⚠️ Browser audio capture not supported');
    },
    
    onAudioSourceChange: (source) => {
      console.log(`🔄 Audio source changed to: ${source}`);
    }
  });

  // Get available sources and browser info
  const availableSources = transcription.getAvailableAudioSources();
  const browserInfo = transcription.getBrowserCaptureInfo();
  const recordingStatus = transcription.getRecordingStatus();

  // Update callbacks when transcript or insights change
  useEffect(() => {
    if (transcription.transcript && onTranscriptUpdate) {
      onTranscriptUpdate(transcription.transcript);
    }
  }, [transcription.transcript, onTranscriptUpdate]);

  useEffect(() => {
    if (transcription.insights.length > 0 && onInsightGenerated) {
      onInsightGenerated(transcription.insights);
    }
  }, [transcription.insights, onInsightGenerated]);

  // Handle start/stop recording
  const handleToggleRecording = async () => {
    if (transcription.isRecording) {
      transcription.stopRecording();
    } else {
      try {
        await transcription.startRecording();
      } catch (error) {
        console.error('Failed to start recording:', error);
      }
    }
  };

  // Render compact mode
  if (compactMode) {
    return (
      <div className="transcription-compact flex items-center gap-4 p-2 bg-white rounded-lg shadow">
        {/* Compact Audio Source Selector */}
        {enableBrowserCapture && (
          <AudioSourceSelectorCompact
            currentSource={transcription.currentAudioSource}
            availableSources={availableSources}
            onSourceChange={transcription.switchAudioSource}
            isRecording={transcription.isRecording}
          />
        )}
        
        {/* Record Button */}
        <button
          onClick={handleToggleRecording}
          className={`
            px-4 py-2 rounded-lg font-medium transition-all
            ${transcription.isRecording 
              ? 'bg-red-500 hover:bg-red-600 text-white' 
              : 'bg-blue-500 hover:bg-blue-600 text-white'
            }
          `}
        >
          {transcription.isRecording ? '⏹ Stop' : '⏺ Record'}
        </button>
        
        {/* Audio Level Indicator */}
        {transcription.isRecording && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Level:</span>
            <div className="w-24 bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-green-500 h-full transition-all duration-100"
                style={{ width: `${transcription.audioLevel * 100}%` }}
              />
            </div>
          </div>
        )}
        
        {/* Status */}
        {transcription.isRecording && (
          <span className="text-sm text-gray-600">
            {recordingStatus.hasAudio ? 'Capturing' : 'Waiting...'}
          </span>
        )}
      </div>
    );
  }

  // Render full mode
  return (
    <div className="transcription-with-browser-capture max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Audio Transcription
          {enableBrowserCapture && (
            <span className="ml-2 text-sm font-normal text-green-600">
              ✨ Browser Capture Enabled
            </span>
          )}
        </h2>
        <p className="text-gray-600">
          Record and transcribe audio from multiple sources
        </p>
      </div>

      {/* Audio Source Selector */}
      {enableBrowserCapture && (
        <div className="mb-6">
          <AudioSourceSelector
            currentSource={transcription.currentAudioSource}
            availableSources={availableSources}
            onSourceChange={transcription.switchAudioSource}
            isRecording={transcription.isRecording}
            browserCaptureInfo={browserInfo}
            onInstallExtension={transcription.installExtension}
          />
        </div>
      )}

      {/* Recording Controls */}
      <div className="mb-6 p-4 bg-white rounded-lg shadow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Record Button */}
            <button
              onClick={handleToggleRecording}
              className={`
                px-6 py-3 rounded-lg font-medium transition-all text-white
                ${transcription.isRecording 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-blue-500 hover:bg-blue-600'
                }
              `}
            >
              {transcription.isRecording ? (
                <span className="flex items-center gap-2">
                  <span>⏹</span>
                  <span>Stop Recording</span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span>⏺</span>
                  <span>Start Recording</span>
                </span>
              )}
            </button>
            
            {/* Recording Status */}
            {transcription.isRecording && (
              <div className="flex items-center gap-3">
                <div className="animate-pulse">
                  <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                </div>
                <span className="font-medium">
                  Recording from {transcription.currentAudioSource}
                </span>
              </div>
            )}
          </div>
          
          {/* Audio Level Meter */}
          {transcription.isRecording && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">Audio Level:</span>
              <div className="w-32 bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-green-500 h-full transition-all duration-100"
                  style={{ width: `${transcription.audioLevel * 100}%` }}
                />
              </div>
              <span className="text-sm text-gray-600">
                {Math.round(transcription.audioLevel * 100)}%
              </span>
            </div>
          )}
        </div>
        
        {/* Error Display */}
        {transcription.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-red-700 font-medium">Error:</p>
                <p className="text-red-600">{transcription.error.message}</p>
              </div>
              <button
                onClick={transcription.resetError}
                className="text-red-500 hover:text-red-700"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transcript Display */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Transcript</h3>
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {showTranscript ? 'Hide' : 'Show'}
          </button>
        </div>
        
        {showTranscript && (
          <div className="p-4 bg-white rounded-lg shadow min-h-[150px]">
            {transcription.transcript || transcription.partialTranscript ? (
              <div>
                <p className="text-gray-800 whitespace-pre-wrap">
                  {transcription.transcript}
                </p>
                {transcription.partialTranscript && (
                  <p className="text-gray-500 italic">
                    {transcription.partialTranscript}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-400 italic">
                No transcript yet. Start recording to begin.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Insights Display */}
      {transcription.insights.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-800">
              Insights ({transcription.insights.length})
            </h3>
            <button
              onClick={() => setShowInsights(!showInsights)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              {showInsights ? 'Hide' : 'Show'}
            </button>
          </div>
          
          {showInsights && (
            <div className="space-y-3">
              {transcription.insights.map((insight, index) => (
                <div key={index} className="p-4 bg-white rounded-lg shadow">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{insight.icon}</span>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-800">{insight.title}</h4>
                      <p className="text-gray-600 mt-1">{insight.content}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(insight.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Debug Info (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-6">
          <button
            onClick={() => setShowDebugInfo(!showDebugInfo)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            {showDebugInfo ? 'Hide' : 'Show'} Debug Info
          </button>
          
          {showDebugInfo && (
            <div className="mt-3 p-4 bg-gray-100 rounded-lg text-xs font-mono">
              <pre>{JSON.stringify({
                recordingStatus: recordingStatus,
                browserInfo: browserInfo,
                availableSources: availableSources,
                permissions: permissionStatus
              }, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};