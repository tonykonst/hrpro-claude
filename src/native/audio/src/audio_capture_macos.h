#pragma once

#ifdef __APPLE__

#include "audio_capture_common.h"
#include <AudioToolbox/AudioToolbox.h>
#include <CoreAudio/CoreAudio.h>
#include <thread>
#include <atomic>
#include <mutex>

class MacOSAudioCapture : public NativeAudioCapture {
public:
    MacOSAudioCapture();
    ~MacOSAudioCapture() override;
    
    bool StartCapture() override;
    void StopCapture() override;
    bool IsCapturing() const override;
    AudioDeviceInfo GetDeviceInfo() const override;
    
private:
    // Core Audio components
    AudioComponent audioComponent_;
    AudioUnit audioUnit_;
    AudioDeviceID outputDevice_;
    
    // Threading
    std::atomic<bool> isCapturing_;
    std::thread captureThread_;
    std::mutex captureMutex_;
    
    // Audio format
    AudioStreamBasicDescription audioFormat_;
    
    // Internal methods
    bool InitializeAudioUnit();
    void CleanupAudioUnit();
    void CaptureLoop();
    bool ConvertAudioData(const AudioBufferList* bufferList, std::vector<int16_t>& output);
    
    // Static callback for audio unit
    static OSStatus AudioUnitCallback(
        void* inRefCon,
        AudioUnitRenderActionFlags* ioActionFlags,
        const AudioTimeStamp* inTimeStamp,
        UInt32 inBusNumber,
        UInt32 inNumberFrames,
        AudioBufferList* ioData
    );
    
    // Instance callback
    OSStatus HandleAudioUnitCallback(
        AudioUnitRenderActionFlags* ioActionFlags,
        const AudioTimeStamp* inTimeStamp,
        UInt32 inBusNumber,
        UInt32 inNumberFrames,
        AudioBufferList* ioData
    );
};

// Factory function for creating platform-specific implementation
std::unique_ptr<NativeAudioCapture> CreateNativeAudioCapture();

#endif // __APPLE__


