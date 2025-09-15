import React from 'react';

interface IOSFallbackProps {
  deviceType?: 'iphone' | 'ipad' | 'ios';
}

export const IOSFallback: React.FC<IOSFallbackProps> = ({ deviceType = 'ios' }) => {
  const getDeviceIcon = () => {
    switch (deviceType) {
      case 'iphone':
        return (
          <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 2a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V4a2 2 0 00-2-2H7zm0 2h10v14H7V4zm5 15a1 1 0 110 2 1 1 0 010-2z" />
          </svg>
        );
      case 'ipad':
        return (
          <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4 2a2 2 0 00-2 2v16a2 2 0 002 2h16a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h16v14H4V4zm8 15a1 1 0 110 2 1 1 0 010-2z" />
          </svg>
        );
      default:
        return (
          <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
        );
    }
  };

  const getDeviceName = () => {
    switch (deviceType) {
      case 'iphone':
        return 'iPhone';
      case 'ipad':
        return 'iPad';
      default:
        return 'iOS device';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4 text-gray-400">
            {getDeviceIcon()}
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Not Available on {getDeviceName()}
          </h1>
          
          <p className="text-gray-600 mb-6">
            Audio capture from web browsers is not supported on iOS devices due to platform limitations.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h2 className="font-semibold text-blue-900 mb-2">To use this application:</h2>
            <ul className="text-left text-blue-800 space-y-2">
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <span>Use a desktop or laptop computer</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <span>Open in Chrome, Safari, Edge, or Firefox</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <span>Ensure you have a modern browser version</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-700 mb-1">Recommended Browsers:</h3>
              <div className="flex justify-center space-x-4 mt-2">
                <div className="text-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-1">
                    <span className="text-xl">🔷</span>
                  </div>
                  <span className="text-xs text-gray-600">Chrome</span>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-1">
                    <span className="text-xl">🧭</span>
                  </div>
                  <span className="text-xs text-gray-600">Safari</span>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-1">
                    <span className="text-xl">🌐</span>
                  </div>
                  <span className="text-xs text-gray-600">Edge</span>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-1">
                    <span className="text-xl">🦊</span>
                  </div>
                  <span className="text-xs text-gray-600">Firefox</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Why isn't this available on iOS?</strong><br />
                iOS Safari doesn't support the Web APIs required for capturing audio from browser tabs or screen content.
              </p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              For the best experience, we recommend using this application on a desktop computer with Google Chrome.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};