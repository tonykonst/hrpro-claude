import { Logger } from '../../utils/logger';
import { AppError } from '../../utils/errors';

export interface NativeAudioConfig {
  sampleRate: number;
  channels: number;
  bufferSize: number;
  enableLoopback: boolean;
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

export class NativeAudioService extends SimpleEventEmitter {
  private nativeCapture: any = null;
  private isInitialized: boolean = false;
  private isCapturing: boolean = false;
  private config: NativeAudioConfig;
  private audioBuffer: Int16Array[] = [];
  private maxBufferSize: number = 100;

  constructor(config: Partial<NativeAudioConfig> = {}) {
    super();
    this.config = {
      sampleRate: 16000,
      channels: 1,
      bufferSize: 4096,
      enableLoopback: true,
      ...config
    };

    this.initializeNativeModule();
  }

  /**
   * Initialize the native audio capture module
   */
  private async initializeNativeModule(): Promise<void> {
    try {
      // Check if electronAPI is available
      if (typeof window === 'undefined' || !window.electronAPI) {
        throw new Error('Electron API not available');
      }

      // Initialize native audio via IPC
      const result = await window.electronAPI.invoke('native-audio-init');
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to initialize native audio');
      }

      // Set up IPC event listeners
      window.electronAPI.on('native-audio-data', this.handleAudioData.bind(this));
      window.electronAPI.on('native-audio-error', this.handleError.bind(this));
      window.electronAPI.on('native-audio-started', this.handleStarted.bind(this));
      window.electronAPI.on('native-audio-stopped', this.handleStopped.bind(this));
      
      this.isInitialized = true;
      Logger.info('Native audio service initialized successfully');
      
    } catch (error) {
      Logger.error('Failed to initialize native audio service', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      throw new AppError(
        'Native audio capture not available',
        'NATIVE_AUDIO_INIT_ERROR',
        false,
        { 
          originalError: error instanceof Error ? error.message : String(error),
          platform: 'macos',
          instructions: 'Native audio capture requires Windows or macOS'
        }
      );
    }
  }

  /**
   * Start capturing system audio
   */
  async startCapture(): Promise<void> {
    if (!this.isInitialized) {
      throw new AppError(
        'Native audio service not initialized',
        'NATIVE_AUDIO_NOT_INITIALIZED',
        false
      );
    }

    if (this.isCapturing) {
      Logger.warn('Audio capture already running');
      return;
    }

    try {
      const result = await window.electronAPI.invoke('native-audio-start');
      
      if (!result.success) {
        throw new AppError(
          'Failed to start native audio capture',
          'NATIVE_AUDIO_START_ERROR',
          true,
          { originalError: result.error }
        );
      }

      Logger.info('Native audio capture started');

    } catch (error) {
      Logger.error('Error starting native audio capture', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        'Failed to start system audio capture',
        'NATIVE_AUDIO_START_ERROR',
        true,
        { 
          originalError: error instanceof Error ? error.message : String(error) 
        }
      );
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
      const result = await window.electronAPI.invoke('native-audio-stop');
      
      if (!result.success) {
        Logger.warn('Failed to stop native audio capture gracefully', { error: result.error });
      }

      // Clear audio buffer
      this.audioBuffer = [];
      
      Logger.info('Native audio capture stopped');

    } catch (error) {
      Logger.error('Error stopping native audio capture', { 
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
   * Get audio device information
   */
  async getDeviceInfo(): Promise<any> {
    if (!this.isInitialized) {
      return null;
    }
    
    try {
      const result = await window.electronAPI.invoke('native-audio-device-info');
      return result.success ? result.deviceInfo : null;
    } catch (error) {
      Logger.error('Failed to get device info', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): NativeAudioConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<NativeAudioConfig>): void {
    this.config = { ...this.config, ...newConfig };
    Logger.info('Native audio config updated', { config: this.config });
  }

  /**
   * Handle audio data from native module
   */
  private handleAudioData(audioData: { data: Int16Array; timestamp: number }): void {
    try {
      // Add to buffer
      this.audioBuffer.push(audioData.data);
      
      // Limit buffer size
      if (this.audioBuffer.length > this.maxBufferSize) {
        this.audioBuffer.shift();
      }

      // Emit processed audio data
      const event: AudioDataEvent = {
        data: audioData.data,
        timestamp: audioData.timestamp,
        sampleRate: this.config.sampleRate,
        channels: this.config.channels
      };

      this.emit('audioData', event);
      
    } catch (error) {
      Logger.error('Error handling audio data', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Handle capture started event
   */
  private handleStarted(): void {
    this.isCapturing = true;
    this.emit('captureStarted');
    Logger.info('Native audio capture started');
  }

  /**
   * Handle capture stopped event
   */
  private handleStopped(): void {
    this.isCapturing = false;
    this.emit('captureStopped');
    Logger.info('Native audio capture stopped');
  }

  /**
   * Handle errors from native module
   */
  private handleError(error: Error): void {
    Logger.error('Native audio capture error', { 
      error: error.message,
      stack: error.stack 
    });
    
    this.emit('error', error);
  }

  /**
   * Get buffered audio data
   */
  getBufferedAudioData(): Int16Array[] {
    return [...this.audioBuffer];
  }

  /**
   * Clear audio buffer
   */
  clearBuffer(): void {
    this.audioBuffer = [];
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.nativeCapture) {
      this.nativeCapture.destroy();
      this.nativeCapture = null;
    }
    
    this.audioBuffer = [];
    this.removeAllListeners();
    this.isInitialized = false;
    this.isCapturing = false;
    
    Logger.info('Native audio service destroyed');
  }
}

// Factory function
export function createNativeAudioService(config?: Partial<NativeAudioConfig>): NativeAudioService {
  return new NativeAudioService(config);
}

// Default instance
export const nativeAudioService = new NativeAudioService();
