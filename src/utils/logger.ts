/**
 * Structured logging system for the Interview Assistant application
 *
 * Provides JSON-formatted logs with context sanitization and service detection
 * following the architectural principles from hrpro.mdc
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  context?: Record<string, any>;
  sessionId?: string;
}

export class Logger {
  private static sessionId = `session_${Date.now()}`;

  /**
   * Log a message with structured format
   *
   * @param level - Log level
   * @param message - Log message
   * @param context - Additional context data
   */
  static log(level: LogLevel, message: string, context?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.getServiceName(),
      message,
      context: this.sanitizeContext(context),
      sessionId: this.sessionId,
    };

    console.log(JSON.stringify(entry));
  }

  /**
   * Log debug message
   */
  static debug(message: string, context?: any): void {
    this.log('debug', message, context);
  }

  /**
   * Log info message
   */
  static info(message: string, context?: any): void {
    this.log('info', message, context);
  }

  /**
   * Log warning message
   */
  static warn(message: string, context?: any): void {
    this.log('warn', message, context);
  }

  /**
   * Log error message
   */
  static error(message: string, context?: any): void {
    this.log('error', message, context);
  }

  /**
   * Detect service name from stack trace
   */
  private static getServiceName(): string {
    try {
      const stack = new Error().stack || '';
      if (stack.includes('deepgram')) return 'deepgram';
      if (stack.includes('claude')) return 'claude';
      if (stack.includes('config')) return 'config';
      if (stack.includes('transcription')) return 'transcription';
      if (stack.includes('main')) return 'main';
      if (stack.includes('preload')) return 'preload';
      return 'app';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Sanitize context data to remove sensitive information
   */
  private static sanitizeContext(context: any): any {
    if (!context) return undefined;

    try {
      // Create a copy to avoid modifying original
      const sanitized = { ...context };

      // Remove potentially sensitive data
      delete sanitized.apiKey;
      delete sanitized.password;
      delete sanitized.token;
      delete sanitized.secret;
      delete sanitized.key;

      // Sanitize nested objects
      Object.keys(sanitized).forEach(key => {
        if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
          sanitized[key] = this.sanitizeContext(sanitized[key]);
        }
      });

      return sanitized;
    } catch {
      return { error: 'Failed to sanitize context' };
    }
  }
}
