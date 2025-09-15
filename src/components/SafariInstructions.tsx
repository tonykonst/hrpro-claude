import React from 'react';

interface SafariInstructionsProps {
  onStartCapture: () => void;
  isCapturing: boolean;
  hasAudio: boolean;
  error?: string | null;
}

export const SafariInstructions: React.FC<SafariInstructionsProps> = ({
  onStartCapture,
  isCapturing,
  hasAudio,
  error
}) => {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="flex items-center mb-4">
        <svg
          className="w-8 h-8 mr-3 text-blue-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        <h2 className="text-2xl font-bold text-gray-800">Safari Audio Capture</h2>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 font-medium">Error:</p>
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">How to capture audio in Safari:</h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800">
            <li>Open your video call (Google Meet, Zoom, etc.) in a Safari tab</li>
            <li>Return to this tab and click "Start Capture" below</li>
            <li>In the share dialog, select the tab with your video call</li>
            <li className="font-semibold">Important: Check "Share Audio" checkbox in the dialog</li>
            <li>Click "Share" to begin capturing</li>
          </ol>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-900 mb-2">Safari Limitations:</h3>
          <ul className="list-disc list-inside space-y-1 text-yellow-800 text-sm">
            <li>Audio capture only works with content playing in Safari tabs</li>
            <li>Cannot capture system audio or audio from other applications</li>
            <li>Requires Safari 13 or later</li>
            <li>Screen recording permissions may be required in System Preferences</li>
          </ul>
        </div>

        {isCapturing ? (
          <div className="flex flex-col items-center space-y-4">
            <div className="flex items-center space-x-3">
              <div className="animate-pulse">
                <div className="w-3 h-3 bg-red-600 rounded-full"></div>
              </div>
              <span className="text-lg font-medium text-gray-700">
                {hasAudio ? 'Capturing audio...' : 'Waiting for audio...'}
              </span>
            </div>
            
            {!hasAudio && (
              <div className="text-sm text-gray-600 text-center">
                <p>No audio detected. Please ensure:</p>
                <ul className="list-disc list-inside mt-2">
                  <li>You selected "Share Audio" when sharing</li>
                  <li>Audio is playing in the shared tab</li>
                  <li>The tab is not muted</li>
                </ul>
              </div>
            )}

            <button
              onClick={onStartCapture}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              Stop Capture
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4">
            <button
              onClick={onStartCapture}
              className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg shadow-lg"
            >
              Start Capture
            </button>
            
            <p className="text-sm text-gray-600 text-center">
              Make sure your video call is open in another Safari tab before starting
            </p>
          </div>
        )}

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-semibold text-gray-700 mb-2">Troubleshooting:</h4>
          <details className="text-sm text-gray-600">
            <summary className="cursor-pointer hover:text-gray-800">No audio after sharing?</summary>
            <div className="mt-2 pl-4 space-y-1">
              <p>• Ensure "Share Audio" was checked in the share dialog</p>
              <p>• Verify audio is playing in the shared tab</p>
              <p>• Check Safari's audio permissions in System Preferences</p>
              <p>• Try refreshing both tabs and starting again</p>
            </div>
          </details>
          <details className="text-sm text-gray-600 mt-2">
            <summary className="cursor-pointer hover:text-gray-800">Permission denied error?</summary>
            <div className="mt-2 pl-4 space-y-1">
              <p>• Go to System Preferences → Security & Privacy → Screen Recording</p>
              <p>• Ensure Safari is allowed to record the screen</p>
              <p>• Restart Safari after changing permissions</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};