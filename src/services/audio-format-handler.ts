/**
 * Audio Format Handler
 * Provides cross-browser audio format compatibility (WebM, MP4, WAV)
 * Handles conversion and recording for different browsers
 */

import { detectBrowser } from '../utils/browserDetection';

export type AudioFormat = 'webm' | 'mp4' | 'wav' | 'ogg';
export type AudioCodec = 'opus' | 'aac' | 'pcm' | 'vorbis';

export interface FormatCapabilities {
  format: AudioFormat;
  codec: AudioCodec;
  mimeType: string;
  supported: boolean;
  quality: 'high' | 'medium' | 'low';
}

export interface RecordingOptions {
  format?: AudioFormat;
  codec?: AudioCodec;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
}

export interface AudioBlob {
  blob: Blob;
  format: AudioFormat;
  codec: AudioCodec;
  mimeType: string;
  duration?: number;
}

export class AudioFormatHandler {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startTime: number = 0;
  private browser = detectBrowser();

  /**
   * Gets supported audio formats for the current browser
   */
  getSupportedFormats(): FormatCapabilities[] {
    const formats: FormatCapabilities[] = [];
    
    // Test WebM with Opus (Chrome, Firefox, Edge)
    if (this.isFormatSupported('audio/webm;codecs=opus')) {
      formats.push({
        format: 'webm',
        codec: 'opus',
        mimeType: 'audio/webm;codecs=opus',
        supported: true,
        quality: 'high'
      });
    }
    
    // Test WebM with Vorbis (older browsers)
    if (this.isFormatSupported('audio/webm;codecs=vorbis')) {
      formats.push({
        format: 'webm',
        codec: 'vorbis',
        mimeType: 'audio/webm;codecs=vorbis',
        supported: true,
        quality: 'medium'
      });
    }
    
    // Test MP4 with AAC (Safari, iOS)
    if (this.isFormatSupported('audio/mp4;codecs=mp4a.40.2')) {
      formats.push({
        format: 'mp4',
        codec: 'aac',
        mimeType: 'audio/mp4;codecs=mp4a.40.2',
        supported: true,
        quality: 'high'
      });
    }
    
    // Test Ogg with Opus (Firefox)
    if (this.isFormatSupported('audio/ogg;codecs=opus')) {
      formats.push({
        format: 'ogg',
        codec: 'opus',
        mimeType: 'audio/ogg;codecs=opus',
        supported: true,
        quality: 'high'
      });
    }
    
    // Test WAV (fallback for all browsers)
    if (this.isFormatSupported('audio/wav')) {
      formats.push({
        format: 'wav',
        codec: 'pcm',
        mimeType: 'audio/wav',
        supported: true,
        quality: 'low' // Large file size
      });
    }
    
    return formats;
  }

  /**
   * Gets the best format for the current browser
   */
  getBestFormat(): FormatCapabilities | null {
    const formats = this.getSupportedFormats();
    
    if (formats.length === 0) {
      return null;
    }
    
    // Prefer high quality formats
    const highQuality = formats.filter(f => f.quality === 'high');
    if (highQuality.length > 0) {
      // Safari prefers MP4
      if (this.browser.name === 'safari') {
        const mp4 = highQuality.find(f => f.format === 'mp4');
        if (mp4) return mp4;
      }
      
      // Chrome/Firefox prefer WebM
      const webm = highQuality.find(f => f.format === 'webm');
      if (webm) return webm;
      
      return highQuality[0];
    }
    
    // Fall back to any available format
    return formats[0];
  }

  /**
   * Starts recording audio from a MediaStream
   */
  startRecording(stream: MediaStream, options: RecordingOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        reject(new Error('Recording already in progress'));
        return;
      }
      
      // Get the best format if not specified
      let mimeType: string;
      
      if (options.format && options.codec) {
        mimeType = this.getMimeType(options.format, options.codec);
      } else {
        const bestFormat = this.getBestFormat();
        if (!bestFormat) {
          reject(new Error('No supported audio format found'));
          return;
        }
        mimeType = bestFormat.mimeType;
      }
      
      // Create MediaRecorder with options
      const recorderOptions: MediaRecorderOptions = {
        mimeType,
        audioBitsPerSecond: options.bitrate || 128000
      };
      
