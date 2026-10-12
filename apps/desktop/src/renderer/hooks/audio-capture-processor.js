class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channelData = input[0];
    if (!channelData || channelData.length === 0) return true;

    let offset = 0;
    while (offset < channelData.length) {
      const remaining = this.bufferSize - this.bufferIndex;
      const toCopy = Math.min(remaining, channelData.length - offset);
      this.buffer.set(channelData.subarray(offset, offset + toCopy), this.bufferIndex);
      this.bufferIndex += toCopy;
      offset += toCopy;

      if (this.bufferIndex === this.bufferSize) {
        let sum = 0;
        let peak = 0;
        for (let i = 0; i < this.bufferSize; i++) {
          const val = this.buffer[i];
          sum += val * val;
          const abs = Math.abs(val);
          if (abs > peak) peak = abs;
        }
        const rms = Math.sqrt(sum / this.bufferSize);

        const inRate = sampleRate;
        const outRate = 16000;
        const ratio = inRate / outRate;
        const outLength = Math.round(this.bufferSize / ratio);
        const resampled = new Float32Array(outLength);

        for (let i = 0; i < outLength; i++) {
          const origIdx = i * ratio;
          const low = Math.min(Math.floor(origIdx), this.bufferSize - 1);
          const high = Math.min(low + 1, this.bufferSize - 1);
          const frac = origIdx - low;
          resampled[i] = this.buffer[low] * (1 - frac) + this.buffer[high] * frac;
        }

        this.port.postMessage(
          { rms, peak, resampled: resampled.buffer },
          [resampled.buffer]
        );

        this.bufferIndex = 0;
      }
    }
    return true;
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);

