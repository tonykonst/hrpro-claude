import React, { useState, useEffect } from "react";
import { ControlPanel, DataWindow } from "./components";
import { NativeAudioOverlay } from "./components/overlay";
import { useWindowManager } from "./hooks/useWindowManager";
import { useDataSync } from "./hooks/useDataSync";
import { useTranscriptionElectron } from "./hooks/transcription/useTranscriptionElectron";
import { useAudioRecording } from "./hooks/useAudioRecording";

// Типы для IPC - теперь используется безопасный electronAPI
declare global {
  interface Window {
    electronAPI: any; // Упрощенное определение, так как типы уже определены в preload.ts
  }
}

export function App() {
  // Определяем тип окна из URL параметров
  const urlParams = new URLSearchParams(window.location.search);
  const windowType = urlParams.get('window') || 'control';

  // Состояния UI
  const [isVisible, setIsVisible] = useState(true);
  const [clickThrough, setClickThrough] = useState(false);
  
  // Хуки для функциональности
  const transcription = useTranscriptionElectron();
  const audioRecording = useAudioRecording();
  
  // Window manager hook
  const { createDataWindow, closeDataWindow } = useWindowManager({
    windowType: windowType as 'control' | 'data',
    isRecording: transcription.isRecording,
    onError: (error) => console.error('Window manager error:', error)
  });

  // Data sync hook
  useDataSync({
    windowType: windowType as 'control' | 'data',
    transcript: transcription.transcript,
    partialTranscript: transcription.partialTranscript,
    insights: transcription.insights,
    isRecording: transcription.isRecording,
    onTranscriptUpdate: (data) => {
      if (data.transcript !== undefined) {
        transcription.setTranscript(data.transcript);
      }
      if (data.partialTranscript !== undefined) {
        transcription.setPartialTranscript(data.partialTranscript);
      }
    },
    onInsightsUpdate: (newInsights) => {
      transcription.setInsights(newInsights);
    },
    onRecordingStateChange: (recordingState) => {
      transcription.setIsRecording(recordingState);
    }
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        setIsVisible(!isVisible);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "T") {
        setClickThrough(!clickThrough);
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [isVisible, clickThrough]);

  // Check microphone permission on mount
  useEffect(() => {
    audioRecording.checkMicPermission().catch(error => {
      console.warn('⚠️ [App] Mic permission check failed:', error);
    });
  }, [audioRecording.checkMicPermission]);

  // Render based on window type
  if (windowType === 'data') {
    return (
      <DataWindow
        transcript={transcription.transcript}
        partialTranscript={transcription.partialTranscript}
        insights={transcription.insights}
        isRecording={transcription.isRecording}
      />
    );
  }

  // Render native audio overlay if this is the overlay window
  if (windowType === 'native-audio-overlay') {
    return <NativeAudioOverlay />;
  }

  return (
    <ControlPanel
      isRecording={transcription.isRecording}
      hasPermission={audioRecording.hasPermission}
      transcript={transcription.transcript}
      partialTranscript={transcription.partialTranscript}
      insights={transcription.insights}
      audioLevel={transcription.audioLevel}
      isVisible={isVisible}
      clickThrough={clickThrough}
      onStartRecording={transcription.startRecording}
      onStopRecording={transcription.stopRecording}
      onCheckMicPermission={audioRecording.checkMicPermission}
    />
  );
}