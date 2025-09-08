// Claude AI Service for Interview Analysis
// Replaces mock insights with real AI analysis using Claude Sonnet 4

import Anthropic from '@anthropic-ai/sdk';
import { RAGService, RAGContext } from './rag';
import { Logger } from '../utils/logger';
import { AppError, ErrorHandler } from '../utils/errors';
import { PerformanceMonitor } from '../utils/performance-monitor';
import { IAnalysisService, AnalysisRequest, InsightResponse } from '../types/IAnalysisService';

// Re-export types from interface for backward compatibility
export type { AnalysisRequest, InsightResponse } from '../types/IAnalysisService';

export interface ClaudeServiceConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export class ClaudeAnalysisService implements IAnalysisService {
  private anthropic: Anthropic | null;
  private systemPrompt: string = '';
  private config: ClaudeServiceConfig;
  private ragService?: RAGService;

  constructor(config: ClaudeServiceConfig, ragService?: RAGService) {
    this.config = config;
    this.ragService = ragService;

    // Проверяем, что API ключ есть
    if (!config.apiKey || config.apiKey === 'your_claude_api_key_here') {
      Logger.warn('Claude API key not configured, insights will be disabled');
      this.anthropic = null;
      return;
    }

    try {
      this.anthropic = new Anthropic({
        apiKey: config.apiKey,
        dangerouslyAllowBrowser: true, // Разрешаем использование в Electron renderer
      });
    } catch (error) {
      const appError = new AppError(
        'Failed to initialize Anthropic client',
        'CLAUDE_INIT_ERROR',
        true, // Retriable
        { 
          originalError: error instanceof Error ? error.message : String(error),
          apiKey: config.apiKey ? 'configured' : 'missing'
        }
      );
      Logger.error('Failed to initialize Anthropic', { 
        error: appError.message,
        code: appError.code,
        context: appError.context
      });
      this.anthropic = null;
    }

    // System prompt based on requirements from hrpro.mdc
    this.systemPrompt = `You are an expert technical interviewer analyzing candidate responses in real-time.

CORE TASKS:
- Classify the current topic being discussed
- Score answer depth (0-1): 0=surface level, 1=expert depth
- Detect risk indicators: generic answers, lack of examples, inconsistencies
- Suggest 1-2 targeted follow-up questions
- Provide short actionable insights for HR

CRITICAL RULES:
- NEVER directly accuse of AI usage
- Only note indicators: "shallow", "generic", "no examples", "perfectly phrased but no details"
- Keep insights under 120 characters
- Output ONLY valid JSON
- Be neutral and professional
- Focus on technical depth and practical experience

RESPONSE FORMAT (strict JSON):
{
  "topic": "Current technical area discussed",
  "depth_score": 0.75,
  "signals": ["specific indicator 1", "indicator 2"],
  "followups": ["targeted question 1", "question 2"],
  "note": "Short insight for HR",
  "type": "strength|risk|question",
  "confidence": 0.85
}`;
  }