      try {
        this.mediaRecorder = new MediaRecorder(stream, recorderOptions);
        this.chunks = [];
        this.startTime = Date.now();
        
        // Handle data available
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.chunks.push(event.data);
          }
        };
        
        // Handle recording start
        this.mediaRecorder.onstart = () => {
          console.log(`[AudioFormatHandler] Recording started with format: ${mimeType}`);
          resolve();
        };
        
        // Handle errors
        this.mediaRecorder.onerror = (event) => {
          console.error('[AudioFormatHandler] Recording error:', event);
          reject(new Error('Recording failed'));
        };
        
        // Start recording
        this.mediaRecorder.start(1000); // Collect data every second
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stops recording and returns the audio blob
   */
  stopRecording(): Promise<AudioBlob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        reject(new Error('No recording in progress'));
        return;
      }
      
      const mimeType = this.mediaRecorder.mimeType;
      const duration = Date.now() - this.startTime;
      
      this.mediaRecorder.onstop = () => {
        // Create blob from chunks
        const blob = new Blob(this.chunks, { type: mimeType });
        
        // Parse format and codec from mime type
        const { format, codec } = this.parseMimeType(mimeType);
        
        resolve({
          blob,
          format,
          codec,
          mimeType,
          duration
        });
        
        // Clean up
        this.mediaRecorder = null;
        this.chunks = [];
      };
      
      this.mediaRecorder.stop();
    });
  }

  /**
   * Converts audio blob to WAV format (cross-browser compatible)
   */
  async convertToWav(audioBlob: Blob): Promise<Blob> {
    // Create audio context
    const audioContext = new AudioContext();
    
    // Decode audio data
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Convert to WAV
    const wavBlob = this.audioBufferToWav(audioBuffer);
    
    audioContext.close();
    
    return wavBlob;
  }

  /**
   * Checks if a format is supported
   */
  private isFormatSupported(mimeType: string): boolean {
    if (!MediaRecorder || !MediaRecorder.isTypeSupported) {
      return false;
    }
    return MediaRecorder.isTypeSupported(mimeType);
  }

  /**
   * Gets MIME type string from format and codec
   */
  private getMimeType(format: AudioFormat, codec: AudioCodec): string {
    const mimeMap: Record<string, string> = {
      'webm-opus': 'audio/webm;codecs=opus',
      'webm-vorbis': 'audio/webm;codecs=vorbis',
      'mp4-aac': 'audio/mp4;codecs=mp4a.40.2',
      'ogg-opus': 'audio/ogg;codecs=opus',
      'wav-pcm': 'audio/wav'
    };
    
    return mimeMap[`${format}-${codec}`] || 'audio/webm';
  }

  /**
   * Parses format and codec from MIME type
   */
  private parseMimeType(mimeType: string): { format: AudioFormat; codec: AudioCodec } {
    if (mimeType.includes('webm')) {
      if (mimeType.includes('opus')) return { format: 'webm', codec: 'opus' };
      if (mimeType.includes('vorbis')) return { format: 'webm', codec: 'vorbis' };
      return { format: 'webm', codec: 'opus' };
    }
    
    if (mimeType.includes('mp4')) {
      return { format: 'mp4', codec: 'aac' };
    }
    
    if (mimeType.includes('ogg')) {
      return { format: 'ogg', codec: 'opus' };
    }
    
    if (mimeType.includes('wav')) {
      return { format: 'wav', codec: 'pcm' };
    }
    
    // Default
    return { format: 'webm', codec: 'opus' };
  }

  /**
   * Converts AudioBuffer to WAV format
   */
  private audioBufferToWav(audioBuffer: AudioBuffer): Blob {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numberOfChannels * bytesPerSample;
    
    const data = this.interleaveChannels(audioBuffer);
    const dataLength = data.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);
    
    // Convert float samples to PCM
    let offset = 44;
    for (let i = 0; i < data.length; i++) {
      const sample = Math.max(-1, Math.min(1, data[i]));
      const value = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, value, true);
      offset += 2;
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  }

  /**
   * Interleaves audio channels
   */
  private interleaveChannels(audioBuffer: AudioBuffer): Float32Array {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const result = new Float32Array(length * numberOfChannels);
    
    const channels: Float32Array[] = [];
    for (let i = 0; i < numberOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i));
    }
    
    let offset = 0;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        result[offset++] = channels[channel][i];
      }
    }
    
    return result;
  }

  /**
   * Gets recommended settings for the current browser
   */
  getRecommendedSettings(): RecordingOptions {
    const browser = detectBrowser();
    
    if (browser.name === 'safari') {
      return {
        format: 'mp4',
        codec: 'aac',
        bitrate: 128000,
        sampleRate: 48000,
        channels: 2
      };
    }
    
    if (browser.name === 'firefox') {
      return {
        format: 'ogg',
        codec: 'opus',
        bitrate: 128000,
        sampleRate: 48000,
        channels: 2
      };
    }
    
    // Chrome, Edge, Opera
    return {
      format: 'webm',
      codec: 'opus',
      bitrate: 128000,
      sampleRate: 48000,
      channels: 2
    };
  }
}

// Export singleton instance
export const audioFormatHandler = new AudioFormatHandler();