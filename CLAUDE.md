# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Electron-based desktop application called "Interview Assistant" (v0.52) - an AI-powered tool for HR specialists that provides real-time interview transcription, AI-powered candidate analysis, and insights for decision-making. The system operates as a standalone desktop application without requiring external backend services.

## Architecture

**Technology Stack:**
- **Electron**: Desktop application framework with main process and renderer
- **React + TypeScript**: Frontend with strict typing and modular architecture
- **Vite**: Build tool for development and production builds
- **TailwindCSS**: Styling framework
- **Vitest**: Testing framework

**Core Structure:**
- **Main Process** (`src/main/`): Window management, IPC handlers, lifecycle management
- **Renderer Process** (`src/`): React UI with modular components and hooks
- **Preload Scripts** (`src/preload/`): Secure API bridge between main and renderer
- **Services** (`src/services/`): Business logic and external API integrations
- **Components** (`src/components/`): Modular UI components organized by responsibility
- **Hooks** (`src/hooks/`): Custom React hooks for state management and effects

## Key Commands

### Development
- `npm run dev` - Start development server with hot reload (Vite + Electron)
- `npm run dev:vite` - Start only Vite development server
- `npm run dev:electron` - Start only Electron (waits for Vite)

### Building
- `npm run build` - Full production build (native + vite + electron)
- `npm run build:native` - Build native audio modules
- `npm run build:vite` - Build renderer process with Vite
- `npm run build:electron` - Build main process with TypeScript

### Testing
- `npm test` - Run all tests with Vitest
- `npm run test:audio` - Run audio-related tests only
- `npm run test:audio:unit` - Run audio unit tests
- `npm run test:audio:integration` - Run audio integration tests
- `npm run test:audio:performance` - Run audio performance tests
- `npm run test:native-audio` - Test native audio modules

### Code Quality
- `npm run lint` - ESLint code linting
- `npm run lint:audio` - Lint audio-specific files
- `npm run type-check` - TypeScript type checking
- `npm run type-check:audio` - Type check audio files

### Maintenance
- `npm run clean` - Clean build artifacts
- `npm run rebuild:native` - Rebuild native audio dependencies
- `npm run postinstall` - Setup dependencies and rebuild native modules

## Core Components Architecture

**Modular Component Structure:**
- `src/components/ui/` - Reusable UI components (Button, Panel, Transcript, Insights)
- `src/components/control/` - Control panel components (ControlPanel, StartButton, StopButton, DragZone)
- `src/components/data/` - Data window components (DataWindow, TranscriptSection, InsightsSection)
- `src/components/common/` - Shared components (WaveLoader)
- `src/components/overlay/` - Overlay window components (NativeAudioOverlay)

**Hook Architecture:**
- `src/hooks/transcription/` - Modular transcription hooks:
  - `useTranscriptionCore.ts` - Core state management
  - `useTranscriptionCallbacks.ts` - Event handlers
  - `useTranscriptionState.ts` - State management
  - `useTranscriptionRecording.ts` - Recording logic
  - `useTranscriptionElectron.ts` - Electron-specific implementation
  - `useTranscriptionNative.ts` - Native audio implementation

**Service Layer:**
- `src/services/config.ts` - Centralized configuration management with environment variables
- `src/services/deepgram.ts` - Deepgram streaming API integration
- `src/services/claude.ts` - Claude AI analysis service
- `src/services/adaptive-asr.ts` - Adaptive ASR parameter optimization
- `src/services/post-editor.ts` - ASR correction system
- `src/services/transcript-logger.ts` - Local transcript logging

## TypeScript Configuration

The project uses multiple TypeScript configurations:
- `tsconfig.json` - Main renderer process configuration with path aliases
- `tsconfig.main.json` - Main process configuration (CommonJS)
- Strict TypeScript mode enabled with comprehensive type checking
- Path aliases configured: `@/*`, `@/types/*`, `@/components/*`, `@/hooks/*`, `@/services/*`

## Audio Processing Pipeline

**Real-time Audio Processing:**
- AudioWorklet for real-time PCM processing (Float32 → Int16 conversion)
- 16kHz sample rate, single channel optimized for speech recognition
- Native audio modules in `src/native/audio/` for advanced processing
- Audio stream splitting capability for multi-source interviews

**Speech Recognition:**
- Deepgram streaming API with nova-2-general model
- Adaptive ASR with dynamic parameter optimization
- Real-time partial results (100-250ms intervals)
- Post-processing correction system using Claude Haiku

## AI Analysis System

**Primary Analysis:** Claude Sonnet 4 for real-time interview insights
**Post-Processing:** Claude Haiku for ASR correction
**Output Format:** Structured JSON with topics, depth scores, signals, and follow-up questions
**Rate Limiting:** 3 requests/second with timeout protection

## Security & Environment

**Electron Security:**
- Context isolation enabled (`contextIsolation: true`)
- Node integration disabled (`nodeIntegration: false`)
- Web security enabled (`webSecurity: true`)
- Secure preload scripts for API bridge

**Configuration Management:**
- Environment variables loaded through secure electronAPI
- API keys protected and never logged
- Local-only data storage for privacy
- No external data transmission except to configured AI services

## Development Guidelines

**Code Quality:**
- Follow modular architecture principles from Cursor rules
- Use TypeScript interfaces for all service contracts
- Implement comprehensive error handling with AppError class
- Follow structured logging with context information
- Never use fake/mock data - always use real API responses

**Performance:**
- Support long-running sessions (3+ hours)
- Adaptive memory management with automatic cleanup
- Real-time processing without blocking main thread
- Graceful degradation on service failures

**Testing:**
- Use real APIs for all testing (no simulations)
- Audio testing with actual Deepgram/Whisper services
- Performance testing for memory leaks and latency
- Integration testing for complete workflows

## Window Management

**Multi-Window Architecture:**
- Control Panel: Compact recording interface (always-on-top, transparent)
- Data Window: Full transcript and insights display
- Native Audio Overlay: Advanced audio processing interface
- IPC communication for secure data synchronization

**Window Features:**
- Transparent windows with vibrancy (macOS) / layered transparency (Windows)
- Global shortcuts (Ctrl+\ for show/hide)
- Click-through mode support
- Frameless design with custom UI

## Key Files to Understand

- `src/App.tsx` - Main application router and window type handler
- `src/main/main.ts` - Main process entry point and initialization
- `src/services/config.ts` - Configuration service with environment management
- `src/hooks/transcription/useTranscriptionElectron.ts` - Main transcription logic
- `.cursor/rules/hrpro.mdc` - Comprehensive development standards and architecture principles (873 lines)

## Environment Setup

Required environment variables:
- `DEEPGRAM_API_KEY` - For speech recognition
- `CLAUDE_API_KEY` - For AI analysis
- `NODE_ENV` - Development/production mode

The application gracefully falls back to development mode when API keys are missing, but real functionality requires proper configuration.