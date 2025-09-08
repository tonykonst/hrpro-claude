# Аудио разделение потоков: Кандидат vs HR

*Дата создания: 5 сентября 2025*  
*Версия: v0.51*  
*Статус: Планирование*

---

## 📋 **ПРОБЛЕМА**

В текущей реализации Interview Assistant обрабатывается только один аудиопоток от микрофона пользователя. Однако в реальном сценарии интервью:

- **Кандидат** говорит через видеозвонок (Zoom, Teams, etc.)
- **HR** говорит через микрофон компьютера
- **Система должна анализировать только речь кандидата**

Требуется реализовать разделение аудиопотоков для изоляции речи кандидата от речи HR.

---

## 🎯 **ЦЕЛИ РЕАЛИЗАЦИИ**

1. **Разделение аудиопотоков**: Изолировать речь кандидата от речи HR
2. **Автоматическое определение**: Автоматически определять, кто говорит
3. **Анализ только кандидата**: Обрабатывать транскрипцию только речи кандидата
4. **Сохранение производительности**: Минимальное влияние на латентность
5. **Fallback режим**: Работа при невозможности разделения потоков

---

## 🏗️ **АРХИТЕКТУРА РЕШЕНИЯ**

### **1. Многоуровневая система разделения**

```
┌─────────────────────────────────────────────────────────────┐
│                    АУДИО СИСТЕМА                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │   КАНДИДАТ      │    │      HR         │                │
│  │  (Видеозвонок)  │    │  (Микрофон)     │                │
│  └─────────────────┘    └─────────────────┘                │
│           │                       │                        │
│           ▼                       ▼                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │           АУДИО РАЗДЕЛИТЕЛЬ (Audio Splitter)           │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │ │
│  │  │   Детектор  │  │   Фильтр    │  │   Селектор  │    │ │
│  │  │   источника │  │   качества  │  │   потока    │    │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘    │ │
│  └─────────────────────────────────────────────────────────┘ │
│           │                       │                        │
│           ▼                       ▼                        │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │  КАНДИДАТ       │    │  HR (игнорир.)  │                │
│  │  (обработка)    │    │  (мониторинг)   │                │
│  └─────────────────┘    └─────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### **2. Компоненты системы**

#### **A. Audio Source Detector**
- Определяет источник аудио (микрофон vs системный звук)
- Анализирует характеристики потока
- Детектирует активность речи

#### **B. Audio Quality Filter**
- Фильтрует потоки по качеству
- Определяет приоритетные источники
- Устраняет шум и артефакты

#### **C. Stream Selector**
- Выбирает основной поток для анализа
- Переключается между потоками при необходимости
- Обеспечивает fallback режим

---

## 🔧 **ТЕХНИЧЕСКАЯ РЕАЛИЗАЦИЯ**

### **1. Новые сервисы**

#### **A. AudioSourceDetector**

```typescript
// src/services/audio/AudioSourceDetector.ts
export interface AudioSource {
  id: string;
  type: 'microphone' | 'system' | 'application';
  name: string;
  isActive: boolean;
  quality: number; // 0-1
  priority: number; // 0-10
  characteristics: {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    latency: number;
  };
}

export class AudioSourceDetector {
  private sources: Map<string, AudioSource> = new Map();
  private activeSource: string | null = null;
  
  async detectSources(): Promise<AudioSource[]> {
    // 1. Получаем доступные аудиоустройства
    const devices = await navigator.mediaDevices.enumerateDevices();
    
    // 2. Анализируем системный звук (через Web Audio API)
    const systemAudio = await this.detectSystemAudio();
    
    // 3. Определяем характеристики каждого источника
    const sources = await this.analyzeSources(devices, systemAudio);
    
    return sources;
  }
  
  private async detectSystemAudio(): Promise<AudioSource | null> {
    try {
      // Попытка захвата системного звука (требует разрешений)
      const constraints = {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          // Специальные флаги для системного звука
          systemAudio: true
        }
      };
      
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      return {
        id: 'system-audio',
        type: 'system',
        name: 'System Audio',
        isActive: true,
        quality: 0.9,
        priority: 8,
        characteristics: {
          sampleRate: 48000,
          channels: 2,
          bitDepth: 16,
          latency: 50
        }
      };
    } catch (error) {
      console.warn('System audio capture not available:', error);
      return null;
    }
  }
  
  private async analyzeSources(devices: MediaDeviceInfo[], systemAudio: AudioSource | null): Promise<AudioSource[]> {
    const sources: AudioSource[] = [];
    
    // Анализируем микрофоны
    for (const device of devices.filter(d => d.kind === 'audioinput')) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: device.deviceId }
        });
        
        const quality = await this.analyzeAudioQuality(stream);
        const priority = this.calculatePriority(device, quality);
        
        sources.push({
          id: device.deviceId,
          type: 'microphone',
          name: device.label || 'Microphone',
          isActive: false,
          quality,
          priority,
          characteristics: {
            sampleRate: 16000,
            channels: 1,
            bitDepth: 16,
            latency: 100
          }
        });
        
        stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        console.warn(`Failed to analyze device ${device.deviceId}:`, error);
      }
    }
    
    // Добавляем системный звук если доступен
    if (systemAudio) {
      sources.push(systemAudio);
    }
    
    return sources.sort((a, b) => b.priority - a.priority);
  }
  
  private async analyzeAudioQuality(stream: MediaStream): Promise<number> {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    
    analyser.fftSize = 2048;
    source.connect(analyser);
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    
    // Анализируем частотный спектр для определения качества
    const quality = this.calculateQualityFromSpectrum(dataArray);
    
    audioContext.close();
    return quality;
  }
  
  private calculateQualityFromSpectrum(data: Uint8Array): number {
    // Простой алгоритм оценки качества по спектру
    const total = data.reduce((sum, value) => sum + value, 0);
    const average = total / data.length;
    const variance = data.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / data.length;
    
    // Качество основано на средней амплитуде и вариативности
    return Math.min(1, (average / 128) * (variance / 1000));
  }
  
  private calculatePriority(device: MediaDeviceInfo, quality: number): number {
    let priority = quality * 5; // Базовый приоритет от качества
    
    // Повышаем приоритет для устройств с определенными именами
    const name = device.label.toLowerCase();
    if (name.includes('headset') || name.includes('headphone')) {
      priority += 2; // Гарнитуры обычно лучше для интервью
    }
    if (name.includes('usb') || name.includes('bluetooth')) {
      priority += 1; // USB/Bluetooth устройства часто качественнее
    }
    
    return Math.min(10, priority);
  }
}
```

#### **B. AudioStreamSplitter**

```typescript
// src/services/audio/AudioStreamSplitter.ts
export interface StreamAnalysis {
  source: AudioSource;
  isActive: boolean;
  confidence: number;
  lastActivity: number;
  characteristics: {
    volume: number;
    frequency: number;
    clarity: number;
  };
}

