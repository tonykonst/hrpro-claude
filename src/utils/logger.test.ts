import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger } from './logger';

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('log method', () => {
    it('should log with correct structure', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      Logger.info('Test message', { test: 'data' });
      
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry).toMatchObject({
        level: 'info',
        message: 'Test message',
        context: { test: 'data' },
        sessionId: expect.any(String),
        service: expect.any(String),
        timestamp: expect.any(String)
      });
    });

    it('should sanitize sensitive data', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      Logger.info('Test message', { 
        apiKey: 'secret123',
        password: 'password123',
        normalData: 'safe'
      });
      
      const logCall = consoleSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry.context).toEqual({
        normalData: 'safe'
      });
      expect(logEntry.context.apiKey).toBeUndefined();
      expect(logEntry.context.password).toBeUndefined();
    });
  });

  describe('log levels', () => {
    it('should log debug messages', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      Logger.debug('Debug message');
      
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry.level).toBe('debug');
      expect(logEntry.message).toBe('Debug message');
    });

    it('should log info messages', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      Logger.info('Info message');
      
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry.level).toBe('info');
      expect(logEntry.message).toBe('Info message');
    });

    it('should log warning messages', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      Logger.warn('Warning message');
      
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry.level).toBe('warn');
      expect(logEntry.message).toBe('Warning message');
    });

    it('should log error messages', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      Logger.error('Error message');
      
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry.level).toBe('error');
      expect(logEntry.message).toBe('Error message');
    });
  });

  describe('service detection', () => {
    it('should detect service from stack trace', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      Logger.info('Test message');
      
      const logCall = consoleSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry.service).toBeDefined();
      expect(typeof logEntry.service).toBe('string');
    });
  });
});
