import React, { useState, useEffect, useCallback } from 'react';
import { useTranscriptionNative } from '../../hooks/transcription/useTranscriptionNative';
import { Logger } from '../../utils/logger';

/**
 * Native Audio Overlay Component (v0.54)
 * Transparent overlay for native audio capture interface
 * 
 * @example
 * ```tsx
 * <NativeAudioOverlay />
 * ```
 */
export const NativeAudioOverlay: React.FC = () => {
  const [isClickThrough, setIsClickThrough] = useState(false);
  const [transparency, setTransparency] = useState(0.8);
  const [isMinimized, setIsMinimized] = useState(false);
  
  const transcription = useTranscriptionNative();

  /**
   * Toggle click-through mode
   */
  const toggleClickThrough = useCallback(async () => {
    try {
      await window.electronAPI?.invoke('overlay:toggle-click-through');
      setIsClickThrough(!isClickThrough);
      Logger.info('Click-through mode toggled', { enabled: !isClickThrough });
    } catch (error) {
      Logger.error('Failed to toggle click-through', { error });
    }
  }, [isClickThrough]);

  /**
   * Set transparency level
   */
  const setTransparencyLevel = useCallback(async (alpha: number) => {
    try {
      await window.electronAPI?.invoke('overlay:set-transparency', alpha);
      setTransparency(alpha);
      Logger.info('Transparency updated', { alpha });
    } catch (error) {
      Logger.error('Failed to set transparency', { error });
    }
  }, []);

  /**
   * Toggle overlay visibility
   */
  const toggleVisibility = useCallback(async () => {
    try {
      await window.electronAPI?.invoke('overlay:toggle-visibility');
      Logger.info('Overlay visibility toggled');
    } catch (error) {
      Logger.error('Failed to toggle visibility', { error });
    }
  }, []);

  /**
   * Start native audio recording
   */
  const startRecording = useCallback(async () => {
    try {
      await transcription.startRecording();
      Logger.info('Native audio recording started');
    } catch (error) {
      Logger.error('Failed to start native audio recording', { error });
    }
  }, [transcription]);

  /**
   * Stop native audio recording
   */
  const stopRecording = useCallback(async () => {
    try {
      await transcription.stopRecording();
      Logger.info('Native audio recording stopped');
    } catch (error) {
      Logger.error('Failed to stop native audio recording', { error });
    }
  }, [transcription]);

  /**
   * Get status indicator color
   */
  const getStatusColor = (): string => {
    if (transcription.isRecording) {
      return '#ff4444'; // Red when recording
    } else if (transcription.isNativeAudioAvailable) {
      return '#44ff44'; // Green when available
    } else {
      return '#ffaa44'; // Orange when not available
    }
  };

  /**
   * Get status text
   */
  const getStatusText = (): string => {
    if (transcription.isRecording) {
      return 'Recording';
    } else if (transcription.isNativeAudioAvailable) {
      return 'Ready';
    } else if (transcription.initializationError) {
      return 'Error';
    } else {
      return 'Initializing...';
    }
  };

  /**
   * Get device info text
   */
  const getDeviceInfoText = (): string => {
    const deviceInfo = transcription.nativeAudioDeviceInfo;
    if (deviceInfo) {
      return `${deviceInfo.name} (${deviceInfo.sampleRate}Hz)`;
    }
    return 'No device info';
  };

  return (
    <div 
      className="native-audio-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: isClickThrough ? 'none' : 'auto',
        zIndex: 9999,
        background: 'transparent'
      }}
    >
      {/* Main overlay panel */}
      <div
        className="overlay-panel"
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          width: isMinimized ? '60px' : '280px',
          height: isMinimized ? '40px' : '80px',
          background: `rgba(0, 0, 0, ${transparency})`,
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(10px)',
          transition: 'all 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
          padding: '8px',
          color: 'white',
          fontSize: '12px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: isMinimized ? '0' : '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: getStatusColor(),
                animation: transcription.isRecording ? 'pulse 1s infinite' : 'none'
              }}
            />
            <span style={{ fontWeight: 'bold' }}>
              {isMinimized ? 'NA' : 'Native Audio'}
            </span>
          </div>
          
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                padding: '2px',
                fontSize: '10px'
              }}
            >
              {isMinimized ? '▼' : '▲'}
            </button>
            <button
              onClick={toggleVisibility}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                padding: '2px',
                fontSize: '10px'
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Content (when not minimized) */}
        {!isMinimized && (
          <>
            {/* Status */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>
                Status: {getStatusText()}
              </div>
              <div style={{ fontSize: '10px', opacity: 0.6 }}>
                {getDeviceInfoText()}
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* Record button */}
              <button
                onClick={transcription.isRecording ? stopRecording : startRecording}
                disabled={!transcription.isNativeAudioAvailable}
                style={{
                  background: transcription.isRecording ? '#ff4444' : '#44ff44',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  padding: '4px 8px',
                  fontSize: '10px',
                  cursor: transcription.isNativeAudioAvailable ? 'pointer' : 'not-allowed',
                  opacity: transcription.isNativeAudioAvailable ? 1 : 0.5
                }}
              >
                {transcription.isRecording ? 'Stop' : 'Start'}
              </button>

              {/* Click-through toggle */}
              <button
                onClick={toggleClickThrough}
                style={{
                  background: isClickThrough ? '#ffaa44' : 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  padding: '4px 8px',
                  fontSize: '10px',
                  cursor: 'pointer'
                }}
              >
                {isClickThrough ? 'CT' : 'IT'}
              </button>

              {/* Transparency slider */}
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={transparency}
                onChange={(e) => setTransparencyLevel(parseFloat(e.target.value))}
                style={{
                  width: '60px',
                  height: '4px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  outline: 'none',
                  borderRadius: '2px'
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* CSS for pulse animation */}
      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        `}
      </style>
    </div>
  );
};

export default NativeAudioOverlay;


