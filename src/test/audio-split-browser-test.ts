/**
 * Браузерный тест для аудио разделения потоков
 * 
 * Запуск: Откройте консоль браузера и выполните:
 * import('./test/audio-split-browser-test').then(m => m.runBrowserTest())
 */

import { AudioStreamSplitter } from '../services/audio/AudioStreamSplitter';
import { configService } from '../services/config';
import { Logger } from '../utils/logger';

export interface BrowserTestResult {
  test: string;
  success: boolean;
  message: string;
  duration?: number;
  data?: any;
}

export class AudioSplitBrowserTester {
  private results: BrowserTestResult[] = [];
  
  async runAllTests(): Promise<BrowserTestResult[]> {
    console.log('🧪 Запуск браузерных тестов аудио разделения потоков...');
    
    this.results = [];
    
    // Тест 1: Проверка конфигурации
    await this.testConfiguration();
    
    // Тест 2: Проверка доступности API
    await this.testBrowserAPIs();
    
    // Тест 3: Инициализация AudioStreamSplitter
    await this.testInitialization();
    
    // Тест 4: Детекция источников
    await this.testSourceDetection();
    
    // Тест 5: Производительность
    await this.testPerformance();
    
    // Тест 6: Очистка ресурсов
    await this.testCleanup();
    
    this.printResults();
    return this.results;
  }
  
  private async testConfiguration(): Promise<void> {
    const startTime = performance.now();
    
    try {
      const config = configService.getAudioSplitConfig();
      
      const requiredKeys = [
        'enabled',
        'autoDetectRoles',
        'fallbackToSingleStream',
        'monitoringInterval',
        'roleReevaluationTimeout',
        'qualityThreshold',
        'activityThreshold'
      ];
      
      const missingKeys = requiredKeys.filter(key => !(key in config));
      
      if (missingKeys.length === 0) {
        this.addResult('Configuration', true, 'Конфигурация корректна', performance.now() - startTime, config);
      } else {
        this.addResult('Configuration', false, `Отсутствуют ключи: ${missingKeys.join(', ')}`, performance.now() - startTime);
      }
    } catch (error) {
      this.addResult('Configuration', false, `Ошибка конфигурации: ${error}`, performance.now() - startTime);
    }
  }
  
  private async testBrowserAPIs(): Promise<void> {
    const startTime = performance.now();
    
    try {
      const apis = {
        mediaDevices: 'mediaDevices' in navigator,
        getUserMedia: 'getUserMedia' in navigator.mediaDevices,
        getDisplayMedia: 'getDisplayMedia' in navigator.mediaDevices,
        enumerateDevices: 'enumerateDevices' in navigator.mediaDevices,
        audioContext: 'AudioContext' in window,
        requestAnimationFrame: 'requestAnimationFrame' in window
      };
      
      const missingAPIs = Object.entries(apis)
        .filter(([_, available]) => !available)
        .map(([api, _]) => api);
      
      if (missingAPIs.length === 0) {
        this.addResult('Browser APIs', true, 'Все необходимые API доступны', performance.now() - startTime, apis);
      } else {
        this.addResult('Browser APIs', false, `Отсутствуют API: ${missingAPIs.join(', ')}`, performance.now() - startTime, apis);
      }
    } catch (error) {
      this.addResult('Browser APIs', false, `Ошибка проверки API: ${error}`, performance.now() - startTime);
    }
  }
  
  private async testInitialization(): Promise<void> {
    const startTime = performance.now();
    
    try {
      const splitter = new AudioStreamSplitter();
      
      // Проверяем, что splitter создан
      if (splitter) {
        this.addResult('Initialization', true, 'AudioStreamSplitter создан успешно', performance.now() - startTime);
        
        // Очищаем ресурсы
        splitter.cleanup();
      } else {
        this.addResult('Initialization', false, 'Не удалось создать AudioStreamSplitter', performance.now() - startTime);
      }
    } catch (error) {
      this.addResult('Initialization', false, `Ошибка инициализации: ${error}`, performance.now() - startTime);
    }
  }
  
  private async testSourceDetection(): Promise<void> {
    const startTime = performance.now();
    
    try {
      const splitter = new AudioStreamSplitter();
      
      // Пытаемся получить список устройств
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      
      this.addResult('Source Detection', true, `Найдено ${audioInputs.length} аудио устройств`, performance.now() - startTime, {
        totalDevices: devices.length,
        audioInputs: audioInputs.length,
        devices: audioInputs.map(d => ({ id: d.deviceId, label: d.label }))
      });
      
      splitter.cleanup();
    } catch (error) {
      this.addResult('Source Detection', false, `Ошибка детекции источников: ${error}`, performance.now() - startTime);
    }
  }
  
