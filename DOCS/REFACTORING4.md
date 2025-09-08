# План рефакторинга v0.51 → v0.52
## Приведение кода в соответствие с правилами hrpro.mdc

**Цель**: Привести проект в полное соответствие с архитектурными принципами и стандартами качества для публичного сервиса.

**Принцип**: Изменения небольшими инкрементальными шагами с тестированием после каждого этапа.

---

## 🎯 **ЭТАП 1: Создание базовой инфраструктуры ошибок**
**Приоритет**: КРИТИЧНО  
**Время**: 1-2 часа  
**Тестирование**: Проверить, что приложение запускается без ошибок

### 1.1 Создать базовые классы ошибок
```bash
# Создать файл
src/utils/errors.ts
```

**Содержимое**:
```typescript
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
```

### 1.2 Обновить экспорты
```typescript
// Добавить в src/utils/index.ts
export * from './errors';
```

**Тестирование**: 
- ✅ Приложение запускается
- ✅ Нет TypeScript ошибок
- ✅ Импорты работают корректно

---

## 🎯 **ЭТАП 2: Базовое структурированное логирование**
**Приоритет**: КРИТИЧНО  
**Время**: 1-2 часа  
**Тестирование**: Проверить логи в консоли

### 2.1 Создать Logger класс
```bash
# Создать файл
src/utils/logger.ts
```

**Содержимое**:
```typescript
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
  
  static log(level: LogLevel, message: string, context?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.getServiceName(),
      message,
      context: this.sanitizeContext(context),
      sessionId: this.sessionId
    };
    
    console.log(JSON.stringify(entry));
  }
  
  static debug(message: string, context?: any): void {
    this.log('debug', message, context);
  }
  
  static info(message: string, context?: any): void {
    this.log('info', message, context);
  }
  
  static warn(message: string, context?: any): void {
    this.log('warn', message, context);
  }
  
  static error(message: string, context?: any): void {
    this.log('error', message, context);
  }
  
  private static getServiceName(): string {
    // Простая детекция сервиса по stack trace
    const stack = new Error().stack || '';
    if (stack.includes('deepgram')) return 'deepgram';
    if (stack.includes('claude')) return 'claude';
    if (stack.includes('config')) return 'config';
    return 'app';
  }
  
  private static sanitizeContext(context: any): any {
    if (!context) return undefined;
    
    // Удаляем потенциально чувствительные данные
    const sanitized = { ...context };
    delete sanitized.apiKey;
    delete sanitized.password;
    delete sanitized.token;
    
    return sanitized;
  }
}
```

### 2.2 Заменить первые console.log
**Файлы для изменения**:
- `src/main/main.ts` - заменить 2-3 console.log
- `src/main.tsx` - заменить console.log

**Тестирование**:
- ✅ Логи выводятся в JSON формате
- ✅ Приложение работает как раньше
- ✅ Нет потери функциональности

---

## 🎯 **ЭТАП 3: Базовое управление памятью**
**Приоритет**: КРИТИЧНО  
**Время**: 2-3 часа  
**Тестирование**: Проверить, что нет утечек памяти при длительной записи

### 3.1 Создать MemoryManager
```bash
# Создать файл
src/utils/memory-manager.ts
```

