import { EventEmitter } from 'events';

export interface AudioDeviceInfo {
  name: string;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
}

export interface AudioData {
  data: Int16Array;
  timestamp: number;
}

export class NativeAudioCapture extends EventEmitter {
  private nativeModule: any;
  private isCapturing: boolean = false;
  private captureInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    
    try {
      // Load the native module
      this.nativeModule = require('./build/Release/audio_capture');
    } catch (error) {
      console.error('Failed to load native audio capture module:', error);
      throw new Error('Native audio capture module not available');
    }
  }

  /**
   * Start capturing system audio
   */
  async startCapture(): Promise<boolean> {
    if (this.isCapturing) {
      return false;
    }

    try {
      const success = this.nativeModule.AudioCapture.prototype.startCapture.call(this.nativeModule);
      
      if (success) {
        this.isCapturing = true;
        this.startDataPolling();
        this.emit('started');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to start audio capture:', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Stop capturing system audio
   */
  async stopCapture(): Promise<boolean> {
    if (!this.isCapturing) {
      return true;
    }

    try {
      const success = this.nativeModule.AudioCapture.prototype.stopCapture.call(this.nativeModule);
      
      if (success) {
        this.isCapturing = false;
        this.stopDataPolling();
        this.emit('stopped');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to stop audio capture:', error);
      this.emit('error', error);
      return false;
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
  getDeviceInfo(): AudioDeviceInfo {
    try {
      return this.nativeModule.AudioCapture.prototype.getDeviceInfo.call(this.nativeModule);
    } catch (error) {
      console.error('Failed to get device info:', error);
      return {
        name: 'Unknown Device',
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16
      };
    }
  }

  /**
   * Start polling for audio data
   */
  private startDataPolling(): void {
    this.captureInterval = setInterval(() => {
      try {
        const audioData = this.nativeModule.AudioCapture.prototype.getAudioData.call(this.nativeModule);
        
        if (audioData && audioData.length > 0) {
          // Process each audio chunk
          for (const chunk of audioData) {
            if (chunk && chunk.length > 0) {
              const int16Array = new Int16Array(chunk);
              this.emit('data', {
                data: int16Array,
                timestamp: Date.now()
              });
            }
          }
        }
      } catch (error) {
        console.error('Error polling audio data:', error);
        this.emit('error', error);
      }
    }, 10); // Poll every 10ms for real-time performance
  }

  /**
   * Stop polling for audio data
   */
  private stopDataPolling(): void {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopCapture();
    this.removeAllListeners();
  }
}

// Factory function to create native audio capture instance
export function createNativeAudioCapture(): NativeAudioCapture {
  return new NativeAudioCapture();
}

// Export default
export default NativeAudioCapture;


