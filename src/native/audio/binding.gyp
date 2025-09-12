{
  "targets": [
    {
      "target_name": "audio_capture",
      "sources": [
        "src/audio_capture.cpp",
        "src/audio_capture_windows.cpp",
        "src/audio_capture_macos.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "10.14"
      },
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1
        }
      },
      "conditions": [
        ["OS=='win'", {
          "libraries": [
            "-lole32.lib",
            "-loleaut32.lib",
            "-lwinmm.lib",
            "-lksuser.lib"
          ],
          "defines": [
            "WIN32_LEAN_AND_MEAN",
            "NOMINMAX"
          ]
        }],
        ["OS=='mac'", {
          "libraries": [
            "-framework CoreAudio",
            "-framework AudioToolbox",
            "-framework AudioUnit"
          ]
        }]
      ]
    }
  ]
}