**Содержимое**:
```typescript
import { Logger } from './logger';

export interface Insight {
  id: string;
  timestamp: number;
  content: string;
}

export class MemoryManager {
  private static readonly MAX_TRANSCRIPT_WORDS = 1000;
  private static readonly MAX_INSIGHTS_HISTORY = 50;
  private static readonly MAX_AUDIO_BUFFER_SIZE = 1024 * 1024; // 1MB
  
  static cleanupOldData(transcript: string[], insights: Insight[]): {
    cleanedTranscript: string[];
    cleanedInsights: Insight[];
    removedCount: { transcript: number; insights: number };
  } {
    const originalTranscriptLength = transcript.length;
    const originalInsightsLength = insights.length;
    
    // Очистка транскрипта
    let cleanedTranscript = transcript;
    if (transcript.length > this.MAX_TRANSCRIPT_WORDS) {
      cleanedTranscript = transcript.slice(-this.MAX_TRANSCRIPT_WORDS);
      Logger.info('Transcript cleaned', {
        originalLength: originalTranscriptLength,
        newLength: cleanedTranscript.length,
        removed: originalTranscriptLength - cleanedTranscript.length
      });
    }
    
    // Очистка инсайтов
    let cleanedInsights = insights;
    if (insights.length > this.MAX_INSIGHTS_HISTORY) {
      cleanedInsights = insights.slice(-this.MAX_INSIGHTS_HISTORY);
      Logger.info('Insights cleaned', {
        originalLength: originalInsightsLength,
        newLength: cleanedInsights.length,
        removed: originalInsightsLength - cleanedInsights.length
      });
    }
    
    return {
      cleanedTranscript,
      cleanedInsights,
      removedCount: {
        transcript: originalTranscriptLength - cleanedTranscript.length,
        insights: originalInsightsLength - cleanedInsights.length
      }
    };
  }
  
  static getMemoryStats(): {
    maxTranscriptWords: number;
    maxInsightsHistory: number;
    maxAudioBufferSize: number;
  } {
    return {
      maxTranscriptWords: this.MAX_TRANSCRIPT_WORDS,
      maxInsightsHistory: this.MAX_INSIGHTS_HISTORY,
      maxAudioBufferSize: this.MAX_AUDIO_BUFFER_SIZE
    };
  }
}
```

### 3.2 Интегрировать в useTranscriptionCore
**Файл**: `src/hooks/transcription/useTranscriptionCore.ts`

**Изменения**:
- Добавить импорт MemoryManager
- Добавить периодическую очистку данных (каждые 30 секунд)

**Тестирование**:
- ✅ Длительная запись (5+ минут) не вызывает утечек памяти
- ✅ Старые данные корректно удаляются
- ✅ Новые данные продолжают поступать

---

## 🎯 **ЭТАП 4: Настройка ESLint и Prettier**
**Приоритет**: ВАЖНО  
**Время**: 1 час  
**Тестирование**: Проверить, что код проходит линтинг

### 4.1 Установить зависимости
```bash
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react eslint-plugin-react-hooks prettier
```

### 4.2 Создать конфигурации
```bash
# Создать файлы
.eslintrc.js
.prettierrc
.eslintignore
.prettierignore
```

**Содержимое .eslintrc.js**:
```javascript
module.exports = {
  extends: [
    '@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': 'error',
    'react-hooks/exhaustive-deps': 'error',
    'no-console': 'warn'
  },
  settings: {
    react: {
      version: 'detect'
    }
  }
};
```

**Содержимое .prettierrc**:
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

### 4.3 Добавить скрипты в package.json
```json
{
  "scripts": {
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "format": "prettier --write src/**/*.{ts,tsx}",
    "format:check": "prettier --check src/**/*.{ts,tsx}"
  }
}
```

**Тестирование**:
- ✅ `npm run lint` проходит без ошибок
- ✅ `npm run format` форматирует код
- ✅ Приложение работает после форматирования

---

## 🎯 **ЭТАП 5: Замена console.log на Logger**
**Приоритет**: ВАЖНО  
**Время**: 2-3 часа  
**Тестирование**: Проверить логи в JSON формате

### 5.1 Заменить в сервисах
**Файлы**:
- `src/services/deepgram.ts` - заменить ~20 console.log
- `src/services/claude.ts` - заменить ~15 console.log
- `src/services/config.ts` - заменить ~10 console.log

**Подход**: Заменять по 5-10 console.log за раз, тестировать после каждой группы.

