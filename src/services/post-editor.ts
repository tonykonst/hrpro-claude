// LLM Post-Editor Service for ASR Correction
// Improves ASR quality for Russian+English mixed speech and technical terms

import Anthropic from '@anthropic-ai/sdk';

export interface PostEditorConfig {
  apiKey: string;
  model: string; // Should be fast model like claude-haiku or gpt-4o-mini
  maxTokens: number;
  temperature: number;
  maxRequestsPerSecond: number;
  timeoutMs: number;
}

export interface CorrectionContext {
  jobTerms: string[]; // Job description terms (будет позже)
  synonymDictionary: Record<string, string>; // Словарь синонимов
}

export interface CorrectionResult {
  correctedText: string;
  wasChanged: boolean;
  confidence: number;
  processingTimeMs: number;
}

export interface SegmentAnalysis {
  needsCorrection: boolean;
  reasons: string[];
  confidence: number;
  language: 'ru' | 'en' | 'mixed';
  technicalTerms: string[];
}

export class PostEditorService {
  private anthropic: Anthropic | null;
  private config: PostEditorConfig;
  private context: CorrectionContext;
  private lastRequestTime: number = 0;
  private requestQueue: Promise<any> = Promise.resolve();

  constructor(config: PostEditorConfig, context: CorrectionContext) {
    this.config = config;
    this.context = context;

    // Проверяем, что API ключ есть
    if (!config.apiKey || config.apiKey === 'your_claude_api_key_here') {
      console.warn(
        '⚠️ [POST-EDITOR] Claude API key not configured, post-editing will be disabled'
      );
      this.anthropic = null;
      return;
    }

    try {
      this.anthropic = new Anthropic({
        apiKey: config.apiKey,
        dangerouslyAllowBrowser: true, // Разрешаем использование в Electron renderer
      });
    } catch (error) {
      console.error('❌ [POST-EDITOR] Failed to initialize Anthropic:', error);
      this.anthropic = null;
    }
  }

  // Основная функция для проверки нужности коррекции
  analyzeSegment(text: string, confidence: number): SegmentAnalysis {
    const analysis: SegmentAnalysis = {
      needsCorrection: false,
      reasons: [],
      confidence: 0,
      language: this.detectLanguage(text),
      technicalTerms: this.extractTechnicalTerms(text),
    };

    // Если Anthropic не инициализирован, возвращаем базовый анализ
    if (!this.anthropic) {
      return analysis;
    }

    // Триггер 1: Низкая уверенность (более консервативный для быстрой речи)
    if (confidence < 0.7) {
      analysis.needsCorrection = true;
      analysis.reasons.push('low_confidence');
    }

    // Триггер 2: Смешанный язык
    if (analysis.language === 'mixed') {
      analysis.needsCorrection = true;
      analysis.reasons.push('mixed_language');
    }

    // Триггер 3: Технические термины
    if (analysis.technicalTerms.length > 0) {
      analysis.needsCorrection = true;
      analysis.reasons.push('technical_terms');
    }

    // Триггер 4: Подозрительные слова (нет в словаре)
    const suspiciousWords = this.findSuspiciousWords(text);
    if (suspiciousWords.length > 0) {
      analysis.needsCorrection = true;
      analysis.reasons.push('suspicious_words');
    }

    // Триггер 5: Цифры, версии, команды
    if (this.hasVersionsOrCommands(text)) {
      analysis.needsCorrection = true;
      analysis.reasons.push('versions_commands');
    }

    // Проверка длины (не больше ~120 слов)
    const wordCount = text.trim().split(/\s+/).length;
    if (wordCount > 120) {
      analysis.needsCorrection = false;
      analysis.reasons = ['text_too_long'];
    }

    analysis.confidence = this.calculateAnalysisConfidence(analysis);

    return analysis;
  }

