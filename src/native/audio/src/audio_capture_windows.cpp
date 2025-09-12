#ifdef _WIN32

#include "audio_capture_windows.h"
#include <iostream>
#include <algorithm>

WindowsAudioCapture::WindowsAudioCapture()
    : deviceEnumerator_(nullptr)
    , audioDevice_(nullptr)
    , audioClient_(nullptr)
    , captureClient_(nullptr)
    , waveFormat_(nullptr)
    , isCapturing_(false)
    , comInitialized_(false) {
    
    if (!InitializeCOM()) {
        throw std::runtime_error("Failed to initialize COM");
    }
    
    if (!InitializeAudioDevice()) {
        CleanupCOM();
        throw std::runtime_error("Failed to initialize audio device");
    }
}

WindowsAudioCapture::~WindowsAudioCapture() {
    StopCapture();
    CleanupAudioDevice();
    CleanupCOM();
}

bool WindowsAudioCapture::InitializeCOM() {
    HRESULT hr = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    if (FAILED(hr) && hr != RPC_E_CHANGED_MODE) {
        return false;
    }
    
    comInitialized_ = true;
    return true;
}

void WindowsAudioCapture::CleanupCOM() {
    if (comInitialized_) {
        CoUninitialize();
        comInitialized_ = false;
    }
}

bool WindowsAudioCapture::InitializeAudioDevice() {
    HRESULT hr;
    
    // Create device enumerator
    hr = CoCreateInstance(
        __uuidof(MMDeviceEnumerator),
        nullptr,
        CLSCTX_ALL,
        __uuidof(IMMDeviceEnumerator),
        (void**)&deviceEnumerator_
    );
    
    if (FAILED(hr)) {
        return false;
    }
    
    // Get default audio endpoint (loopback device for system audio)
    hr = deviceEnumerator_->GetDefaultAudioEndpoint(
        eRender,        // Capture from render endpoint (system audio)
        eConsole,       // Console role
        &audioDevice_
    );
    
    if (FAILED(hr)) {
        return false;
    }
    
    // Activate audio client
    hr = audioDevice_->Activate(
        __uuidof(IAudioClient),
        CLSCTX_ALL,
        nullptr,
        (void**)&audioClient_
    );
    
    if (FAILED(hr)) {
        return false;
    }
    
    // Get mix format
    hr = audioClient_->GetMixFormat(&waveFormat_);
    if (FAILED(hr)) {
        return false;
    }
    
    // Initialize audio client for loopback capture
    hr = audioClient_->Initialize(
        AUDCLNT_SHAREMODE_SHARED,
        AUDCLNT_STREAMFLAGS_LOOPBACK,  // This is the key for system audio capture
        10000000,  // 100ms buffer
        0,
        waveFormat_,
        nullptr
    );
    
    if (FAILED(hr)) {
        return false;
    }
    
    // Get capture client
    hr = audioClient_->GetService(
        __uuidof(IAudioCaptureClient),
        (void**)&captureClient_
    );
    
    if (FAILED(hr)) {
        return false;
    }
    
    return true;
}

void WindowsAudioCapture::CleanupAudioDevice() {
    if (captureClient_) {
        captureClient_->Release();
        captureClient_ = nullptr;
    }
    
    if (audioClient_) {
        audioClient_->Release();
        audioClient_ = nullptr;
    }
    
    if (audioDevice_) {
        audioDevice_->Release();
        audioDevice_ = nullptr;
    }
    
    if (deviceEnumerator_) {
        deviceEnumerator_->Release();
        deviceEnumerator_ = nullptr;
    }
    
    if (waveFormat_) {
        CoTaskMemFree(waveFormat_);
        waveFormat_ = nullptr;
    }
}

bool WindowsAudioCapture::StartCapture() {
    std::lock_guard<std::mutex> lock(captureMutex_);
    
    if (isCapturing_.load()) {
        return false;
    }
    
    HRESULT hr = audioClient_->Start();
    if (FAILED(hr)) {
        return false;
    }
    
    isCapturing_.store(true);
    captureThread_ = std::thread(&WindowsAudioCapture::CaptureLoop, this);
    
    return true;
}