### 5.2 Заменить в хуках
**Файлы**:
- `src/hooks/transcription/useTranscriptionCore.ts`
- `src/hooks/transcription/useTranscriptionCallbacks.ts`

### 5.3 Заменить в компонентах
**Файлы**:
- `src/App.tsx`
- `src/main.tsx`

**Тестирование**:
- ✅ Все логи в JSON формате
- ✅ Нет потери важной информации
- ✅ Приложение работает стабильно

---

## 🎯 **ЭТАП 6: Базовое тестирование**
**Приоритет**: КРИТИЧНО  
**Время**: 3-4 часа  
**Тестирование**: Запустить тесты

### 6.1 Установить Jest
```bash
npm install --save-dev jest @types/jest ts-jest @testing-library/react @testing-library/jest-dom
```

### 6.2 Создать конфигурацию Jest
```bash
# Создать файл
jest.config.js
```

**Содержимое**:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx']
};
```

### 6.3 Создать первые тесты
```bash
# Создать файлы
src/__tests__/utils/errors.test.ts
src/__tests__/utils/logger.test.ts
src/__tests__/utils/memory-manager.test.ts
```

**Пример теста для errors.test.ts**:
```typescript
import { AppError, ErrorHandler } from '../../utils/errors';

describe('AppError', () => {
  it('should create error with correct properties', () => {
    const error = new AppError('Test error', 'TEST_ERROR', true, { context: 'test' });
    
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.retriable).toBe(true);
    expect(error.context).toEqual({ context: 'test' });
  });
});

describe('ErrorHandler', () => {
  it('should retry operation on failure', async () => {
    let attempts = 0;
    const operation = async () => {
      attempts++;
      if (attempts < 3) throw new Error('Temporary failure');
      return 'success';
    };
    
    const result = await ErrorHandler.withRetry(operation, 3, 10);
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });
});
```

### 6.4 Добавить скрипты тестирования
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

**Тестирование**:
- ✅ `npm test` проходит успешно
- ✅ Покрытие тестами > 80% для утилит
- ✅ Приложение работает после добавления тестов

---

## 🎯 **ЭТАП 7: Мониторинг производительности**
**Приоритет**: ВАЖНО  
**Время**: 2-3 часа  
**Тестирование**: Проверить метрики в логах

### 7.1 Создать PerformanceMonitor
```bash
# Создать файл
src/utils/performance-monitor.ts
```

**Содержимое**:
```typescript
import { Logger } from './logger';

export interface PerformanceMetrics {
  audioLatency: number;
  transcriptionLatency: number;
  analysisLatency: number;
  memoryUsage: number;
  errorRate: number;
  sessionDuration: number;
}

export class PerformanceMonitor {
  private static metrics: PerformanceMetrics = {
    audioLatency: 0,
    transcriptionLatency: 0,
    analysisLatency: 0,
    memoryUsage: 0,
    errorRate: 0,
    sessionDuration: 0
  };
  
  private static sessionStartTime = Date.now();
  private static errorCount = 0;
  private static totalOperations = 0;
  
  static recordAudioLatency(latency: number): void {
    this.metrics.audioLatency = latency;
    Logger.debug('Audio latency recorded', { latency });
  }
  
  static recordTranscriptionLatency(latency: number): void {
    this.metrics.transcriptionLatency = latency;
    Logger.debug('Transcription latency recorded', { latency });
  }
  
  static recordAnalysisLatency(latency: number): void {
    this.metrics.analysisLatency = latency;
    Logger.debug('Analysis latency recorded', { latency });
  }
  
  static recordError(): void {
    this.errorCount++;
    this.totalOperations++;
    this.metrics.errorRate = this.errorCount / this.totalOperations;
    Logger.warn('Error recorded', { errorRate: this.metrics.errorRate });
  }
  
  static recordSuccess(): void {
    this.totalOperations++;
    this.metrics.errorRate = this.errorCount / this.totalOperations;
  }
  