export class AudioStreamSplitter {
  private detector: AudioSourceDetector;
  private activeStreams: Map<string, MediaStream> = new Map();
  private streamAnalyses: Map<string, StreamAnalysis> = new Map();
  private candidateStream: string | null = null;
  private hrStream: string | null = null;
  
  constructor() {
    this.detector = new AudioSourceDetector();
  }
  
  async initialize(): Promise<void> {
    const sources = await this.detector.detectSources();
    
    // Инициализируем потоки для всех источников
    for (const source of sources) {
      await this.initializeStream(source);
    }
    
    // Автоматически определяем кандидата и HR
    await this.autoDetectRoles();
  }
  
  private async initializeStream(source: AudioSource): Promise<void> {
    try {
      let stream: MediaStream;
      
      if (source.type === 'system') {
        // Захват системного звука
        stream = await navigator.mediaDevices.getDisplayMedia({
          audio: true,
          video: false
        });
      } else {
        // Захват микрофона
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: source.id }
        });
      }
      
      this.activeStreams.set(source.id, stream);
      
      // Начинаем анализ потока
      this.startStreamAnalysis(source.id, stream);
      
    } catch (error) {
      console.error(`Failed to initialize stream for ${source.id}:`, error);
    }
  }
  
  private startStreamAnalysis(sourceId: string, stream: MediaStream): void {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    
    analyser.fftSize = 2048;
    source.connect(analyser);
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const analyze = () => {
      analyser.getByteFrequencyData(dataArray);
      
      const analysis = this.analyzeStreamData(dataArray, sourceId);
      this.streamAnalyses.set(sourceId, analysis);
      
      // Обновляем роли если необходимо
      this.updateRoleDetection();
      
      requestAnimationFrame(analyze);
    };
    
    analyze();
  }
  
  private analyzeStreamData(data: Uint8Array, sourceId: string): StreamAnalysis {
    const source = this.detector.getSource(sourceId);
    if (!source) throw new Error(`Source ${sourceId} not found`);
    
    // Анализируем характеристики аудио
    const volume = this.calculateVolume(data);
    const frequency = this.calculateDominantFrequency(data);
    const clarity = this.calculateClarity(data);
    
    const isActive = volume > 0.1; // Порог активности
    const confidence = this.calculateConfidence(volume, frequency, clarity);
    
    return {
      source,
      isActive,
      confidence,
      lastActivity: isActive ? Date.now() : this.streamAnalyses.get(sourceId)?.lastActivity || 0,
      characteristics: {
        volume,
        frequency,
        clarity
      }
    };
  }
  
  private calculateVolume(data: Uint8Array): number {
    const sum = data.reduce((acc, value) => acc + value, 0);
    return sum / (data.length * 255);
  }
  
  private calculateDominantFrequency(data: Uint8Array): number {
    let maxIndex = 0;
    let maxValue = 0;
    
    for (let i = 0; i < data.length; i++) {
      if (data[i] > maxValue) {
        maxValue = data[i];
        maxIndex = i;
      }
    }
    
    // Конвертируем индекс в частоту (примерно)
    return (maxIndex / data.length) * 22050; // 22050 Hz - половина частоты дискретизации
  }
  
  private calculateClarity(data: Uint8Array): number {
    // Анализируем четкость по распределению частот
    const sorted = [...data].sort((a, b) => b - a);
    const top10Percent = sorted.slice(0, Math.floor(sorted.length * 0.1));
    const average = data.reduce((sum, value) => sum + value, 0) / data.length;
    
    // Четкость выше если есть выраженные пики
    return top10Percent.reduce((sum, value) => sum + value, 0) / (top10Percent.length * 255);
  }
  
  private calculateConfidence(volume: number, frequency: number, clarity: number): number {
    // Комбинированная оценка уверенности
    const volumeScore = Math.min(1, volume * 2);
    const frequencyScore = this.getFrequencyScore(frequency);
    const clarityScore = clarity;
    
    return (volumeScore + frequencyScore + clarityScore) / 3;
  }
  
  private getFrequencyScore(frequency: number): number {
    // Человеческая речь обычно в диапазоне 85-255 Hz (основной тон)
    // и 300-3400 Hz (форманты)
    if (frequency >= 85 && frequency <= 255) return 1.0;
    if (frequency >= 300 && frequency <= 3400) return 0.8;
    if (frequency >= 50 && frequency <= 8000) return 0.6;
    return 0.2;
  }
  
  private async autoDetectRoles(): Promise<void> {
    // Алгоритм автоматического определения ролей
    const analyses = Array.from(this.streamAnalyses.values());
    
    if (analyses.length < 2) {
      // Если только один поток, считаем его кандидатом
      this.candidateStream = analyses[0]?.source.id || null;
      return;
    }
    
    // Сортируем по приоритету и характеристикам
    const sorted = analyses.sort((a, b) => {
      // Приоритет: системный звук > качество > активность
      if (a.source.type === 'system' && b.source.type !== 'system') return -1;
      if (b.source.type === 'system' && a.source.type !== 'system') return 1;
      
      const aScore = a.confidence * a.source.quality * a.source.priority;
      const bScore = b.confidence * b.source.quality * b.source.priority;
      
      return bScore - aScore;
    });
    
    // Первый поток - кандидат (обычно системный звук от видеозвонка)
    this.candidateStream = sorted[0].source.id;
    
    // Второй поток - HR (обычно микрофон)
    this.hrStream = sorted[1].source.id;
    
    console.log(`🎯 Auto-detected roles: Candidate=${this.candidateStream}, HR=${this.hrStream}`);
  }
  
  private updateRoleDetection(): void {
    // Периодически пересматриваем роли на основе активности
    const now = Date.now();
    const analyses = Array.from(this.streamAnalyses.values());
    
    // Если кандидат неактивен более 30 секунд, пересматриваем
    const candidateAnalysis = this.candidateStream ? this.streamAnalyses.get(this.candidateStream) : null;
    if (candidateAnalysis && now - candidateAnalysis.lastActivity > 30000) {
      console.log('🔄 Re-evaluating roles due to candidate inactivity');
      this.autoDetectRoles();
    }
  }
  
  // Публичные методы
  getCandidateStream(): MediaStream | null {
    return this.candidateStream ? this.activeStreams.get(this.candidateStream) || null : null;
  }
  
  getHRStream(): MediaStream | null {
    return this.hrStream ? this.activeStreams.get(this.hrStream) || null : null;
  }
  
  getCandidateAnalysis(): StreamAnalysis | null {
    return this.candidateStream ? this.streamAnalyses.get(this.candidateStream) || null : null;
  }
  
  getHRAnalysis(): StreamAnalysis | null {
    return this.hrStream ? this.streamAnalyses.get(this.hrStream) || null : null;
  }
  
  isCandidateActive(): boolean {
    const analysis = this.getCandidateAnalysis();
    return analysis ? analysis.isActive : false;
  }
  
  // Ручное переопределение ролей
  setCandidateStream(sourceId: string): void {
    this.candidateStream = sourceId;
    console.log(`🎯 Manually set candidate stream: ${sourceId}`);
  }
  
  setHRStream(sourceId: string): void {
    this.hrStream = sourceId;
    console.log(`🎯 Manually set HR stream: ${sourceId}`);
  }
  
  // Очистка ресурсов
  cleanup(): void {
    this.activeStreams.forEach(stream => {
      stream.getTracks().forEach(track => track.stop());
    });
    this.activeStreams.clear();
    this.streamAnalyses.clear();
  }
}
```

### **2. Интеграция с существующей системой**

#### **A. Обновление useTranscriptionRecording**

```typescript
// src/hooks/transcription/useTranscriptionRecording.ts
export const useTranscriptionRecording = () => {
  const [streamSplitter, setStreamSplitter] = useState<AudioStreamSplitter | null>(null);
  const [candidateStream, setCandidateStream] = useState<MediaStream | null>(null);
  
  const startRecording = useCallback(async () => {
    try {
      // ШАГ 1: Инициализируем разделитель потоков
      const splitter = new AudioStreamSplitter();
      await splitter.initialize();
      setStreamSplitter(splitter);
      
      // ШАГ 2: Получаем поток кандидата
      const candidateAudioStream = splitter.getCandidateStream();
      if (!candidateAudioStream) {
        throw new Error('No candidate audio stream available');
      }
      setCandidateStream(candidateAudioStream);
      
      // ШАГ 3: Подключаемся к Deepgram с потоком кандидата
      const cleanup = await connectToDeepgram();
      
      // ШАГ 4: Настраиваем аудио pipeline для потока кандидата
      const audioContext = new AudioContext({ sampleRate: 16000 });
      await audioContext.audioWorklet.addModule('/audioWorklet.js');
      
      const source = audioContext.createMediaStreamSource(candidateAudioStream);
      const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
      
      // ШАГ 5: Обработчик аудио данных (только кандидат)
      workletNode.port.onmessage = (event) => {
        if (event.data.type === 'pcm-data') {
          deepgramRef.current.sendAudio(event.data.data);
        }
      };
      
      source.connect(workletNode);
      
      // ШАГ 6: Мониторим активность потоков
      startStreamMonitoring(splitter);
      
    } catch (error) {
      console.error('Failed to start recording with stream splitting:', error);
      // Fallback к обычному режиму
      await startRecordingFallback();
    }
  }, []);
  
  const startStreamMonitoring = useCallback((splitter: AudioStreamSplitter) => {
    const monitor = setInterval(() => {
      const candidateAnalysis = splitter.getCandidateAnalysis();
      const hrAnalysis = splitter.getHRAnalysis();
      
      // Логируем активность для отладки
      if (candidateAnalysis?.isActive) {
        console.log(`🎤 Candidate active: volume=${candidateAnalysis.characteristics.volume.toFixed(2)}`);
      }
      if (hrAnalysis?.isActive) {
        console.log(`👤 HR active: volume=${hrAnalysis.characteristics.volume.toFixed(2)}`);
      }
      
      // Можно добавить логику переключения потоков при необходимости
    }, 1000);
    
    return () => clearInterval(monitor);
  }, []);
  
  const startRecordingFallback = useCallback(async () => {
    // Обычный режим записи без разделения потоков
    console.log('🔄 Falling back to single-stream recording');
    
    const audioConstraints = configService.getAudioConstraints();
    const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
    
    // ... остальная логика как раньше
  }, []);
  
  const stopRecording = useCallback(() => {
    if (streamSplitter) {
      streamSplitter.cleanup();
      setStreamSplitter(null);
    }
    setCandidateStream(null);
    
    // ... остальная логика остановки
  }, [streamSplitter]);
  
  return {
    startRecording,
    stopRecording,
    candidateStream,
    streamSplitter
  };
};
```

#### **B. Обновление UI для отображения потоков**

```typescript
// src/components/control/StreamStatus.tsx
interface StreamStatusProps {
  streamSplitter: AudioStreamSplitter | null;
}

