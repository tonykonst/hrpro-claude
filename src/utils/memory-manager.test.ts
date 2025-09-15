import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryManager, Insight } from './memory-manager';

describe('MemoryManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('cleanupOldData', () => {
    it('should not clean data when under limits', () => {
      const transcript = ['word1', 'word2', 'word3'];
      const insights: Insight[] = [
        { id: '1', timestamp: Date.now(), content: 'insight1' },
        { id: '2', timestamp: Date.now(), content: 'insight2' }
      ];

      const result = MemoryManager.cleanupOldData(transcript, insights);

      expect(result.cleanedTranscript).toEqual(transcript);
      expect(result.cleanedInsights).toEqual(insights);
      expect(result.removedCount.transcript).toBe(0);
      expect(result.removedCount.insights).toBe(0);
    });

    it('should clean transcript when over limit', () => {
      const transcript = Array.from({ length: 1500 }, (_, i) => `word${i}`);
      const insights: Insight[] = [
        { id: '1', timestamp: Date.now(), content: 'insight1' }
      ];

      const result = MemoryManager.cleanupOldData(transcript, insights);

      expect(result.cleanedTranscript.length).toBe(1000);
      expect(result.cleanedTranscript).toEqual(transcript.slice(-1000));
      expect(result.removedCount.transcript).toBe(500);
      expect(result.removedCount.insights).toBe(0);
    });

    it('should clean insights when over limit', () => {
      const transcript = ['word1', 'word2'];
      const insights: Insight[] = Array.from({ length: 75 }, (_, i) => ({
        id: `${i}`,
        timestamp: Date.now(),
        content: `insight${i}`
      }));

      const result = MemoryManager.cleanupOldData(transcript, insights);

      expect(result.cleanedInsights.length).toBe(50);
      expect(result.cleanedInsights).toEqual(insights.slice(-50));
      expect(result.removedCount.transcript).toBe(0);
      expect(result.removedCount.insights).toBe(25);
    });

    it('should clean both transcript and insights when over limits', () => {
      const transcript = Array.from({ length: 1500 }, (_, i) => `word${i}`);
      const insights: Insight[] = Array.from({ length: 75 }, (_, i) => ({
        id: `${i}`,
        timestamp: Date.now(),
        content: `insight${i}`
      }));

      const result = MemoryManager.cleanupOldData(transcript, insights);

      expect(result.cleanedTranscript.length).toBe(1000);
      expect(result.cleanedInsights.length).toBe(50);
      expect(result.removedCount.transcript).toBe(500);
      expect(result.removedCount.insights).toBe(25);
    });
  });

  describe('getMemoryStats', () => {
    it('should return correct memory configuration', () => {
      const stats = MemoryManager.getMemoryStats();

      expect(stats).toEqual({
        maxTranscriptWords: 1000,
        maxInsightsHistory: 50,
        maxAudioBufferSize: 1024 * 1024
      });
    });
  });

  describe('needsCleanup', () => {
    it('should return false when under limits', () => {
      const transcript = ['word1', 'word2'];
      const insights: Insight[] = [
        { id: '1', timestamp: Date.now(), content: 'insight1' }
      ];

      expect(MemoryManager.needsCleanup(transcript, insights)).toBe(false);
    });

    it('should return true when transcript over limit', () => {
      const transcript = Array.from({ length: 1500 }, (_, i) => `word${i}`);
      const insights: Insight[] = [
        { id: '1', timestamp: Date.now(), content: 'insight1' }
      ];

      expect(MemoryManager.needsCleanup(transcript, insights)).toBe(true);
    });

    it('should return true when insights over limit', () => {
      const transcript = ['word1', 'word2'];
      const insights: Insight[] = Array.from({ length: 75 }, (_, i) => ({
        id: `${i}`,
        timestamp: Date.now(),
        content: `insight${i}`
      }));

      expect(MemoryManager.needsCleanup(transcript, insights)).toBe(true);
    });
  });

  describe('getMemoryUsageEstimate', () => {
    it('should calculate memory usage correctly', () => {
      const transcript = ['hello', 'world', 'test'];
      const insights: Insight[] = [
        { id: '1', timestamp: Date.now(), content: 'short insight' },
        { id: '2', timestamp: Date.now(), content: 'another insight' }
      ];

      const usage = MemoryManager.getMemoryUsageEstimate(transcript, insights);

      expect(usage.transcriptWords).toBe(3);
      expect(usage.insightsCount).toBe(2);
      expect(usage.estimatedSizeKB).toBeGreaterThanOrEqual(0);
      expect(typeof usage.estimatedSizeKB).toBe('number');
      
      // Calculate expected size: transcript "hello world test" = 17 chars * 2 = 34 bytes
      // insights: 2 insights * (content length * 2 + 50 overhead) = 2 * (26 + 50) = 152 bytes
      // Total: 34 + 152 = 186 bytes = 0.18 KB
      expect(usage.estimatedSizeKB).toBe(0);
    });

    it('should handle empty arrays', () => {
      const transcript: string[] = [];
      const insights: Insight[] = [];

      const usage = MemoryManager.getMemoryUsageEstimate(transcript, insights);

      expect(usage.transcriptWords).toBe(0);
      expect(usage.insightsCount).toBe(0);
      expect(usage.estimatedSizeKB).toBe(0);
    });
  });
});