  static getMetrics(): PerformanceMetrics {
    this.metrics.sessionDuration = Date.now() - this.sessionStartTime;
    this.metrics.memoryUsage = this.getMemoryUsage();
    
    return { ...this.metrics };
  }
  
  static logMetrics(): void {
    const metrics = this.getMetrics();
    Logger.info('Performance metrics', metrics);
  }
  
  private static getMemoryUsage(): number {
    if (typeof performance !== 'undefined' && performance.memory) {
      return performance.memory.usedJSHeapSize;
    }
    return 0;
  }
}
```

### 7.2 Интегрировать в ключевые сервисы
**Файлы для изменения**:
- `src/services/deepgram.ts` - добавить измерение latency
- `src/services/claude.ts` - добавить измерение analysis latency

**Тестирование**:
- ✅ Метрики записываются в логи
- ✅ Нет влияния на производительность
- ✅ Данные корректно отображаются

---

## 🎯 **ЭТАП 8: Улучшение обработки ошибок в сервисах**
**Приоритет**: ВАЖНО  
**Время**: 2-3 часа  
**Тестирование**: Проверить обработку ошибок

### 8.1 Обновить DeepgramService
**Файл**: `src/services/deepgram.ts`

**Изменения**:
- Заменить throw new Error на AppError
- Добавить ErrorHandler.withRetry для критических операций
- Улучшить обработку WebSocket ошибок

### 8.2 Обновить ClaudeAnalysisService
**Файл**: `src/services/claude.ts`

**Изменения**:
- Добавить AppError для API ошибок
- Реализовать retry логику для Claude API
- Улучшить fallback механизмы

**Тестирование**:
- ✅ Ошибки обрабатываются корректно
- ✅ Retry логика работает
- ✅ Приложение не падает при ошибках API

---

## 🎯 **ЭТАП 9: Финальная проверка и документация**
**Приоритет**: ВАЖНО  
**Время**: 1-2 часа  
**Тестирование**: Полное тестирование приложения

### 9.1 Обновить документацию
**Файлы**:
- `README.md` - добавить информацию о новых возможностях
- `DOCS/DOCUMENTATION.md` - обновить архитектурные решения

### 9.2 Финальные тесты
- ✅ Длительная сессия (30+ минут)
- ✅ Обработка ошибок API
- ✅ Управление памятью
- ✅ Производительность

### 9.3 Обновить версию
```json
// package.json
{
  "version": "0.52.0"
}
```

---

## 📊 **КРИТЕРИИ УСПЕХА**

После завершения всех этапов проект должен соответствовать:

- ✅ **Обработка ошибок**: AppError используется везде
- ✅ **Управление памятью**: MemoryManager предотвращает утечки
- ✅ **Логирование**: Структурированные JSON логи
- ✅ **Тестирование**: >80% покрытие для критических компонентов
- ✅ **Качество кода**: ESLint проходит без ошибок
- ✅ **Производительность**: Мониторинг метрик работает
- ✅ **Безопасность**: Сохранены все существующие настройки

## ⚠️ **ВАЖНЫЕ ПРИНЦИПЫ**

1. **Тестировать после каждого этапа** - приложение должно оставаться работоспособным
2. **Не делать больших изменений** - максимум 1-2 файла за раз
3. **Сохранять обратную совместимость** - не ломать существующий функционал
4. **Документировать изменения** - обновлять комментарии и документацию
5. **Откатываться при проблемах** - если что-то сломалось, откатить изменения

## 🚀 **ПЛАН ВЫПОЛНЕНИЯ**

**Неделя 1**: Этапы 1-3 (базовая инфраструктура)
**Неделя 2**: Этапы 4-6 (качество кода и тестирование)  
**Неделя 3**: Этапы 7-9 (мониторинг и финализация)

**Общее время**: 15-20 часов разработки
**Результат**: Полное соответствие правилам hrpro.mdc
