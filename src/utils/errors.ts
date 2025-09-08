/**
 * Structured error handling for the Interview Assistant application
 *
 * Provides AppError class for structured errors and ErrorHandler for retry logic
 * following the architectural principles from hrpro.mdc
 */

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public retriable: boolean = false,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ErrorHandler {
  /**
   * Retry operation with exponential backoff
   *
   * @param operation - Function to retry
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   * @param delay - Initial delay in milliseconds (default: 1000)
   * @returns Promise with operation result
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) break;

        const waitTime = delay * Math.pow(2, attempt); // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    throw lastError!;
  }
}
