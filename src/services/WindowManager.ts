/**
 * WindowManager - Централизованное управление окнами приложения
 *
 * Принципы:
 * - Единый источник истины для всех окон
 * - Реактивное управление жизненным циклом
 * - Безопасная IPC связь
 * - Автоматическая очистка ресурсов
 */

import { EventEmitter } from 'events';

// Типы для electronAPI
declare global {
  interface Window {
    electronAPI: {
      createDataWindow: () => Promise<any>;
      closeDataWindow: () => Promise<any>;
      getConfig: () => Promise<any>;
      sendTranscript: (data: any) => Promise<any>;
      sendInsights: (data: any) => Promise<any>;
      sendRecordingState: (data: any) => Promise<any>;
      onTranscriptUpdate: (callback: (data: any) => void) => void;
      onInsightsUpdate: (callback: (data: any) => void) => void;
      onRecordingStateChange: (callback: (data: any) => void) => void;
      onWindowCreated: (callback: (windowId: string) => void) => void;
      onWindowClosed: (callback: (windowId: string) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}

export interface WindowState {
  isVisible: boolean;
  isRecording: boolean;
  hasData: boolean;
}

export interface WindowConfig {
  id: string;
  type: 'control' | 'data';
  title: string;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  frame?: boolean;
  transparent?: boolean;
  alwaysOnTop?: boolean;
  skipTaskbar?: boolean;
  resizable?: boolean;
}

export class WindowManager extends EventEmitter {
  private static instance: WindowManager;
  private windows: Map<string, any> = new Map();
  private windowStates: Map<string, WindowState> = new Map();
  private recordingState: boolean = false;

  private constructor() {
    super();
    this.setupEventHandlers();
  }

  public static getInstance(): WindowManager {
    if (!WindowManager.instance) {
      WindowManager.instance = new WindowManager();
    }
    return WindowManager.instance;
  }

  /**
   * Создать окно с данными
   */
  public async createDataWindow(): Promise<void> {
    try {
      if (this.windows.has('data')) {
        console.log('📱 [WindowManager] Data window already exists');
        return;
      }

      console.log('📱 [WindowManager] Creating data window...');

      // Отправляем запрос на создание окна в main процесс
      if (window.electronAPI) {
        console.log(
          '📡 [WindowManager] Using electronAPI to create data window'
        );
        const result = await window.electronAPI.createDataWindow();
        console.log('📡 [WindowManager] Create data window result:', result);

        // Устанавливаем начальное состояние
        this.windowStates.set('data', {
          isVisible: true,
          isRecording: this.recordingState,
          hasData: false,
        });

        this.emit('window-created', 'data');
        console.log('✅ [WindowManager] Data window created successfully');
      } else {
        console.error('❌ [WindowManager] electronAPI not available');
        throw new Error('electronAPI not available');
      }
    } catch (error) {
      console.error('❌ [WindowManager] Failed to create data window:', error);
      this.emit('error', error);
    }
  }

  /**
   * Скрыть окно с данными (НЕ закрывать!)
   */
  public async closeDataWindow(): Promise<void> {
    try {
      if (!this.windows.has('data')) {
        console.log('📱 [WindowManager] Data window does not exist');
        return;
      }

      console.log('👁️ [WindowManager] Hiding data window...');

      if (window.electronAPI) {
        console.log('📡 [WindowManager] Using electronAPI to hide data window');
        await window.electronAPI.closeDataWindow(); // ← Теперь это скрывает окно!

        // НЕ удаляем из windows - окно остается живым!
        // this.windows.delete('data');
        // this.windowStates.delete('data');

        this.emit('window-closed', 'data');
        console.log('✅ [WindowManager] Data window hidden successfully');
      } else {
        console.error('❌ [WindowManager] electronAPI not available');
        throw new Error('electronAPI not available');
      }
    } catch (error) {
      console.error('❌ [WindowManager] Failed to close data window:', error);
      this.emit('error', error);
    }
  }

  /**
   * Обновить состояние записи
   */
  public setRecordingState(isRecording: boolean): void {
    const previousState = this.recordingState;
    this.recordingState = isRecording;

    console.log(
      `🎤 [WindowManager] Recording state changed: ${previousState} → ${isRecording}`
    );

    // Обновляем состояние всех окон
    this.windowStates.forEach((state, windowId) => {
      state.isRecording = isRecording;
      this.windowStates.set(windowId, state);
    });

    this.emit('recording-state-changed', isRecording);

    // Автоматически управляем окном данных
    this.handleDataWindowLifecycle(isRecording);
  }

  /**
   * Автоматическое управление жизненным циклом окна данных
   */
  private async handleDataWindowLifecycle(isRecording: boolean): Promise<void> {
    if (isRecording) {
      // Начинаем запись - создаем окно если его нет
      if (!this.windows.has('data')) {
        await this.createDataWindow();
      }
    } else {
      // Останавливаем запись - скрываем окно вместо закрытия
      if (this.windows.has('data')) {
        console.log('📱 [WindowManager] Hiding data window instead of closing');
        await this.closeDataWindow(); // ← Теперь это скрывает окно, а не закрывает!
      }
    }
  }

  /**
   * Получить состояние окна
   */
  public getWindowState(windowId: string): WindowState | undefined {
    return this.windowStates.get(windowId);
  }

  /**
   * Получить состояние записи
   */
  public getRecordingState(): boolean {
    return this.recordingState;
  }

  /**
   * Проверить, существует ли окно
   */
  public hasWindow(windowId: string): boolean {
    return this.windows.has(windowId);
  }

  /**
   * Настройка обработчиков событий
   */
  private setupEventHandlers(): void {
    // Слушаем события от main процесса
    if (window.electronAPI) {
      // Окно создано
      const handleWindowCreated = (windowId: string) => {
        this.windows.set(windowId, { id: windowId });
        console.log(`📱 [WindowManager] Window ${windowId} registered`);
      };

      // Окно закрыто
      const handleWindowClosed = (windowId: string) => {
        this.windows.delete(windowId);
        this.windowStates.delete(windowId);
        console.log(`📱 [WindowManager] Window ${windowId} unregistered`);
      };

      // Регистрируем слушатели через electronAPI
      window.electronAPI.onWindowCreated(handleWindowCreated);
      window.electronAPI.onWindowClosed(handleWindowClosed);
    }
  }

  /**
   * Очистка ресурсов
   */
  public cleanup(): void {
    this.windows.clear();
    this.windowStates.clear();
    this.removeAllListeners();
    console.log('🧹 [WindowManager] Cleanup completed');
  }
}

// Экспортируем singleton
export const windowManager = WindowManager.getInstance();
