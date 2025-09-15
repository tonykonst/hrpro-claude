/**
 * Safari Screen Capture Service
 * Handles screen capture with audio for Safari browser
 * Based on getDisplayMedia API with Safari-specific handling
 * 
 * ============================================================================
 * FEATURE FLAG CONTROL
 * ============================================================================
 * This service can be completely disabled by:
 * 
 * 1. Environment Variable:
 *    REACT_APP_ENABLE_SAFARI_CAPTURE=false
 * 
 * 2. Code Comment:
 *    Comment out the ENABLE_SAFARI_CAPTURE flag in featureFlags.ts
 * 
 * 3. Runtime Control:
 *    Use the useFeatureFlags hook to disable at runtime
 * ============================================================================
 */

import { detectBrowser, getDisplayMediaConstraints } from '../utils/browserDetection';
import { isFeatureEnabled } from '../config/featureFlags';

export interface CaptureState {
  isCapturing: boolean;
  stream: MediaStream | null;
  audioTrack: MediaStreamTrack | null;
  videoTrack: MediaStreamTrack | null;
  error: Error | null;
}

export interface CaptureOptions {
  includeVideo?: boolean;
  audioOnly?: boolean;
  onStreamReady?: (stream: MediaStream) => void;
  onStreamEnded?: () => void;
  onError?: (error: Error) => void;
}

export class SafariCaptureService {
  private state: CaptureState = {
    isCapturing: false,
    stream: null,
    audioTrack: null,
    videoTrack: null,
    error: null
  };

  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private options: CaptureOptions = {};

  constructor() {
    // Check if Safari capture is enabled via feature flag
    if (!isFeatureEnabled('ENABLE_SAFARI_CAPTURE')) {
      console.log('[SafariCapture] Safari capture is disabled via feature flag');
      return;
    }
    
    // Ensure we're running in Safari
    const browser = detectBrowser();
    if (browser.name !== 'safari' && !browser.name.includes('webkit')) {
      console.warn('SafariCaptureService: Not running in Safari, some features may not work as expected');
    }
  }

  /**
   * Starts screen capture with audio
   */
  async startCapture(options: CaptureOptions = {}): Promise<MediaStream> {
    // ========================================================================
    // FEATURE FLAG CHECK - Graceful degradation if disabled
    // ========================================================================
    if (!isFeatureEnabled('ENABLE_SAFARI_CAPTURE')) {
      throw new Error('Safari capture is disabled. Please enable it in settings or use microphone input.');
    }
    
    this.options = options;
    
    if (this.state.isCapturing) {
      throw new Error('Capture already in progress');
    }

    try {
      console.log('[SafariCapture] Starting screen capture...');
      
      // Get display media constraints for Safari
      const constraints = getDisplayMediaConstraints();
      
      // Request screen capture with audio
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      
      // Process the stream
      this.processStream(stream);
      
      // Set up event handlers
      this.setupStreamEventHandlers(stream);
      
      // Update state
      this.state.isCapturing = true;
      this.state.stream = stream;
      this.state.error = null;
      
      // Extract tracks
      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();
      
      if (audioTracks.length > 0) {
        this.state.audioTrack = audioTracks[0];
        console.log('[SafariCapture] Audio track obtained:', this.state.audioTrack.label);
      } else {
        console.warn('[SafariCapture] No audio track found in stream');
      }
      
      if (videoTracks.length > 0) {
        this.state.videoTrack = videoTracks[0];
        console.log('[SafariCapture] Video track obtained:', this.state.videoTrack.label);
      }
      
      // If audio only mode, remove video track
      if (options.audioOnly && this.state.videoTrack) {
        this.state.videoTrack.stop();
        stream.removeTrack(this.state.videoTrack);
        this.state.videoTrack = null;
        console.log('[SafariCapture] Removed video track (audio-only mode)');
      }
      
      // Notify callback
      if (options.onStreamReady) {
        options.onStreamReady(stream);
      }
      
      return stream;
      
    } catch (error) {
      console.error('[SafariCapture] Failed to start capture:', error);
      this.state.error = error as Error;
      
      if (options.onError) {
        options.onError(error as Error);
      }
      
      throw error;
    }
  }

