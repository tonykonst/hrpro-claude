import { describe, it, expect, vi } from 'vitest';
import { AppError, ErrorHandler } from './errors';

describe('AppError', () => {
  it('should create error with message and code', () => {
    const error = new AppError('Test error', 'TEST_ERROR');
    
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.name).toBe('AppError');
    expect(error.retriable).toBe(false);
    expect(error.context).toBeUndefined();
  });

  it('should create error with all properties', () => {
    const context = { userId: 123, action: 'test' };
    const error = new AppError('Test error', 'TEST_ERROR', true, context);
    
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.retriable).toBe(true);
    expect(error.context).toEqual(context);
  });

  it('should be instance of Error', () => {
    const error = new AppError('Test error', 'TEST_ERROR');
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });
});

describe('ErrorHandler', () => {
  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await ErrorHandler.withRetry(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValue('success');
      
      const result = await ErrorHandler.withRetry(operation, 3, 10);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Persistent failure'));
      
      await expect(ErrorHandler.withRetry(operation, 2, 10))
        .rejects.toThrow('Persistent failure');
      
      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should use exponential backoff', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Failure'));
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
      
      try {
        await ErrorHandler.withRetry(operation, 2, 100);
      } catch (error) {
        // Expected to fail
      }
      
      // Check that setTimeout was called with increasing delays
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100); // First retry
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 200); // Second retry (100 * 2^1)
    });

    it('should use default parameters', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Failure'));
      
      await expect(ErrorHandler.withRetry(operation, 1, 10))
        .rejects.toThrow('Failure');
      
      expect(operation).toHaveBeenCalledTimes(2); // Initial + 1 retry
    }, 10000);
  });
});
