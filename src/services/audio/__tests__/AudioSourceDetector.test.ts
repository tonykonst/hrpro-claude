/**
 * AudioSourceDetector Unit Tests
 * 
 * Тестирует функциональность детектора аудио источников.
 * Соответствует архитектурным принципам hrpro.mdc:
 * - Unit тесты с покрытием >80%
 * - Mock внешних сервисов
 * - Тестирование error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioSourceDetector } from '../AudioSourceDetector';
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

// Mock MediaDevices API
const mockEnumerateDevices = vi.fn();
const mockGetUserMedia = vi.fn();
const mockGetDisplayMedia = vi.fn();

Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    enumerateDevices: mockEnumerateDevices,
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
    getByteFrequencyData: vi.fn(),
    connect: vi.fn()
  }),
  close: vi.fn()
}));

describe('AudioSourceDetector', () => {
  let detector: AudioSourceDetector;
  
  beforeEach(() => {
    detector = new AudioSourceDetector();
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    detector.cleanup();
  });
  
  describe('detectSources', () => {
    it('should detect audio sources successfully', async () => {
      // Arrange
      const mockDevices = [
        { deviceId: 'mic1', kind: 'audioinput', label: 'Microphone' },
        { deviceId: 'mic2', kind: 'audioinput', label: 'USB Headset' }
      ];
      
      mockEnumerateDevices.mockResolvedValue(mockDevices);
      mockGetUserMedia.mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }]
      });
      
      // Act
      const sources = await detector.detectSources();
      
      // Assert
      expect(sources).toHaveLength(2);
      expect(sources[0].type).toBe('microphone');
      expect(sources[0].name).toBe('Microphone');
      expect(sources[1].name).toBe('USB Headset');
      expect(mockEnumerateDevices).toHaveBeenCalledTimes(1);
    });
    
    it('should handle errors gracefully', async () => {
      // Arrange
      mockEnumerateDevices.mockRejectedValue(new Error('Permission denied'));
      
      // Act & Assert
      await expect(detector.detectSources()).rejects.toThrow(AppError);
    });
    
    it('should limit sources to MAX_SOURCES', async () => {
      // Arrange
      const manyDevices = Array.from({ length: 15 }, (_, i) => ({
        deviceId: `mic${i}`,
        kind: 'audioinput',
        label: `Microphone ${i}`
      }));
      
      mockEnumerateDevices.mockResolvedValue(manyDevices);
      mockGetUserMedia.mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }]
      });
      
      // Act
      const sources = await detector.detectSources();
      
      // Assert
      expect(sources).toHaveLength(10); // MAX_SOURCES
    });
    
    it('should detect system audio when available', async () => {
      // Arrange
      const mockDevices = [
        { deviceId: 'mic1', kind: 'audioinput', label: 'Microphone' }
      ];
      
      mockEnumerateDevices.mockResolvedValue(mockDevices);
      mockGetUserMedia.mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }]
      });
      mockGetDisplayMedia.mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }]
      });
      
      // Act
      const sources = await detector.detectSources();
      
      // Assert
      expect(sources).toHaveLength(2); // 1 microphone + 1 system audio
      expect(sources.some(s => s.type === 'system')).toBe(true);
    });
  });
  
  describe('analyzeQuality', () => {
    it('should analyze audio quality successfully', async () => {
      // Arrange
      const mockStream = {
        getTracks: () => [{ stop: vi.fn() }]
      };
      
      // Act
      const quality = await detector.analyzeQuality(mockStream as unknown as MediaStream);
      
      // Assert
      expect(quality).toBeGreaterThanOrEqual(0);
      expect(quality).toBeLessThanOrEqual(1);
    });
    
    it('should return fallback quality on error', async () => {
      // Arrange
      const mockStream = {
        getTracks: () => [{ stop: vi.fn() }]
      };
      
      // Mock AudioContext to throw error
      global.AudioContext = vi.fn().mockImplementation(() => {
        throw new Error('AudioContext error');
      });
      
      // Act
      const quality = await detector.analyzeQuality(mockStream as unknown as MediaStream);
      
      // Assert
      expect(quality).toBe(0.5); // Fallback value
    });
  });
  
  describe('calculatePriority', () => {
    it('should calculate priority based on quality', () => {
      // Arrange
      const device = { label: 'Test Microphone' } as MediaDeviceInfo;
      const quality = 0.8;
      
      // Act
      const priority = detector.calculatePriority(device, quality);
      
      // Assert
      expect(priority).toBe(4); // quality * 5 = 0.8 * 5 = 4
    });
    
    it('should boost priority for headset devices', () => {
      // Arrange
      const device = { label: 'USB Headset' } as MediaDeviceInfo;
      const quality = 0.6;
      
      // Act
      const priority = detector.calculatePriority(device, quality);
      
      // Assert
      expect(priority).toBe(5); // (0.6 * 5) + 2 = 5
    });
    
    it('should boost priority for USB/Bluetooth devices', () => {
      // Arrange
      const device = { label: 'Bluetooth Microphone' } as MediaDeviceInfo;
      const quality = 0.7;
      
      // Act
      const priority = detector.calculatePriority(device, quality);
      
      // Assert
      expect(priority).toBe(4.5); // (0.7 * 5) + 1 = 4.5
    });
    
    it('should cap priority at 10', () => {
      // Arrange
      const device = { label: 'Premium USB Headset' } as MediaDeviceInfo;
      const quality = 1.0;
      
      // Act
      const priority = detector.calculatePriority(device, quality);
      
      // Assert
      expect(priority).toBe(10); // Capped at 10
    });
  });
  
  describe('getSource', () => {
    it('should return source by ID', async () => {
      // Arrange
      const mockDevices = [
        { deviceId: 'mic1', kind: 'audioinput', label: 'Microphone' }
      ];
      
      mockEnumerateDevices.mockResolvedValue(mockDevices);
      mockGetUserMedia.mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }]
      });
      
      await detector.detectSources();
      
      // Act
      const source = detector.getSource('mic1');
      
      // Assert
      expect(source).toBeDefined();
      expect(source?.id).toBe('mic1');
    });
    
    it('should return undefined for non-existent source', () => {
      // Act
      const source = detector.getSource('non-existent');
      
      // Assert
      expect(source).toBeUndefined();
    });
  });
  
  describe('cleanup', () => {
    it('should clean up resources', () => {
      // Act
      detector.cleanup();
      
      // Assert - no errors should be thrown
      expect(() => detector.cleanup()).not.toThrow();
    });
  });
});