  /**
   * Stops the current capture session
   */
  stopCapture(): void {
    console.log('[SafariCapture] Stopping capture...');
    
    // Stop all tracks
    if (this.state.audioTrack) {
      this.state.audioTrack.stop();
      this.state.audioTrack = null;
    }
    
    if (this.state.videoTrack) {
      this.state.videoTrack.stop();
      this.state.videoTrack = null;
    }
    
    if (this.state.stream) {
      this.state.stream.getTracks().forEach(track => track.stop());
      this.state.stream = null;
    }
    
    // Clean up audio nodes
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    
    if (this.destinationNode) {
      this.destinationNode = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    // Update state
    this.state.isCapturing = false;
    
    // Notify callback
    if (this.options.onStreamEnded) {
      this.options.onStreamEnded();
    }
  }

  /**
   * Gets the current audio stream (audio tracks only)
   */
  getAudioStream(): MediaStream | null {
    if (!this.state.audioTrack) {
      return null;
    }
    
    // Create a new stream with only audio
    const audioStream = new MediaStream([this.state.audioTrack]);
    return audioStream;
  }

  /**
   * Gets the current capture state
   */
  getState(): CaptureState {
    return { ...this.state };
  }

  /**
   * Checks if audio is available in the current stream
   */
  hasAudio(): boolean {
    return this.state.audioTrack !== null && this.state.audioTrack.readyState === 'live';
  }

  /**
   * Process stream with Web Audio API for better control
   */
  private processStream(stream: MediaStream): void {
    const audioTracks = stream.getAudioTracks();
    
    if (audioTracks.length === 0) {
      console.warn('[SafariCapture] No audio tracks to process');
      return;
    }
    
    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });
      
      // Create source from stream
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      
      // Create destination
      this.destinationNode = this.audioContext.createMediaStreamDestination();
      
      // Connect nodes
      this.sourceNode.connect(this.destinationNode);
      
      console.log('[SafariCapture] Audio processing pipeline created');
      
    } catch (error) {
      console.error('[SafariCapture] Failed to process audio:', error);
    }
  }

  /**
   * Sets up event handlers for the media stream
   */
  private setupStreamEventHandlers(stream: MediaStream): void {
    // Handle track ended events
    stream.getTracks().forEach(track => {
      track.addEventListener('ended', () => {
        console.log(`[SafariCapture] Track ended: ${track.kind} - ${track.label}`);
        
        if (track.kind === 'audio' && track === this.state.audioTrack) {
          this.state.audioTrack = null;
        }
        
        if (track.kind === 'video' && track === this.state.videoTrack) {
          this.state.videoTrack = null;
        }
        
        // If all tracks ended, stop capture
        if (!this.state.audioTrack && !this.state.videoTrack) {
          this.stopCapture();
        }
      });
      
      // Handle track mute events
      track.addEventListener('mute', () => {
        console.warn(`[SafariCapture] Track muted: ${track.kind} - ${track.label}`);
      });
      
      track.addEventListener('unmute', () => {
        console.log(`[SafariCapture] Track unmuted: ${track.kind} - ${track.label}`);
      });
    });
    
    // Handle stream events
    stream.addEventListener('addtrack', (event) => {
      console.log('[SafariCapture] Track added to stream:', event.track.kind);
    });
    
    stream.addEventListener('removetrack', (event) => {
      console.log('[SafariCapture] Track removed from stream:', event.track.kind);
    });
  }

  /**
   * Gets audio level from the current stream
   */
  getAudioLevel(): number {
    if (!this.audioContext || !this.sourceNode) {
      return 0;
    }
    
    try {
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      
      this.sourceNode.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      
      return average / 255; // Normalize to 0-1
      
    } catch (error) {
      console.error('[SafariCapture] Failed to get audio level:', error);
      return 0;
    }
  }

  /**
   * Checks if Safari screen capture is supported
   */
  static isSupported(): boolean {
    const browser = detectBrowser();
    
    // Check if we're in Safari
    if (browser.name !== 'safari') {
      return false;
    }
    
    // Check if getDisplayMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      return false;
    }
    
    // Check Safari version (requires 13+)
    const version = parseFloat(browser.version);
    if (version < 13) {
      return false;
    }
    
    return true;
  }

  /**
   * Gets Safari-specific limitations and requirements
   */
  static getLimitations(): string[] {
    return [
      'Requires Safari 13 or later',
      'User must explicitly select "Share Audio" in the dialog',
      'Cannot capture system audio, only tab/window audio',
      'Screen capture requires user gesture',
      'Audio may not be available for all content types',
      'Does not support capturing audio from other applications'
    ];
  }
}

// Export singleton instance
export const safariCaptureService = new SafariCaptureService();