/**
 * HeadphoneDetector Unit Tests
 * 
 * Тестирует функциональность детектора наушников.
 * Соответствует архитектурным принципам hrpro.mdc:
 * - Unit тесты с покрытием >80%
 * - Mock внешних сервисов
 * - Тестирование error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HeadphoneDetector } from '../HeadphoneDetector';
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

Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    enumerateDevices: mockEnumerateDevices,
    getUserMedia: mockGetUserMedia
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

describe('HeadphoneDetector', () => {
  let detector: HeadphoneDetector;
  
  beforeEach(() => {
    detector = new HeadphoneDetector();
    vi.clearAllMocks();
  });
  
  describe('detectHeadphones', () => {
    it('should detect headphone devices successfully', async () => {
      // Arrange
      const mockDevices = [
        { deviceId: 'headset1', kind: 'audioinput', label: 'USB Headset' },
        { deviceId: 'mic1', kind: 'audioinput', label: 'Built-in Microphone' }
      ];
      
      mockEnumerateDevices.mockResolvedValue(mockDevices);
      mockGetUserMedia.mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }]
      });
      
      // Act
      const headphones = await detector.detectHeadphones();
      
      // Assert
      expect(headphones).toHaveLength(1); // Only headset detected
      expect(headphones[0].hasHeadphones).toBe(true);
      expect(headphones[0].type).toBe('usb');
      expect(headphones[0].deviceName).toBe('USB Headset');
    });
    
    it('should detect different headphone types', async () => {
      // Arrange
      const mockDevices = [
        { deviceId: 'bluetooth1', kind: 'audioinput', label: 'Bluetooth Headphones' },
        { deviceId: 'airpods1', kind: 'audioinput', label: 'AirPods Pro' },
        { deviceId: 'jack1', kind: 'audioinput', label: '3.5mm Headphones' }
      ];
      
      mockEnumerateDevices.mockResolvedValue(mockDevices);
      mockGetUserMedia.mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }]
      });
      
      // Act
      const headphones = await detector.detectHeadphones();
      
      // Assert
      expect(headphones).toHaveLength(3);
      expect(headphones[0].type).toBe('bluetooth');
      expect(headphones[1].type).toBe('wireless');
      expect(headphones[2].type).toBe('jack');
    });
    
    it('should handle errors gracefully', async () => {
      // Arrange
      mockEnumerateDevices.mockRejectedValue(new Error('Permission denied'));
      
      // Act & Assert
      await expect(detector.detectHeadphones()).rejects.toThrow(AppError);
    });
    
    it('should limit headphones to MAX_HEADPHONES', async () => {
      // Arrange
      const manyDevices = Array.from({ length: 10 }, (_, i) => ({
        deviceId: `headset${i}`,
        kind: 'audioinput',
        label: `Headset ${i}`
      }));
      
      mockEnumerateDevices.mockResolvedValue(manyDevices);
      mockGetUserMedia.mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }]
      });
      
      // Act
      const headphones = await detector.detectHeadphones();
      
      // Assert
      expect(headphones).toHaveLength(5); // MAX_HEADPHONES
    });
    
    it('should handle device analysis errors', async () => {
      // Arrange
      const mockDevices = [
        { deviceId: 'headset1', kind: 'audioinput', label: 'USB Headset' },
        { deviceId: 'broken1', kind: 'audioinput', label: 'Broken Device' }
      ];
      
      mockEnumerateDevices.mockResolvedValue(mockDevices);
      mockGetUserMedia
        .mockResolvedValueOnce({
          getTracks: () => [{ stop: vi.fn() }]
        })
        .mockRejectedValueOnce(new Error('Device error'));
      
      // Act
      const headphones = await detector.detectHeadphones();
      
      // Assert
      expect(headphones).toHaveLength(1); // Only working device
      expect(headphones[0].deviceName).toBe('USB Headset');
    });
  });
  
  describe('isHRUsingHeadphones', () => {
    it('should return true when HR is using headphones', async () => {
      // Arrange
      const mockDevices = [
        { deviceId: 'headset1', kind: 'audioinput', label: 'USB Headset' }
      ];
      
      mockEnumerateDevices.mockResolvedValue(mockDevices);
      mockGetUserMedia.mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }]
      });
      
      // Act
      const isUsing = await detector.isHRUsingHeadphones();
      
      // Assert
      expect(isUsing).toBe(true);
    });
    
    it('should return false when HR is not using headphones', async () => {
      // Arrange
      const mockDevices = [
        { deviceId: 'mic1', kind: 'audioinput', label: 'Built-in Microphone' }
      ];
      
      mockEnumerateDevices.mockResolvedValue(mockDevices);
      mockGetUserMedia.mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }]
      });
      
      // Act
      const isUsing = await detector.isHRUsingHeadphones();
      
      // Assert
      expect(isUsing).toBe(false);
    });
    
    it('should return false on error', async () => {
      // Arrange
      mockEnumerateDevices.mockRejectedValue(new Error('Permission denied'));
      
      // Act
      const isUsing = await detector.isHRUsingHeadphones();
      
      // Assert
      expect(isUsing).toBe(false);
    });
  });
  
  describe('getHRHeadphoneType', () => {
    it('should return headphone type when HR is using headphones', async () => {
      // Arrange
      const mockDevices = [
        { deviceId: 'bluetooth1', kind: 'audioinput', label: 'Bluetooth Headphones' }
      ];
      
      mockEnumerateDevices.mockResolvedValue(mockDevices);
      mockGetUserMedia.mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }]
      });
      
      // Act
      const type = await detector.getHRHeadphoneType();
      
      // Assert
      expect(type).toBe('bluetooth');
    });
    
    it('should return null when HR is not using headphones', async () => {
      // Arrange
      const mockDevices = [
        { deviceId: 'mic1', kind: 'audioinput', label: 'Built-in Microphone' }
      ];
      
      mockEnumerateDevices.mockResolvedValue(mockDevices);
      mockGetUserMedia.mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }]
      });
      
      // Act
      const type = await detector.getHRHeadphoneType();
      
      // Assert
      expect(type).toBe(null);
    });
    
    it('should return null on error', async () => {
      // Arrange
      mockEnumerateDevices.mockRejectedValue(new Error('Permission denied'));
      
      // Act
      const type = await detector.getHRHeadphoneType();
      
      // Assert
      expect(type).toBe(null);
    });
  });
});
