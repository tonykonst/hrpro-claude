import { ipcMain, BrowserWindow, desktopCapturer } from 'electron';
import { createNativeAudioCapture } from '../../native/audio';

/**
 * IPC handlers for communication between main and renderer processes
 * 
 * @example
 * ```tsx
 * const ipcHandlers = new IPCHandlers(windowManager);
 * ipcHandlers.setup();
 * ```
 */
export class IPCHandlers {
  private windowManager: any; // WindowManager type
  private pendingTranscriptData: any[] = [];
  private pendingInsightsData: any[] = [];
  private pendingRecordingStateData: any[] = [];
  private nativeAudioCapture: any = null;

  constructor(windowManager: any) {
    this.windowManager = windowManager;
  }

  /**
   * Setup all IPC handlers
   */
  setup(): void {
    this.setupWindowHandlers();
    this.setupDataHandlers();
    this.setupNativeAudioHandlers();
    this.setupDesktopCapturerHandlers();
  }

  /**
   * Setup window management handlers
   */
  private setupWindowHandlers(): void {
    // Создать окно с данными
    ipcMain.handle('create-data-window', () => {
      try {
        const dataWindow = this.windowManager.createDataWindow();
        
        // Обрабатываем очередь данных после создания окна
        this.processPendingData();
        
        const controlPanelWindow = this.windowManager.getControlPanelWindow();
        if (controlPanelWindow) {
          controlPanelWindow.webContents.send('window-created', 'data');
        }
        return { success: true, message: 'Data window creation initiated' };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // Закрыть окно с данными
    ipcMain.handle('close-data-window', () => {
      try {
        const dataWindow = this.windowManager.getDataWindow();
        if (dataWindow && !dataWindow.isDestroyed()) {
          dataWindow.close();
        }
        return { success: true, message: 'Data window closed' };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * Setup data transmission handlers
   */
  private setupDataHandlers(): void {
    // Передать транскрипт в окно данных
    ipcMain.handle('send-transcript', (event, data) => {
      const dataWindow = this.windowManager.getDataWindow();
      if (dataWindow && !dataWindow.isDestroyed()) {
        dataWindow.webContents.send('transcript-update', data);
      } else {
        this.pendingTranscriptData.push(data); // Добавляем в очередь
      }
    });

    // Передать инсайты в окно данных
    ipcMain.handle('send-insights', (event, insights) => {
      const dataWindow = this.windowManager.getDataWindow();
      if (dataWindow && !dataWindow.isDestroyed()) {
        dataWindow.webContents.send('insights-update', insights);
      } else {
        this.pendingInsightsData.push(insights);
      }
    });

    // Передать состояние записи в окно данных
    ipcMain.handle('send-recording-state', (event, data) => {
      const dataWindow = this.windowManager.getDataWindow();
      if (dataWindow && !dataWindow.isDestroyed()) {
        dataWindow.webContents.send('recording-state-change', data);
      } else {
        this.pendingRecordingStateData.push(data);
      }
    });
  }

  /**
   * Process pending data when data window is created
   */
  processPendingData(): void {
    const dataWindow = this.windowManager.getDataWindow();
    if (!dataWindow || dataWindow.isDestroyed()) return;

    // Отправляем накопленные данные транскрипции
    this.pendingTranscriptData.forEach(data => {
      dataWindow.webContents.send('transcript-update', data);
    });
    this.pendingTranscriptData = [];

    // Отправляем накопленные данные инсайтов
    this.pendingInsightsData.forEach(data => {
      dataWindow.webContents.send('insights-update', data);
    });
    this.pendingInsightsData = [];

    // Отправляем накопленные данные состояния записи
    this.pendingRecordingStateData.forEach(data => {
      dataWindow.webContents.send('recording-state-change', data);
    });
    this.pendingRecordingStateData = [];
  }

  /**
   * Setup native audio handlers
   */
  private setupNativeAudioHandlers(): void {
    // Initialize native audio capture
    ipcMain.handle('native-audio-init', async () => {
      try {
        this.nativeAudioCapture = createNativeAudioCapture();
        
        // Forward events to renderer
        this.nativeAudioCapture.on('data', (audioData: any) => {
          const allWindows = BrowserWindow.getAllWindows();
          allWindows.forEach(window => {
            window.webContents.send('native-audio-data', audioData);
          });
        });

        this.nativeAudioCapture.on('started', () => {
          const allWindows = BrowserWindow.getAllWindows();
          allWindows.forEach(window => {
            window.webContents.send('native-audio-started');
          });
        });

        this.nativeAudioCapture.on('stopped', () => {
          const allWindows = BrowserWindow.getAllWindows();
          allWindows.forEach(window => {
            window.webContents.send('native-audio-stopped');
          });
        });

        this.nativeAudioCapture.on('error', (error: Error) => {
          const allWindows = BrowserWindow.getAllWindows();
          allWindows.forEach(window => {
            window.webContents.send('native-audio-error', error.message);
          });
        });

        return { success: true };
      } catch (error) {
        console.error('Failed to initialize native audio:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Start capture
    ipcMain.handle('native-audio-start', async () => {
      try {
        if (!this.nativeAudioCapture) {
          throw new Error('Native audio not initialized');
        }
        const success = await this.nativeAudioCapture.startCapture();
        return { success };
      } catch (error) {
        console.error('Failed to start native audio:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Stop capture
    ipcMain.handle('native-audio-stop', async () => {
      try {
        if (!this.nativeAudioCapture) {
          return { success: true };
        }
        const success = await this.nativeAudioCapture.stopCapture();
        return { success };
      } catch (error) {
        console.error('Failed to stop native audio:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Get device info
    ipcMain.handle('native-audio-device-info', async () => {
      try {
        if (!this.nativeAudioCapture) {
          throw new Error('Native audio not initialized');
        }
        const deviceInfo = this.nativeAudioCapture.getDeviceInfo();
        return { success: true, deviceInfo };
      } catch (error) {
        console.error('Failed to get device info:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Check if capturing
    ipcMain.handle('native-audio-is-capturing', async () => {
      try {
        if (!this.nativeAudioCapture) {
          return { success: true, isCapturing: false };
        }
        const isCapturing = this.nativeAudioCapture.isCurrentlyCapturing();
        return { success: true, isCapturing };
      } catch (error) {
        console.error('Failed to check capture status:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });
  }

  /**
   * Setup desktop capturer handlers (OFFICIAL Electron API)
   */
  private setupDesktopCapturerHandlers(): void {
    // Get available sources for screen/window capture
    ipcMain.handle('desktop-capturer-get-sources', async (event, options) => {
      try {
        const sources = await desktopCapturer.getSources({
          types: options.types || ['screen', 'window'],
          thumbnailSize: options.thumbnailSize || { width: 150, height: 150 },
          fetchWindowIcons: options.fetchWindowIcons || false
        });

        return sources.map(source => ({
          id: source.id,
          name: source.name,
          thumbnail: source.thumbnail.toDataURL()
        }));
      } catch (error) {
        console.error('Failed to get desktop capturer sources:', error);
        return [];
      }
    });
  }
}
