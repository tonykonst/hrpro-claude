#ifdef __APPLE__

#include "audio_capture_macos.h"
#include <iostream>
#include <algorithm>

MacOSAudioCapture::MacOSAudioCapture()
    : audioComponent_(nullptr)
    , audioUnit_(nullptr)
    , outputDevice_(0)
    , isCapturing_(false) {
    
    if (!InitializeAudioUnit()) {
        throw std::runtime_error("Failed to initialize audio unit");
    }
}

MacOSAudioCapture::~MacOSAudioCapture() {
    StopCapture();
    CleanupAudioUnit();
}

bool MacOSAudioCapture::InitializeAudioUnit() {
    OSStatus status;
    
    // Find the HAL output component
    AudioComponentDescription desc;
    desc.componentType = kAudioUnitType_Output;
    desc.componentSubType = kAudioUnitSubType_HALOutput;
    desc.componentManufacturer = kAudioUnitManufacturer_Apple;
    desc.componentFlags = 0;
    desc.componentFlagsMask = 0;
    
    audioComponent_ = AudioComponentFindNext(nullptr, &desc);
    if (!audioComponent_) {
        return false;
    }
    
    // Create the audio unit
    status = AudioComponentInstanceNew(audioComponent_, &audioUnit_);
    if (status != noErr) {
        return false;
    }
    
    // Get the default output device
    UInt32 size = sizeof(AudioDeviceID);
    status = AudioHardwareGetProperty(
        kAudioHardwarePropertyDefaultSystemOutputDevice,
        &size,
        &outputDevice_
    );
    
    if (status != noErr) {
        return false;
    }
    
    // Enable input on the audio unit
    UInt32 enableInput = 1;
    status = AudioUnitSetProperty(
        audioUnit_,
        kAudioOutputUnitProperty_EnableIO,
        kAudioUnitScope_Input,
        1,  // Input element
        &enableInput,
        sizeof(enableInput)
    );
    
    if (status != noErr) {
        return false;
    }
    
    // Disable output on the audio unit
    UInt32 disableOutput = 0;
    status = AudioUnitSetProperty(
        audioUnit_,
        kAudioOutputUnitProperty_EnableIO,
        kAudioUnitScope_Output,
        0,  // Output element
        &disableOutput,
        sizeof(disableOutput)
    );
    
    if (status != noErr) {
        return false;
    }
    
    // Set the current device
    status = AudioUnitSetProperty(
        audioUnit_,
        kAudioOutputUnitProperty_CurrentDevice,
        kAudioUnitScope_Global,
        0,
        &outputDevice_,
        sizeof(outputDevice_)
    );
    
    if (status != noErr) {
        return false;
    }
    
    // Set up the audio format
    audioFormat_.mSampleRate = 16000.0;
    audioFormat_.mFormatID = kAudioFormatLinearPCM;
    audioFormat_.mFormatFlags = kAudioFormatFlagIsSignedInteger | kAudioFormatFlagIsPacked;
    audioFormat_.mBytesPerPacket = 2;
    audioFormat_.mFramesPerPacket = 1;
    audioFormat_.mBytesPerFrame = 2;
    audioFormat_.mChannelsPerFrame = 1;
    audioFormat_.mBitsPerChannel = 16;
    audioFormat_.mReserved = 0;
    
    // Set the audio format
    status = AudioUnitSetProperty(
        audioUnit_,
        kAudioUnitProperty_StreamFormat,
        kAudioUnitScope_Output,
        1,  // Input element
        &audioFormat_,
        sizeof(audioFormat_)
    );
    
    if (status != noErr) {
        return false;
    }
    
    // Set up the render callback
    AURenderCallbackStruct callbackStruct;
    callbackStruct.inputProc = AudioUnitCallback;
    callbackStruct.inputProcRefCon = this;
    
    status = AudioUnitSetProperty(
        audioUnit_,
        kAudioOutputUnitProperty_SetInputCallback,
        kAudioUnitScope_Global,
        0,
        &callbackStruct,
        sizeof(callbackStruct)
    );
    
    if (status != noErr) {
        return false;
    }
    
    // Initialize the audio unit
    status = AudioUnitInitialize(audioUnit_);
    if (status != noErr) {
        return false;
    }
    
    return true;
}

