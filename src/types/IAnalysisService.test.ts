import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IAnalysisService, AnalysisRequest, InsightResponse } from './IAnalysisService';

// Mock implementation for testing
class MockAnalysisService implements IAnalysisService {
  private configured = true;

  async analyzeTranscript(request: AnalysisRequest): Promise<InsightResponse> {
    return {
      topic: 'Test Topic',
      depth_score: 0.8,
      signals: ['test signal'],
      followups: ['test question'],
      note: 'Test insight',
      type: 'strength',
      confidence: 0.9
    };
  }

  isConfigured(): boolean {
    return this.configured;
  }

  getConfigStatus() {
    return {
      configured: this.configured,
      model: 'test-model',
      maxTokens: 300,
      temperature: 0.3
    };
  }

  setConfigured(value: boolean) {
    this.configured = value;
  }
}

describe('IAnalysisService', () => {
  let service: MockAnalysisService;

  beforeEach(() => {
    service = new MockAnalysisService();
  });

  describe('analyzeTranscript', () => {
    it('should analyze transcript and return insights', async () => {
      const request: AnalysisRequest = {
        transcript: 'Test transcript',
        contextWindow: ['context1', 'context2'],
        entities: ['entity1'],
        topicHistory: ['topic1']
      };

      const result = await service.analyzeTranscript(request);

      expect(result).toMatchObject({
        topic: expect.any(String),
        depth_score: expect.any(Number),
        signals: expect.any(Array),
        followups: expect.any(Array),
        note: expect.any(String),
        type: expect.stringMatching(/^(strength|risk|question)$/),
        confidence: expect.any(Number)
      });
    });

    it('should handle RAG context when provided', async () => {
      const request: AnalysisRequest = {
        transcript: 'Test transcript',
        contextWindow: ['context1'],
        entities: ['entity1'],
        topicHistory: ['topic1'],
        ragContext: {
          relevantChunks: [{
            content: 'relevant content',
            source: { type: 'job_description', name: 'test' },
            relevanceScore: 0.9
          }],
          totalTokens: 100,
          retrievalMetadata: {
            averageScore: 0.9,
            retrievalTime: 50
          }
        }
      };

      const result = await service.analyzeTranscript(request);
      expect(result).toBeDefined();
    });
  });

  describe('isConfigured', () => {
    it('should return true when service is configured', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when service is not configured', () => {
      service.setConfigured(false);
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('getConfigStatus', () => {
    it('should return configuration status', () => {
      const status = service.getConfigStatus();

      expect(status).toMatchObject({
        configured: expect.any(Boolean),
        model: expect.any(String),
        maxTokens: expect.any(Number),
        temperature: expect.any(Number)
      });
    });
  });
});
