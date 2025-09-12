import { useCallback, useState } from 'react';
import { configService } from '../../services/config';
import { useAudioAnalyser } from '../useAudioAnalyser';
import { AudioStreamSplitter } from '../../services/audio/AudioStreamSplitter';
import { AppError, ErrorHandler } from '../../utils/errors';
import { Logger } from '../../utils/logger';
import { PerformanceMonitor } from '../../utils/performance-monitor';

/**
 * Recording functionality for transcription hook
 * 
 * @example
 * ```tsx
 * const recording = useTranscriptionRecording({
 *   streamRef,
 *   audioContextRef,
 *   processorRef,
 *   cleanupRef,
 *   deepgramRef,
 *   setIsRecording,
 *   initAudioAnalyser,
 *   stopAudioAnalyser,
 *   connectToDeepgram
 * });
 * ```
 */
interface UseTranscriptionRecordingProps {
  streamRef: React.MutableRefObject<MediaStream | null>;
  audioContextRef: React.MutableRefObject<AudioContext | null>;
  processorRef: React.MutableRefObject<ScriptProcessorNode | AudioWorkletNode | null>;
  cleanupRef: React.MutableRefObject<(() => void) | null>;
  deepgramRef: React.MutableRefObject<any>;
  setIsRecording: (recording: boolean) => void;
  initAudioAnalyser: (stream: MediaStream) => void;
  stopAudioAnalyser: () => void;
  connectToDeepgram: () => Promise<() => void>;
}