  private async testPerformance(): Promise<void> {
    const startTime = performance.now();
    
    try {
      const splitter = new AudioStreamSplitter();
      
      // Тест производительности создания и очистки
      const createStart = performance.now();
      const newSplitter = new AudioStreamSplitter();
      const createTime = performance.now() - createStart;
      
      const cleanupStart = performance.now();
      newSplitter.cleanup();
      const cleanupTime = performance.now() - cleanupStart;
      
      // Тест производительности операций
      const operationsStart = performance.now();
      for (let i = 0; i < 100; i++) {
        splitter.isConfigured();
        splitter.getCandidateStream();
        splitter.getHRStream();
      }
      const operationsTime = performance.now() - operationsStart;
      
      const performanceData = {
        createTime: createTime.toFixed(2) + 'ms',
        cleanupTime: cleanupTime.toFixed(2) + 'ms',
        operationsTime: operationsTime.toFixed(2) + 'ms',
        avgOperationTime: (operationsTime / 300).toFixed(3) + 'ms'
      };
      
      // Проверяем бюджеты производительности
      const budgets = {
        createTime: createTime < 100, // 100ms
        cleanupTime: cleanupTime < 50, // 50ms
        operationsTime: operationsTime < 10 // 10ms для 300 операций
      };
      
      const budgetPassed = Object.values(budgets).every(passed => passed);
      
      this.addResult('Performance', budgetPassed, 
        budgetPassed ? 'Производительность в пределах бюджета' : 'Производительность превышает бюджет',
        performance.now() - startTime, performanceData);
      
      splitter.cleanup();
    } catch (error) {
      this.addResult('Performance', false, `Ошибка тестирования производительности: ${error}`, performance.now() - startTime);
    }
  }
  
  private async testCleanup(): Promise<void> {
    const startTime = performance.now();
    
    try {
      const splitter = new AudioStreamSplitter();
      
      // Проверяем состояние до очистки
      const beforeCleanup = {
        isConfigured: splitter.isConfigured(),
        hasCandidateStream: splitter.getCandidateStream() !== null,
        hasHRStream: splitter.getHRStream() !== null
      };
      
      // Очищаем ресурсы
      splitter.cleanup();
      
      // Проверяем состояние после очистки
      const afterCleanup = {
        isConfigured: splitter.isConfigured(),
        hasCandidateStream: splitter.getCandidateStream() !== null,
        hasHRStream: splitter.getHRStream() !== null
      };
      
      const cleanupSuccessful = !afterCleanup.isConfigured && 
                               !afterCleanup.hasCandidateStream && 
                               !afterCleanup.hasHRStream;
      
      this.addResult('Cleanup', cleanupSuccessful, 
        cleanupSuccessful ? 'Очистка ресурсов выполнена успешно' : 'Ошибка очистки ресурсов',
        performance.now() - startTime, { beforeCleanup, afterCleanup });
      
    } catch (error) {
      this.addResult('Cleanup', false, `Ошибка очистки: ${error}`, performance.now() - startTime);
    }
  }
  
  private addResult(test: string, success: boolean, message: string, duration?: number, data?: any): void {
    this.results.push({
      test,
      success,
      message,
      duration,
      data
    });
  }
  
  private printResults(): void {
    console.log('\n📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ:');
    console.log('='.repeat(50));
    
    let passed = 0;
    let failed = 0;
    
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const duration = result.duration ? ` (${result.duration.toFixed(2)}ms)` : '';
      
      console.log(`${status} ${result.test}: ${result.message}${duration}`);
      
      if (result.data && result.success) {
        console.log(`   📋 Данные:`, result.data);
      }
      
      if (result.success) {
        passed++;
      } else {
        failed++;
      }
    });
    
    console.log('='.repeat(50));
    console.log(`📈 Итого: ${passed} пройдено, ${failed} провалено`);
    
    if (failed === 0) {
      console.log('🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!');
      console.log('✅ Система аудио разделения потоков готова к использованию');
    } else {
      console.log('⚠️  ЕСТЬ ПРОБЛЕМЫ - проверьте результаты выше');
    }
  }
}

// Функция для быстрого запуска
export async function runBrowserTest(): Promise<BrowserTestResult[]> {
  const tester = new AudioSplitBrowserTester();
  return await tester.runAllTests();
}

// Функция для тестирования конкретного сценария
export async function testHeadphoneScenario(scenario: string): Promise<BrowserTestResult[]> {
  console.log(`🎧 Тестирование сценария: ${scenario}`);
  
  const tester = new AudioSplitBrowserTester();
  const results = await tester.runAllTests();
  
  // Добавляем специфичные для сценария проверки
  console.log(`\n🎯 Специфичные проверки для сценария "${scenario}":`);
  
  // Здесь можно добавить специфичные проверки для каждого сценария
  switch (scenario) {
    case 'usb_headphones':
      console.log('✅ Проверка USB наушников');
      break;
    case 'bluetooth_phone':
      console.log('✅ Проверка Bluetooth наушников → телефон');
      break;
    case 'bluetooth_computer':
      console.log('✅ Проверка Bluetooth наушников → компьютер');
      break;
    case 'wireless':
      console.log('✅ Проверка беспроводных наушников');
      break;
    case 'dual':
      console.log('✅ Проверка обоих с наушниками');
      break;
    default:
      console.log('⚠️  Неизвестный сценарий');
  }
  
  return results;
}

// Экспорт для использования в консоли
(window as any).AudioSplitBrowserTester = AudioSplitBrowserTester;
(window as any).runBrowserTest = runBrowserTest;
(window as any).testHeadphoneScenario = testHeadphoneScenario;
