/**
 * Memory management system for long-running sessions
 *
 * Prevents memory leaks by limiting buffer sizes and cleaning old data
 * following the architectural principles from hrpro.mdc
 */

import { Logger } from './logger';
import { configService } from '../services/config';

export interface Insight {
  id: string;
  timestamp: number;
  content: string;
}

export interface MemoryStats {
  maxTranscriptWords: number;
  maxInsightsHistory: number;
  maxAudioBufferSize: number;
}

export interface CleanupResult {
  cleanedTranscript: string[];
  cleanedInsights: Insight[];
  removedCount: { transcript: number; insights: number };
}

export class MemoryManager {
  private static readonly MAX_TRANSCRIPT_WORDS = 1000;
  private static readonly MAX_INSIGHTS_HISTORY = 50;
  
  /**
   * Получить максимальный размер аудио буфера из конфигурации
   */
  private static getMaxAudioBufferSize(): number {
    return configService.getAudioBufferConfig().maxBufferSize;
  }

  /**
   * Clean old data to prevent memory leaks
   *
   * @param transcript - Array of transcript words
   * @param insights - Array of insights
   * @returns Cleaned data and removal statistics
   */
  static cleanupOldData(
    transcript: string[],
    insights: Insight[]
  ): CleanupResult {
    const originalTranscriptLength = transcript.length;
    const originalInsightsLength = insights.length;

    // Clean transcript
    let cleanedTranscript = transcript;
    if (transcript.length > this.MAX_TRANSCRIPT_WORDS) {
      cleanedTranscript = transcript.slice(-this.MAX_TRANSCRIPT_WORDS);
      Logger.info('Transcript cleaned', {
        originalLength: originalTranscriptLength,
        newLength: cleanedTranscript.length,
        removed: originalTranscriptLength - cleanedTranscript.length,
      });
    }

    // Clean insights
    let cleanedInsights = insights;
    if (insights.length > this.MAX_INSIGHTS_HISTORY) {
      cleanedInsights = insights.slice(-this.MAX_INSIGHTS_HISTORY);
      Logger.info('Insights cleaned', {
        originalLength: originalInsightsLength,
        newLength: cleanedInsights.length,
        removed: originalInsightsLength - cleanedInsights.length,
      });
    }

    return {
      cleanedTranscript,
      cleanedInsights,
      removedCount: {
        transcript: originalTranscriptLength - cleanedTranscript.length,
        insights: originalInsightsLength - cleanedInsights.length,
      },
    };
  }

  /**
   * Get memory management configuration
   */
  static getMemoryStats(): MemoryStats {
    return {
      maxTranscriptWords: this.MAX_TRANSCRIPT_WORDS,
      maxInsightsHistory: this.MAX_INSIGHTS_HISTORY,
      maxAudioBufferSize: this.getMaxAudioBufferSize(),
    };
  }

  /**
   * Check if cleanup is needed
   */
  static needsCleanup(transcript: string[], insights: Insight[]): boolean {
    return (
      transcript.length > this.MAX_TRANSCRIPT_WORDS ||
      insights.length > this.MAX_INSIGHTS_HISTORY
    );
  }

  /**
   * Get current memory usage estimate
   */
  static getMemoryUsageEstimate(
    transcript: string[],
    insights: Insight[]
  ): {
    transcriptWords: number;
    insightsCount: number;
    estimatedSizeKB: number;
  } {
    const transcriptSize = transcript.join(' ').length * 2; // Rough estimate: 2 bytes per char
    const insightsSize = insights.reduce((total, insight) => {
      return total + insight.content.length * 2 + 50; // 50 bytes overhead per insight
    }, 0);

    const totalSizeBytes = transcriptSize + insightsSize;

    return {
      transcriptWords: transcript.length,
      insightsCount: insights.length,
      estimatedSizeKB: Math.round(totalSizeBytes / 1024),
    };
  }
}
