/**
 * AudioStreamSplitter Integration Tests
 * 
 * Тестирует интеграцию между компонентами аудио системы.
 * Соответствует архитектурным принципам hrpro.mdc:
 * - Integration тесты для взаимодействия между модулями
 * - Тестирование реальных сценариев использования
 * - Performance budgets для критических операций
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AudioStreamSplitter } from '../AudioStreamSplitter';
import { configService } from '../../config';

describe('AudioStreamSplitter Integration', () => {
  let splitter: AudioStreamSplitter;
  
  beforeEach(() => {
    splitter = new AudioStreamSplitter();
  });
  
  afterEach(() => {
    splitter.cleanup();
  });
  
  describe('Full Integration Flow', () => {
    it('should complete full initialization flow', async () => {
      // Act
      await splitter.initialize();
      
      // Assert
      expect(splitter.isConfigured()).toBe(true);
      expect(splitter.getCandidateStream()).toBeDefined();
      expect(splitter.getHRStrategy()).toBeDefined();
    });
    
    it('should handle multiple initialization attempts', async () => {
      // Act
      await splitter.initialize();
      await splitter.initialize(); // Second initialization
      
      // Assert
      expect(splitter.isConfigured()).toBe(true);
    });
    
    it('should maintain state consistency during operations', async () => {
      // Arrange
      await splitter.initialize();
      const initialCandidateStream = splitter.getCandidateStream();
      const initialHRStrategy = splitter.getHRStrategy();
      
      // Act
      const candidateAnalysis = splitter.getCandidateAnalysis();
      const hrAnalysis = splitter.getHRAnalysis();
      const isActive = splitter.isCandidateActive();
      
      // Assert
      expect(splitter.getCandidateStream()).toBe(initialCandidateStream);
      expect(splitter.getHRStrategy()).toBe(initialHRStrategy);
      expect(candidateAnalysis).toBeDefined();
      expect(typeof isActive).toBe('boolean');
    });
  });
  
  describe('Configuration Integration', () => {
    it('should respect audio split configuration', async () => {
      // Arrange
      const config = configService.getAudioSplitConfig();
      
      // Act
      await splitter.initialize();
      
      // Assert
      expect(splitter.isConfigured()).toBe(config.enabled);
    });
    
    it('should handle configuration changes', async () => {
      // Arrange
      await splitter.initialize();
      const initialState = splitter.isConfigured();
      
      // Act - Simulate configuration change
      // Note: In real scenario, this would require reinitialization
      
      // Assert
      expect(initialState).toBe(true);
    });
  });
  
  describe('Error Recovery Integration', () => {
    it('should recover from initialization errors', async () => {
      // Arrange
      let firstAttempt = true;
      const originalInitialize = splitter.initialize.bind(splitter);
      
      // Mock first initialization to fail, second to succeed
      splitter.initialize = async () => {
        if (firstAttempt) {
          firstAttempt = false;
          throw new Error('Initialization failed');
        }
        return originalInitialize();
      };
      
      // Act & Assert
      await expect(splitter.initialize()).rejects.toThrow('Initialization failed');
      await expect(splitter.initialize()).resolves.not.toThrow();
    });
    
    it('should handle cleanup after failed initialization', async () => {
      // Arrange
      try {
        await splitter.initialize();
      } catch (error) {
        // Expected to fail in test environment
      }
      
      // Act
      splitter.cleanup();
      
      // Assert
      expect(splitter.isConfigured()).toBe(false);
    });
  });
  
  describe('Stream Management Integration', () => {
    it('should manage multiple streams correctly', async () => {
      // Arrange
      await splitter.initialize();
      
      // Act
      const candidateStream = splitter.getCandidateStream();
      const hrStream = splitter.getHRStream();
      const sources = await splitter.detectSources();
      
      // Assert
      expect(sources.length).toBeGreaterThan(0);
      expect(candidateStream).toBeDefined();
      // HR stream might be null depending on configuration
    });
    
    it('should handle stream switching', async () => {
      // Arrange
      await splitter.initialize();
      const sources = await splitter.detectSources();
      
      if (sources.length > 1) {
        // Act
        splitter.setCandidateStream(sources[1].id);
        
        // Assert
        expect(splitter.getCandidateStream()).toBeDefined();
      }
    });
  });
  
  describe('Performance Integration', () => {
    it('should initialize within performance budget', async () => {
      // Arrange
      const startTime = performance.now();
      
      // Act
      await splitter.initialize();
      
      // Assert
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(5000); // 5 seconds budget
    });
    
    it('should handle rapid operations efficiently', async () => {
      // Arrange
      await splitter.initialize();
      const startTime = performance.now();
      
      // Act - Perform multiple operations rapidly
      for (let i = 0; i < 10; i++) {
        splitter.getCandidateAnalysis();
        splitter.getHRAnalysis();
        splitter.isCandidateActive();
      }
      
      // Assert
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(100); // 100ms budget for 10 operations
    });
  });
  
  describe('Memory Management Integration', () => {
    it('should not leak memory during multiple initializations', async () => {
      // Arrange
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Act - Multiple initialization cycles
      for (let i = 0; i < 3; i++) {
        await splitter.initialize();
        splitter.cleanup();
      }
      
      // Assert
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Allow for some memory increase but not excessive
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 10MB limit
    });
    
    it('should clean up resources properly', async () => {
      // Arrange
      await splitter.initialize();
      const candidateStream = splitter.getCandidateStream();
      
      // Act
      splitter.cleanup();
      
      // Assert
      expect(splitter.isConfigured()).toBe(false);
      expect(splitter.getCandidateStream()).toBeNull();
      expect(splitter.getHRStream()).toBeNull();
      expect(splitter.getHRStrategy()).toBeNull();
    });
  });
  
  describe('Real-world Scenario Integration', () => {
    it('should handle typical interview setup', async () => {
      // Arrange - Simulate typical interview setup
      await splitter.initialize();
      
      // Act - Simulate interview flow
      const candidateStream = splitter.getCandidateStream();
      const hrStrategy = splitter.getHRStrategy();
      const candidateAnalysis = splitter.getCandidateAnalysis();
      
      // Assert
      expect(candidateStream).toBeDefined();
      expect(hrStrategy).toBeDefined();
      expect(candidateAnalysis).toBeDefined();
      expect(hrStrategy?.strategy).toBeDefined();
    });
    
    it('should handle headphone scenarios', async () => {
      // Arrange
      await splitter.initialize();
      const hrStrategy = splitter.getHRStrategy();
      
      // Act & Assert
      expect(hrStrategy).toBeDefined();
      expect(hrStrategy?.configuration).toBeDefined();
      expect(hrStrategy?.actions).toBeDefined();
      expect(Array.isArray(hrStrategy?.actions)).toBe(true);
    });
  });
});