void WindowsAudioCapture::StopCapture() {
    std::lock_guard<std::mutex> lock(captureMutex_);
    
    if (!isCapturing_.load()) {
        return;
    }
    
    isCapturing_.store(false);
    
    if (captureThread_.joinable()) {
        captureThread_.join();
    }
    
    audioClient_->Stop();
}

bool WindowsAudioCapture::IsCapturing() const {
    return isCapturing_.load();
}

AudioDeviceInfo WindowsAudioCapture::GetDeviceInfo() const {
    AudioDeviceInfo info;
    
    if (waveFormat_) {
        info.sampleRate = waveFormat_->nSamplesPerSec;
        info.channels = waveFormat_->nChannels;
        info.bitsPerSample = waveFormat_->wBitsPerSample;
    } else {
        info.sampleRate = 16000;
        info.channels = 1;
        info.bitsPerSample = 16;
    }
    
    info.name = "System Audio (Loopback)";
    
    return info;
}

void WindowsAudioCapture::CaptureLoop() {
    const UINT32 bufferSize = 4096;
    std::vector<int16_t> audioBuffer;
    audioBuffer.reserve(bufferSize);
    
    while (isCapturing_.load()) {
        UINT32 packetLength = 0;
        HRESULT hr = captureClient_->GetNextPacketSize(&packetLength);
        
        if (FAILED(hr)) {
            break;
        }
        
        while (packetLength > 0) {
            BYTE* data;
            UINT32 framesAvailable;
            DWORD flags;
            
            hr = captureClient_->GetBuffer(
                &data,
                &framesAvailable,
                &flags,
                nullptr,
                nullptr
            );
            
            if (FAILED(hr)) {
                break;
            }
            
            if (framesAvailable > 0 && !(flags & AUDCLNT_BUFFERFLAGS_SILENT)) {
                std::vector<int16_t> convertedData;
                if (ConvertAudioData(data, framesAvailable, convertedData)) {
                    OnAudioData(convertedData);
                }
            }
            
            hr = captureClient_->ReleaseBuffer(framesAvailable);
            if (FAILED(hr)) {
                break;
            }
            
            hr = captureClient_->GetNextPacketSize(&packetLength);
            if (FAILED(hr)) {
                break;
            }
        }
        
        // Small delay to prevent excessive CPU usage
        std::this_thread::sleep_for(std::chrono::milliseconds(1));
    }
}

bool WindowsAudioCapture::ConvertAudioData(BYTE* data, UINT32 frames, std::vector<int16_t>& output) {
    if (!waveFormat_ || !data || frames == 0) {
        return false;
    }
    
    const UINT32 bytesPerFrame = waveFormat_->nBlockAlign;
    const UINT32 totalBytes = frames * bytesPerFrame;
    
    output.clear();
    output.reserve(frames * waveFormat_->nChannels);
    
    if (waveFormat_->wBitsPerSample == 16) {
        // Direct copy for 16-bit data
        const int16_t* samples = reinterpret_cast<const int16_t*>(data);
        const size_t sampleCount = totalBytes / sizeof(int16_t);
        
        for (size_t i = 0; i < sampleCount; ++i) {
            output.push_back(samples[i]);
        }
    } else if (waveFormat_->wBitsPerSample == 32) {
        // Convert 32-bit float to 16-bit int
        const float* samples = reinterpret_cast<const float*>(data);
        const size_t sampleCount = totalBytes / sizeof(float);
        
        for (size_t i = 0; i < sampleCount; ++i) {
            // Clamp and convert to 16-bit
            float sample = std::max(-1.0f, std::min(1.0f, samples[i]));
            int16_t converted = static_cast<int16_t>(sample * 32767.0f);
            output.push_back(converted);
        }
    } else {
        // Unsupported format
        return false;
    }
    
    return true;
}

// Factory function
std::unique_ptr<NativeAudioCapture> CreateNativeAudioCapture() {
    return std::make_unique<WindowsAudioCapture>();
}

#endif // _WIN32


