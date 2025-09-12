// Адаптивная система для улучшения ASR
// Умная детекция языка и оптимизация производительности

export interface LanguageStats {
  language: 'ru' | 'en' | 'mixed';
  confidence: number;
  characterCount: number;
  lastDetected: number;
}

export interface PerformanceMetrics {
  avgConfidence: number;
  avgLatency: number;
  errorRate: number;
  sessionStartTime: number;
  totalSegments: number;
}

export class LanguageDetector {
  private languageHistory: LanguageStats[] = [];

  detectLanguage(text: string): LanguageStats {
    // Улучшенные паттерны для более точной детекции
    const englishPattern = /[a-zA-Z]/g;
    const russianPattern = /[а-яё]/gi;
    const numberPattern = /\d/g;
    const punctuationPattern = /[.,!?;:()\-"']/g;
    const spacePattern = /\s/g;

    const englishChars = (text.match(englishPattern) || []).length;
    const russianChars = (text.match(russianPattern) || []).length;
    const numberChars = (text.match(numberPattern) || []).length;
    const punctuationChars = (text.match(punctuationPattern) || []).length;
    const spaceChars = (text.match(spacePattern) || []).length;

    // Исключаем цифры, знаки препинания и пробелы из подсчета
    const totalLetters = englishChars + russianChars;
    const totalChars = text.length - numberChars - punctuationChars - spaceChars;

    if (totalLetters === 0) {
      return {
        language: 'mixed',
        confidence: 0.5,
        characterCount: totalChars,
        lastDetected: Date.now(),
      };
    }

    const englishRatio = englishChars / totalLetters;
    const russianRatio = russianChars / totalLetters;

    let detectedLanguage: 'ru' | 'en' | 'mixed';
    let confidence: number;

    // Более строгие пороги для лучшей детекции
    if (englishRatio > 0.85) {
      detectedLanguage = 'en';
      confidence = Math.min(englishRatio * 1.1, 1.0); // Небольшой буст для английского
    } else if (russianRatio > 0.85) {
      detectedLanguage = 'ru';
      confidence = Math.min(russianRatio * 1.1, 1.0); // Небольшой буст для русского
    } else if (englishRatio > 0.3 && russianRatio > 0.3) {
      // Смешанный язык - оба языка присутствуют в значительном количестве
      detectedLanguage = 'mixed';
      confidence = 1 - Math.abs(englishRatio - russianRatio);
    } else if (englishRatio > russianRatio) {
      // Преобладает английский, но не критично
      detectedLanguage = 'en';
      confidence = englishRatio;
    } else {
      // Преобладает русский, но не критично
      detectedLanguage = 'ru';
      confidence = russianRatio;
    }

    const stats: LanguageStats = {
      language: detectedLanguage,
      confidence,
      characterCount: totalChars,
      lastDetected: Date.now(),
    };

    this.updateLanguageHistory(stats);
    return stats;
  }

  private updateLanguageHistory(stats: LanguageStats) {
    this.languageHistory.push(stats);

    // Держим только последние 10 детекций
    if (this.languageHistory.length > 10) {
      this.languageHistory = this.languageHistory.slice(-10);
    }
  }

  // Получить доминирующий язык за последние сегменты
  getDominantLanguage(): 'ru' | 'en' | 'mixed' {
    if (this.languageHistory.length === 0) return 'mixed';

    const recent = this.languageHistory.slice(-5); // Последние 5 сегментов
    const langCounts = { ru: 0, en: 0, mixed: 0 };

    recent.forEach(stats => {
      langCounts[stats.language]++;
    });

    // Возвращаем язык с максимальным количеством
    const dominant = Object.entries(langCounts).reduce((a, b) => {
      const aKey = a[0] as keyof typeof langCounts;
      const bKey = b[0] as keyof typeof langCounts;
      return langCounts[aKey] > langCounts[bKey] ? a : b;
    })[0] as 'ru' | 'en' | 'mixed';

    return dominant;
  }

  // Получить статистику по языку (для логирования)
  getLanguageStats(): {
    dominant: 'ru' | 'en' | 'mixed';
    recentConfidence: number;
    historyLength: number;
  } {
    const dominant = this.getDominantLanguage();
    const recentConfidence = dominant === 'mixed' ? 0 : this.getRecentConfidence(dominant as 'ru' | 'en');
    
    return {
      dominant,
      recentConfidence,
      historyLength: this.languageHistory.length
    };
  }

  private getRecentConfidence(language: 'ru' | 'en'): number {
    const recentStats = this.languageHistory
      .slice(-3)
      .filter(stats => stats.language === language);

    if (recentStats.length === 0) return 0;

    return (
      recentStats.reduce((sum, stats) => sum + stats.confidence, 0) /
      recentStats.length
    );
  }

  getDebugInfo() {
    return {
      dominantLanguage: this.getDominantLanguage(),
      historyLength: this.languageHistory.length,
      recentStats: this.languageHistory.slice(-3),
    };
  }
}

export class PerformanceOptimizer {
  private metrics: PerformanceMetrics;
  private latencyHistory: number[] = [];

  constructor() {
    this.metrics = {
      avgConfidence: 0.85,
      avgLatency: 200,
      errorRate: 0.1,
      sessionStartTime: Date.now(),
      totalSegments: 0,
    };
  }

  updateMetrics(
    confidence: number,
    latency: number,
    hadError: boolean = false
  ) {
    this.metrics.totalSegments++;

    // Обновляем среднюю уверенность (экспоненциальное сглаживание)
    this.metrics.avgConfidence =
      this.metrics.avgConfidence * 0.9 + confidence * 0.1;

    // Обновляем латентность
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > 20) {
      this.latencyHistory = this.latencyHistory.slice(-20);
    }
    this.metrics.avgLatency =
      this.latencyHistory.reduce((a, b) => a + b) / this.latencyHistory.length;