  // Исправление текста с помощью LLM
  async correctText(
    text: string,
    analysis: SegmentAnalysis
  ): Promise<CorrectionResult> {
    const startTime = Date.now();

    try {
      // Rate limiting
      await this.enforceRateLimit();

      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(text, analysis);

      console.log('🔧 Post-editing with LLM:', {
        text_length: text.length,
        reasons: analysis.reasons,
        language: analysis.language,
        tech_terms: analysis.technicalTerms.length,
      });

      // Проверяем, что Anthropic инициализирован
      if (!this.anthropic) {
        console.warn(
          '⚠️ [POST-EDITOR] Anthropic not initialized, skipping correction'
        );
        return {
          correctedText: text,
          confidence: 0,
          wasChanged: false,
          processingTimeMs: 0,
        };
      }

      const response = await Promise.race([
        this.anthropic.messages.create({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        }),
        this.createTimeoutPromise(this.config.timeoutMs),
      ]);

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from LLM');
      }

      const result = JSON.parse(content.text);
      const processingTime = Date.now() - startTime;

      console.log('✅ Post-editing complete:', {
        original_length: text.length,
        corrected_length: result.corrected_text.length,
        was_changed: result.was_changed,
        processing_time: processingTime + 'ms',
      });

      return {
        correctedText: result.corrected_text,
        wasChanged: result.was_changed,
        confidence: result.confidence,
        processingTimeMs: processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.warn('⚠️ Post-editing failed:', error);

      // Возвращаем оригинальный текст при ошибке
      return {
        correctedText: text,
        wasChanged: false,
        confidence: 0,
        processingTimeMs: processingTime,
      };
    }
  }

  // Детекция языка
  private detectLanguage(text: string): 'ru' | 'en' | 'mixed' {
    const cyrillicPattern = /[а-яё]/i;
    const latinPattern = /[a-z]/i;

    const hasCyrillic = cyrillicPattern.test(text);
    const hasLatin = latinPattern.test(text);

    if (hasCyrillic && hasLatin) return 'mixed';
    if (hasCyrillic) return 'ru';
    return 'en';
  }

