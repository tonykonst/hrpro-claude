import { BrowserWindow, screen, ipcMain } from 'electron';
import * as path from 'path';

/**
 * Overlay window manager for native audio capture interface (v0.54)
 * Creates transparent, always-on-top windows for native audio capture
 * 
 * @example
 * ```tsx
 * const overlayManager = new OverlayWindowManager();
 * overlayManager.createNativeAudioOverlay();
 * ```
 */
export class OverlayWindowManager {
  private nativeAudioOverlay: BrowserWindow | null = null;
  private clickThroughEnabled: boolean = false;

  constructor() {
    this.setupIPC();
  }

  /**
   * Create native audio capture overlay window
   */
  createNativeAudioOverlay(): BrowserWindow {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    
    const windowOptions = {
      width: 300,
      height: 80,
      minWidth: 200,
      minHeight: 60,
      maxWidth: 500,
      maxHeight: 120,
      useContentSize: true,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: true,
      movable: true,
      minimizable: false,
      maximizable: false,
      closable: false,
      focusable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false,
        enableRemoteModule: false,
        webSecurity: true,
        preload: path.join(__dirname, '..', '..', 'preload', 'preload.js')
      }
    };

    this.nativeAudioOverlay = new BrowserWindow(windowOptions);

    // Position in top-right corner
    this.nativeAudioOverlay.setPosition(width - 320, 20);

    // Load native audio overlay interface
    this.nativeAudioOverlay.loadURL('http://localhost:5173?window=native-audio-overlay');

    // Set up window events
    this.setupWindowEvents();

    // Apply initial transparency
    this.setTransparency(0.8);

    return this.nativeAudioOverlay;
  }

  /**
   * Set up window event handlers
   */
  private setupWindowEvents(): void {
    if (!this.nativeAudioOverlay) return;

    // Handle window closed
    this.nativeAudioOverlay.on('closed', () => {
      this.nativeAudioOverlay = null;
    });

    // Handle window focus
    this.nativeAudioOverlay.on('focus', () => {
      // Temporarily disable click-through when focused
      this.setClickThrough(false);
    });

    this.nativeAudioOverlay.on('blur', () => {
      // Re-enable click-through when not focused
      if (this.clickThroughEnabled) {
        this.setClickThrough(true);
      }
    });
  }

  /**
   * Set up IPC handlers for overlay control
   */
  private setupIPC(): void {
    // Toggle click-through mode
    ipcMain.handle('overlay:toggle-click-through', () => {
      this.toggleClickThrough();
    });

    // Set transparency
    ipcMain.handle('overlay:set-transparency', (event, alpha: number) => {
      this.setTransparency(alpha);
    });

    // Get overlay status
    ipcMain.handle('overlay:get-status', () => {
      return {
        isVisible: this.nativeAudioOverlay?.isVisible() || false,
        isClickThrough: this.clickThroughEnabled,
        position: this.nativeAudioOverlay?.getPosition(),
        size: this.nativeAudioOverlay?.getSize()
      };
    });

    // Show/hide overlay
    ipcMain.handle('overlay:toggle-visibility', () => {
      this.toggleVisibility();
    });
  }

  /**
   * Toggle click-through mode
   */
  toggleClickThrough(): void {
    this.clickThroughEnabled = !this.clickThroughEnabled;
    this.setClickThrough(this.clickThroughEnabled);
  }

  /**
   * Set click-through mode
   */
  setClickThrough(enabled: boolean): void {
    if (!this.nativeAudioOverlay) return;

    try {
      if (process.platform === 'win32') {
        // Windows implementation
        const { setWindowClickThrough } = require('../../native/audio/build/Release/audio_capture');
        if (setWindowClickThrough) {
          setWindowClickThrough(this.nativeAudioOverlay.getNativeWindowHandle(), enabled);
        }
      } else if (process.platform === 'darwin') {
        // macOS implementation
        this.nativeAudioOverlay.setIgnoreMouseEvents(enabled, { forward: true });
      }
    } catch (error) {
      console.error('Failed to set click-through mode:', error);
    }
  }

  /**
   * Set window transparency
   */
  setTransparency(alpha: number): void {
    if (!this.nativeAudioOverlay) return;

    try {
      if (process.platform === 'win32') {
        // Windows layered window transparency
        const { setWindowTransparency } = require('../../native/audio/build/Release/audio_capture');
        if (setWindowTransparency) {
          setWindowTransparency(this.nativeAudioOverlay.getNativeWindowHandle(), alpha);
        }
      } else if (process.platform === 'darwin') {
        // macOS vibrancy
        this.nativeAudioOverlay.setVibrancy('under-window');
        this.nativeAudioOverlay.setOpacity(alpha);
      }
    } catch (error) {
      console.error('Failed to set transparency:', error);
    }
  }

  /**
   * Toggle overlay visibility
   */
  toggleVisibility(): void {
    if (!this.nativeAudioOverlay) return;

    if (this.nativeAudioOverlay.isVisible()) {
      this.nativeAudioOverlay.hide();
    } else {
      this.nativeAudioOverlay.show();
    }
  }

  /**
   * Show overlay
   */
  showOverlay(): void {
    if (this.nativeAudioOverlay) {
      this.nativeAudioOverlay.show();
    }
  }

  /**
   * Hide overlay
   */
  hideOverlay(): void {
    if (this.nativeAudioOverlay) {
      this.nativeAudioOverlay.hide();
    }
  }

  /**
   * Get overlay window
   */
  getOverlayWindow(): BrowserWindow | null {
    return this.nativeAudioOverlay;
  }

  /**
   * Check if overlay is visible
   */
  isOverlayVisible(): boolean {
    return this.nativeAudioOverlay?.isVisible() || false;
  }

  /**
   * Check if click-through is enabled
   */
  isClickThroughEnabled(): boolean {
    return this.clickThroughEnabled;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.nativeAudioOverlay) {
      this.nativeAudioOverlay.destroy();
      this.nativeAudioOverlay = null;
    }
  }
}
