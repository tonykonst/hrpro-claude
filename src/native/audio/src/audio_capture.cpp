#include <napi.h>
#include <memory>
#include <thread>
#include <atomic>
#include <queue>
#include <mutex>
#include <condition_variable>

#include "audio_capture_common.h"

#ifdef _WIN32
#include "audio_capture_windows.h"
#elif __APPLE__
#include "audio_capture_macos.h"
#endif

class AudioCapture : public Napi::ObjectWrap<AudioCapture> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    AudioCapture(const Napi::CallbackInfo& info);
    ~AudioCapture();

private:
    static Napi::FunctionReference constructor;
    
    // Native audio capture implementation
    std::unique_ptr<NativeAudioCapture> nativeCapture_;
    
    // Audio data buffer
    std::queue<std::vector<int16_t>> audioBuffer_;
    std::mutex bufferMutex_;
    std::condition_variable bufferCondition_;
    
    // Threading
    std::atomic<bool> isCapturing_{false};
    std::thread captureThread_;
    
    // NAPI methods
    Napi::Value StartCapture(const Napi::CallbackInfo& info);
    Napi::Value StopCapture(const Napi::CallbackInfo& info);
    Napi::Value IsCapturing(const Napi::CallbackInfo& info);
    Napi::Value GetAudioData(const Napi::CallbackInfo& info);
    Napi::Value GetDeviceInfo(const Napi::CallbackInfo& info);
    
    // Internal methods
    void CaptureLoop();
    void OnAudioData(const std::vector<int16_t>& data);
};

Napi::FunctionReference AudioCapture::constructor;

Napi::Object AudioCapture::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "AudioCapture", {
        InstanceMethod("startCapture", &AudioCapture::StartCapture),
        InstanceMethod("stopCapture", &AudioCapture::StopCapture),
        InstanceMethod("isCapturing", &AudioCapture::IsCapturing),
        InstanceMethod("getAudioData", &AudioCapture::GetAudioData),
        InstanceMethod("getDeviceInfo", &AudioCapture::GetDeviceInfo)
    });

    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();

    exports.Set("AudioCapture", func);
    return exports;
}

AudioCapture::AudioCapture(const Napi::CallbackInfo& info) 
    : Napi::ObjectWrap<AudioCapture>(info) {
    
    Napi::Env env = info.Env();
    
    try {
        // Initialize native audio capture using factory function
        nativeCapture_ = CreateNativeAudioCapture();
        
        // Set up audio data callback
        nativeCapture_->SetAudioDataCallback([this](const std::vector<int16_t>& data) {
            OnAudioData(data);
        });
        
    } catch (const std::exception& e) {
        Napi::Error::New(env, "Failed to initialize audio capture: " + std::string(e.what()))
            .ThrowAsJavaScriptException();
    }
}

AudioCapture::~AudioCapture() {
    if (isCapturing_.load()) {
        // Stop capture without using Napi::CallbackInfo
        if (nativeCapture_) {
            nativeCapture_->StopCapture();
        }
    }
}

Napi::Value AudioCapture::StartCapture(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (isCapturing_.load()) {
        return Napi::Boolean::New(env, false);
    }
    
    try {
        // Start native capture
        if (!nativeCapture_->StartCapture()) {
            return Napi::Boolean::New(env, false);
        }
        
        // Start capture thread
        isCapturing_.store(true);
        captureThread_ = std::thread(&AudioCapture::CaptureLoop, this);
        
        return Napi::Boolean::New(env, true);
        
    } catch (const std::exception& e) {
        Napi::Error::New(env, "Failed to start capture: " + std::string(e.what()))
            .ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }
}

Napi::Value AudioCapture::StopCapture(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (!isCapturing_.load()) {
        return Napi::Boolean::New(env, true);
    }
    
    try {
        // Stop capture thread
        isCapturing_.store(false);
        bufferCondition_.notify_all();
        
        if (captureThread_.joinable()) {
            captureThread_.join();
        }
        
        // Stop native capture
        nativeCapture_->StopCapture();
        
        // Clear buffer
        std::lock_guard<std::mutex> lock(bufferMutex_);
        while (!audioBuffer_.empty()) {
            audioBuffer_.pop();
        }
        
        return Napi::Boolean::New(env, true);
        
    } catch (const std::exception& e) {
        Napi::Error::New(env, "Failed to stop capture: " + std::string(e.what()))
            .ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }
}

Napi::Value AudioCapture::IsCapturing(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Boolean::New(env, isCapturing_.load());
}

Napi::Value AudioCapture::GetAudioData(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    std::lock_guard<std::mutex> lock(bufferMutex_);
    
    if (audioBuffer_.empty()) {
        return Napi::Array::New(env, 0);
    }
    
    Napi::Array result = Napi::Array::New(env, audioBuffer_.size());
    size_t index = 0;
    
    while (!audioBuffer_.empty()) {
        const auto& data = audioBuffer_.front();
        Napi::Array chunk = Napi::Array::New(env, data.size());
        
        for (size_t i = 0; i < data.size(); ++i) {
            chunk.Set(i, Napi::Number::New(env, data[i]));
        }
        
        result.Set(index++, chunk);
        audioBuffer_.pop();
    }
    
    return result;
}

Napi::Value AudioCapture::GetDeviceInfo(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    try {
        auto deviceInfo = nativeCapture_->GetDeviceInfo();
        
        Napi::Object result = Napi::Object::New(env);
        result.Set("name", Napi::String::New(env, deviceInfo.name));
        result.Set("sampleRate", Napi::Number::New(env, deviceInfo.sampleRate));
        result.Set("channels", Napi::Number::New(env, deviceInfo.channels));
        result.Set("bitsPerSample", Napi::Number::New(env, deviceInfo.bitsPerSample));
        
        return result;
        
    } catch (const std::exception& e) {
        Napi::Error::New(env, "Failed to get device info: " + std::string(e.what()))
            .ThrowAsJavaScriptException();
        return Napi::Object::New(env);
    }
}

void AudioCapture::CaptureLoop() {
    while (isCapturing_.load()) {
        // Let native capture handle the actual audio capture
        // This thread just manages the buffer
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }
}

void AudioCapture::OnAudioData(const std::vector<int16_t>& data) {
    std::lock_guard<std::mutex> lock(bufferMutex_);
    
    // Limit buffer size to prevent memory issues
    const size_t maxBufferSize = 100;
    if (audioBuffer_.size() >= maxBufferSize) {
        audioBuffer_.pop();
    }
    
    audioBuffer_.push(data);
    bufferCondition_.notify_all();
}

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    return AudioCapture::Init(env, exports);
}

NODE_API_MODULE(audio_capture, Init)
