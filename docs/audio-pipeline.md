# EchoLingo Audio Pipeline Documentation

## Audio Processing Flow

```
[Audio Source: Mic or System Audio]
                 │
                 ▼
[AudioContext @ 44.1kHz or 48kHz]
                 │
                 ▼
[ScriptProcessorNode / Worklet (4096 buffer)]
                 │
                 ▼
[Linear Resampling to 16,000 Hz Mono Float32]
                 │
                 ▼
[RMS Energy & Peak Meter Calculation]
                 │
                 ▼
[IPC Audio Chunk Dispatch (processChunk)]
                 │
                 ▼
[Voice Activity Detector (VAD)]
  ├── Energy Thresholding
  ├── Min Speech Window: 400ms
  └── Silence Timeout: 800ms
                 │
                 ▼
[Speech Recognition Provider (Local / Cloud)]
                 │
                 ▼
[Partial / Final Transcription Events]
                 │
                 ▼
[Concurrent Multi-Target Translation]
                 │
                 ▼
[SubtitleTimeline Deduplication & Persistence]
                 │
        ┌────────┴────────┐
        ▼                 ▼
[MainWindow Stream]  [OverlayWindow Stream]
```

### Voice Activity Detection (VAD)

The built-in VAD computes Root Mean Square (RMS) energy:
$$RMS = \sqrt{\frac{1}{N}\sum_{i=1}^{N} x_i^2}$$

- **Speech Activation**: Triggered when frame RMS exceeds the configurable threshold (default `0.02`).
- **Chunk Windowing**: Long speech segments are chunked into max 3,000ms blocks with 200ms overlap to maintain context continuity.
- **Silence Finalization**: When sound level drops below threshold for 800ms, the accumulated utterance is marked `isFinal: true`.

### Memory Protection & Backpressure

To prevent memory leaks during long-running sessions, the pipeline utilizes a `BoundedAudioQueue` with a maximum capacity of 15-20 chunks. When inference latency spikes, oldest unprocessed frames are discarded and logged, ensuring memory stays flat.
