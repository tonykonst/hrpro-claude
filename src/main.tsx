import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles/globals.css";
import "./styles/components.css";
import { Logger } from "./utils/logger";

Logger.info('Main.tsx loaded');

try {
  // Создаем и рендерим приложение
  Logger.debug('Creating React root...');
  const root = ReactDOM.createRoot(
    document.getElementById("root") as HTMLElement
  );

  Logger.debug('Rendering App component...');
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  Logger.info('App rendered successfully');
} catch (error) {
  Logger.error('Failed to render App', { error: error instanceof Error ? error.message : String(error) });
}

// Скрываем загрузочный экран
setTimeout(() => {
  if (window.hideLoadingScreen) {
    window.hideLoadingScreen();
  }
}, 500);

// Добавляем типы для window
declare global {
  interface Window {
    hideLoadingScreen?: () => void;
  }
}
