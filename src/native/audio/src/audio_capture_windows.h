#pragma once

#ifdef _WIN32

#include "audio_capture_common.h"
#include <windows.h>
#include <mmdeviceapi.h>
#include <audioclient.h>
#include <audiopolicy.h>
#include <thread>
#include <atomic>
#include <mutex>

class WindowsAudioCapture : public NativeAudioCapture {
public:
    WindowsAudioCapture();
    ~WindowsAudioCapture() override;
    
    bool StartCapture() override;
    void StopCapture() override;
    bool IsCapturing() const override;
    AudioDeviceInfo GetDeviceInfo() const override;
    
private:
    // COM interfaces
    IMMDeviceEnumerator* deviceEnumerator_;
    IMMDevice* audioDevice_;
    IAudioClient* audioClient_;
    IAudioCaptureClient* captureClient_;
    
    // Threading
    std::atomic<bool> isCapturing_;
    std::thread captureThread_;
    std::mutex captureMutex_;
    
    // Audio format
    WAVEFORMATEX* waveFormat_;
    
    // Internal methods
    bool InitializeCOM();
    void CleanupCOM();
    bool InitializeAudioDevice();
    void CleanupAudioDevice();
    void CaptureLoop();
    bool ConvertAudioData(BYTE* data, UINT32 frames, std::vector<int16_t>& output);
    
    // COM initialization flag
    bool comInitialized_;
};

// Factory function for creating platform-specific implementation
std::unique_ptr<NativeAudioCapture> CreateNativeAudioCapture();

#endif // _WIN32