export const StreamStatus: React.FC<StreamStatusProps> = ({ streamSplitter }) => {
  const [candidateAnalysis, setCandidateAnalysis] = useState<StreamAnalysis | null>(null);
  const [hrAnalysis, setHRAnalysis] = useState<StreamAnalysis | null>(null);
  
  useEffect(() => {
    if (!streamSplitter) return;
    
    const updateAnalyses = () => {
      setCandidateAnalysis(streamSplitter.getCandidateAnalysis());
      setHRAnalysis(streamSplitter.getHRAnalysis());
    };
    
    const interval = setInterval(updateAnalyses, 500);
    return () => clearInterval(interval);
  }, [streamSplitter]);
  
  if (!streamSplitter) return null;
  
  return (
    <div className="stream-status">
      <div className="stream-status__title">Audio Streams</div>
      
      <div className="stream-status__stream">
        <div className="stream-status__label">
          🎤 Candidate {candidateAnalysis?.isActive ? '●' : '○'}
        </div>
        <div className="stream-status__details">
          {candidateAnalysis && (
            <>
              <div>Volume: {(candidateAnalysis.characteristics.volume * 100).toFixed(0)}%</div>
              <div>Confidence: {(candidateAnalysis.confidence * 100).toFixed(0)}%</div>
            </>
          )}
        </div>
      </div>
      
      <div className="stream-status__stream">
        <div className="stream-status__label">
          👤 HR {hrAnalysis?.isActive ? '●' : '○'}
        </div>
        <div className="stream-status__details">
          {hrAnalysis && (
            <>
              <div>Volume: {(hrAnalysis.characteristics.volume * 100).toFixed(0)}%</div>
              <div>Confidence: {(hrAnalysis.confidence * 100).toFixed(0)}%</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
```

### **3. Конфигурация**

```typescript
// src/services/config.ts - добавления
interface AudioSplitConfig {
  enabled: boolean;
  autoDetectRoles: boolean;
  candidateSource: string | null; // ID источника для кандидата
  hrSource: string | null; // ID источника для HR
  fallbackToSingleStream: boolean;
  monitoringInterval: number; // мс
  roleReevaluationTimeout: number; // мс
  qualityThreshold: number; // 0-1
  activityThreshold: number; // 0-1
}

// В AppConfig
audio: {
  // ... существующие настройки
  split: {
    enabled: true,
    autoDetectRoles: true,
    candidateSource: null, // null = автоопределение
    hrSource: null, // null = автоопределение
    fallbackToSingleStream: true,
    monitoringInterval: 1000,
    roleReevaluationTimeout: 30000,
    qualityThreshold: 0.3,
    activityThreshold: 0.1
  }
}
```

---

## 📊 **ТАБЛИЦА СЦЕНАРИЕВ НАУШНИКОВ**

| Сценарий | HR Наушники | Кандидат Наушники | Приоритет | Источник Кандидата | Источник HR | Фильтрация |
|----------|-------------|-------------------|-----------|-------------------|-------------|------------|
| **Оптимальный** | Bluetooth (телефон) | Любые | 1 | Системный звук | Нет | Не нужна |
| **Хороший** | USB/Jack | Любые | 2 | Системный звук (фильтрованный) | Микрофон HR | HR из системного звука |
| **Сложный** | Bluetooth (компьютер) | Любые | 3 | Системный звук (ML фильтр) | Bluetooth микрофон | ML разделение |
| **Смешанный** | Нет | Есть | 4 | Системный звук | Микрофон HR | Эхо-подавление |
| **Идеальный** | Любые | Любые | 5 | Системный звук | Микрофон наушников | Speaker Diarization |

### **Детальное описание сценариев**

#### **🎯 Сценарий 1: Оптимальный (HR Bluetooth → телефон)**
- **HR**: Bluetooth наушники подключены к телефону
- **Кандидат**: Любые наушники или без них
- **Результат**: Системный звук содержит ТОЛЬКО речь кандидата
- **Действия**: Никакой фильтрации не требуется
- **Точность**: 95-99%

#### **🎯 Сценарий 2: Хороший (HR USB/Jack наушники)**
- **HR**: USB или Jack наушники подключены к компьютеру
- **Кандидат**: Любые наушники или без них
- **Результат**: HR речь может попадать в системный звук
- **Действия**: Фильтрация HR речи из системного звука
- **Точность**: 85-95%

#### **🎯 Сценарий 3: Сложный (HR Bluetooth → компьютер)**
- **HR**: Bluetooth наушники подключены к компьютеру
- **Кандидат**: Любые наушники или без них
- **Результат**: HR речь в обоих потоках
- **Действия**: Машинное обучение для разделения
- **Точность**: 75-90%

#### **🎯 Сценарий 4: Смешанный (HR без наушников, кандидат с наушниками)**
- **HR**: Обычный микрофон
- **Кандидат**: Наушники для видеозвонка
- **Результат**: Возможны эхо-эффекты
- **Действия**: Эхо-подавление
- **Точность**: 80-90%

#### **🎯 Сценарий 5: Идеальный (оба с наушниками)**
- **HR**: Любые наушники с микрофоном
- **Кандидат**: Любые наушники
- **Результат**: Максимальное разделение потоков
- **Действия**: Speaker Diarization для финальной проверки
- **Точность**: 95-99%

## 🚀 **ПЛАН ВНЕДРЕНИЯ**

### **Этап 1: Базовая инфраструктура (2-3 дня)**
1. Создать `AudioSourceDetector` класс
2. Создать `HeadphoneDetector` класс
3. Реализовать обнаружение аудиоустройств
4. Добавить базовый анализ качества аудио
5. Интегрировать с существующей системой конфигурации

### **Этап 2: Разделение потоков (3-4 дня)**
1. Создать `AudioStreamSplitter` класс
2. Создать `HRHeadphoneHandler` класс
3. Реализовать захват системного звука
4. Добавить анализ характеристик потоков
5. Реализовать автоматическое определение ролей
6. Добавить правила приоритизации наушников

### **Этап 3: Интеграция (2-3 дня)**
1. Обновить `useTranscriptionRecording` хук
2. Добавить fallback режим
3. Интегрировать с Deepgram
4. Добавить мониторинг потоков
5. Реализовать адаптивное обучение

### **Этап 4: UI и тестирование (2-3 дня)**
1. Создать компонент `StreamStatus`
2. Создать компонент `HRHeadphoneStatus`
3. Добавить ручное переопределение ролей
4. Тестирование с реальными видеозвонками
5. Тестирование всех сценариев наушников
6. Оптимизация производительности

### **Этап 5: Продвинутые функции (3-4 дня)**
1. Реализовать Speaker Diarization
2. Добавить машинное обучение для разделения
3. Создать адаптивные алгоритмы
4. Добавить голосовые отпечатки
5. Финальное тестирование и оптимизация

---

## 🎧 **СПЕЦИАЛЬНЫЕ СЦЕНАРИИ**

### **HR с наушниками**

#### **Проблема**
Когда HR использует наушники, его речь может попадать в системный звук (если наушники подключены к компьютеру) или вообще не захватываться (если наушники подключены к телефону/отдельному устройству).

#### **Детекция наушников HR**

```typescript
// src/services/audio/HeadphoneDetector.ts
export interface HeadphoneInfo {
  hasHeadphones: boolean;
  type: 'usb' | 'bluetooth' | 'jack' | 'wireless' | 'unknown';
  isActive: boolean;
  deviceName: string;
  characteristics: {
    hasMicrophone: boolean;
    isNoiseCancelling: boolean;
    isWireless: boolean;
  };
}

export class HeadphoneDetector {
  async detectHeadphones(): Promise<HeadphoneInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const headphones: HeadphoneInfo[] = [];
    
    for (const device of devices.filter(d => d.kind === 'audioinput')) {
      const info = await this.analyzeDevice(device);
      if (this.isHeadphoneDevice(info)) {
        headphones.push(info);
      }
    }
    
    return headphones;
  }
  
  private async analyzeDevice(device: MediaDeviceInfo): Promise<HeadphoneInfo> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: device.deviceId }
      });
      
      const characteristics = await this.analyzeDeviceCharacteristics(stream);
      
      stream.getTracks().forEach(track => track.stop());
      
      return {
        hasHeadphones: this.isHeadphoneDevice({ device, characteristics }),
        type: this.detectHeadphoneType(device.label, characteristics),
        isActive: true,
        deviceName: device.label || 'Unknown Device',
        characteristics
      };
    } catch (error) {
      return {
        hasHeadphones: false,
        type: 'unknown',
        isActive: false,
        deviceName: device.label || 'Unknown Device',
        characteristics: {
          hasMicrophone: false,
          isNoiseCancelling: false,
          isWireless: false
        }
      };
    }
  }
  
  private isHeadphoneDevice(info: any): boolean {
    const name = info.device.label.toLowerCase();
    const keywords = [
      'headphone', 'headset', 'earphone', 'airpods', 'buds',
      'wireless', 'bluetooth', 'usb headset', 'gaming headset'
    ];
    
    return keywords.some(keyword => name.includes(keyword));
  }
  
  private detectHeadphoneType(deviceName: string, characteristics: any): HeadphoneInfo['type'] {
    const name = deviceName.toLowerCase();
    
    if (name.includes('usb')) return 'usb';
    if (name.includes('bluetooth') || name.includes('wireless')) return 'bluetooth';
    if (name.includes('jack') || name.includes('3.5mm')) return 'jack';
    if (characteristics.isWireless) return 'wireless';
    
    return 'unknown';
  }
}
```

#### **Правила обработки HR с наушниками**

```typescript
// src/services/audio/HRHeadphoneHandler.ts
export class HRHeadphoneHandler {
  private headphoneDetector: HeadphoneDetector;
  private streamSplitter: AudioStreamSplitter;
  