  // Извлечение технических терминов
  private extractTechnicalTerms(text: string): string[] {
    const patterns = [
      /\b[A-Z][a-z]*[A-Z][a-zA-Z]*\b/g, // CamelCase
      /\b\w+\.(js|ts|py|java|go|rs|sql|json|yaml|yml|xml|html|css)\b/g, // Extensions
      /\b(API|SDK|UI|UX|DB|SQL|REST|GraphQL|JWT|OAuth|HTTP|HTTPS|JSON|XML|HTML|CSS|NPM|Git|Docker|Kubernetes|AWS|Azure|GCP)\b/g, // Tech acronyms
      /\b[a-z]+\-[a-z\-]+\b/g, // kebab-case
      /\b[a-z_]+_[a-z_]+\b/g, // snake_case
      /\bv?\d+\.\d+(\.\d+)?(\-[a-z0-9\-]+)?(\+[a-z0-9\-]+)?\b/g, // Версии
    ];

    const terms: string[] = [];
    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        terms.push(...matches);
      }
    });

    return [...new Set(terms)];
  }

  // Поиск подозрительных слов
  private findSuspiciousWords(text: string): string[] {
    // Простая эвристика для подозрительных слов
    const words = text.toLowerCase().split(/\s+/);
    const suspicious: string[] = [];

    for (const word of words) {
      // Слова с необычными сочетаниями букв
      if (word.length > 3 && this.hasSuspiciousPattern(word)) {
        suspicious.push(word);
      }
    }

    return suspicious;
  }

  private hasSuspiciousPattern(word: string): boolean {
    // Паттерны, которые могут указывать на ошибки ASR
    const suspiciousPatterns = [
      /[а-я]{1}[a-z]{2,}/i, // Смешение кириллицы и латиницы внутри слова
      /[a-z]{1}[а-я]{2,}/i,
      /\d{1}[а-яa-z]{1,}/i, // Цифра прилипла к слову
      /[а-яa-z]{1,}\d{1}/i, // Слово прилипло к цифре
    ];

    return suspiciousPatterns.some(pattern => pattern.test(word));
  }

  // Проверка версий и команд
  private hasVersionsOrCommands(text: string): boolean {
    const patterns = [
      /\bv?\d+\.\d+/i, // Версии
      /\b(npm|yarn|pip|docker|kubectl|git|node|python|java|mvn|gradle)\s+/i, // Команды
      /\b\d+\.\d+\.\d+/i, // Семантические версии
      /\b(install|update|build|run|start|stop|deploy|test)\b/i, // Command keywords
    ];

    return patterns.some(pattern => pattern.test(text));
  }

  private calculateAnalysisConfidence(analysis: SegmentAnalysis): number {
    let confidence = 0.5; // Base confidence

    if (analysis.reasons.includes('low_confidence')) confidence += 0.2;
    if (analysis.reasons.includes('mixed_language')) confidence += 0.15;
    if (analysis.reasons.includes('technical_terms')) confidence += 0.1;
    if (analysis.reasons.includes('suspicious_words')) confidence += 0.1;
    if (analysis.reasons.includes('versions_commands')) confidence += 0.05;

    return Math.min(confidence, 1.0);
  }

  // Rate limiting
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const minInterval = 1000 / this.config.maxRequestsPerSecond;
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Post-editing timeout')), timeoutMs);
    });
  }

  private buildSystemPrompt(): string {
    return `You are a specialized post-editor for speech recognition (ASR) outputs. Your task is to fix ONLY specific errors while preserving the original meaning completely.

STRICT RULES:
- Fix ONLY: technical terms, punctuation, capitalization
- NEVER rephrase or change meaning
- NEVER add or remove words (except obvious ASR errors)
- Keep the exact same sentence structure
- Preserve all speaking patterns and hesitations

WHAT TO FIX:
1. Technical terms: "кубер" → "Kubernetes", "постгрес" → "PostgreSQL"
2. Punctuation: add commas, periods, question marks where clearly needed
3. Capitalization: proper nouns, acronyms, sentence starts
4. Mixed language issues: separate stuck-together words
5. Version numbers: ensure proper formatting

WHAT NOT TO CHANGE:
- Informal speech patterns
- Repetitions or hesitations
- Grammatical structures
- Word order
- Colloquial expressions

CONTEXT DICTIONARY:
${JSON.stringify(this.context.synonymDictionary, null, 2)}

JOB TERMS (important context):
${this.context.jobTerms.join(', ') || 'None provided yet'}

OUTPUT FORMAT (strict JSON):
{
  "corrected_text": "The corrected text",
  "was_changed": true/false,
  "confidence": 0.85
}`;
  }

  private buildUserPrompt(text: string, analysis: SegmentAnalysis): string {
    return `Fix this ASR output:

ORIGINAL TEXT:
"${text}"

DETECTED ISSUES:
- Language: ${analysis.language}
- Technical terms found: ${analysis.technicalTerms.join(', ') || 'none'}
- Reasons for correction: ${analysis.reasons.join(', ')}

Apply minimal corrections for technical accuracy while preserving natural speech patterns.
Return valid JSON only.`;
  }

  // Update context
  updateContext(newContext: Partial<CorrectionContext>): void {
    this.context = { ...this.context, ...newContext };
  }
}

// Factory function
export const createPostEditorService = (
  config: PostEditorConfig,
  context?: Partial<CorrectionContext>
): PostEditorService => {
  // Default context with example synonyms
  const defaultContext: CorrectionContext = {
    jobTerms: [], // Будет добавлено позже
    synonymDictionary: {
      // Примеры синонимов и транскрипций
      кубер: 'Kubernetes',
      кубернетес: 'Kubernetes',
      постгрес: 'PostgreSQL',
      постгресс: 'PostgreSQL',
      реакт: 'React',
      нод: 'Node.js',
      ноде: 'Node.js',
      тайпскрипт: 'TypeScript',
      джаваскрипт: 'JavaScript',
      гит: 'Git',
      гитхаб: 'GitHub',
      докер: 'Docker',
      монго: 'MongoDB',
      редис: 'Redis',
      эластик: 'Elasticsearch',
      апи: 'API',
      рест: 'REST',
      джсон: 'JSON',
      хтмл: 'HTML',
      цсс: 'CSS',
    },
  };

  const mergedContext = { ...defaultContext, ...context };
  return new PostEditorService(config, mergedContext);
};
