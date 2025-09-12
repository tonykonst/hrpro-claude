// Тест для проверки автоопределения языка
// Запуск: npm test language-detection-test.ts

import { LanguageDetector, AdaptiveASRManager } from '../services/adaptive-asr';

describe('Language Detection Tests', () => {
  let languageDetector: LanguageDetector;
  let adaptiveASR: AdaptiveASRManager;

  beforeEach(() => {
    languageDetector = new LanguageDetector();
    adaptiveASR = new AdaptiveASRManager();
  });

  describe('LanguageDetector', () => {
    test('should detect English text correctly', () => {
      const englishText = 'Hello, I am a software developer working with React and TypeScript';
      const result = languageDetector.detectLanguage(englishText);
      
      expect(result.language).toBe('en');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('should detect Russian text correctly', () => {
      const russianText = 'Привет, я разработчик программного обеспечения, работаю с React и TypeScript';
      const result = languageDetector.detectLanguage(russianText);
      
      expect(result.language).toBe('ru');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('should detect mixed language text', () => {
      const mixedText = 'Я разработчик, использую React для frontend разработки';
      const result = languageDetector.detectLanguage(mixedText);
      
      expect(result.language).toBe('mixed');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('should handle technical terms correctly', () => {
      const technicalText = 'Использую Docker для контейнеризации и Kubernetes для оркестрации';
      const result = languageDetector.detectLanguage(technicalText);
      
      expect(result.language).toBe('ru');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('should handle numbers and punctuation', () => {
      const textWithNumbers = 'Версия 2.0.1 была выпущена 15.03.2024 года';
      const result = languageDetector.detectLanguage(textWithNumbers);
      
      expect(result.language).toBe('ru');
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('AdaptiveASRManager', () => {
    test('should analyze English transcript correctly', () => {
      const analysis = adaptiveASR.analyzeTranscript(
        'Hello, I am a software developer',
        0.9,
        200
      );
      
      expect(analysis.languageStats.language).toBe('en');
      expect(analysis.languageStats.confidence).toBeGreaterThan(0.8);
    });

    test('should analyze Russian transcript correctly', () => {
      const analysis = adaptiveASR.analyzeTranscript(
        'Привет, я разработчик программного обеспечения',
        0.9,
        200
      );
      
      expect(analysis.languageStats.language).toBe('ru');
      expect(analysis.languageStats.confidence).toBeGreaterThan(0.8);
    });

    test('should recommend language switch for consistent Russian', () => {
      // Симулируем несколько русских сегментов
      adaptiveASR.analyzeTranscript('Привет, как дела?', 0.9, 200);
      adaptiveASR.analyzeTranscript('Я разработчик', 0.9, 200);
      adaptiveASR.analyzeTranscript('Работаю с React', 0.9, 200);
      
      const analysis = adaptiveASR.analyzeTranscript(
        'Использую TypeScript для разработки',
        0.9,
        200
      );
      
      expect(analysis.recommendations.languageSwitch?.switch).toBe(true);
      expect(analysis.recommendations.languageSwitch?.newSetting).toBe('ru');
    });

    test('should recommend language switch for consistent English', () => {
      // Симулируем несколько английских сегментов
      adaptiveASR.analyzeTranscript('Hello, how are you?', 0.9, 200);
      adaptiveASR.analyzeTranscript('I am a developer', 0.9, 200);
      adaptiveASR.analyzeTranscript('Working with React', 0.9, 200);
      
      const analysis = adaptiveASR.analyzeTranscript(
        'Using TypeScript for development',
        0.9,
        200
      );
      
      expect(analysis.recommendations.languageSwitch?.switch).toBe(true);
      expect(analysis.recommendations.languageSwitch?.newSetting).toBe('en');
    });

    test('should handle mixed language gracefully', () => {
      // Симулируем смешанные сегменты
      adaptiveASR.analyzeTranscript('Привет, I am developer', 0.8, 200);
      adaptiveASR.analyzeTranscript('Работаю с React', 0.8, 200);
      adaptiveASR.analyzeTranscript('Using TypeScript', 0.8, 200);
      
      const analysis = adaptiveASR.analyzeTranscript(
        'Создаю компоненты components',
        0.8,
        200
      );
      
      // При смешанном языке не должно быть переключения
      expect(analysis.recommendations.languageSwitch?.switch).toBe(false);
    });
  });

  describe('Real-world scenarios', () => {
    test('should handle interview context in Russian', () => {
      const interviewTexts = [
        'Расскажите о вашем опыте работы',
        'Какие технологии вы используете?',
        'Как вы решаете сложные задачи?',
        'Расскажите о вашем последнем проекте'
      ];

      interviewTexts.forEach(text => {
        const result = languageDetector.detectLanguage(text);
        expect(result.language).toBe('ru');
        expect(result.confidence).toBeGreaterThan(0.8);
      });
    });

    test('should handle interview context in English', () => {
      const interviewTexts = [
        'Tell me about your work experience',
        'What technologies do you use?',
        'How do you solve complex problems?',
        'Tell me about your latest project'
      ];

      interviewTexts.forEach(text => {
        const result = languageDetector.detectLanguage(text);
        expect(result.language).toBe('en');
        expect(result.confidence).toBeGreaterThan(0.8);
      });
    });

    test('should handle technical terms in both languages', () => {
      const technicalTexts = [
        'Использую Docker и Kubernetes для деплоя',
        'Working with Docker and Kubernetes for deployment',
        'React компоненты и TypeScript интерфейсы',
        'React components and TypeScript interfaces'
      ];

      const results = technicalTexts.map(text => languageDetector.detectLanguage(text));
      
      expect(results[0].language).toBe('ru');
      expect(results[1].language).toBe('en');
      expect(results[2].language).toBe('ru');
      expect(results[3].language).toBe('en');
    });
  });
});

// Функция для ручного тестирования
export function runLanguageDetectionDemo() {
  console.log('🧪 Language Detection Demo');
  console.log('========================');
  
  const detector = new LanguageDetector();
  const testTexts = [
    'Hello, I am a software developer',
    'Привет, я разработчик программного обеспечения',
    'Я использую React для frontend разработки',
    'Using TypeScript для type safety',
    'Docker контейнеры и Kubernetes оркестрация'
  ];

  testTexts.forEach((text, index) => {
    const result = detector.detectLanguage(text);
    console.log(`${index + 1}. "${text}"`);
    console.log(`   Detected: ${result.language} (confidence: ${result.confidence.toFixed(2)})`);
    console.log('');
  });
}

// Запуск демо если файл выполняется напрямую
if (require.main === module) {
  runLanguageDetectionDemo();
}