  constructor(streamSplitter: AudioStreamSplitter) {
    this.headphoneDetector = new HeadphoneDetector();
    this.streamSplitter = streamSplitter;
  }
  
  async handleHRWithHeadphones(): Promise<HRHeadphoneStrategy> {
    const headphones = await this.headphoneDetector.detectHeadphones();
    const hrHeadphones = headphones.find(h => this.isHRHeadphone(h));
    
    if (!hrHeadphones) {
      return { strategy: 'no_headphones', message: 'HR not using headphones' };
    }
    
    // Определяем стратегию в зависимости от типа наушников
    switch (hrHeadphones.type) {
      case 'usb':
        return this.handleUSBHeadphones(hrHeadphones);
      case 'bluetooth':
        return this.handleBluetoothHeadphones(hrHeadphones);
      case 'jack':
        return this.handleJackHeadphones(hrHeadphones);
      case 'wireless':
        return this.handleWirelessHeadphones(hrHeadphones);
      default:
        return this.handleUnknownHeadphones(hrHeadphones);
    }
  }
  
  private async handleUSBHeadphones(headphones: HeadphoneInfo): Promise<HRHeadphoneStrategy> {
    // USB наушники обычно подключаются к компьютеру
    // HR речь может попадать в системный звук
    
    const strategy: HRHeadphoneStrategy = {
      strategy: 'usb_headphones',
      message: 'HR using USB headphones - monitoring system audio for HR speech',
      actions: [
        'Monitor system audio for HR speech patterns',
        'Use voice activity detection to filter HR speech',
        'Focus on candidate speech from video call',
        'Enable HR speech suppression in system audio'
      ],
      configuration: {
        monitorSystemAudio: true,
        suppressHRInSystemAudio: true,
        candidateSource: 'system_audio_filtered',
        hrSource: 'usb_headphone_mic'
      }
    };
    
    // Настраиваем фильтрацию HR речи из системного звука
    await this.configureHRSuppression(strategy.configuration);
    
    return strategy;
  }
  
