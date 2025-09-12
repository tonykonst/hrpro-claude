import { Logger } from '../../utils/logger';
import { AppError } from '../../utils/errors';

export interface ElectronAudioConfig {
  sampleRate: number;
  channels: number;
  bufferSize: number;
}

export interface AudioDataEvent {
  data: Int16Array;
  timestamp: number;
  sampleRate: number;
  channels: number;
}

// Simple event emitter for renderer process
class SimpleEventEmitter {
  private listeners: { [event: string]: Function[] } = {};

  on(event: string, listener: Function): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  off(event: string, listener: Function): void {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(listener);
      if (index > -1) {
        this.listeners[event].splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    if (this.listeners[event]) {
      this.listeners[event].forEach(listener => listener(...args));
    }
  }

  removeAllListeners(): void {
    this.listeners = {};
  }
}

/**
 * Electron Audio Service using OFFICIAL desktopCapturer API
 * Based on Electron official documentation
 */
export class ElectronAudioService extends SimpleEventEmitter {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private isCapturing: boolean = false;
  private config: ElectronAudioConfig;

  constructor(config: Partial<ElectronAudioConfig> = {}) {
    super();
    this.config = {
      sampleRate: 16000,
      channels: 1,
      bufferSize: 4096,
      ...config
    };
  }

  /**
   * Start capturing system audio using Electron desktopCapturer
   * Based on official Electron documentation
   */
  async startCapture(): Promise<void> {
    if (this.isCapturing) {
      Logger.warn('Audio capture already running');
      return;
    }

    try {
      Logger.info('Starting Electron audio capture with desktopCapturer');

      // STEP 1: Get available sources using Electron desktopCapturer
      if (!window.electronAPI) {
        throw new AppError(
          'Electron API not available',
          'ELECTRON_API_NOT_AVAILABLE',
          false
        );
      }

      // STEP 2: Request sources from main process
      const sources = await window.electronAPI.invoke('desktop-capturer-get-sources', {
        types: ['screen', 'window'],
        thumbnailSize: { width: 150, height: 150 }
      });

      if (!sources || sources.length === 0) {
        throw new AppError(
          'No capture sources available',
          'NO_CAPTURE_SOURCES',
          false
        );
      }

      // STEP 3: Use first available source (screen or window)
      const primarySource = sources[0];
      
      Logger.info('Using capture source', { 
        sourceId: primarySource.id,
        sourceName: primarySource.name 
      });

      // STEP 4: Get media stream using getDisplayMedia with audio
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: primarySource.id
          }
        } as any,
        audio: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: primarySource.id
          }
        } as any
      });

      this.mediaStream = mediaStream;

      // STEP 5: Set up audio processing
      await this.setupAudioProcessing(mediaStream);

      this.isCapturing = true;
      this.emit('captureStarted');
      
      Logger.info('Electron audio capture started successfully');

    } catch (error) {
      Logger.error('Failed to start Electron audio capture', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      throw new AppError(
        'Failed to start system audio capture',
        'ELECTRON_AUDIO_START_ERROR',
        true,
        { 
          originalError: error instanceof Error ? error.message : String(error) 
        }
      );
    }
  }

  /**
   * Set up audio processing pipeline
   */
  private async setupAudioProcessing(mediaStream: MediaStream): Promise<void> {
    try {
      // Create audio context
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate
      });

      // Get audio tracks
      const audioTracks = mediaStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks available in media stream');
      }

      Logger.info('Audio tracks found', { count: audioTracks.length });

      // Create source from media stream
      this.source = this.audioContext.createMediaStreamSource(mediaStream);

      // Create script processor for audio data
      this.processor = this.audioContext.createScriptProcessor(
        this.config.bufferSize,
        this.config.channels,
        this.config.channels
      );

      // Set up audio processing
      this.processor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer;
        const outputBuffer = event.outputBuffer;

        // Copy input to output (passthrough)
        for (let channel = 0; channel < inputBuffer.numberOfChannels; channel++) {
          const inputData = inputBuffer.getChannelData(channel);
          const outputData = outputBuffer.getChannelData(channel);
          outputData.set(inputData);
        }

        // Convert to Int16Array for Deepgram
        const channelData = inputBuffer.getChannelData(0);
        const int16Array = new Int16Array(channelData.length);
        
        for (let i = 0; i < channelData.length; i++) {
          int16Array[i] = Math.max(-32768, Math.min(32767, channelData[i] * 32768));
        }

        // Emit audio data
        const audioEvent: AudioDataEvent = {
          data: int16Array,
          timestamp: Date.now(),
          sampleRate: this.config.sampleRate,
          channels: this.config.channels
        };

        this.emit('audioData', audioEvent);
      };

      // Connect audio nodes
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      Logger.info('Audio processing pipeline set up successfully');

    } catch (error) {
      Logger.error('Failed to set up audio processing', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Stop capturing system audio
   */
  async stopCapture(): Promise<void> {
    if (!this.isCapturing) {
      return;
    }

    try {
      // Stop audio processing
      if (this.processor) {
        this.processor.disconnect();
        this.processor = null;
      }

      if (this.source) {
        this.source.disconnect();
        this.source = null;
      }

      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
      }

      // Stop media stream
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }

      this.isCapturing = false;
      this.emit('captureStopped');
      
      Logger.info('Electron audio capture stopped');

    } catch (error) {
      Logger.error('Error stopping Electron audio capture', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Check if currently capturing
   */
  isCurrentlyCapturing(): boolean {
    return this.isCapturing;
  }

  /**
   * Get current configuration
   */
  getConfig(): ElectronAudioConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ElectronAudioConfig>): void {
    this.config = { ...this.config, ...newConfig };
    Logger.info('Electron audio config updated', { config: this.config });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopCapture();
    this.removeAllListeners();
    Logger.info('Electron audio service destroyed');
  }
}

// Factory function
export function createElectronAudioService(config?: Partial<ElectronAudioConfig>): ElectronAudioService {
  return new ElectronAudioService(config);
}

// Default instance
export const electronAudioService = new ElectronAudioService();


