#pragma once

#include <vector>
#include <functional>
#include <string>

struct AudioDeviceInfo {
    std::string name;
    uint32_t sampleRate;
    uint16_t channels;
    uint16_t bitsPerSample;
};

class NativeAudioCapture {
public:
    using AudioDataCallback = std::function<void(const std::vector<int16_t>&)>;
    
    virtual ~NativeAudioCapture() = default;
    
    virtual bool StartCapture() = 0;
    virtual void StopCapture() = 0;
    virtual bool IsCapturing() const = 0;
    virtual AudioDeviceInfo GetDeviceInfo() const = 0;
    
    void SetAudioDataCallback(AudioDataCallback callback) {
        audioDataCallback_ = callback;
    }
    
protected:
    void OnAudioData(const std::vector<int16_t>& data) {
        if (audioDataCallback_) {
            audioDataCallback_(data);
        }
    }
    
private:
    AudioDataCallback audioDataCallback_;
};

// Factory function declaration
std::unique_ptr<NativeAudioCapture> CreateNativeAudioCapture();
