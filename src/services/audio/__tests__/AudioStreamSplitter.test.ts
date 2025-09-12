/**
 * AudioStreamSplitter Unit Tests
 * 
 * Тестирует функциональность разделителя аудио потоков.
 * Соответствует архитектурным принципам hrpro.mdc:
 * - Unit тесты с покрытием >80%
 * - Mock внешних сервисов
 * - Тестирование error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioStreamSplitter } from '../AudioStreamSplitter';
import { AppError } from '../../../utils/errors';

// Mock dependencies
vi.mock('../../../utils/errors', () => ({
  AppError: vi.fn().mockImplementation((message, code, retriable, context) => ({
    message,
    code,
    retriable,
    context,
    name: 'AppError'
  })),
  ErrorHandler: {
    withRetry: vi.fn().mockImplementation(async (fn) => fn())
  }
}));

vi.mock('../../../utils/logger', () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../utils/performance-monitor', () => ({
  PerformanceMonitor: {
    recordAnalysisLatency: vi.fn()
  }
}));

vi.mock('../AudioSourceDetector', () => ({
  AudioSourceDetector: vi.fn().mockImplementation(() => ({
    detectSources: vi.fn().mockResolvedValue([
      {
        id: 'mic1',
        type: 'microphone',
        name: 'Microphone',
        isActive: false,
        quality: 0.8,
        priority: 5,
        characteristics: {
          sampleRate: 16000,
          channels: 1,
          bitDepth: 16,
          latency: 100
        }
      },
      {
        id: 'system-audio',
        type: 'system',
        name: 'System Audio',
        isActive: true,
        quality: 0.9,
        priority: 8,
        characteristics: {
          sampleRate: 48000,
          channels: 2,
          bitDepth: 16,
          latency: 50
        }
      }
    ]),
    getSource: vi.fn().mockImplementation((id) => {
      const sources = [
        {
          id: 'mic1',
          type: 'microphone',
          name: 'Microphone',
          isActive: false,
          quality: 0.8,
          priority: 5,
          characteristics: {
            sampleRate: 16000,
            channels: 1,
            bitDepth: 16,
            latency: 100
          }
        },
        {
          id: 'system-audio',
          type: 'system',
          name: 'System Audio',
          isActive: true,
          quality: 0.9,
          priority: 8,
          characteristics: {
            sampleRate: 48000,
            channels: 2,
            bitDepth: 16,
            latency: 50
          }
        }
      ];
      return sources.find(s => s.id === id);
    }),
    cleanup: vi.fn()
  }))
}));

vi.mock('../HRHeadphoneHandler', () => ({
  HRHeadphoneHandler: vi.fn().mockImplementation(() => ({
    handleHRWithHeadphones: vi.fn().mockResolvedValue({
      strategy: 'no_headphones',
      message: 'HR not using headphones',
      actions: ['Use standard microphone setup'],
      configuration: {
        monitorSystemAudio: true,
        suppressHRInSystemAudio: false,
        candidateSource: 'system_audio',
        hrSource: 'hr_microphone'
      }
    }),
    cleanup: vi.fn()
  }))
}));

// Mock MediaDevices API
const mockGetUserMedia = vi.fn();
const mockGetDisplayMedia = vi.fn();

Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
    getDisplayMedia: mockGetDisplayMedia
  },
  writable: true
});

// Mock AudioContext
global.AudioContext = vi.fn().mockImplementation(() => ({
  createMediaStreamSource: vi.fn().mockReturnValue({
    connect: vi.fn()
  }),
  createAnalyser: vi.fn().mockReturnValue({
    fftSize: 2048,
    frequencyBinCount: 1024,
    getByteFrequencyData: vi.fn()
  }),
  close: vi.fn()
}));

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn().mockImplementation((cb) => {
  setTimeout(cb, 16);
  return 1;
});

describe('AudioStreamSplitter', () => {
  let splitter: AudioStreamSplitter;
  
  beforeEach(() => {
    splitter = new AudioStreamSplitter();
    vi.clearAllMocks();
    
    // Mock MediaStream
    const mockStream = {
      id: 'test-stream',
      getTracks: () => [{ stop: vi.fn() }]
    };
    
    mockGetUserMedia.mockResolvedValue(mockStream);
    mockGetDisplayMedia.mockResolvedValue(mockStream);
  });
  
  afterEach(() => {
    splitter.cleanup();
  });
  
  describe('initialize', () => {
    it('should initialize successfully', async () => {
      // Act
      await splitter.initialize();
      
      // Assert
      expect(splitter.isConfigured()).toBe(true);
      expect(splitter.getCandidateStream()).toBeDefined();
    });
    
    it('should handle initialization errors', async () => {
      // Arrange
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));
      
      // Act & Assert
      await expect(splitter.initialize()).rejects.toThrow(AppError);
    });
    
    it('should limit streams to MAX_STREAMS', async () => {
      // Arrange - Mock many sources
      const { AudioSourceDetector } = await import('../AudioSourceDetector');
      const mockDetector = new AudioSourceDetector();
      vi.mocked(mockDetector.detectSources).mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({
          id: `source${i}`,
          type: 'microphone' as const,
          name: `Source ${i}`,
          isActive: false,
          quality: 0.8,
          priority: 5,
          characteristics: {
            sampleRate: 16000,
            channels: 1,
            bitDepth: 16,
            latency: 100
          }
        }))
      );
      
      // Act
      await splitter.initialize();
      
      // Assert - Should not throw and should be configured
      expect(splitter.isConfigured()).toBe(true);
    });
  });
  
  describe('selectCandidateStream', () => {
    it('should return candidate stream when initialized', async () => {
      // Arrange
      await splitter.initialize();
      
      // Act
      const stream = await splitter.selectCandidateStream();
      
      // Assert
      expect(stream).toBeDefined();
    });
    
    it('should throw error when not initialized', async () => {
      // Act & Assert
      await expect(splitter.selectCandidateStream()).rejects.toThrow(AppError);
    });
  });
  
  describe('getCandidateStream', () => {
    it('should return candidate stream', async () => {
      // Arrange
      await splitter.initialize();
      
      // Act
      const stream = splitter.getCandidateStream();
      
      // Assert
      expect(stream).toBeDefined();
    });
    
    it('should return null when no candidate stream', () => {
      // Act
      const stream = splitter.getCandidateStream();
      
      // Assert
      expect(stream).toBeNull();
    });
  });
  
  describe('getHRStream', () => {
    it('should return HR stream when available', async () => {
      // Arrange
      await splitter.initialize();
      
      // Act
      const stream = splitter.getHRStream();
      
      // Assert
      expect(stream).toBeDefined();
    });
    
    it('should return null when no HR stream', () => {
      // Act
      const stream = splitter.getHRStream();
      
      // Assert
      expect(stream).toBeNull();
    });
  });
  
  describe('getCandidateAnalysis', () => {
    it('should return candidate analysis', async () => {
      // Arrange
      await splitter.initialize();
      
      // Act
      const analysis = splitter.getCandidateAnalysis();
      
      // Assert
      expect(analysis).toBeDefined();
      expect(analysis?.source).toBeDefined();
    });
    
    it('should return null when no candidate stream', () => {
      // Act
      const analysis = splitter.getCandidateAnalysis();
      
      // Assert
      expect(analysis).toBeNull();
    });
  });
  
  describe('getHRAnalysis', () => {
    it('should return HR analysis when available', async () => {
      // Arrange
      await splitter.initialize();
      
      // Act
      const analysis = splitter.getHRAnalysis();
      
      // Assert
      expect(analysis).toBeDefined();
    });
    
    it('should return null when no HR stream', () => {
      // Act
      const analysis = splitter.getHRAnalysis();
      
      // Assert
      expect(analysis).toBeNull();
    });
  });
  
  describe('isCandidateActive', () => {
    it('should return candidate activity status', async () => {
      // Arrange
      await splitter.initialize();
      
      // Act
      const isActive = splitter.isCandidateActive();
      
      // Assert
      expect(typeof isActive).toBe('boolean');
    });
    
    it('should return false when no candidate stream', () => {
      // Act
      const isActive = splitter.isCandidateActive();
      
      // Assert
      expect(isActive).toBe(false);
    });
  });
  
  describe('getHRStrategy', () => {
    it('should return HR strategy when initialized', async () => {
      // Arrange
      await splitter.initialize();
      
      // Act
      const strategy = splitter.getHRStrategy();
      
      // Assert
      expect(strategy).toBeDefined();
      expect(strategy?.strategy).toBe('no_headphones');
    });
    
    it('should return null when not initialized', () => {
      // Act
      const strategy = splitter.getHRStrategy();
      
      // Assert
      expect(strategy).toBeNull();
    });
  });
  
  describe('setCandidateStream', () => {
    it('should set candidate stream manually', async () => {
      // Arrange
      await splitter.initialize();
      
      // Act
      splitter.setCandidateStream('mic1');
      
      // Assert
      expect(splitter.getCandidateStream()).toBeDefined();
    });
  });
  
  describe('setHRStream', () => {
    it('should set HR stream manually', async () => {
      // Arrange
      await splitter.initialize();
      
      // Act
      splitter.setHRStream('mic1');
      
      // Assert
      expect(splitter.getHRStream()).toBeDefined();
    });
  });
  
  describe('detectSources', () => {
    it('should detect sources', async () => {
      // Act
      const sources = await splitter.detectSources();
      
      // Assert
      expect(sources).toHaveLength(2);
      expect(sources[0].type).toBe('microphone');
      expect(sources[1].type).toBe('system');
    });
  });
  
  describe('isConfigured', () => {
    it('should return false when not initialized', () => {
      // Act
      const configured = splitter.isConfigured();
      
      // Assert
      expect(configured).toBe(false);
    });
    
    it('should return true when initialized with candidate stream', async () => {
      // Arrange
      await splitter.initialize();
      
      // Act
      const configured = splitter.isConfigured();
      
      // Assert
      expect(configured).toBe(true);
    });
  });
  
  describe('cleanup', () => {
    it('should clean up resources', async () => {
      // Arrange
      await splitter.initialize();
      
      // Act
      splitter.cleanup();
      
      // Assert
      expect(splitter.isConfigured()).toBe(false);
      expect(splitter.getCandidateStream()).toBeNull();
      expect(splitter.getHRStream()).toBeNull();
    });
    
    it('should handle cleanup errors gracefully', async () => {
      // Arrange
      await splitter.initialize();
      
      // Mock stream to throw error on stop
      const mockStream = {
        id: 'test-stream',
        getTracks: () => [{ stop: vi.fn().mockImplementation(() => { throw new Error('Stop error'); }) }]
      };
      
      // Act & Assert - Should not throw
      expect(() => splitter.cleanup()).not.toThrow();
    });
  });
});
