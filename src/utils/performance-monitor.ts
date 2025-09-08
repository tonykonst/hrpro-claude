/**
 * Performance Monitor for Interview Assistant
 * 
 * Tracks critical performance metrics for long-running sessions:
 * - Audio processing latency
 * - Transcription latency  
 * - AI analysis latency
 * - Memory usage
 * - Error rates
 * - Session duration
 */

import { Logger } from './logger';

export interface PerformanceMetrics {
  audioLatency: number;
  transcriptionLatency: number;
  analysisLatency: number;
  memoryUsage: number;
  errorRate: number;
  sessionDuration: number;
  totalOperations: number;
  successRate: number;
}

export interface LatencyMeasurement {
  startTime: number;
  endTime: number;
  duration: number;
}

export class PerformanceMonitor {
  private static metrics: PerformanceMetrics = {
    audioLatency: 0,
    transcriptionLatency: 0,
    analysisLatency: 0,
    memoryUsage: 0,
    errorRate: 0,
    sessionDuration: 0,
    totalOperations: 0,
    successRate: 0
  };
  
  private static sessionStartTime = Date.now();
  private static errorCount = 0;
  private static totalOperations = 0;
  private static latencyMeasurements: {
    audio: number[];
    transcription: number[];
    analysis: number[];
  } = {
    audio: [],
    transcription: [],
    analysis: []
  };
  
  // Maximum number of latency samples to keep for averaging
  private static readonly MAX_SAMPLES = 100;
  
  /**
   * Record audio processing latency
   */
  static recordAudioLatency(latency: number): void {
    this.addLatencySample('audio', latency);
    this.metrics.audioLatency = this.calculateAverageLatency('audio');
    Logger.debug('Audio latency recorded', { 
      latency, 
      average: this.metrics.audioLatency,
      samples: this.latencyMeasurements.audio.length
    });
  }
  
  /**
   * Record transcription latency
   */
  static recordTranscriptionLatency(latency: number): void {
    this.addLatencySample('transcription', latency);
    this.metrics.transcriptionLatency = this.calculateAverageLatency('transcription');
    Logger.debug('Transcription latency recorded', { 
      latency, 
      average: this.metrics.transcriptionLatency,
      samples: this.latencyMeasurements.transcription.length
    });
  }
  
  /**
   * Record AI analysis latency
   */
  static recordAnalysisLatency(latency: number): void {
    this.addLatencySample('analysis', latency);
    this.metrics.analysisLatency = this.calculateAverageLatency('analysis');
    Logger.debug('Analysis latency recorded', { 
      latency, 
      average: this.metrics.analysisLatency,
      samples: this.latencyMeasurements.analysis.length
    });
  }
  
  /**
   * Record an error occurrence
   */
  static recordError(): void {
    this.errorCount++;
    this.totalOperations++;
    this.updateErrorMetrics();
    Logger.warn('Error recorded', { 
      errorRate: this.metrics.errorRate,
      totalErrors: this.errorCount,
      totalOperations: this.totalOperations
    });
  }
  
  /**
   * Record a successful operation
   */
  static recordSuccess(): void {
    this.totalOperations++;
    this.updateErrorMetrics();
    Logger.debug('Success recorded', { 
      successRate: this.metrics.successRate,
      totalOperations: this.totalOperations
    });
  }
  
  /**
   * Get current performance metrics
   */
  static getMetrics(): PerformanceMetrics {
    this.metrics.sessionDuration = Date.now() - this.sessionStartTime;
    this.metrics.memoryUsage = this.getMemoryUsage();
    this.metrics.totalOperations = this.totalOperations;
    
    return { ...this.metrics };
  }
  
  /**
   * Log current performance metrics
   */
  static logMetrics(): void {
    const metrics = this.getMetrics();
    Logger.info('Performance metrics summary', {
      sessionDuration: `${Math.round(metrics.sessionDuration / 1000)}s`,
      audioLatency: `${metrics.audioLatency.toFixed(2)}ms`,
      transcriptionLatency: `${metrics.transcriptionLatency.toFixed(2)}ms`,
      analysisLatency: `${metrics.analysisLatency.toFixed(2)}ms`,
      memoryUsage: `${Math.round(metrics.memoryUsage / 1024 / 1024)}MB`,
      errorRate: `${(metrics.errorRate * 100).toFixed(2)}%`,
      successRate: `${(metrics.successRate * 100).toFixed(2)}%`,
      totalOperations: metrics.totalOperations
    });
  }
  
