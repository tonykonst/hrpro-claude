#!/usr/bin/env node

// Демо-скрипт для тестирования автоопределения языка
// Запуск: node scripts/test-language-detection.js

const { LanguageDetector, AdaptiveASRManager } = require('../dist/services/adaptive-asr');

console.log('🧪 Language Detection Demo');
console.log('========================\n');

const detector = new LanguageDetector();
const adaptiveASR = new AdaptiveASRManager();

const testTexts = [
  'Hello, I am a software developer',
  'Привет, я разработчик программного обеспечения',
  'Я использую React для frontend разработки',
  'Using TypeScript для type safety',
  'Docker контейнеры и Kubernetes оркестрация',
  'Расскажите о вашем опыте работы с React',
  'Tell me about your experience with React',
  'Как вы решаете сложные задачи в программировании?',
  'How do you solve complex programming problems?'
];

console.log('📝 Testing Language Detection:');
console.log('-------------------------------');

testTexts.forEach((text, index) => {
  const result = detector.detectLanguage(text);
  const languageEmoji = result.language === 'en' ? '🇺🇸' : 
                       result.language === 'ru' ? '🇷🇺' : '🌍';
  
  console.log(`${index + 1}. ${languageEmoji} "${text}"`);
  console.log(`   Detected: ${result.language} (confidence: ${result.confidence.toFixed(2)})`);
  console.log('');
});

console.log('🔄 Testing Adaptive ASR Manager:');
console.log('--------------------------------');

// Тестируем адаптивную систему
const russianTexts = [
  'Привет, как дела?',
  'Я разработчик',
  'Работаю с React',
  'Использую TypeScript для разработки'
];

console.log('Simulating Russian conversation:');
russianTexts.forEach((text, index) => {
  const analysis = adaptiveASR.analyzeTranscript(text, 0.9, 200);
  console.log(`${index + 1}. "${text}"`);
  console.log(`   Language: ${analysis.languageStats.language} (${analysis.languageStats.confidence.toFixed(2)})`);
  
  if (analysis.recommendations.languageSwitch?.switch) {
    console.log(`   🔄 Recommendation: Switch to ${analysis.recommendations.languageSwitch.newSetting}`);
  } else {
    console.log(`   ✅ No language switch needed`);
  }
  console.log('');
});

console.log('📊 Final Debug Info:');
console.log('--------------------');
const debugInfo = adaptiveASR.getDebugInfo();
console.log(JSON.stringify(debugInfo, null, 2));

console.log('\n✅ Language detection demo completed!');
console.log('\n💡 Key Features:');
console.log('   • Automatic language detection (Russian/English/Mixed)');
console.log('   • Adaptive language switching recommendations');
console.log('   • Enhanced Russian language support');
console.log('   • Technical terms recognition in both languages');
console.log('   • Real-time language optimization');


