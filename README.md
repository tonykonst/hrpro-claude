# Interview Assistant v0.51

> 🎤 AI-powered interview transcription and analysis tool built with Electron, React, and TypeScript

## 🚀 Features

- **Real-time Speech-to-Text**: Powered by Deepgram API for accurate transcription
- **AI Analysis**: Claude AI integration for intelligent interview insights
- **Dual Window Interface**: Separate control panel and data display windows
- **Audio Visualization**: Real-time audio level monitoring with wave animations
- **RAG System**: Retrieval-Augmented Generation for contextual analysis
- **Multi-language Support**: Adaptive language detection (Russian/English)
- **Transcript Logging**: Comprehensive session logging and data persistence

## 🏗️ Architecture

### Frontend (Renderer Process)
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Modular Components**: Organized into `ui/`, `control/`, `data/`, and `common/` directories

### Backend (Main Process)
- **Electron** for cross-platform desktop app
- **Modular Architecture**: Separated into `windows/`, `ipc/`, and `lifecycle/` modules
- **IPC Communication**: Secure inter-process communication between main and renderer

### Services
- **Deepgram**: Real-time speech recognition
- **Claude AI**: Interview analysis and insights generation
- **RAG System**: Document processing and vector search
- **Audio Processing**: Web Audio API with AudioWorklet for low-latency processing

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Deepgram API key
- Claude API key

### Setup
```bash
# Clone the repository
git clone <repository-url>
cd interview-assistant-0.51

# Install dependencies
npm install

# Copy environment configuration
cp config.example.env .env

# Configure your API keys in .env
DEEPGRAM_API_KEY=your_deepgram_key
CLAUDE_API_KEY=your_claude_key
```

## 🛠️ Development

### Available Scripts
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check

# Lint code
npm run lint

# Start only Vite dev server
npm run dev:vite

# Start only Electron
npm run dev:electron
```

### Development Workflow
1. Run `npm run dev` to start both Vite and Electron
2. The app will open with two windows:
   - **Control Panel**: Main interface for recording controls
   - **Data Window**: Displays transcripts and AI insights
3. Hot reload is enabled for both frontend and main process

## 🎯 Usage

### Starting an Interview Session
1. Click "Start Recording" in the control panel
2. Grant microphone permissions when prompted
3. Begin speaking - transcription will appear in real-time
4. AI analysis will generate insights automatically
5. Click "Stop Recording" to end the session

### Features Overview
- **Real-time Transcription**: See your speech converted to text instantly
- **AI Insights**: Get intelligent analysis of interview content
- **Audio Monitoring**: Visual feedback of audio levels
- **Session Logging**: All data is automatically saved and logged

### Browser Audio Capture
- When sharing a tab or screen, make sure the **"Share tab audio"** checkbox is enabled.
- If no audio track is captured, the app now shows a prompt with instructions and a **Retry** button.
- Firefox capture is disabled by default due to limited support; see [MDN compatibility table](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia#browser_compatibility).

## 🏛️ Project Structure

```
src/
├── components/           # React components
│   ├── ui/              # Reusable UI components
│   ├── control/         # Recording control components
│   ├── data/            # Data display components
│   └── common/          # Shared components
├── hooks/               # Custom React hooks
│   └── transcription/   # Transcription-related hooks
├── main/                # Electron main process
│   ├── windows/         # Window management
│   ├── ipc/             # IPC handlers
│   └── lifecycle/       # App lifecycle management
├── services/            # Business logic services
│   ├── rag/             # RAG system implementation
│   └── transcription/   # Transcription services
└── types/               # TypeScript type definitions
```

## 🔧 Configuration

### Environment Variables
```env
# API Keys
DEEPGRAM_API_KEY=your_deepgram_api_key
CLAUDE_API_KEY=your_claude_api_key

# Application Settings
NODE_ENV=development
LOG_LEVEL=info

# Optional: Custom API endpoints
DEEPGRAM_ENDPOINT=wss://api.deepgram.com/v1/listen
CLAUDE_ENDPOINT=https://api.anthropic.com/v1/messages
```

### Audio Settings
- **Sample Rate**: 16kHz (optimized for speech)
- **Channels**: Mono
- **Format**: PCM 16-bit
- **Buffer Size**: 4096 samples

## 🧪 Testing

```bash
# Run type checking
npm run type-check

# Run linting
npm run lint

# Build and test production build
npm run build
```

## 📊 Performance

### Optimizations
- **AudioWorklet**: Low-latency audio processing
- **Smart Buffering**: Efficient audio data management
- **Modular Architecture**: Lazy loading and code splitting
- **Memory Management**: Automatic cleanup of resources

### System Requirements
- **RAM**: 4GB minimum, 8GB recommended
- **CPU**: Modern multi-core processor
- **Storage**: 500MB for application + logs
- **Network**: Stable internet for API calls

## 🐛 Troubleshooting

### Common Issues

**Port 5173 already in use**
```bash
# Kill process using port 5173
kill -9 $(lsof -t -i:5173)
```

**Microphone not working**
- Check system permissions
- Verify microphone is not used by other applications
- Restart the application

**API errors**
- Verify API keys in `.env` file
- Check internet connection
- Review API usage limits

### Debug Mode
Enable debug logging by setting `LOG_LEVEL=debug` in your `.env` file.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Style
- Use TypeScript for all new code
- Follow existing component patterns
- Add JSDoc comments for public APIs
- Maintain console.log statements for debugging

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Deepgram** for speech recognition API
- **Anthropic** for Claude AI integration
- **Electron** team for the desktop framework
- **React** and **Vite** communities

## 📞 Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the documentation in `DOCS/` folder

---

**Version**: 0.51  
**Last Updated**: September 2025  
**Status**: Active Development