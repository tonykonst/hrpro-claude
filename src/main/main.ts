import { app, systemPreferences } from 'electron';
import { config } from 'dotenv';
import { WindowManager } from './windows/WindowManager';
import { OverlayWindowManager } from './windows/OverlayWindowManager';
import { IPCHandlers } from './ipc/IPCHandlers';
import { AppLifecycle } from './lifecycle/AppLifecycle';
import { Logger } from '../utils/logger';

// Загружаем переменные окружения из .env файла
config();

/**
 * Main Electron process entry point
 *
 * This file coordinates the application initialization and manages
 * the main process lifecycle.
 */
class MainProcess {
  private windowManager: WindowManager;
  private overlayWindowManager: OverlayWindowManager;
  private ipcHandlers: IPCHandlers;
  private appLifecycle: AppLifecycle;

  constructor() {
    this.windowManager = new WindowManager();
    this.overlayWindowManager = new OverlayWindowManager();
    this.ipcHandlers = new IPCHandlers(this.windowManager);
    this.appLifecycle = new AppLifecycle(this.windowManager);
  }

  /**
   * Request media access permissions on macOS
   */
  private async requestMediaPermissions(): Promise<void> {
    if (process.platform === 'darwin') {
      try {
        Logger.info('Requesting microphone permission on macOS');
        const micAccess = await systemPreferences.askForMediaAccess('microphone');
        
        if (micAccess) {
          Logger.info('Microphone access granted');
        } else {
          Logger.warn('Microphone access denied');
        }
      } catch (error) {
        Logger.error('Error requesting media permissions', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    Logger.info('Starting Interview Assistant...');

    // Request media permissions on macOS
    await this.requestMediaPermissions();

    // Setup application lifecycle
    this.appLifecycle.setup();

    // Setup IPC handlers
    this.ipcHandlers.setup();

    // Create control panel window
    this.createControlPanelWindow();

    // Create native audio overlay (if enabled)
    this.createNativeAudioOverlay();

    Logger.info('Application initialized successfully');
  }

  /**
   * Create and setup control panel window
   */
  private createControlPanelWindow(): void {
    const controlPanelWindow = this.windowManager.createControlPanelWindow();

    // DevTools для отладки в development режиме
    if (process.env.NODE_ENV === 'development') {
      controlPanelWindow.webContents.once('did-finish-load', () => {
        Logger.debug('Opening DevTools for control panel');
        controlPanelWindow.webContents.openDevTools({ mode: 'detach' });
      });
    }

    // Обработка создания data window
    controlPanelWindow.webContents.on('did-finish-load', () => {
      Logger.info('Control panel loaded');
    });
  }

  /**
   * Create native audio overlay window
   */
  private createNativeAudioOverlay(): void {
    try {
      const overlayWindow = this.overlayWindowManager.createNativeAudioOverlay();
      
      // DevTools для отладки в development режиме
      if (process.env.NODE_ENV === 'development') {
        overlayWindow.webContents.once('did-finish-load', () => {
          Logger.debug('Opening DevTools for native audio overlay');
          overlayWindow.webContents.openDevTools({ mode: 'detach' });
        });
      }

      // Обработка загрузки overlay
      overlayWindow.webContents.on('did-finish-load', () => {
        Logger.info('Native audio overlay loaded');
      });

      Logger.info('Native audio overlay created successfully');
      
    } catch (error) {
      Logger.error('Failed to create native audio overlay', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    Logger.info('Cleaning up resources...');
    this.overlayWindowManager.destroy();
    this.appLifecycle.cleanup();
  }
}

// Создаем экземпляр главного процесса
const mainProcess = new MainProcess();

// Обработка необработанных исключений
process.on('uncaughtException', error => {
  Logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  mainProcess.cleanup();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  Logger.error('Unhandled Rejection', { reason, promise });
  mainProcess.cleanup();
  process.exit(1);
});

// Инициализация приложения когда Electron готов
app.whenReady().then(async () => {
  try {
    await mainProcess.initialize();
  } catch (error) {
    Logger.error('Failed to initialize application', {
      error: error instanceof Error ? error.message : String(error),
    });
    app.quit();
  }
});

// Cleanup при завершении
app.on('before-quit', () => {
  mainProcess.cleanup();
});