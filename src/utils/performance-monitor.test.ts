/**
 * Unit tests for PerformanceMonitor
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PerformanceMonitor } from './performance-monitor';

// Mock performance API
const mockPerformance = {
  now: vi.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024 // 50MB
  }
};

// Mock global performance
Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true
});

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    PerformanceMonitor.reset();
    vi.clearAllMocks();
  });

  describe('Latency Recording', () => {
    it('should record audio latency correctly', () => {
      PerformanceMonitor.recordAudioLatency(100);
      PerformanceMonitor.recordAudioLatency(200);
      
      const metrics = PerformanceMonitor.getMetrics();
      expect(metrics.audioLatency).toBe(150); // Average of 100 and 200
    });

    it('should record transcription latency correctly', () => {
      PerformanceMonitor.recordTranscriptionLatency(500);
      PerformanceMonitor.recordTranscriptionLatency(300);
      
      const metrics = PerformanceMonitor.getMetrics();
      expect(metrics.transcriptionLatency).toBe(400); // Average of 500 and 300
    });

    it('should record analysis latency correctly', () => {
      PerformanceMonitor.recordAnalysisLatency(1000);
      PerformanceMonitor.recordAnalysisLatency(800);
      
      const metrics = PerformanceMonitor.getMetrics();
      expect(metrics.analysisLatency).toBe(900); // Average of 1000 and 800
    });

    it('should limit latency samples to MAX_SAMPLES', () => {
      // Add more samples than MAX_SAMPLES (100)
      for (let i = 0; i < 150; i++) {
        PerformanceMonitor.recordAudioLatency(i);
      }
      
      const metrics = PerformanceMonitor.getMetrics();
      // Should only keep the last 100 samples (50-149)
      expect(metrics.audioLatency).toBeCloseTo(99.5, 1); // Average of 50-149
    });
  });

  describe('Error and Success Recording', () => {
    it('should record errors and calculate error rate', () => {
      PerformanceMonitor.recordSuccess();
      PerformanceMonitor.recordSuccess();
      PerformanceMonitor.recordError();
      
      const metrics = PerformanceMonitor.getMetrics();
      expect(metrics.totalOperations).toBe(3);
      expect(metrics.errorRate).toBeCloseTo(0.333, 2); // 1/3
      expect(metrics.successRate).toBeCloseTo(0.667, 2); // 2/3
    });

    it('should handle zero operations', () => {
      const metrics = PerformanceMonitor.getMetrics();
      expect(metrics.totalOperations).toBe(0);
      expect(metrics.errorRate).toBe(0);
      expect(metrics.successRate).toBe(0); // Changed from 1 to 0 for zero operations
    });
  });

  describe('Latency Measurement', () => {
    it('should measure latency correctly', () => {
      mockPerformance.now
        .mockReturnValueOnce(1000) // startTime
        .mockReturnValueOnce(1200); // endTime
      
      const measurement = PerformanceMonitor.startLatencyMeasurement();
      const duration = PerformanceMonitor.endLatencyMeasurement(measurement, 'audio');
      
      expect(duration).toBe(200);
      expect(measurement.startTime).toBe(1000);
      expect(measurement.endTime).toBe(1200);
      expect(measurement.duration).toBe(200);
    });
  });

  describe('Performance Health Check', () => {
    it('should report healthy performance', () => {
      PerformanceMonitor.recordAudioLatency(50);
      PerformanceMonitor.recordTranscriptionLatency(1000);
      PerformanceMonitor.recordAnalysisLatency(2000);
      PerformanceMonitor.recordSuccess();
      
      const health = PerformanceMonitor.checkPerformanceHealth();
      expect(health.isHealthy).toBe(true);
      expect(health.issues).toHaveLength(0);
    });

    it('should detect high audio latency', () => {
      PerformanceMonitor.recordAudioLatency(150); // Above 100ms threshold
      
      const health = PerformanceMonitor.checkPerformanceHealth();
      expect(health.isHealthy).toBe(false);
      expect(health.issues[0]).toContain('High audio latency');
      expect(health.recommendations).toContain('Consider reducing audio buffer size');
    });

    it('should detect high transcription latency', () => {
      PerformanceMonitor.recordTranscriptionLatency(3000); // Above 2000ms threshold
      
      const health = PerformanceMonitor.checkPerformanceHealth();
      expect(health.isHealthy).toBe(false);
      expect(health.issues[0]).toContain('High transcription latency');
      expect(health.recommendations).toContain('Check Deepgram connection and network');
    });

    it('should detect high analysis latency', () => {
      PerformanceMonitor.recordAnalysisLatency(6000); // Above 5000ms threshold
      
      const health = PerformanceMonitor.checkPerformanceHealth();
      expect(health.isHealthy).toBe(false);
      expect(health.issues[0]).toContain('High analysis latency');
      expect(health.recommendations).toContain('Consider reducing context window size');
    });

    it('should detect high error rate', () => {
      PerformanceMonitor.recordError();
      PerformanceMonitor.recordError();
      PerformanceMonitor.recordSuccess(); // 2/3 = 66% error rate
      
      const health = PerformanceMonitor.checkPerformanceHealth();
      expect(health.isHealthy).toBe(false);
      expect(health.issues[0]).toContain('High error rate');
      expect(health.recommendations).toContain('Investigate API connectivity and rate limits');
    });
  });

  describe('Memory Usage', () => {
    it('should get memory usage from performance.memory', () => {
      const metrics = PerformanceMonitor.getMetrics();
      expect(metrics.memoryUsage).toBe(50 * 1024 * 1024); // 50MB
    });

    it('should handle missing performance.memory', () => {
      // Remove memory property
      delete (mockPerformance as any).memory;
      
      const metrics = PerformanceMonitor.getMetrics();
      expect(metrics.memoryUsage).toBe(0);
    });
  });

  describe('Session Duration', () => {
    it('should calculate session duration correctly', () => {
      // Mock Date.now to simulate time passing
      const startTime = 1000000;
      const currentTime = 1005000; // 5 seconds later
      
      vi.spyOn(Date, 'now')
        .mockReturnValueOnce(startTime) // For session start
        .mockReturnValueOnce(currentTime); // For getMetrics
      
      PerformanceMonitor.reset();
      const metrics = PerformanceMonitor.getMetrics();
      
      expect(metrics.sessionDuration).toBe(5000); // 5 seconds
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all metrics', () => {
      PerformanceMonitor.recordAudioLatency(100);
      PerformanceMonitor.recordError();
      PerformanceMonitor.recordSuccess();
      
      PerformanceMonitor.reset();
      
      const metrics = PerformanceMonitor.getMetrics();
      expect(metrics.audioLatency).toBe(0);
      expect(metrics.totalOperations).toBe(0);
      expect(metrics.errorRate).toBe(0);
      expect(metrics.successRate).toBe(0);
    });
  });

  describe('Metrics Logging', () => {
    it('should log metrics in correct format', () => {
      PerformanceMonitor.recordAudioLatency(100);
      PerformanceMonitor.recordSuccess();
      
      // Mock console.log to capture the log output
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      PerformanceMonitor.logMetrics();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Performance metrics summary')
      );
      
      consoleSpy.mockRestore();
    });
  });
});
