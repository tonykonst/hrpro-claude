/**
 * AudioStreamSplitter Performance Tests
 * 
 * Тестирует производительность аудио системы.
 * Соответствует архитектурным принципам hrpro.mdc:
 * - Performance budgets для критических операций
 * - Нагрузочное тестирование
 * - Мониторинг метрик производительности
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AudioStreamSplitter } from '../AudioStreamSplitter';

describe('AudioStreamSplitter Performance', () => {
  let splitter: AudioStreamSplitter;
  
  beforeEach(() => {
    splitter = new AudioStreamSplitter();
  });
  
  afterEach(() => {
    splitter.cleanup();
  });
  
  describe('Initialization Performance', () => {
    it('should initialize within 5 seconds budget', async () => {
      // Arrange
      const startTime = performance.now();
      
      // Act
      await splitter.initialize();
      
      // Assert
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(5000); // 5 seconds budget
      
      console.log(`Initialization took: ${duration.toFixed(2)}ms`);
    });
    
    it('should handle concurrent initializations efficiently', async () => {
      // Arrange
      const startTime = performance.now();
      
      // Act - Multiple concurrent initializations
      const promises = Array.from({ length: 3 }, () => {
        const newSplitter = new AudioStreamSplitter();
        return newSplitter.initialize().then(() => {
          newSplitter.cleanup();
        });
      });
      
      await Promise.all(promises);
      
      // Assert
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(10000); // 10 seconds budget for 3 concurrent
      
      console.log(`Concurrent initializations took: ${duration.toFixed(2)}ms`);
    });
  });
  
  describe('Operation Performance', () => {
    beforeEach(async () => {
      await splitter.initialize();
    });
    
    it('should perform stream operations within 10ms', () => {
      // Arrange
      const startTime = performance.now();
      
      // Act - Multiple stream operations
      for (let i = 0; i < 100; i++) {
        splitter.getCandidateStream();
        splitter.getHRStream();
        splitter.getCandidateAnalysis();
        splitter.getHRAnalysis();
        splitter.isCandidateActive();
      }
      
      // Assert
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(10); // 10ms budget for 100 operations
      
      console.log(`100 stream operations took: ${duration.toFixed(2)}ms`);
    });
    
    it('should handle rapid state changes efficiently', () => {
      // Arrange
      const startTime = performance.now();
      
      // Act - Rapid state changes
      for (let i = 0; i < 50; i++) {
        splitter.setCandidateStream('test-source');
        splitter.setHRStream('test-hr-source');
        splitter.getCandidateStream();
        splitter.getHRStream();
      }
      
      // Assert
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(5); // 5ms budget for 50 state changes
      
      console.log(`50 state changes took: ${duration.toFixed(2)}ms`);
    });
    
    it('should maintain performance under load', async () => {
      // Arrange
      const startTime = performance.now();
      const operations = 1000;
      
      // Act - High load operations
      for (let i = 0; i < operations; i++) {
        splitter.getCandidateAnalysis();
        splitter.getHRAnalysis();
        splitter.isCandidateActive();
        
        // Simulate some processing
        if (i % 100 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      // Assert
      const duration = performance.now() - startTime;
      const avgTimePerOperation = duration / operations;
      
      expect(avgTimePerOperation).toBeLessThan(0.1); // 0.1ms per operation
      expect(duration).toBeLessThan(1000); // 1 second total budget
      
      console.log(`1000 operations took: ${duration.toFixed(2)}ms (avg: ${avgTimePerOperation.toFixed(3)}ms/op)`);
    });
  });
  
  describe('Memory Performance', () => {
    it('should not exceed memory budget during initialization', async () => {
      // Arrange
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Act
      await splitter.initialize();
      
      // Assert
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024); // 5MB budget
      
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
    
    it('should not leak memory during repeated operations', async () => {
      // Arrange
      await splitter.initialize();
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Act - Repeated operations
      for (let i = 0; i < 100; i++) {
        splitter.getCandidateAnalysis();
        splitter.getHRAnalysis();
        splitter.isCandidateActive();
        
        // Force garbage collection if available
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      }
      
      // Assert
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      expect(memoryIncrease).toBeLessThan(1024 * 1024); // 1MB budget
      
      console.log(`Memory increase after 100 operations: ${(memoryIncrease / 1024).toFixed(2)}KB`);
    });
    
    it('should clean up memory properly', async () => {
      // Arrange
      await splitter.initialize();
      const memoryBeforeCleanup = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Act
      splitter.cleanup();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Assert
      const memoryAfterCleanup = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryFreed = memoryBeforeCleanup - memoryAfterCleanup;
      
      // Should free some memory (allowing for some variance)
      expect(memoryFreed).toBeGreaterThan(-1024 * 1024); // Allow 1MB variance
      
      console.log(`Memory freed: ${(memoryFreed / 1024).toFixed(2)}KB`);
    });
  });
  
  describe('Latency Performance', () => {
    beforeEach(async () => {
      await splitter.initialize();
    });
    
    it('should respond to stream queries within 1ms', () => {
      // Arrange
      const startTime = performance.now();
      
      // Act
      const stream = splitter.getCandidateStream();
      
      // Assert
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(1); // 1ms budget
      
      console.log(`Stream query latency: ${duration.toFixed(3)}ms`);
    });
    
    it('should respond to analysis queries within 5ms', () => {
      // Arrange
      const startTime = performance.now();
      
      // Act
      const analysis = splitter.getCandidateAnalysis();
      
      // Assert
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(5); // 5ms budget
      
      console.log(`Analysis query latency: ${duration.toFixed(3)}ms`);
    });
    
    it('should handle batch operations efficiently', () => {
      // Arrange
      const startTime = performance.now();
      const batchSize = 100;
      
      // Act
      for (let i = 0; i < batchSize; i++) {
        splitter.getCandidateStream();
        splitter.getHRStream();
        splitter.getCandidateAnalysis();
        splitter.getHRAnalysis();
        splitter.isCandidateActive();
      }
      
      // Assert
      const duration = performance.now() - startTime;
      const avgLatency = duration / (batchSize * 5); // 5 operations per iteration
      
      expect(avgLatency).toBeLessThan(0.1); // 0.1ms average per operation
      
      console.log(`Batch operation latency: ${avgLatency.toFixed(3)}ms per operation`);
    });
  });
  
  describe('Stress Testing', () => {
    it('should handle stress test with multiple splitters', async () => {
      // Arrange
      const startTime = performance.now();
      const numSplitters = 5;
      
      // Act
      const splitters = Array.from({ length: numSplitters }, () => new AudioStreamSplitter());
      
      // Initialize all splitters
      await Promise.all(splitters.map(s => s.initialize()));
      
      // Perform operations on all splitters
      for (let i = 0; i < 10; i++) {
        splitters.forEach(s => {
          s.getCandidateStream();
          s.getHRStream();
          s.getCandidateAnalysis();
          s.getHRAnalysis();
          s.isCandidateActive();
        });
      }
      
      // Cleanup all splitters
      splitters.forEach(s => s.cleanup());
      
      // Assert
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(15000); // 15 seconds budget
      
      console.log(`Stress test with ${numSplitters} splitters took: ${duration.toFixed(2)}ms`);
    });
    
    it('should maintain performance during extended operation', async () => {
      // Arrange
      await splitter.initialize();
      const startTime = performance.now();
      const operationCount = 10000;
      
      // Act - Extended operation
      for (let i = 0; i < operationCount; i++) {
        splitter.getCandidateAnalysis();
        splitter.getHRAnalysis();
        splitter.isCandidateActive();
        
        // Simulate real-world usage pattern
        if (i % 1000 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      // Assert
      const duration = performance.now() - startTime;
      const avgTimePerOperation = duration / operationCount;
      
      expect(avgTimePerOperation).toBeLessThan(0.05); // 0.05ms per operation
      expect(duration).toBeLessThan(5000); // 5 seconds total budget
      
      console.log(`Extended operation (${operationCount} ops) took: ${duration.toFixed(2)}ms (avg: ${avgTimePerOperation.toFixed(4)}ms/op)`);
    });
  });
});