void MacOSAudioCapture::CleanupAudioUnit() {
    if (audioUnit_) {
        AudioUnitUninitialize(audioUnit_);
        AudioComponentInstanceDispose(audioUnit_);
        audioUnit_ = nullptr;
    }
}

bool MacOSAudioCapture::StartCapture() {
    std::lock_guard<std::mutex> lock(captureMutex_);
    
    if (isCapturing_.load()) {
        return false;
    }
    
    OSStatus status = AudioOutputUnitStart(audioUnit_);
    if (status != noErr) {
        return false;
    }
    
    isCapturing_.store(true);
    captureThread_ = std::thread(&MacOSAudioCapture::CaptureLoop, this);
    
    return true;
}

void MacOSAudioCapture::StopCapture() {
    std::lock_guard<std::mutex> lock(captureMutex_);
    
    if (!isCapturing_.load()) {
        return;
    }
    
    isCapturing_.store(false);
    
    if (captureThread_.joinable()) {
        captureThread_.join();
    }
    
    AudioOutputUnitStop(audioUnit_);
}

bool MacOSAudioCapture::IsCapturing() const {
    return isCapturing_.load();
}

AudioDeviceInfo MacOSAudioCapture::GetDeviceInfo() const {
    AudioDeviceInfo info;
    
    info.sampleRate = static_cast<uint32_t>(audioFormat_.mSampleRate);
    info.channels = audioFormat_.mChannelsPerFrame;
    info.bitsPerSample = audioFormat_.mBitsPerChannel;
    info.name = "System Audio (Core Audio)";
    
    return info;
}

void MacOSAudioCapture::CaptureLoop() {
    // The actual audio capture is handled by the AudioUnit callback
    // This thread just keeps the capture loop alive
    while (isCapturing_.load()) {
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }
}

OSStatus MacOSAudioCapture::AudioUnitCallback(
    void* inRefCon,
    AudioUnitRenderActionFlags* ioActionFlags,
    const AudioTimeStamp* inTimeStamp,
    UInt32 inBusNumber,
    UInt32 inNumberFrames,
    AudioBufferList* ioData
) {
    MacOSAudioCapture* capture = static_cast<MacOSAudioCapture*>(inRefCon);
    return capture->HandleAudioUnitCallback(ioActionFlags, inTimeStamp, inBusNumber, inNumberFrames, ioData);
}

OSStatus MacOSAudioCapture::HandleAudioUnitCallback(
    AudioUnitRenderActionFlags* ioActionFlags,
    const AudioTimeStamp* inTimeStamp,
    UInt32 inBusNumber,
    UInt32 inNumberFrames,
    AudioBufferList* ioData
) {
    if (!isCapturing_.load()) {
        return noErr;
    }
    
    // Render audio data
    OSStatus status = AudioUnitRender(
        audioUnit_,
        ioActionFlags,
        inTimeStamp,
        inBusNumber,
        inNumberFrames,
        ioData
    );
    
    if (status != noErr) {
        return status;
    }
    
    // Convert and send audio data
    std::vector<int16_t> convertedData;
    if (ConvertAudioData(ioData, convertedData)) {
        OnAudioData(convertedData);
    }
    
    return noErr;
}

bool MacOSAudioCapture::ConvertAudioData(const AudioBufferList* bufferList, std::vector<int16_t>& output) {
    if (!bufferList || bufferList->mNumberBuffers == 0) {
        return false;
    }
    
    const AudioBuffer& buffer = bufferList->mBuffers[0];
    if (!buffer.mData || buffer.mDataByteSize == 0) {
        return false;
    }
    
    const size_t sampleCount = buffer.mDataByteSize / sizeof(int16_t);
    const int16_t* samples = static_cast<const int16_t*>(buffer.mData);
    
    output.clear();
    output.reserve(sampleCount);
    
    for (size_t i = 0; i < sampleCount; ++i) {
        output.push_back(samples[i]);
    }
    
    return true;
}

// Factory function
std::unique_ptr<NativeAudioCapture> CreateNativeAudioCapture() {
    return std::make_unique<MacOSAudioCapture>();
}

#endif // __APPLE__