  async analyzeTranscript(request: AnalysisRequest): Promise<InsightResponse> {
    const analysisMeasurement = PerformanceMonitor.startLatencyMeasurement();
    try {
      // Enhance with RAG context if available
      let enhancedRequest = request;
      if (this.ragService && !request.ragContext) {
        try {
          const ragContext = await this.ragService.getRelevantContext(
            request.transcript,
            {
              types: ['job_description', 'resume'],
              maxTokens: 2000,
              topK: 3,
            }
          );
          enhancedRequest = { ...request, ragContext };

          Logger.info('Enhanced with RAG context', {
            relevantChunks: ragContext.relevantChunks.length,
            totalTokens: ragContext.totalTokens,
            avgRelevance: ragContext.retrievalMetadata.averageScore.toFixed(3),
          });
        } catch (ragError) {
          console.warn(
            '⚠️ RAG context retrieval failed, continuing without:',
            ragError
          );
        }
      }

      const userPrompt = this.buildUserPrompt(enhancedRequest);

      Logger.info('Sending to Claude Sonnet 4', {
        transcript_length: enhancedRequest.transcript.length,
        context_items: enhancedRequest.contextWindow.length,
        entities: enhancedRequest.entities.length,
        ragContext: !!enhancedRequest.ragContext,
      });

      // Проверяем, что Anthropic инициализирован
      if (!this.anthropic) {
        console.warn(
          '⚠️ [CLAUDE] Anthropic not initialized, skipping analysis'
        );
        return {
          note: 'Claude service not available',
          type: 'strength' as const,
          topic: 'Service unavailable',
          confidence: 0,
          depth_score: 0,
          signals: [],
          followups: [],
        };
      }

      const response = await this.anthropic.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: this.systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const analysis = JSON.parse(content.text) as InsightResponse;

      Logger.info('Claude analysis received', {
        topic: analysis.topic,
        depth_score: analysis.depth_score,
        type: analysis.type,
        confidence: analysis.confidence,
        withRAG: !!enhancedRequest.ragContext,
      });

      PerformanceMonitor.endLatencyMeasurement(analysisMeasurement, 'analysis');
      PerformanceMonitor.recordSuccess();
      return analysis;
    } catch (error) {
      console.error('❌ Claude analysis error:', error);
      PerformanceMonitor.endLatencyMeasurement(analysisMeasurement, 'analysis');
      PerformanceMonitor.recordError();

      // Fallback insight on error
      return {
        topic: 'Analysis Error',
        depth_score: 0,
        signals: ['API error occurred'],
        followups: [],
        note: 'AI analysis temporarily unavailable',
        type: 'risk',
        confidence: 0,
      };
    }
  }

  private buildUserPrompt(request: AnalysisRequest): string {
    let prompt = `ANALYZE THIS INTERVIEW SEGMENT:

CURRENT TRANSCRIPT:
"${request.transcript}"

CONTEXT WINDOW (last 15-40s):
${request.contextWindow.join(' ')}

TECHNICAL ENTITIES MENTIONED:
${request.entities.join(', ') || 'None yet'}

PREVIOUS TOPICS:
${request.topicHistory.join(', ') || 'None yet'}`;

    // Add RAG context if available
    if (request.ragContext && request.ragContext.relevantChunks.length > 0) {
      prompt += `

RELEVANT CONTEXT FROM DOCUMENTS:`;

      // Group chunks by document type
      const jobDescChunks = request.ragContext.relevantChunks.filter(
        (chunk: any) => chunk.source.type === 'job_description'
      );
      const resumeChunks = request.ragContext.relevantChunks.filter(
        (chunk: any) => chunk.source.type === 'resume'
      );

      if (jobDescChunks.length > 0) {
        prompt += `

JOB REQUIREMENTS (from job description):`;
        jobDescChunks.forEach((chunk: any, index: number) => {
          prompt += `
${index + 1}. ${chunk.content.substring(0, 500)}${chunk.content.length > 500 ? '...' : ''}`;
        });
      }

      if (resumeChunks.length > 0) {
        prompt += `

CANDIDATE BACKGROUND (from resume):`;
        resumeChunks.forEach((chunk: any, index: number) => {
          prompt += `
${index + 1}. ${chunk.content.substring(0, 500)}${chunk.content.length > 500 ? '...' : ''}`;
        });
      }

      // Add other document types if present
      const otherChunks = request.ragContext.relevantChunks.filter(
        (chunk: any) => !['job_description', 'resume'].includes(chunk.source.type)
      );
      if (otherChunks.length > 0) {
        prompt += `

ADDITIONAL CONTEXT:`;
        otherChunks.forEach((chunk: any, index: number) => {
          prompt += `
${index + 1}. [${chunk.source.type}] ${chunk.content.substring(0, 400)}${chunk.content.length > 400 ? '...' : ''}`;
        });
      }
    } else if (request.jobDescription) {
      // Fallback to legacy job description
      prompt += `

JOB REQUIREMENTS:
${request.jobDescription}`;
    }

    prompt += `

TASK: Using the context above, analyze the candidate's response for:
1. Alignment with job requirements
2. Technical depth and accuracy
3. Practical experience indicators
4. Areas needing deeper exploration

Consider both what the candidate said and how it matches the job requirements and their stated background.
OUTPUT: Valid JSON only (no markdown, no explanation).`;

    return prompt;
  }

