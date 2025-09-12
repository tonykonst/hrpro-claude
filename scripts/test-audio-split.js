#!/usr/bin/env node

/**
 * Скрипт для автоматического тестирования аудио разделения потоков
 * 
 * Запуск: node scripts/test-audio-split.js
 * 
 * Опции:
 * --unit - только unit тесты
 * --integration - только integration тесты  
 * --performance - только performance тесты
 * --all - все тесты (по умолчанию)
 * --verbose - подробный вывод
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Парсинг аргументов командной строки
const args = process.argv.slice(2);
const options = {
  unit: args.includes('--unit'),
  integration: args.includes('--integration'),
  performance: args.includes('--performance'),
  all: args.includes('--all') || (!args.includes('--unit') && !args.includes('--integration') && !args.includes('--performance')),
  verbose: args.includes('--verbose')
};

// Функция для вывода с цветом
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Функция для выполнения команды
function runCommand(command, description) {
  log(`\n${colors.blue}${description}${colors.reset}`);
  log(`${colors.cyan}Выполняется: ${command}${colors.reset}`);
  
  try {
    const output = execSync(command, { 
      encoding: 'utf8',
      stdio: options.verbose ? 'inherit' : 'pipe'
    });
    
    if (!options.verbose && output) {
      console.log(output);
    }
    
    log(`${colors.green}✅ ${description} - УСПЕШНО${colors.reset}`);
    return true;
  } catch (error) {
    log(`${colors.red}❌ ${description} - ОШИБКА${colors.reset}`);
    if (error.stdout) {
      console.log(error.stdout);
    }
    if (error.stderr) {
      console.log(error.stderr);
    }
    return false;
  }
}

// Функция для проверки файлов
function checkFiles() {
  log(`\n${colors.bright}${colors.blue}Проверка файлов...${colors.reset}`);
  
  const requiredFiles = [
    'src/types/IAudioService.ts',
    'src/services/audio/AudioSourceDetector.ts',
    'src/services/audio/HeadphoneDetector.ts',
    'src/services/audio/HRHeadphoneHandler.ts',
    'src/services/audio/AudioStreamSplitter.ts',
    'src/components/control/StreamStatus.tsx',
    'src/components/control/HRHeadphoneStatus.tsx',
    'src/hooks/transcription/useTranscriptionRecording.ts',
    'src/services/audio/__tests__/AudioSourceDetector.test.ts',
    'src/services/audio/__tests__/HeadphoneDetector.test.ts',
    'src/services/audio/__tests__/AudioStreamSplitter.test.ts',
    'src/services/audio/__tests__/AudioStreamSplitter.integration.test.ts',
    'src/services/audio/__tests__/AudioStreamSplitter.performance.test.ts'
  ];
  
  let allFilesExist = true;
  
  for (const file of requiredFiles) {
    if (fs.existsSync(file)) {
      log(`${colors.green}✅ ${file}${colors.reset}`);
    } else {
      log(`${colors.red}❌ ${file} - НЕ НАЙДЕН${colors.reset}`);
      allFilesExist = false;
    }
  }
  
  return allFilesExist;
}

// Функция для проверки конфигурации
function checkConfiguration() {
  log(`\n${colors.bright}${colors.blue}Проверка конфигурации...${colors.reset}`);
  
  const configFile = 'src/services/config.ts';
  if (!fs.existsSync(configFile)) {
    log(`${colors.red}❌ Конфигурационный файл не найден${colors.reset}`);
    return false;
  }
  
  const configContent = fs.readFileSync(configFile, 'utf8');
  
  const requiredConfigs = [
    'AUDIO_SPLIT_ENABLED',
    'AUDIO_SPLIT_AUTO_DETECT_ROLES',
    'AUDIO_SPLIT_FALLBACK_TO_SINGLE',
    'AUDIO_SPLIT_MONITORING_INTERVAL',
    'AUDIO_SPLIT_ROLE_REEVALUATION_TIMEOUT',
    'AUDIO_SPLIT_QUALITY_THRESHOLD',
    'AUDIO_SPLIT_ACTIVITY_THRESHOLD'
  ];
  
  let allConfigsExist = true;
  
  for (const config of requiredConfigs) {
    if (configContent.includes(config)) {
      log(`${colors.green}✅ ${config}${colors.reset}`);
    } else {
      log(`${colors.red}❌ ${config} - НЕ НАЙДЕН${colors.reset}`);
      allConfigsExist = false;
    }
  }
  
  return allConfigsExist;
}

// Функция для проверки линтера
function checkLinting() {
  log(`\n${colors.bright}${colors.blue}Проверка линтера...${colors.reset}`);
  
  const audioFiles = [
    'src/types/IAudioService.ts',
    'src/services/audio/AudioSourceDetector.ts',
    'src/services/audio/HeadphoneDetector.ts',
    'src/services/audio/HRHeadphoneHandler.ts',
    'src/services/audio/AudioStreamSplitter.ts',
    'src/components/control/StreamStatus.tsx',
    'src/components/control/HRHeadphoneStatus.tsx',
    'src/hooks/transcription/useTranscriptionRecording.ts'
  ];
  
  let lintingPassed = true;
  
  for (const file of audioFiles) {
    if (fs.existsSync(file)) {
      try {
        execSync(`npx eslint ${file} --no-error-on-unmatched-pattern`, { 
          encoding: 'utf8',
          stdio: 'pipe'
        });
        log(`${colors.green}✅ ${file} - Линтер пройден${colors.reset}`);
      } catch (error) {
        log(`${colors.red}❌ ${file} - Ошибки линтера${colors.reset}`);
        if (error.stdout) {
          console.log(error.stdout);
        }
        lintingPassed = false;
      }
    }
  }
  
  return lintingPassed;
}

// Функция для запуска unit тестов
function runUnitTests() {
  log(`\n${colors.bright}${colors.magenta}=== UNIT ТЕСТЫ ===${colors.reset}`);
  
  const unitTestFiles = [
    'src/services/audio/__tests__/AudioSourceDetector.test.ts',
    'src/services/audio/__tests__/HeadphoneDetector.test.ts',
    'src/services/audio/__tests__/AudioStreamSplitter.test.ts'
  ];
  
  let allTestsPassed = true;
  
  for (const testFile of unitTestFiles) {
    if (fs.existsSync(testFile)) {
      const success = runCommand(
        `npm test ${testFile}`,
        `Unit тест: ${path.basename(testFile)}`
      );
      if (!success) allTestsPassed = false;
    } else {
      log(`${colors.red}❌ Тест файл не найден: ${testFile}${colors.reset}`);
      allTestsPassed = false;
    }
  }
  
  return allTestsPassed;
}

// Функция для запуска integration тестов
function runIntegrationTests() {
  log(`\n${colors.bright}${colors.magenta}=== INTEGRATION ТЕСТЫ ===${colors.reset}`);
  
  const integrationTestFile = 'src/services/audio/__tests__/AudioStreamSplitter.integration.test.ts';
  
  if (fs.existsSync(integrationTestFile)) {
    return runCommand(
      `npm test ${integrationTestFile}`,
      'Integration тесты AudioStreamSplitter'
    );
  } else {
    log(`${colors.red}❌ Integration тест файл не найден: ${integrationTestFile}${colors.reset}`);
    return false;
  }
}

// Функция для запуска performance тестов
function runPerformanceTests() {
  log(`\n${colors.bright}${colors.magenta}=== PERFORMANCE ТЕСТЫ ===${colors.reset}`);
  
  const performanceTestFile = 'src/services/audio/__tests__/AudioStreamSplitter.performance.test.ts';
  
  if (fs.existsSync(performanceTestFile)) {
    return runCommand(
      `npm test ${performanceTestFile}`,
      'Performance тесты AudioStreamSplitter'
    );
  } else {
    log(`${colors.red}❌ Performance тест файл не найден: ${performanceTestFile}${colors.reset}`);
    return false;
  }
}

// Функция для генерации отчета
function generateReport(results) {
  const timestamp = new Date().toISOString();
  const reportContent = `# Отчет о тестировании аудио разделения потоков

## Дата: ${timestamp}
## Версия: v0.52

## Результаты тестирования:

### Проверка файлов: ${results.files ? '✅ ПРОЙДЕНО' : '❌ ОШИБКА'}
### Проверка конфигурации: ${results.config ? '✅ ПРОЙДЕНО' : '❌ ОШИБКА'}
### Проверка линтера: ${results.linting ? '✅ ПРОЙДЕНО' : '❌ ОШИБКА'}
### Unit тесты: ${results.unit ? '✅ ПРОЙДЕНО' : '❌ ОШИБКА'}
### Integration тесты: ${results.integration ? '✅ ПРОЙДЕНО' : '❌ ОШИБКА'}
### Performance тесты: ${results.performance ? '✅ ПРОЙДЕНО' : '❌ ОШИБКА'}

## Общий результат: ${Object.values(results).every(r => r) ? '✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ' : '❌ ЕСТЬ ОШИБКИ'}

## Рекомендации:
${!results.files ? '- Проверить наличие всех файлов\n' : ''}${!results.config ? '- Проверить конфигурацию\n' : ''}${!results.linting ? '- Исправить ошибки линтера\n' : ''}${!results.unit ? '- Исправить unit тесты\n' : ''}${!results.integration ? '- Исправить integration тесты\n' : ''}${!results.performance ? '- Исправить performance тесты\n' : ''}${Object.values(results).every(r => r) ? '- Система готова к использованию!' : ''}
`;

  const reportFile = `test-report-${timestamp.replace(/[:.]/g, '-')}.md`;
  fs.writeFileSync(reportFile, reportContent);
  
  log(`\n${colors.green}📄 Отчет сохранен: ${reportFile}${colors.reset}`);
}

// Основная функция
function main() {
  log(`${colors.bright}${colors.blue}🧪 Тестирование аудио разделения потоков v0.52${colors.reset}`);
  log(`${colors.cyan}Опции: ${JSON.stringify(options, null, 2)}${colors.reset}`);
  
  const results = {
    files: false,
    config: false,
    linting: false,
    unit: false,
    integration: false,
    performance: false
  };
  
  // Проверка файлов
  results.files = checkFiles();
  
  // Проверка конфигурации
  results.config = checkConfiguration();
  
  // Проверка линтера
  results.linting = checkLinting();
  
  // Запуск тестов
  if (options.unit || options.all) {
    results.unit = runUnitTests();
  }
  
  if (options.integration || options.all) {
    results.integration = runIntegrationTests();
  }
  
  if (options.performance || options.all) {
    results.performance = runPerformanceTests();
  }
  
  // Итоговый результат
  log(`\n${colors.bright}${colors.blue}=== ИТОГОВЫЙ РЕЗУЛЬТАТ ===${colors.reset}`);
  
  const allPassed = Object.values(results).every(r => r);
  
  if (allPassed) {
    log(`${colors.green}🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!${colors.reset}`);
    log(`${colors.green}✅ Система аудио разделения потоков готова к использованию${colors.reset}`);
  } else {
    log(`${colors.red}❌ ЕСТЬ ОШИБКИ В ТЕСТАХ${colors.reset}`);
    log(`${colors.yellow}⚠️  Проверьте результаты выше и исправьте ошибки${colors.reset}`);
  }
  
  // Генерация отчета
  generateReport(results);
  
  // Выход с соответствующим кодом
  process.exit(allPassed ? 0 : 1);
}

// Запуск
if (require.main === module) {
  main();
}

module.exports = {
  checkFiles,
  checkConfiguration,
  checkLinting,
  runUnitTests,
  runIntegrationTests,
  runPerformanceTests,
  generateReport
};