    // Обновляем частоту ошибок
    if (hadError) {
      this.metrics.errorRate = this.metrics.errorRate * 0.95 + 0.05;
    } else {
      this.metrics.errorRate = this.metrics.errorRate * 0.95;
    }
  }

  // Рекомендации по оптимизации модели
  getModelRecommendation(): { model: string; reason: string } {
    const sessionTime =
      (Date.now() - this.metrics.sessionStartTime) / (1000 * 60); // минуты

    // Если сессия длинная и качество падает - переходим на более точную модель
    if (sessionTime > 30 && this.metrics.avgConfidence < 0.7) {
      return {
        model: 'nova-2-general',
        reason: 'low confidence in long session',
      };
    }

    // Если высокое качество и нужна скорость - можем использовать быструю модель
    if (this.metrics.avgConfidence > 0.9 && this.metrics.avgLatency > 300) {
      return {
        model: 'base',
        reason: 'high confidence, optimize for speed',
      };
    }

    // Если много ошибок - используем самую точную модель
    if (this.metrics.errorRate > 0.2) {
      return {
        model: 'nova-2',
        reason: 'high error rate, need accuracy',
      };
    }

    // По умолчанию - general модель с поддержкой автоопределения языка
    return {
      model: 'nova-2-general',
      reason: 'supports automatic language detection',
    };
  }

  // Адаптивные параметры для Deepgram
  getAdaptiveParameters(): {
    endpointing: number;
    interim_results_period: number;
    confidence_threshold: number;
  } {
    // Если качество низкое - увеличиваем endpointing (ждем дольше перед финализацией)
    let endpointing = 300;
    if (this.metrics.avgConfidence < 0.7) {
      endpointing = 500;
    } else if (this.metrics.avgConfidence > 0.9) {
      endpointing = 200;
    }

    // Если латентность высокая - уменьшаем частоту interim results
    let interimPeriod = 100;
    if (this.metrics.avgLatency > 400) {
      interimPeriod = 200;
    } else if (this.metrics.avgLatency < 150) {
      interimPeriod = 50;
    }

    // Адаптивный порог уверенности для постредактора
    let confidenceThreshold = 0.9;
    if (this.metrics.avgConfidence < 0.8) {
      confidenceThreshold = 0.85; // Более агрессивная коррекция при низком качестве
    } else if (this.metrics.avgConfidence > 0.95) {
      confidenceThreshold = 0.95; // Более консервативная коррекция при высоком качестве
    }

    return {
      endpointing,
      interim_results_period: interimPeriod,
      confidence_threshold: confidenceThreshold,
    };
  }

  getDebugInfo() {
    return {
      ...this.metrics,
      sessionTimeMinutes:
        (Date.now() - this.metrics.sessionStartTime) / (1000 * 60),
      recommendation: this.getModelRecommendation(),
      adaptiveParams: this.getAdaptiveParameters(),
    };
  }
}

export class AdaptiveASRManager {
  private languageDetector: LanguageDetector;
  private performanceOptimizer: PerformanceOptimizer;

  constructor() {
    this.languageDetector = new LanguageDetector();
    this.performanceOptimizer = new PerformanceOptimizer();
  }

  // Анализируем транскрипт и даем рекомендации
  analyzeTranscript(
    text: string,
    confidence: number,
    latency: number = 200,
    detectedLanguage?: string,
    languageConfidence?: number
  ): {
    languageStats: LanguageStats;
    shouldOptimize: boolean;
    recommendations: {
      languageSwitch?: { switch: boolean; newSetting: string };
      modelSwitch?: { model: string; reason: string };
      adaptiveParams?: any;
    };
  } {
    // Используем официальные данные о языке от Deepgram, если доступны
    let languageStats: LanguageStats;
    
    if (detectedLanguage && languageConfidence !== undefined) {
      // Используем официальные данные Deepgram
      languageStats = {
        language: this.mapDeepgramLanguage(detectedLanguage),
        confidence: languageConfidence,
        characterCount: text.length,
        lastDetected: Date.now(),
      };
    } else {
      // Fallback на наш детектор языка
      languageStats = this.languageDetector.detectLanguage(text);
    }

    this.performanceOptimizer.updateMetrics(confidence, latency);

    const modelRecommendation =
      this.performanceOptimizer.getModelRecommendation();
    const adaptiveParams = this.performanceOptimizer.getAdaptiveParameters();

    // Определяем, нужна ли оптимизация (убрали переключение языка - Deepgram сам управляет)
    const shouldOptimize =
      modelRecommendation.model !== 'nova-2-general' ||
      adaptiveParams.confidence_threshold !== 0.9;

    return {
      languageStats,
      shouldOptimize,
      recommendations: {
        modelSwitch: modelRecommendation,
        adaptiveParams,
      },
    };
  }

  // Маппинг языков Deepgram в наш формат
  private mapDeepgramLanguage(deepgramLang: string): 'ru' | 'en' | 'mixed' {
    switch (deepgramLang.toLowerCase()) {
      case 'ru':
      case 'russian':
        return 'ru';
      case 'en':
      case 'english':
        return 'en';
      default:
        return 'mixed';
    }
  }


  getDebugInfo() {
    return {
      languageDetector: this.languageDetector.getDebugInfo(),
      performance: this.performanceOptimizer.getDebugInfo(),
    };
  }
}
