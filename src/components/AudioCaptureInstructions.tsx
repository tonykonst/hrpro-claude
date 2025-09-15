import React, { useEffect, useState } from 'react';

interface InstructionEvent {
  detail: {
    onRetry: () => void;
  };
}

export const AudioCaptureInstructions: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [onRetry, setOnRetry] = useState<() => void>(() => () => {});

  useEffect(() => {
    const handler = (e: Event) => {
      const event = e as InstructionEvent;
      setOnRetry(() => event.detail.onRetry);
      setVisible(true);
    };
    window.addEventListener('audio-capture-instructions', handler as EventListener);
    return () => window.removeEventListener('audio-capture-instructions', handler as EventListener);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md text-center">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">No audio captured</h2>
        <p className="mb-4 text-gray-700">
          Please ensure "Share tab audio" is checked and the tab is not muted, then try again.
        </p>
        <div className="flex justify-end space-x-2">
          <button
            className="px-4 py-2 bg-gray-200 rounded"
            onClick={() => setVisible(false)}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded"
            onClick={() => {
              setVisible(false);
              onRetry();
            }}
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  );
};
