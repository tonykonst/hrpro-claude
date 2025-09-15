import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Electron APIs for testing
(global as any).electronAPI = {
  sendMessage: vi.fn(),
  onMessage: vi.fn(),
  getEnv: vi.fn()
};

// Mock window.hideLoadingScreen
(global as any).window = {
  ...global.window,
  hideLoadingScreen: vi.fn()
};

// Mock console methods to avoid noise in tests
(global as any).console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn()
};
