export const AUDIO_CONSTANTS = {
  /** Target sample rate for Whisper speech models (16 kHz mono) */
  SAMPLE_RATE: 16000,
  /** Channel count (mono) */
  CHANNELS: 1,
  /** Audio frame size in samples (e.g. 512 samples = 32ms at 16kHz) */
  FRAME_SIZE: 512,
  /** Minimum speech segment length in ms to trigger inference */
  MIN_SPEECH_DURATION_MS: 500,
  /** Maximum speech segment length in ms before forcing chunk cut */
  MAX_CHUNK_DURATION_MS: 3000,
  /** Overlap between consecutive chunks in ms */
  CHUNK_OVERLAP_MS: 400,
  /** Default Voice Activity Detection energy threshold (RMS) */
  DEFAULT_VAD_THRESHOLD: 0.008,
  /** Silence threshold in ms to finalize a partial segment */
  SILENCE_TIMEOUT_MS: 900,
  /** Maximum queue size for audio chunks to avoid unbounded memory leaks */
  MAX_AUDIO_QUEUE_CHUNKS: 20,
};
