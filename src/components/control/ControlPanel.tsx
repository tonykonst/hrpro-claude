import React from 'react';
import { LegacyInsight } from '../../types/events';
import { AudioSourceType } from '../../hooks/transcription';
import { StartButton } from './StartButton';
import { RecordingControls } from './RecordingControls';
import { DragZone } from './DragZone';
import { TranscriptSection } from '../data/TranscriptSection';
import { InsightsSection } from '../data/InsightsSection';
import { AudioSourceSelector } from '../AudioSourceSelector';

/**
 * Props for ControlPanel component
 */
interface ControlPanelProps {
  // Состояния
  isRecording: boolean;
  hasPermission: boolean | null;
  transcript: string;
  partialTranscript: string;
  insights: LegacyInsight[];
  audioLevel: number;
  isVisible: boolean;
  clickThrough: boolean;

  // Методы
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCheckMicPermission: () => void;
  lastCorrectionTime?: number;

  // Audio source props (optional for backward compatibility)
  currentAudioSource?: AudioSourceType;
  onAudioSourceChange?: (source: AudioSourceType) => void;
  availableAudioSources?: AudioSourceType[];
}

/**
 * Main control panel component for the interview assistant
 * 
 * @example
 * ```tsx
 * <ControlPanel
 *   isRecording={false}
 *   hasPermission={true}
 *   transcript=""
 *   partialTranscript=""
 *   insights={[]}
 *   audioLevel={0}
 *   isVisible={true}
 *   clickThrough={false}
 *   onStartRecording={handleStart}
 *   onStopRecording={handleStop}
 *   onCheckMicPermission={handlePermission}
 * />
 * ```
 */
export function ControlPanel({
  isRecording,
  hasPermission,
  transcript,
  partialTranscript,
  insights,
  audioLevel,
  isVisible,
  clickThrough,
  onStartRecording,
  onStopRecording,
  onCheckMicPermission,
  lastCorrectionTime,
  currentAudioSource,
  onAudioSourceChange,
  availableAudioSources
}: ControlPanelProps) {
  console.log('🎨 [ControlPanel] Rendering with props:', {
    isRecording,
    hasPermission,
    isVisible,
    hasOnStartRecording: typeof onStartRecording === 'function',
    hasOnCheckMicPermission: typeof onCheckMicPermission === 'function'
  });

  const [showCorrectionFlash, setShowCorrectionFlash] = React.useState(false);
  // State to preserve transcript visibility after recording stops
  const [showTranscript, setShowTranscript] = React.useState(false);

  // Эффект для анимации исправлений
  React.useEffect(() => {
    if (lastCorrectionTime && lastCorrectionTime > Date.now() - 5000) {
      setShowCorrectionFlash(true);
      const timer = setTimeout(() => setShowCorrectionFlash(false), 300);
      return () => clearTimeout(timer);
    }
  }, [lastCorrectionTime]);

  // Show transcript when recording starts or when there's content
  React.useEffect(() => {
    if (isRecording || transcript || partialTranscript) {
      setShowTranscript(true);
    }
  }, [isRecording, transcript, partialTranscript]);

  // Если не видимый, не рендерим
  if (!isVisible) {
    return null;
  }

  // Если запись идет или есть транскрипт для отображения
  if (isRecording || showTranscript) {
    return (
      <div className="recording-screen">
        {/* Top panel - recording controls */}
        <div className="recording-screen__header">
          {isRecording ? (
            <RecordingControls
              onStopRecording={onStopRecording}
              audioLevel={audioLevel}
            />
          ) : (
            <div className="recording-screen__header-controls">
              {/* Audio source selector when not recording - compact version */}
              {onAudioSourceChange && (
                <AudioSourceSelector
                  onSourceChange={(source) => onAudioSourceChange(source as AudioSourceType)}
                  defaultSource={currentAudioSource}
                  disabled={isRecording}
                  compact={true}
                />
              )}
              <StartButton
                hasPermission={hasPermission || false}
                onStartRecording={onStartRecording}
                onCheckMicPermission={onCheckMicPermission}
              />
            </div>
          )}
        </div>

        {/* Main content area - always show if we have transcript data */}
        <div className="recording-screen__content">
          <TranscriptSection
            transcript={transcript}
            partialTranscript={partialTranscript}
          />
          <InsightsSection insights={insights} />
        </div>
      </div>
    );
  }

  // Если не записываем и нет транскрипта, показываем стартовый экран
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="control-panel">
        {/* Audio source selector - compact inline version */}
        {onAudioSourceChange && (
          <div className="control-panel__audio-source-compact">
            <AudioSourceSelector
              onSourceChange={(source) => onAudioSourceChange(source as AudioSourceType)}
              defaultSource={currentAudioSource}
              disabled={false}
              compact={true}
            />
          </div>
        )}

        {/* Actions section */}
        <div className="control-panel__actions">
          <StartButton
            hasPermission={hasPermission || false}
            onStartRecording={onStartRecording}
            onCheckMicPermission={onCheckMicPermission}
          />
        </div>

        {/* Separator */}
        <div className="control-panel__separator"></div>

        {/* Drag zone */}
        <DragZone />
      </div>

    </div>
  );
}
