/**
 * Interface for AI analysis services
 * 
 * Defines the contract for services that analyze interview transcripts
 * and provide insights for HR decision-making
 */

export interface AnalysisRequest {
  transcript: string;
  jobDescription?: string;
  contextWindow: string[];
  entities: string[];
  topicHistory: string[];
  ragContext?: any; // Use existing RAGContext type
}

export interface InsightResponse {
  topic: string;
  depth_score: number;
  signals: string[];
  followups: string[];
  note: string;
  type: 'strength' | 'risk' | 'question';
  confidence: number;
}

export interface IAnalysisService {
  /**
   * Analyze interview transcript and provide insights
   * 
   * @param request - Analysis request with transcript and context
   * @returns Promise with analysis insights
   */
  analyzeTranscript(request: AnalysisRequest): Promise<InsightResponse>;
  
  /**
   * Check if the service is properly configured
   * 
   * @returns true if service is ready to use
   */
  isConfigured(): boolean;
  
  /**
   * Get service configuration status
   * 
   * @returns Configuration details
   */
  getConfigStatus(): {
    configured: boolean;
    model: string;
    maxTokens: number;
    temperature: number;
  };
}
