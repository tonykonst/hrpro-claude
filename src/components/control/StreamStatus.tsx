/**
 * Stream Status Component
 * 
 * Отображает статус аудио потоков кандидата и HR.
 * Соответствует архитектурным принципам hrpro.mdc:
 * - Строгая типизация с интерфейсами
 * - Обработка ошибок с error boundaries
 * - Структурированное логирование
 */

import React, { useState, useEffect } from 'react';
import { AudioStreamSplitter } from '../../services/audio/AudioStreamSplitter';
import { StreamAnalysis } from '../../types/IAudioService';
import { Logger } from '../../utils/logger';

interface StreamStatusProps {
  streamSplitter: AudioStreamSplitter | null;
}

export const StreamStatus: React.FC<StreamStatusProps> = ({ streamSplitter }) => {
  const [candidateAnalysis, setCandidateAnalysis] = useState<StreamAnalysis | null>(null);
  const [hrAnalysis, setHRAnalysis] = useState<StreamAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!streamSplitter) {
      setCandidateAnalysis(null);
      setHRAnalysis(null);
      setError(null);
      return;
    }
    
    const updateAnalyses = () => {
      try {
        const candidate = streamSplitter.getCandidateAnalysis();
        const hr = streamSplitter.getHRAnalysis();
        
        setCandidateAnalysis(candidate);
        setHRAnalysis(hr);
        setError(null);
        
        // Логируем изменения для отладки
        if (candidate?.isActive || hr?.isActive) {
          Logger.debug('Stream activity detected', {
            candidateActive: candidate?.isActive,
            hrActive: hr?.isActive,
            candidateVolume: candidate?.characteristics.volume.toFixed(2),
            hrVolume: hr?.characteristics.volume.toFixed(2)
          });
        }
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        Logger.error('Failed to update stream analyses', { error: errorMessage });
      }
    };
    
    // Обновляем анализы каждые 500ms
    const interval = setInterval(updateAnalyses, 500);
    
    // Первоначальное обновление
    updateAnalyses();
    
    return () => {
      clearInterval(interval);
      Logger.debug('Stream status monitoring stopped');
    };
  }, [streamSplitter]);
  
  if (!streamSplitter) {
    return (
      <div className="stream-status stream-status--disabled">
        <div className="stream-status__title">Audio Streams</div>
        <div className="stream-status__message">No stream splitter available</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="stream-status stream-status--error">
        <div className="stream-status__title">Audio Streams</div>
        <div className="stream-status__error">Error: {error}</div>
      </div>
    );
  }
  
  return (
    <div className="stream-status">
      <div className="stream-status__title">Audio Streams</div>
      
      <div className="stream-status__stream">
        <div className="stream-status__label">
          🎤 Candidate {candidateAnalysis?.isActive ? '●' : '○'}
        </div>
        <div className="stream-status__details">
          {candidateAnalysis ? (
            <>
              <div className="stream-status__metric">
                Volume: {(candidateAnalysis.characteristics.volume * 100).toFixed(0)}%
              </div>
              <div className="stream-status__metric">
                Confidence: {(candidateAnalysis.confidence * 100).toFixed(0)}%
              </div>
              <div className="stream-status__metric">
                Source: {candidateAnalysis.source.name}
              </div>
            </>
          ) : (
            <div className="stream-status__no-data">No candidate stream</div>
          )}
        </div>
      </div>
      
      <div className="stream-status__stream">
        <div className="stream-status__label">
          👤 HR {hrAnalysis?.isActive ? '●' : '○'}
        </div>
        <div className="stream-status__details">
          {hrAnalysis ? (
            <>
              <div className="stream-status__metric">
                Volume: {(hrAnalysis.characteristics.volume * 100).toFixed(0)}%
              </div>
              <div className="stream-status__metric">
                Confidence: {(hrAnalysis.confidence * 100).toFixed(0)}%
              </div>
              <div className="stream-status__metric">
                Source: {hrAnalysis.source.name}
              </div>
            </>
          ) : (
            <div className="stream-status__no-data">No HR stream</div>
          )}
        </div>
      </div>
    </div>
  );
};