  // Aggregate analysis for batch processing
  async analyzeConversation(
    fullTranscript: string,
    jobDescription?: string
  ): Promise<{
    summary: string;
    strengths: string[];
    risks: string[];
    scores: Record<string, number>;
    recommendations: string[];
  }> {
    const reportPrompt = `Analyze this complete interview transcript and generate a comprehensive report.

TRANSCRIPT:
${fullTranscript}

${jobDescription ? `JOB REQUIREMENTS:\n${jobDescription}\n` : ''}

Generate a structured analysis focusing on:
- Technical competency demonstrated
- Communication clarity
- Practical experience indicators
- Areas needing deeper exploration
- Overall assessment

Respond with valid JSON only.`;

    try {
      // Проверяем, что Anthropic инициализирован
      if (!this.anthropic) {
        console.warn(
          '⚠️ [CLAUDE] Anthropic not initialized, skipping report generation'
        );
        return {
          summary: 'Claude service not available',
          strengths: [],
          risks: [],
          scores: {},
          recommendations: ['Configure Claude API key to enable analysis'],
        };
      }

      const response = await this.anthropic.messages.create({
        model: this.config.model,
        max_tokens: 1000, // Больше токенов для полного отчета
        temperature: 0.2, // Более низкая температура для отчетов
        messages: [
          {
            role: 'user',
            content: reportPrompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      return JSON.parse(content.text);
    } catch (error) {
      console.error('Error generating conversation analysis:', error);
      throw error;
    }
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return this.anthropic !== null && !!this.config.apiKey;
  }

  /**
   * Get service configuration status
   */
  getConfigStatus(): {
    configured: boolean;
    model: string;
    maxTokens: number;
    temperature: number;
  } {
    return {
      configured: this.isConfigured(),
      model: this.config.model,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature
    };
  }
}

// Factory function
export const createClaudeService = (
  config: ClaudeServiceConfig,
  ragService?: RAGService
): ClaudeAnalysisService => {
  return new ClaudeAnalysisService(config, ragService);
};

// Context management for efficient analysis
export class AnalysisContext {
  private maxContextLength = 600; // ~15-40 seconds of words
  private maxEntities = 20;
  private maxTopics = 10;

  private contextWindow: string[] = [];
  private entities: string[] = [];
  private topicHistory: string[] = [];

  addTranscript(text: string): void {
    const words = text.split(' ');
    this.contextWindow.push(...words);

    // Keep only recent context
    if (this.contextWindow.length > this.maxContextLength) {
      this.contextWindow = this.contextWindow.slice(-this.maxContextLength);
    }

    // Extract potential technical entities (simple approach)
    const techTerms = this.extractTechTerms(text);
    this.entities.push(...techTerms);
    this.entities = [...new Set(this.entities)].slice(-this.maxEntities);
  }

  addTopic(topic: string): void {
    if (!this.topicHistory.includes(topic)) {
      this.topicHistory.push(topic);
      if (this.topicHistory.length > this.maxTopics) {
        this.topicHistory = this.topicHistory.slice(-this.maxTopics);
      }
    }
  }

  getContext(): {
    contextWindow: string[];
    entities: string[];
    topicHistory: string[];
  } {
    return {
      contextWindow: this.contextWindow,
      entities: this.entities,
      topicHistory: this.topicHistory,
    };
  }

  private extractTechTerms(text: string): string[] {
    // Simple regex-based extraction of potential technical terms
    const techPatterns = [
      /\b[A-Z][a-z]*[A-Z][a-zA-Z]*\b/g, // CamelCase terms
      /\b\w+\.(js|ts|py|java|go|rs)\b/g, // File extensions
      /\b(API|SDK|UI|UX|DB|SQL|REST|GraphQL|JWT|OAuth)\b/g, // Common tech acronyms
      /\b[a-z]+\-[a-z]+\b/g, // kebab-case terms
    ];

    const terms: string[] = [];
    techPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        terms.push(...matches);
      }
    });

    return [...new Set(terms)];
  }

  reset(): void {
    this.contextWindow = [];
    this.entities = [];
    this.topicHistory = [];
  }
}
