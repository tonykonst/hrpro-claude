/**
 * Media Devices API Mocks for Testing
 */

import { vi } from 'vitest';

// Mock MediaStream
export const createMockMediaStream = () => ({
  id: 'mock-stream-id',
  active: true,
  getTracks: vi.fn(() => [createMockMediaTrack()]),
  getAudioTracks: vi.fn(() => [createMockMediaTrack('audio')]),
  getVideoTracks: vi.fn(() => [createMockMediaTrack('video')]),
  addTrack: vi.fn(),
  removeTrack: vi.fn(),
  clone: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

// Mock MediaTrack
export const createMockMediaTrack = (kind: 'audio' | 'video' = 'audio') => ({
  id: `mock-${kind}-track`,
  kind,
  label: `Mock ${kind} track`,
  enabled: true,
  muted: false,
  readyState: 'live' as MediaStreamTrackState,
  stop: vi.fn(),
  clone: vi.fn(),
  getConstraints: vi.fn(() => ({})),
  getSettings: vi.fn(() => ({})),
  getCapabilities: vi.fn(() => ({})),
  applyConstraints: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  onended: null,
  onmute: null,
  onunmute: null,
});

// Mock MediaDevices
export const createMockMediaDevices = () => ({
  getUserMedia: vi.fn(),
  getDisplayMedia: vi.fn(),
  enumerateDevices: vi.fn(() => Promise.resolve([])),
  getSupportedConstraints: vi.fn(() => ({
    width: true,
    height: true,
    aspectRatio: true,
    frameRate: true,
    facingMode: true,
    volume: true,
    sampleRate: true,
    sampleSize: true,
    echoCancellation: true,
    autoGainControl: true,
    noiseSuppression: true,
    latency: true,
    channelCount: true,
    deviceId: true,
    groupId: true,
  })),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  ondevicechange: null,
});

// Mock MediaRecorder
export const createMockMediaRecorder = () => {
  const mockRecorder = vi.fn().mockImplementation((stream: MediaStream, options?: MediaRecorderOptions) => {
    const recorder = {
      stream,
      mimeType: options?.mimeType || 'audio/webm;codecs=opus',
      state: 'inactive' as RecordingState,
      start: vi.fn((timeslice?: number) => {
        recorder.state = 'recording';
        setTimeout(() => recorder.onstart?.({} as Event), 0);
      }),
      stop: vi.fn(() => {
        recorder.state = 'inactive';
        setTimeout(() => recorder.onstop?.({} as Event), 0);
      }),
      pause: vi.fn(() => {
        recorder.state = 'paused';
        setTimeout(() => recorder.onpause?.({} as Event), 0);
      }),
      resume: vi.fn(() => {
        recorder.state = 'recording';
        setTimeout(() => recorder.onresume?.({} as Event), 0);
      }),
      requestData: vi.fn(() => {
        setTimeout(() => recorder.ondataavailable?.({
          data: new Blob(['mock-audio-data'], { type: recorder.mimeType })
        } as BlobEvent), 0);
      }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onstart: null as ((event: Event) => void) | null,
      onstop: null as ((event: Event) => void) | null,
      onpause: null as ((event: Event) => void) | null,
      onresume: null as ((event: Event) => void) | null,
      ondataavailable: null as ((event: BlobEvent) => void) | null,
      onerror: null as ((event: MediaRecorderErrorEvent) => void) | null,
    };
    return recorder;
  });

  mockRecorder.isTypeSupported = vi.fn((mimeType: string) => {
    // Simulate realistic browser support
    const supportedTypes = [
      'audio/webm',
      'audio/webm;codecs=opus',
      'audio/webm;codecs=vorbis',
      'audio/mp4',
      'audio/mp4;codecs=mp4a.40.2',
      'audio/ogg;codecs=opus',
      'audio/wav',
    ];
    return supportedTypes.some(type => mimeType.includes(type.split(';')[0]));
  });

  return mockRecorder;
};

// Mock AudioContext
export const createMockAudioContext = () => {
  const context = {
    sampleRate: 48000,
    currentTime: 0,
    destination: {} as AudioDestinationNode,
    listener: {} as AudioListener,
    state: 'running' as AudioContextState,
    createMediaStreamSource: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createAnalyser: vi.fn(() => ({
      fftSize: 256,
      frequencyBinCount: 128,
      getByteFrequencyData: vi.fn((array: Uint8Array) => {
        // Fill with mock frequency data
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.random() * 255;
        }
      }),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    decodeAudioData: vi.fn(() => Promise.resolve({
      length: 48000,
      numberOfChannels: 2,
      sampleRate: 48000,
      getChannelData: vi.fn(() => new Float32Array(48000)),
    })),
    close: vi.fn(),
    suspend: vi.fn(),
    resume: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onstatechange: null,
  };
  return context;
};

// Setup function for tests
export const setupMediaDevicesMocks = () => {
  const mockMediaDevices = createMockMediaDevices();
  const mockMediaRecorder = createMockMediaRecorder();
  const mockAudioContext = createMockAudioContext();

  // Mock successful media streams by default
  mockMediaDevices.getUserMedia.mockResolvedValue(createMockMediaStream());
  mockMediaDevices.getDisplayMedia.mockResolvedValue(createMockMediaStream());

  // Set up global objects
  Object.defineProperty(global, 'MediaRecorder', {
    value: mockMediaRecorder,
    writable: true,
  });

  Object.defineProperty(global, 'AudioContext', {
    value: vi.fn().mockImplementation(() => mockAudioContext),
    writable: true,
  });

  Object.defineProperty(global, 'navigator', {
    value: {
      ...global.navigator,
      mediaDevices: mockMediaDevices,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      vendor: 'Google Inc.',
      platform: 'MacIntel',
      maxTouchPoints: 0,
    },
    writable: true,
  });

  return {
    mockMediaDevices,
    mockMediaRecorder,
    mockAudioContext,
  };
};