  /**
   * Check if performance is within acceptable limits
   */
  static checkPerformanceHealth(): {
    isHealthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const metrics = this.getMetrics();
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check latency thresholds
    if (metrics.audioLatency > 100) {
      issues.push(`High audio latency: ${metrics.audioLatency.toFixed(2)}ms`);
      recommendations.push('Consider reducing audio buffer size');
    }
    
    if (metrics.transcriptionLatency > 2000) {
      issues.push(`High transcription latency: ${metrics.transcriptionLatency.toFixed(2)}ms`);
      recommendations.push('Check Deepgram connection and network');
    }
    
    if (metrics.analysisLatency > 5000) {
      issues.push(`High analysis latency: ${metrics.analysisLatency.toFixed(2)}ms`);
      recommendations.push('Consider reducing context window size');
    }
    
    // Check error rate
    if (metrics.errorRate > 0.1) { // 10% error rate
      issues.push(`High error rate: ${(metrics.errorRate * 100).toFixed(2)}%`);
      recommendations.push('Investigate API connectivity and rate limits');
    }
    
    // Check memory usage
    if (metrics.memoryUsage > 500 * 1024 * 1024) { // 500MB
      issues.push(`High memory usage: ${Math.round(metrics.memoryUsage / 1024 / 1024)}MB`);
      recommendations.push('Trigger memory cleanup or restart session');
    }
    
    // Check session duration for long sessions
    if (metrics.sessionDuration > 3 * 60 * 60 * 1000) { // 3 hours
      recommendations.push('Long session detected - consider memory cleanup');
    }
    
    return {
      isHealthy: issues.length === 0,
      issues,
      recommendations
    };
  }
  
  /**
   * Reset all metrics (for new session)
   */
  static reset(): void {
    this.sessionStartTime = Date.now();
    this.errorCount = 0;
    this.totalOperations = 0;
    this.latencyMeasurements = {
      audio: [],
      transcription: [],
      analysis: []
    };
    this.metrics = {
      audioLatency: 0,
      transcriptionLatency: 0,
      analysisLatency: 0,
      memoryUsage: 0,
      errorRate: 0,
      sessionDuration: 0,
      totalOperations: 0,
      successRate: 0
    };
    Logger.info('Performance metrics reset for new session');
  }
  
  /**
   * Start a latency measurement
   */
  static startLatencyMeasurement(): LatencyMeasurement {
    return {
      startTime: performance.now(),
      endTime: 0,
      duration: 0
    };
  }
  
  /**
   * End a latency measurement and record it
   */
  static endLatencyMeasurement(
    measurement: LatencyMeasurement, 
    type: 'audio' | 'transcription' | 'analysis'
  ): number {
    measurement.endTime = performance.now();
    measurement.duration = measurement.endTime - measurement.startTime;
    
    this.recordLatency(type, measurement.duration);
    return measurement.duration;
  }
  
  private static addLatencySample(type: 'audio' | 'transcription' | 'analysis', latency: number): void {
    this.latencyMeasurements[type].push(latency);
    
    // Keep only the most recent samples
    if (this.latencyMeasurements[type].length > this.MAX_SAMPLES) {
      this.latencyMeasurements[type].shift();
    }
  }
  
  private static calculateAverageLatency(type: 'audio' | 'transcription' | 'analysis'): number {
    const samples = this.latencyMeasurements[type];
    if (samples.length === 0) return 0;
    
    const sum = samples.reduce((acc, sample) => acc + sample, 0);
    return sum / samples.length;
  }
  
  private static updateErrorMetrics(): void {
    this.metrics.errorRate = this.totalOperations > 0 ? this.errorCount / this.totalOperations : 0;
    this.metrics.successRate = this.totalOperations > 0 ? (this.totalOperations - this.errorCount) / this.totalOperations : 1;
  }
  
  private static getMemoryUsage(): number {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }
  
  private static recordLatency(type: 'audio' | 'transcription' | 'analysis', duration: number): void {
    switch (type) {
      case 'audio':
        this.recordAudioLatency(duration);
        break;
      case 'transcription':
        this.recordTranscriptionLatency(duration);
        break;
      case 'analysis':
        this.recordAnalysisLatency(duration);
        break;
    }
  }
}
