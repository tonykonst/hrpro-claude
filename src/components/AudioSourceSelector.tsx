/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                      AUDIO SOURCE SELECTOR COMPONENT                      ║
 * ╠════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                            ║
 * ║  Component for selecting audio input source.                              ║
 * ║  Automatically hides when browser capture is disabled via feature flags.  ║
 * ║                                                                            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect } from 'react';
import { useFeatureFlag, useBrowserCapture } from '../hooks/useFeatureFlags';
import { getBrowserCaptureService } from '../services/browserCaptureService';

interface AudioSourceSelectorProps {
  onSourceChange?: (source: string) => void;
  defaultSource?: string;
  disabled?: boolean;
  compact?: boolean; // New compact mode for header
}

export const AudioSourceSelector: React.FC<AudioSourceSelectorProps> = ({
  onSourceChange,
  defaultSource = 'microphone',
  disabled = false,
  compact = false,
}) => {
  const [selectedSource, setSelectedSource] = useState(defaultSource);
  const [availableSources, setAvailableSources] = useState<any[]>([]);
  
  // Check feature flags
  const showSelector = useFeatureFlag('ENABLE_AUDIO_SOURCE_SELECTOR');
  const { enabled: browserCaptureEnabled, chromeEnabled, safariEnabled, firefoxEnabled } = useBrowserCapture();
  
  // Get available sources on mount and when flags change
  useEffect(() => {
    const service = getBrowserCaptureService();
    const capabilities = service.getCapabilities();

    const sources = capabilities.availableSources.map(id => ({
      id,
      label:
        id === 'microphone'
          ? 'Microphone'
          : id === 'browser-tab'
            ? 'Browser Tab Audio'
            : id === 'screen-with-audio'
              ? 'Screen with Audio'
              : 'System Audio',
      type: id,
      available: true,
      requiresExtension:
        id === 'browser-tab' && capabilities.requiresExtension && !capabilities.extensionInstalled,
    }));

    setAvailableSources(sources);

    // If the current selected source is not available, switch to microphone
    const isSelectedSourceAvailable = capabilities.availableSources.includes(
      selectedSource as any
    );

    if (!isSelectedSourceAvailable && selectedSource !== 'microphone') {
      console.log(
        `🔄 [AudioSourceSelector] Selected source '${selectedSource}' not available, switching to microphone`
      );
      setSelectedSource('microphone');
      onSourceChange?.('microphone');
    }
  }, [
    browserCaptureEnabled,
    chromeEnabled,
    safariEnabled,
    firefoxEnabled,
    selectedSource,
    onSourceChange,
  ]);
  
  // Handle source change
  const handleSourceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newSource = event.target.value;
    setSelectedSource(newSource);
    onSourceChange?.(newSource);
  };
  
  // ========================================================================
  // FEATURE FLAG CHECK
  // Component is hidden when ENABLE_AUDIO_SOURCE_SELECTOR is false
  // ========================================================================
  if (!showSelector) {
    return null;
  }
  
  // If browser capture is disabled, only show microphone
  if (!browserCaptureEnabled) {
    if (compact) {
      return (
        <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
          🎤 Microphone
        </span>
      );
    }
    return (
      <div style={{
        padding: '8px',
        backgroundColor: '#f7fafc',
        borderRadius: '4px',
        fontSize: '14px',
        color: '#718096',
      }}>
        <span>📍 Audio Source: Microphone</span>
      </div>
    );
  }

  // Compact version for header
  if (compact) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <select
          value={selectedSource}
          onChange={handleSourceChange}
          disabled={disabled}
          style={{
            padding: '2px 6px',
            borderRadius: '4px',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            fontSize: '12px',
            color: 'white',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {availableSources.map(source => (
            <option
              key={source.id}
              value={source.id}
              disabled={!source.available}
              style={{ color: 'black' }}
            >
              {source.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Full version
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px',
      backgroundColor: '#f7fafc',
      borderRadius: '4px',
    }}>
      <label style={{
        fontSize: '14px',
        color: '#4a5568',
        fontWeight: 500,
      }}>
        Audio Source:
      </label>
      <select
        value={selectedSource}
        onChange={handleSourceChange}
        disabled={disabled}
        style={{
          padding: '4px 8px',
          borderRadius: '4px',
          border: '1px solid #cbd5e0',
          backgroundColor: disabled ? '#e2e8f0' : 'white',
          fontSize: '14px',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {availableSources.map(source => (
          <option
            key={source.id}
            value={source.id}
            disabled={!source.available}
          >
            {source.label}
            {source.requiresExtension && ' (Extension Required)'}
            {!source.available && ' (Not Available)'}
          </option>
        ))}
      </select>

      {/* Show browser-specific hints */}
      {selectedSource === 'browser-tab' && chromeEnabled && (
        <span style={{ fontSize: '12px', color: '#718096' }}>
          Chrome extension required
        </span>
      )}

      {selectedSource === 'screen-with-audio' && safariEnabled && (
        <span style={{ fontSize: '12px', color: '#718096' }}>
          Will open screen share dialog
        </span>
      )}
    </div>
  );
};

/**
 * Example of how to use the selector with feature flags
 */
export const AudioSourceExample: React.FC = () => {
  const [currentSource, setCurrentSource] = useState('microphone');
  const { enabled, available } = useBrowserCapture();
  
  return (
    <div style={{ padding: '20px' }}>
      <h3>Audio Input Configuration</h3>
      
      {/* Show status based on feature flags */}
      <div style={{ marginBottom: '16px' }}>
        <p>Browser Capture: {enabled ? '✅ Enabled' : '❌ Disabled'}</p>
        <p>Available: {available ? 'Yes' : 'No (Microphone only)'}</p>
      </div>
      
      {/* Audio source selector - automatically hidden if feature disabled */}
      <AudioSourceSelector
        defaultSource={currentSource}
        onSourceChange={setCurrentSource}
      />
      
      {/* Show current selection */}
      <div style={{ marginTop: '16px' }}>
        <p>Current source: {currentSource}</p>
      </div>
      
      {/* Instructions for developers */}
      {!enabled && (
        <div style={{
          marginTop: '20px',
          padding: '12px',
          backgroundColor: '#fef5e7',
          borderRadius: '4px',
          border: '1px solid #f9e79f',
        }}>
          <strong>Developer Note:</strong>
          <p>Browser capture is currently disabled.</p>
          <p>To enable:</p>
          <ul>
            <li>Set REACT_APP_ENABLE_BROWSER_CAPTURE=true in .env</li>
            <li>Or press Ctrl+Shift+F to open feature flag panel</li>
          </ul>
        </div>
      )}
    </div>
  );
};