  private async handleBluetoothHeadphones(headphones: HeadphoneInfo): Promise<HRHeadphoneStrategy> {
    // Bluetooth наушники могут быть подключены к телефону или компьютеру
    
    const strategy: HRHeadphoneStrategy = {
      strategy: 'bluetooth_headphones',
      message: 'HR using Bluetooth headphones - checking connection target',
      actions: [
        'Determine if headphones connected to computer or phone',
        'If computer: monitor system audio for HR speech',
        'If phone: HR speech will not be captured',
        'Focus on candidate speech from video call'
      ],
      configuration: {
        monitorSystemAudio: true,
        suppressHRInSystemAudio: false, // Может быть не нужно
        candidateSource: 'system_audio',
        hrSource: 'bluetooth_mic_or_none'
      }
    };
    
    // Проверяем, подключены ли наушники к компьютеру
    const isConnectedToComputer = await this.checkBluetoothConnection(headphones);
    if (!isConnectedToComputer) {
      strategy.configuration.hrSource = 'none';
      strategy.message += ' - HR speech not captured (connected to phone)';
    }
    
    return strategy;
  }
  
  private async handleJackHeadphones(headphones: HeadphoneInfo): Promise<HRHeadphoneStrategy> {
    // Jack наушники обычно подключаются к компьютеру
    
    return {
      strategy: 'jack_headphones',
      message: 'HR using jack headphones - monitoring for HR speech',
      actions: [
        'Monitor system audio for HR speech',
        'Use audio analysis to distinguish HR from candidate',
        'Focus on candidate speech from video call'
      ],
      configuration: {
        monitorSystemAudio: true,
        suppressHRInSystemAudio: true,
        candidateSource: 'system_audio_filtered',
        hrSource: 'jack_headphone_mic'
      }
    };
  }
  