export const useTranscriptionRecording = ({
  streamRef,
  audioContextRef,
  processorRef,
  cleanupRef,
  deepgramRef,
  setIsRecording,
  initAudioAnalyser,
  stopAudioAnalyser,
  connectToDeepgram
}: UseTranscriptionRecordingProps) => {
  const [streamSplitter, setStreamSplitter] = useState<AudioStreamSplitter | null>(null);
  const [candidateStream, setCandidateStream] = useState<MediaStream | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  /**
   * Start recording with stream splitting
   */
  const startRecording = useCallback(async (): Promise<void> => {
    const startTime = performance.now();
    setIsInitializing(true);
    
    try {
      Logger.info('Starting recording with stream splitting');
      
      // Обновляем UI состояние
      setIsRecording(true);
      
      // Проверяем, включено ли разделение потоков
      const audioSplitConfig = configService.getAudioSplitConfig();
      
      if (audioSplitConfig.enabled) {
        try {
          // ШАГ 1: Инициализируем разделитель потоков с retry логикой
          const splitter = await ErrorHandler.withRetry(
            async () => {
              const newSplitter = new AudioStreamSplitter();
              await newSplitter.initialize();
              return newSplitter;
            },
            3,
            1000
          );
          setStreamSplitter(splitter);
          
          // ШАГ 2: Получаем поток кандидата
          const candidateAudioStream = await splitter.selectCandidateStream();
          if (!candidateAudioStream) {
            throw new AppError(
              'No candidate audio stream available',
              'NO_CANDIDATE_STREAM_ERROR',
              true
            );
          }
          setCandidateStream(candidateAudioStream);
          streamRef.current = candidateAudioStream;
          
          // ШАГ 3: Подключаемся к Deepgram с потоком кандидата
          const cleanup = await connectToDeepgram();
          cleanupRef.current = cleanup;
          
          // ШАГ 4: Настраиваем аудио pipeline для потока кандидата
          const audioContext = new AudioContext({ sampleRate: 16000 });
          audioContextRef.current = audioContext;
          
          await audioContext.audioWorklet.addModule('/audioWorklet.js');
          
          const source = audioContext.createMediaStreamSource(candidateAudioStream);
          const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
          
          // ШАГ 5: Обработчик аудио данных (только кандидат)
          workletNode.port.onmessage = (event) => {
            if (event.data.type === 'pcm-data') {
              deepgramRef.current?.sendAudio(event.data.data);
            }
          };
          
          source.connect(workletNode);
          processorRef.current = workletNode;
          
          // ШАГ 6: Инициализируем анализатор аудио для потока кандидата
          initAudioAnalyser(candidateAudioStream);
          
          // ШАГ 7: Мониторим активность потоков
          const monitoringCleanup = startStreamMonitoring(splitter);
          cleanupRef.current = () => {
            cleanup();
            monitoringCleanup();
          };
          
          // Записываем метрики производительности
          const duration = performance.now() - startTime;
          PerformanceMonitor.recordAnalysisLatency(duration);
          
          Logger.info('Recording started successfully with stream splitting', {
            candidateStreamId: candidateAudioStream.id,
            duration: `${duration.toFixed(2)}ms`
          });
          
        } catch (error) {
          Logger.warn('Stream splitting failed, falling back to single stream', { error });
          
          // Fallback к обычному режиму
          if (audioSplitConfig.fallbackToSingleStream) {
            await startRecordingFallback();
          } else {
            throw error;
          }
        }
      } else {
        // Обычный режим без разделения потоков
        await startRecordingFallback();
      }
      
    } catch (error) {
      Logger.error('Failed to start recording', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      setIsRecording(false);
      
      // Создаем более информативную ошибку
      const appError = new AppError(
        'Failed to start recording with system audio',
        'RECORDING_START_ERROR',
        true,
        { 
          originalError: error instanceof Error ? error.message : String(error)
        }
      );
      
      throw appError;
    } finally {
      setIsInitializing(false);
    }
  }, [
    setIsRecording,
    streamRef,
    audioContextRef,
    processorRef,
    cleanupRef,
    deepgramRef,
    initAudioAnalyser,
    connectToDeepgram
  ]);

  /**
   * Fallback recording without stream splitting
   * Uses system audio (candidate speech) instead of microphone (HR speech)
   */
  const startRecordingFallback = useCallback(async (): Promise<void> => {
    Logger.info('Starting single-stream recording with system audio (video call)');
    
    try {
      // Проверяем поддержку getDisplayMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('getDisplayMedia is not supported in this browser');
      }
      
      Logger.info('Browser info', {
        userAgent: navigator.userAgent,
        hasGetDisplayMedia: !!navigator.mediaDevices.getDisplayMedia,
        mediaDevices: Object.keys(navigator.mediaDevices)
      });
      
      // Пробуем разные варианты захвата
      let stream: MediaStream;
      
      try {
        // Сначала пробуем с аудио
        Logger.info('Attempting getDisplayMedia with audio: true');
        stream = await navigator.mediaDevices.getDisplayMedia({
          audio: true,
          video: true
        });
      } catch (audioError) {
        Logger.warn('getDisplayMedia with audio failed, trying video only', { 
          error: audioError instanceof Error ? audioError.message : String(audioError)
        });
        
        // Если не работает с аудио, пробуем только видео
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true
        });
        
        // Проверяем, есть ли аудио треки в видео потоке
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          throw new Error('No audio tracks available in video stream. Audio capture not supported in this browser.');
        }
      }
      
      // Проверяем наличие аудио треков
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks found in the captured stream');
      }
      
      // Отключаем видео треки, оставляем только аудио
      stream.getVideoTracks().forEach(track => {
        track.stop();
        stream.removeTrack(track);
      });
      
      Logger.info('System audio captured successfully', {
        audioTracks: audioTracks.length,
        audioTrackLabel: audioTracks[0]?.label || 'unknown'
      });
      
      streamRef.current = stream;
      
      // Инициализируем анализатор аудио
      initAudioAnalyser(stream);
      
      // Подключаемся к Deepgram
      const cleanup = await connectToDeepgram();
      cleanupRef.current = cleanup;
      
      // Настраиваем аудио pipeline
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      
      try {
        // Пытаемся использовать AudioWorklet (современный подход)
        await audioContext.audioWorklet.addModule('/audioWorklet.js');
        
        const source = audioContext.createMediaStreamSource(stream);
        const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
        
        // Обработчик аудио данных
        workletNode.port.onmessage = (event) => {
          if (event.data.type === 'pcm-data' && deepgramRef.current) {
            deepgramRef.current.sendAudio(event.data.data);
          }
        };
        
        source.connect(workletNode);
        processorRef.current = workletNode;
        
        Logger.info('Fallback AudioWorklet pipeline ready');
        
      } catch (workletError) {
        Logger.warn('AudioWorklet failed, falling back to ScriptProcessor', { workletError });
        
        // Fallback на ScriptProcessor
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        
        processor.onaudioprocess = (event) => {
          const inputData = event.inputBuffer.getChannelData(0);
          
          // Конвертируем Float32 в Int16
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
          }
          
          // Отправляем данные в Deepgram
          if (deepgramRef.current) {
            deepgramRef.current.sendAudio(pcm16.buffer);
          }
        };
        
        source.connect(processor);
        processor.connect(audioContext.destination);
        processorRef.current = processor;
        
        Logger.info('Fallback ScriptProcessor pipeline ready');
      }
      
      Logger.info('Fallback recording started successfully with system audio (video call audio only)');
      
    } catch (error) {
      Logger.error('System audio capture failed', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      const appError = new AppError(
        'Failed to capture system audio from video call. This browser may not support audio capture from screen sharing.',
        'SYSTEM_AUDIO_CAPTURE_ERROR',
        false,
        { 
          originalError: error instanceof Error ? error.message : String(error),
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          userAgent: navigator.userAgent,
          supportedBrowsers: 'Chrome 72+, Firefox 66+, Safari 13+',
          instructions: 'Try using Chrome or Firefox. Make sure to select the correct window/tab with the video call.'
        }
      );
      
      throw appError;
    }
  }, [
    streamRef,
    audioContextRef,
    processorRef,
    cleanupRef,
    deepgramRef,
    initAudioAnalyser,
    connectToDeepgram
  ]);

  /**
   * Start stream monitoring
   */
  const startStreamMonitoring = useCallback((splitter: AudioStreamSplitter) => {
    const monitor = setInterval(() => {
      try {
        const candidateAnalysis = splitter.getCandidateAnalysis();
        const hrAnalysis = splitter.getHRAnalysis();
        
        // Логируем активность для отладки
        if (candidateAnalysis?.isActive) {
          Logger.debug('Candidate stream active', {
            volume: candidateAnalysis.characteristics.volume.toFixed(2),
            confidence: candidateAnalysis.confidence.toFixed(2)
          });
        }
        if (hrAnalysis?.isActive) {
          Logger.debug('HR stream active', {
            volume: hrAnalysis.characteristics.volume.toFixed(2),
            confidence: hrAnalysis.confidence.toFixed(2)
          });
        }
        
        // Можно добавить логику переключения потоков при необходимости
      } catch (error) {
        Logger.warn('Stream monitoring error', { error });
      }
    }, 1000);
    
    return () => {
      clearInterval(monitor);
      Logger.debug('Stream monitoring stopped');
    };
  }, []);

  /**
   * Stop recording
   */
  const stopRecording = useCallback((): void => {
    Logger.info('Stopping recording');
    
    try {
      // Останавливаем аудио pipeline
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      
      // Закрываем аудио контекст
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      // Останавливаем поток
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Останавливаем анализатор
      stopAudioAnalyser();
      
      // Отключаемся от Deepgram
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      
      // Очищаем разделитель потоков
      if (streamSplitter) {
        streamSplitter.cleanup();
        setStreamSplitter(null);
      }
      setCandidateStream(null);
      
      // Обновляем UI состояние
      setIsRecording(false);
      
      Logger.info('Recording stopped successfully');
      
    } catch (error) {
      Logger.error('Error stopping recording', { error });
      setIsRecording(false);
    }
  }, [
    processorRef,
    audioContextRef,
    streamRef,
    stopAudioAnalyser,
    cleanupRef,
    streamSplitter,
    setIsRecording
  ]);

  return {
    startRecording,
    stopRecording,
    streamSplitter,
    candidateStream,
    isInitializing
  };
};
