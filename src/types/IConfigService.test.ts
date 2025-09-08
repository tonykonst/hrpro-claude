import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IConfigService, AppConfig } from './IConfigService';

// Mock implementation for testing
class MockConfigService implements IConfigService {
  private config: AppConfig;

  constructor() {
    this.config = {
      api: {
        deepgram: {
          apiKey: 'test-deepgram-key',
          model: 'nova-2-meeting',
          language: 'en',
          punctuation: true,
          interimResults: true,
          smartFormat: true,
          endpointing: 800,
          vadEvents: true,
          noDelay: true,
          interimResultsPeriod: 100,
          keywords: 'test'
        },
        claude: {
          apiKey: 'test-claude-key',
          model: 'claude-sonnet-4',
          maxTokens: 300,
          temperature: 0.3
        },
        openai: {
          apiKey: 'test-openai-key',
          whisperModel: 'whisper-1',
          temperature: 0.0,
          language: 'en',
          prompt: 'test prompt'
        },
        postEditor: {
          apiKey: 'test-post-editor-key',
          model: 'claude-3-haiku',
          maxTokens: 150,
          temperature: 0.1,
          maxRequestsPerSecond: 3,
          timeoutMs: 500,
          enabled: true
        }
      },
      audio: {
        sampleRate: 16000,
        channels: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        chunkSize: 250
      },
      ui: {
        insightFrequencyMs: 3000,
        minInsightConfidence: 0.6,
        transcriptBufferWords: 600,
        maxInsightsDisplay: 3,
        defaultActivePanel: 'transcript',
        defaultClickThrough: false
      },
      isDevelopment: true
    };
  }

  getConfig(): AppConfig {
    return this.config;
  }

  async getConfigWithEnv(): Promise<AppConfig> {
    return this.config;
  }

  isServiceConfigured(service: string): boolean {
    switch (service) {
      case 'deepgram':
        return !!this.config.api.deepgram.apiKey;
      case 'claude':
        return !!this.config.api.claude.apiKey;
      case 'postEditor':
        return !!this.config.api.postEditor.apiKey;
      default:
        return false;
    }
  }

  getAudioConstraints(): MediaStreamConstraints {
    return {
      audio: {
        sampleRate: this.config.audio.sampleRate,
        channelCount: this.config.audio.channels,
        echoCancellation: this.config.audio.echoCancellation,
        noiseSuppression: this.config.audio.noiseSuppression,
        autoGainControl: this.config.audio.autoGainControl
      }
    };
  }

  logConfig(): void {
    // Mock implementation
  }

  validateConfig(): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.config.api.deepgram.apiKey) {
      errors.push('Deepgram API key is required');
    }
    if (!this.config.api.claude.apiKey) {
      errors.push('Claude API key is required');
    }

    if (this.config.audio.sampleRate < 8000 || this.config.audio.sampleRate > 48000) {
      warnings.push('Audio sample rate should be between 8kHz and 48kHz');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

describe('IConfigService', () => {
  let service: MockConfigService;

  beforeEach(() => {
    service = new MockConfigService();
  });

  describe('getConfig', () => {
    it('should return complete configuration', () => {
      const config = service.getConfig();

      expect(config).toMatchObject({
        api: expect.objectContaining({
          deepgram: expect.any(Object),
          claude: expect.any(Object),
          postEditor: expect.any(Object)
        }),
        audio: expect.any(Object),
        ui: expect.any(Object),
        isDevelopment: expect.any(Boolean)
      });
    });
  });

  describe('getConfigWithEnv', () => {
    it('should return configuration with environment variables', async () => {
      const config = await service.getConfigWithEnv();

      expect(config).toBeDefined();
      expect(config.api.deepgram.apiKey).toBe('test-deepgram-key');
    });
  });

  describe('isServiceConfigured', () => {
    it('should return true for configured services', () => {
      expect(service.isServiceConfigured('deepgram')).toBe(true);
      expect(service.isServiceConfigured('claude')).toBe(true);
      expect(service.isServiceConfigured('postEditor')).toBe(true);
    });

    it('should return false for unknown services', () => {
      expect(service.isServiceConfigured('unknown')).toBe(false);
    });
  });

  describe('getAudioConstraints', () => {
    it('should return valid MediaStreamConstraints', () => {
      const constraints = service.getAudioConstraints();

      expect(constraints).toMatchObject({
        audio: expect.objectContaining({
          sampleRate: expect.any(Number),
          channelCount: expect.any(Number),
          echoCancellation: expect.any(Boolean),
          noiseSuppression: expect.any(Boolean),
          autoGainControl: expect.any(Boolean)
        })
      });
    });
  });

  describe('validateConfig', () => {
    it('should return valid configuration when all keys are present', () => {
      const validation = service.validateConfig();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should return warnings for invalid audio settings', () => {
      const config = service.getConfig();
      config.audio.sampleRate = 5000; // Invalid sample rate

      const validation = service.validateConfig();
      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });
});