  private async handleWirelessHeadphones(headphones: HeadphoneInfo): Promise<HRHeadphoneStrategy> {
    // Беспроводные наушники (AirPods, etc.)
    
    return {
      strategy: 'wireless_headphones',
      message: 'HR using wireless headphones - advanced filtering required',
      actions: [
        'Use advanced voice separation algorithms',
        'Monitor both system audio and headphone mic',
        'Apply machine learning for speaker identification',
        'Focus on candidate speech with high confidence'
      ],
      configuration: {
        monitorSystemAudio: true,
        suppressHRInSystemAudio: true,
        useAdvancedFiltering: true,
        candidateSource: 'system_audio_ml_filtered',
        hrSource: 'wireless_mic_ml_identified'
      }
    };
  }
  
  private async handleUnknownHeadphones(headphones: HeadphoneInfo): Promise<HRHeadphoneStrategy> {
    return {
      strategy: 'unknown_headphones',
      message: 'HR using unknown headphone type - using adaptive detection',
      actions: [
        'Use adaptive voice detection',
        'Monitor all available audio sources',
        'Learn HR voice patterns during interview',
        'Apply dynamic filtering based on learned patterns'
      ],
      configuration: {
        monitorSystemAudio: true,
        suppressHRInSystemAudio: false,
        useAdaptiveDetection: true,
        candidateSource: 'adaptive_detection',
        hrSource: 'adaptive_detection'
      }
    };
  }
  
  private isHRHeadphone(headphones: HeadphoneInfo): boolean {
    // Определяем, являются ли наушники HR наушниками
    // Обычно это наушники с микрофоном, подключенные к компьютеру
    return headphones.hasHeadphones && 
           headphones.characteristics.hasMicrophone && 
           headphones.isActive;
  }
  
  private async configureHRSuppression(config: any): Promise<void> {
    // Настраиваем подавление HR речи в системном звуке
    if (config.suppressHRInSystemAudio) {
      // Реализация алгоритма подавления HR речи
      console.log('🔇 Configuring HR speech suppression in system audio');
    }
  }
  
  private async checkBluetoothConnection(headphones: HeadphoneInfo): Promise<boolean> {
    // Проверяем, подключены ли Bluetooth наушники к компьютеру
    // Это можно сделать через Web Bluetooth API или анализ устройств
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const bluetoothDevices = devices.filter(d => 
        d.label.toLowerCase().includes('bluetooth') && 
        d.kind === 'audioinput'
      );
      
      return bluetoothDevices.length > 0;
    } catch (error) {
      console.warn('Could not check Bluetooth connection:', error);
      return false;
    }
  }
}

export interface HRHeadphoneStrategy {
  strategy: 'no_headphones' | 'usb_headphones' | 'bluetooth_headphones' | 
           'jack_headphones' | 'wireless_headphones' | 'unknown_headphones';
  message: string;
  actions: string[];
  configuration: {
    monitorSystemAudio: boolean;
    suppressHRInSystemAudio: boolean;
    useAdvancedFiltering?: boolean;
    useAdaptiveDetection?: boolean;
    candidateSource: string;
    hrSource: string;
  };
}
```

#### **Интеграция с AudioStreamSplitter**

```typescript
// Обновление AudioStreamSplitter для поддержки наушников HR
export class AudioStreamSplitter {
  private hrHeadphoneHandler: HRHeadphoneHandler;
  private hrStrategy: HRHeadphoneStrategy | null = null;
  
  constructor() {
    this.detector = new AudioSourceDetector();
    this.hrHeadphoneHandler = new HRHeadphoneHandler(this);
  }
  
  async initialize(): Promise<void> {
    const sources = await this.detector.detectSources();
    
    // Инициализируем потоки для всех источников
    for (const source of sources) {
      await this.initializeStream(source);
    }
    
    // Проверяем наушники HR
    this.hrStrategy = await this.hrHeadphoneHandler.handleHRWithHeadphones();
    console.log(`🎧 HR Headphone Strategy: ${this.hrStrategy.message}`);
    
    // Автоматически определяем роли с учетом наушников
    await this.autoDetectRolesWithHeadphones();
  }
  
  private async autoDetectRolesWithHeadphones(): Promise<void> {
    const analyses = Array.from(this.streamAnalyses.values());
    
    if (analyses.length < 2) {
      this.candidateStream = analyses[0]?.source.id || null;
      return;
    }
    
    // Применяем стратегию для наушников HR
    if (this.hrStrategy) {
      await this.applyHRHeadphoneStrategy(this.hrStrategy);
    } else {
      // Обычное определение ролей
      await this.autoDetectRoles();
    }
  }
  
  private async applyHRHeadphoneStrategy(strategy: HRHeadphoneStrategy): Promise<void> {
    const analyses = Array.from(this.streamAnalyses.values());
    
    switch (strategy.strategy) {
      case 'usb_headphones':
      case 'jack_headphones':
        // HR с проводными наушниками - его речь может быть в системном звуке
        this.candidateStream = this.findSystemAudioSource(analyses);
        this.hrStream = this.findHRMicrophoneSource(analyses);
        break;
        
      case 'bluetooth_headphones':
        if (strategy.configuration.hrSource === 'none') {
          // HR подключен к телефону - его речь не захватывается
          this.candidateStream = this.findSystemAudioSource(analyses);
          this.hrStream = null;
        } else {
          // HR подключен к компьютеру
          this.candidateStream = this.findSystemAudioSource(analyses);
          this.hrStream = this.findBluetoothSource(analyses);
        }
        break;
        
      case 'wireless_headphones':
        // Используем машинное обучение для разделения
        this.candidateStream = this.findSystemAudioSource(analyses);
        this.hrStream = this.findWirelessSource(analyses);
        break;
        
      case 'unknown_headphones':
        // Адаптивное определение
        await this.adaptiveRoleDetection(analyses);
        break;
        
      default:
        await this.autoDetectRoles();
    }
    
    console.log(`🎯 Roles with HR headphones: Candidate=${this.candidateStream}, HR=${this.hrStream}`);
  }
  
  private findSystemAudioSource(analyses: StreamAnalysis[]): string | null {
    return analyses.find(a => a.source.type === 'system')?.source.id || null;
  }
  
  private findHRMicrophoneSource(analyses: StreamAnalysis[]): string | null {
    return analyses.find(a => 
      a.source.type === 'microphone' && 
      !a.source.name.toLowerCase().includes('candidate')
    )?.source.id || null;
  }
  
  private findBluetoothSource(analyses: StreamAnalysis[]): string | null {
    return analyses.find(a => 
      a.source.name.toLowerCase().includes('bluetooth')
    )?.source.id || null;
  }
  
