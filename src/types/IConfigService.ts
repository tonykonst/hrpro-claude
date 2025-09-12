/**
 * Interface for configuration services
 * 
 * Defines the contract for services that manage application configuration
 * and environment variables
 */

export interface AppConfig {
  api: {
    deepgram: {
      apiKey: string;
      model: string;
      language: string;
      punctuation: boolean;
      interimResults: boolean;
      smartFormat: boolean;
      endpointing: number;
      vadEvents: boolean;
      noDelay: boolean;
      interimResultsPeriod: number;
      keywords: string;
    };
    claude: {
      apiKey: string;
      model: string;
      maxTokens: number;
      temperature: number;
    };
    openai: {
      apiKey: string;
      whisperModel: string;
      temperature: number;
      language: string;
      prompt: string;
    };
    postEditor: {
      apiKey: string;
      model: string;
      maxTokens: number;
      temperature: number;
      maxRequestsPerSecond: number;
      timeoutMs: number;
      enabled: boolean;
    };
  };
  audio: {
    sampleRate: number;
    channels: number;
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
    chunkSize: number;
    maxBufferSize: number;
    split: {
      enabled: boolean;
      autoDetectRoles: boolean;
      candidateSource: string;
      hrSource: string;
      fallbackToSingleStream: boolean;
      monitoringInterval: number;
      roleReevaluationTimeout: number;
      qualityThreshold: number;
      activityThreshold: number;
    };
  };
  ui: {
    insightFrequencyMs: number;
    minInsightConfidence: number;
    transcriptBufferWords: number;
    maxInsightsDisplay: number;
    defaultActivePanel: 'transcript' | 'insights' | 'settings';
    defaultClickThrough: boolean;
  };
  isDevelopment: boolean;
}

export interface IConfigService {
  /**
   * Get current application configuration
   * 
   * @returns Complete application configuration
   */
  getConfig(): AppConfig;
  
  /**
   * Get configuration with environment variables loaded
   * 
   * @returns Promise with updated configuration
   */
  getConfigWithEnv(): Promise<AppConfig>;
  
  /**
   * Check if a specific service is configured
   * 
   * @param service - Service name to check
   * @returns true if service is properly configured
   */
  isServiceConfigured(service: string): boolean;
  
  /**
   * Get audio constraints for getUserMedia
   * 
   * @returns MediaStreamConstraints for audio capture
   */
  getAudioConstraints(): MediaStreamConstraints;
  
  /**
   * Log current configuration (development only)
   */
  logConfig(): void;
  
  /**
   * Validate configuration integrity
   * 
   * @returns Validation result with errors if any
   */
  validateConfig(): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
}
