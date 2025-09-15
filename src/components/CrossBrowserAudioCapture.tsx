import React, { useEffect, useState } from 'react';
import { useCrossBrowserAudio } from '../hooks/useCrossBrowserAudio';
import { audioFormatHandler } from '../services/audio-format-handler';
import { SafariInstructions } from './SafariInstructions';
import { IOSFallback } from './IOSFallback';

interface CrossBrowserAudioCaptureProps {
  onAudioData?: (blob: Blob) => void;
  onTranscription?: (text: string) => void;
  autoStart?: boolean;
}

export const CrossBrowserAudioCapture: React.FC<CrossBrowserAudioCaptureProps> = ({
  onAudioData,
  onTranscription,
  autoStart = false
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioFormat, setAudioFormat] = useState<string>('');
  
  const {
    browser,
    captureMethod,
    isCapturing,
    hasAudio,
    stream,
    audioLevel,
    error,
    isSupported,
    limitations,
    instructions,
    startCapture,
    stopCapture,
    toggleCapture,
    resetError,
    isExtensionInstalled,
    installExtension
  } = useCrossBrowserAudio({
    onStreamReady: async (stream) => {
      console.log('[CrossBrowserAudioCapture] Stream ready:', stream);
      
      // Get best audio format for this browser
      const bestFormat = audioFormatHandler.getBestFormat();
      if (bestFormat) {
        setAudioFormat(bestFormat.mimeType);
        
        // Start recording if needed
        if (onAudioData) {
          try {
            await audioFormatHandler.startRecording(stream, {
              format: bestFormat.format,
              codec: bestFormat.codec
            });
            setIsRecording(true);
          } catch (err) {
            console.error('[CrossBrowserAudioCapture] Failed to start recording:', err);
          }
        }
      }
    },
    onStreamEnded: async () => {
      console.log('[CrossBrowserAudioCapture] Stream ended');
      
      // Stop recording and get audio data
      if (isRecording && onAudioData) {
        try {
          const audioBlob = await audioFormatHandler.stopRecording();
          onAudioData(audioBlob.blob);
          setIsRecording(false);
        } catch (err) {
          console.error('[CrossBrowserAudioCapture] Failed to stop recording:', err);
        }
      }
    },
    onError: (error) => {
      console.error('[CrossBrowserAudioCapture] Capture error:', error);
    }
  });

  // Update recording duration
  useEffect(() => {
    if (isRecording) {
      const startTime = Date.now();
      const interval = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      
      return () => clearInterval(interval);
    } else {
      setRecordingDuration(0);
    }
  }, [isRecording]);

  // Auto-start if requested
  useEffect(() => {
    if (autoStart && isSupported && !isCapturing) {
      startCapture();
    }
  }, [autoStart, isSupported]);

  // Format duration for display
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Render iOS fallback
  if (browser.isIOS) {
    return <IOSFallback deviceType={browser.name === 'safari' ? 'iphone' : 'ios'} />;
  }

  // Render unsupported browser message
  if (!isSupported) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mx-auto">
        <h2 className="text-xl font-bold text-red-900 mb-2">Browser Not Supported</h2>
        <p className="text-red-700">
          Audio capture is not supported in your current browser. Please use:
        </p>
        <ul className="list-disc list-inside mt-2 text-red-700">
          <li>Google Chrome (recommended)</li>
          <li>Safari 13 or later</li>
          <li>Microsoft Edge</li>
          <li>Mozilla Firefox</li>
        </ul>
      </div>
    );
  }

  // Render Safari instructions if using Safari
  if (captureMethod === 'safari-screen') {
    return (
      <SafariInstructions
        onStartCapture={toggleCapture}
        isCapturing={isCapturing}
        hasAudio={hasAudio}
        error={error?.message}
      />
    );
  }

  // Render main capture interface
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Audio Capture</h2>
        <p className="text-gray-600">
          {instructions}
        </p>
      </div>

      {/* Chrome Extension Notice */}
      {captureMethod === 'chrome-extension' && !isExtensionInstalled && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 font-medium mb-2">Chrome Extension Required</p>
          <p className="text-yellow-700 text-sm mb-3">
            For best audio quality, please install our Chrome extension.
          </p>
          <button
            onClick={installExtension}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
          >
            Install Extension
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-red-700 font-medium">Error:</p>
              <p className="text-red-600">{error.message}</p>
            </div>
            <button
              onClick={resetError}
              className="text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Capture Status */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {isCapturing ? (
              <>
                <div className="animate-pulse">
                  <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                </div>
                <span className="text-lg font-medium">
                  {hasAudio ? 'Capturing Audio' : 'Waiting for Audio...'}
                </span>
              </>
            ) : (
              <span className="text-lg text-gray-600">Ready to capture</span>
            )}
          </div>
          
          {isRecording && (
            <div className="text-gray-600">
              Duration: {formatDuration(recordingDuration)}
            </div>
          )}
        </div>

        {/* Audio Level Indicator */}
        {isCapturing && hasAudio && (
          <div className="mb-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Audio Level:</span>
              <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-green-500 h-full transition-all duration-100"
                  style={{ width: `${audioLevel * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Format Info */}
        {audioFormat && (
          <div className="text-sm text-gray-600 mb-4">
            Recording format: {audioFormat}
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex justify-center space-x-4">
        <button
          onClick={toggleCapture}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            isCapturing
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isCapturing ? 'Stop Capture' : 'Start Capture'}
        </button>
      </div>

      {/* Limitations */}
      {limitations.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-700 mb-2">Limitations:</h3>
          <ul className="list-disc list-inside text-sm text-gray-600">
            {limitations.map((limitation, index) => (
              <li key={index}>{limitation}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Browser Info (Debug) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-6 p-4 bg-gray-100 rounded text-xs text-gray-600">
          <p>Browser: {browser.name} {browser.version}</p>
          <p>Capture Method: {captureMethod}</p>
          <p>Mobile: {browser.isMobile ? 'Yes' : 'No'}</p>
          <p>Supports Screen Capture: {browser.supportsScreenCapture ? 'Yes' : 'No'}</p>
          <p>Supports Extensions: {browser.supportsExtensions ? 'Yes' : 'No'}</p>
        </div>
      )}
    </div>
  );
};