  private findWirelessSource(analyses: StreamAnalysis[]): string | null {
    return analyses.find(a => 
      a.source.name.toLowerCase().includes('wireless') ||
      a.source.name.toLowerCase().includes('airpods')
    )?.source.id || null;
  }
  
  private async adaptiveRoleDetection(analyses: StreamAnalysis[]): Promise<void> {
    // Адаптивное определение ролей на основе анализа паттернов речи
    console.log('🧠 Using adaptive role detection for unknown headphone type');
    
    // Простая эвристика: системный звук = кандидат, микрофон = HR
    this.candidateStream = this.findSystemAudioSource(analyses);
    this.hrStream = this.findHRMicrophoneSource(analyses);
  }
}
```

#### **UI для отображения статуса наушников HR**

```typescript
// src/components/control/HRHeadphoneStatus.tsx
interface HRHeadphoneStatusProps {
  hrStrategy: HRHeadphoneStrategy | null;
}

export const HRHeadphoneStatus: React.FC<HRHeadphoneStatusProps> = ({ hrStrategy }) => {
  if (!hrStrategy) return null;
  
  const getStatusIcon = (strategy: string) => {
    switch (strategy) {
      case 'usb_headphones': return '🎧';
      case 'bluetooth_headphones': return '🔵';
      case 'jack_headphones': return '🔌';
      case 'wireless_headphones': return '📡';
      case 'unknown_headphones': return '❓';
      default: return '🎤';
    }
  };
  
  const getStatusColor = (strategy: string) => {
    switch (strategy) {
      case 'usb_headphones':
      case 'jack_headphones': return 'text-green-500';
      case 'bluetooth_headphones': return 'text-blue-500';
      case 'wireless_headphones': return 'text-purple-500';
      case 'unknown_headphones': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };
  
  return (
    <div className="hr-headphone-status">
      <div className="hr-headphone-status__title">
        {getStatusIcon(hrStrategy.strategy)} HR Audio
      </div>
      <div className={`hr-headphone-status__message ${getStatusColor(hrStrategy.strategy)}`}>
        {hrStrategy.message}
      </div>
      <div className="hr-headphone-status__actions">
        {hrStrategy.actions.map((action, index) => (
          <div key={index} className="hr-headphone-status__action">
            • {action}
          </div>
        ))}
      </div>
    </div>
  );
};
```

## ⚠️ **ОГРАНИЧЕНИЯ И РИСКИ**

### **Технические ограничения**
1. **Системный звук**: Не все браузеры поддерживают захват системного звука
2. **Разрешения**: Требуются специальные разрешения для захвата системного аудио
3. **Производительность**: Анализ нескольких потоков может увеличить нагрузку
4. **Латентность**: Дополнительная обработка может увеличить задержку
5. **Наушники HR**: Сложность определения подключения Bluetooth наушников к компьютеру vs телефону

### **Дополнительные сценарии с наушниками**

#### **Кандидат с наушниками**
```typescript
// src/services/audio/CandidateHeadphoneHandler.ts
export class CandidateHeadphoneHandler {
  async handleCandidateWithHeadphones(): Promise<CandidateHeadphoneStrategy> {
    const headphones = await this.headphoneDetector.detectHeadphones();
    const candidateHeadphones = headphones.find(h => this.isCandidateHeadphone(h));
    
    if (!candidateHeadphones) {
      return { strategy: 'no_headphones', message: 'Candidate not using headphones' };
    }
    
    // Кандидат с наушниками - его речь идет через видеозвонок
    return {
      strategy: 'candidate_headphones',
      message: 'Candidate using headphones - speech comes through video call',
      actions: [
        'Focus on system audio (video call) for candidate speech',
        'Ignore candidate microphone input',
        'Monitor video call audio quality',
        'Apply echo cancellation if needed'
      ],
      configuration: {
        candidateSource: 'system_audio_video_call',
        hrSource: 'hr_microphone',
        enableEchoCancellation: true,
        monitorVideoCallQuality: true
      }
    };
  }
  
  private isCandidateHeadphone(headphones: HeadphoneInfo): boolean {
    // Кандидат обычно использует наушники для видеозвонка
    // Его речь не должна попадать в микрофон HR
    return headphones.hasHeadphones && headphones.isActive;
  }
}
```

#### **Оба используют наушники**
```typescript
// src/services/audio/DualHeadphoneHandler.ts
export class DualHeadphoneHandler {
  async handleDualHeadphones(): Promise<DualHeadphoneStrategy> {
    const headphones = await this.headphoneDetector.detectHeadphones();
    const hrHeadphones = headphones.find(h => this.isHRHeadphone(h));
    const candidateHeadphones = headphones.find(h => this.isCandidateHeadphone(h));
    
    if (!hrHeadphones || !candidateHeadphones) {
      return { strategy: 'mixed_setup', message: 'Mixed headphone setup detected' };
    }
    
    return {
      strategy: 'dual_headphones',
      message: 'Both HR and candidate using headphones - optimal setup',
      actions: [
        'Candidate speech from video call system audio',
        'HR speech from HR headphone microphone',
        'Apply advanced noise cancellation',
        'Monitor both streams independently',
        'Use speaker diarization for final verification'
      ],
      configuration: {
        candidateSource: 'system_audio_video_call',
        hrSource: 'hr_headphone_mic',
        useAdvancedNoiseCancellation: true,
        enableSpeakerDiarization: true,
        independentStreamMonitoring: true
      }
    };
  }
}
```

#### **Правила приоритизации наушников**

```typescript
// src/services/audio/HeadphonePriorityRules.ts
export class HeadphonePriorityRules {
  static getPriorityRules(): HeadphonePriorityRule[] {
    return [
      {
        scenario: 'hr_usb_headphones',
        priority: 1,
        rules: [
          'HR speech may appear in system audio',
          'Use HR microphone as primary HR source',
          'Filter HR speech from system audio',
          'Candidate speech from filtered system audio'
        ]
      },
      {
        scenario: 'hr_bluetooth_phone',
        priority: 2,
        rules: [
          'HR speech not captured by system',
          'System audio contains only candidate',
          'No HR filtering needed',
          'Optimal for candidate analysis'
        ]
      },
      {
        scenario: 'hr_bluetooth_computer',
        priority: 3,
        rules: [
          'HR speech in both system audio and mic',
          'Use advanced separation algorithms',
          'Monitor both sources for HR speech',
          'Apply machine learning filtering'
        ]
      },
      {
        scenario: 'candidate_headphones',
        priority: 4,
        rules: [
          'Candidate speech only in system audio',
          'Ignore candidate microphone',
          'Focus on video call quality',
          'Apply echo cancellation'
        ]
      },
      {
        scenario: 'dual_headphones',
        priority: 5,
        rules: [
          'Optimal separation possible',
          'Use speaker diarization',
          'Independent stream monitoring',
          'Advanced noise cancellation'
        ]
      }
    ];
  }
  
  static getOptimalConfiguration(scenario: string): AudioConfiguration {
    const rules = this.getPriorityRules();
    const rule = rules.find(r => r.scenario === scenario);
    
    if (!rule) {
      return this.getDefaultConfiguration();
    }
    
    return this.buildConfigurationFromRules(rule);
  }
  
  private static buildConfigurationFromRules(rule: HeadphonePriorityRule): AudioConfiguration {
    // Строим конфигурацию на основе правил
    const config: AudioConfiguration = {
      candidateSource: 'auto_detect',
      hrSource: 'auto_detect',
      enableFiltering: true,
      enableDiarization: false,
      enableNoiseCancellation: false
    };
    
    switch (rule.scenario) {
      case 'hr_usb_headphones':
        config.candidateSource = 'system_audio_filtered';
        config.hrSource = 'hr_microphone';
        config.enableFiltering = true;
        break;
        
      case 'hr_bluetooth_phone':
        config.candidateSource = 'system_audio';
        config.hrSource = 'none';
        config.enableFiltering = false;
        break;
        
      case 'hr_bluetooth_computer':
        config.candidateSource = 'system_audio_ml_filtered';
        config.hrSource = 'hr_bluetooth_mic';
        config.enableDiarization = true;
        break;
        
      case 'candidate_headphones':
        config.candidateSource = 'system_audio_video_call';
        config.hrSource = 'hr_microphone';
        config.enableNoiseCancellation = true;
        break;
        
      case 'dual_headphones':
        config.candidateSource = 'system_audio_video_call';
        config.hrSource = 'hr_headphone_mic';
        config.enableDiarization = true;
        config.enableNoiseCancellation = true;
        break;
    }
    
    return config;
  }
}

interface HeadphonePriorityRule {
  scenario: string;
  priority: number;
  rules: string[];
}

interface AudioConfiguration {
  candidateSource: string;
  hrSource: string;
  enableFiltering: boolean;
  enableDiarization: boolean;
  enableNoiseCancellation: boolean;
}
```

### **Fallback стратегии**
1. **Одиночный поток**: При невозможности разделения использовать микрофон
2. **Ручное переключение**: Позволить пользователю выбрать источник
3. **Упрощенный режим**: Отключить разделение потоков в настройках
4. **Предупреждения**: Уведомлять пользователя о проблемах с разделением
5. **Адаптивное обучение**: Система учится на паттернах речи во время интервью

### **Браузерная совместимость**
- **Chrome/Edge**: Полная поддержка `getDisplayMedia` с аудио
- **Firefox**: Ограниченная поддержка системного звука
- **Safari**: Минимальная поддержка, требуется fallback

---

## 📊 **МЕТРИКИ УСПЕХА**

### **Технические метрики**
1. **Точность разделения**: >90% правильного определения кандидата
2. **Латентность**: <100ms дополнительной задержки
3. **Производительность**: <5% увеличение использования CPU
4. **Надежность**: <1% ложных срабатываний

### **Пользовательские метрики**
1. **Автоматическое определение**: >80% случаев без ручной настройки
2. **Fallback успешность**: 100% случаев с fallback режимом
3. **Удобство использования**: <30 секунд на настройку

---

## 🔮 **БУДУЩИЕ УЛУЧШЕНИЯ**

### **Краткосрочные (v0.52)**
1. **Машинное обучение**: Обучение модели на распознавание голосов
2. **Адаптивные пороги**: Динамическая настройка порогов активности
3. **Улучшенный UI**: Визуализация потоков в реальном времени
4. **Горячие клавиши**: Быстрое переключение между потоками

### **Долгосрочные (v0.53+)**
1. **Speaker Diarization**: Интеграция с Deepgram Speaker Diarization
2. **Голосовые отпечатки**: Сохранение характеристик голосов
3. **Умное переключение**: Автоматическое переключение при смене говорящего
4. **Анализ эмоций**: Определение эмоционального состояния по голосу

---

## 📝 **ЗАКЛЮЧЕНИЕ**

Реализация разделения аудиопотоков с поддержкой наушников значительно улучшит точность анализа интервью, фокусируясь исключительно на речи кандидата. Предложенная архитектура обеспечивает:

### **🎯 Ключевые преимущества**

- **Автоматическое определение** ролей кандидата и HR с учетом наушников
- **5 сценариев наушников** с приоритизацией и оптимизацией
- **Надежный fallback** при технических проблемах
- **Минимальное влияние** на производительность
- **Гибкую настройку** для различных сценариев
- **Адаптивное обучение** на паттернах речи

### **🎧 Поддержка наушников**

Система автоматически определяет и обрабатывает:
- **USB/Jack наушники HR** - фильтрация речи из системного звука
- **Bluetooth наушники HR** - определение подключения к компьютеру vs телефону
- **Беспроводные наушники** - машинное обучение для разделения
- **Смешанные сценарии** - адаптивные алгоритмы
- **Идеальная настройка** - Speaker Diarization для максимальной точности

### **📊 Ожидаемые результаты**

- **Точность разделения**: 75-99% в зависимости от сценария
- **Автоматическое определение**: >80% случаев без ручной настройки
- **Производительность**: <5% увеличение использования CPU
- **Латентность**: <100ms дополнительной задержки

### **🚀 Готовность к внедрению**

Система готова к поэтапному внедрению (5 этапов, 12-17 дней) с:
- Сохранением обратной совместимости
- Возможностью отката к текущей реализации
- Постепенным добавлением функций
- Тестированием на реальных сценариях

### **🔮 Будущее развитие**

- **Speaker Diarization** для финальной верификации
- **Машинное обучение** для улучшения разделения
- **Голосовые отпечатки** для персонализации
- **Анализ эмоций** по голосу кандидата

---

*Документ создан: 5 сентября 2025*  
*Версия: v0.51*  
*Статус: Готов к реализации*
