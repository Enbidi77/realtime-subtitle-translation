/**
 * Audio resampling and energy level calculations.
 */

/**
 * Resample a Float32Array from inSampleRate to outSampleRate (e.g. 48000 -> 16000)
 * using linear interpolation.
 */
export function resampleAudio(
  input: Float32Array,
  inSampleRate: number,
  outSampleRate = 16000
): Float32Array {
  if (inSampleRate === outSampleRate) {
    return new Float32Array(input);
  }

  const ratio = inSampleRate / outSampleRate;
  const outLength = Math.round(input.length / ratio);
  const result = new Float32Array(outLength);

  for (let i = 0; i < outLength; i++) {
    const origIndex = i * ratio;
    const indexLow = Math.floor(origIndex);
    const indexHigh = Math.min(indexLow + 1, input.length - 1);
    const frac = origIndex - indexLow;

    result[i] = input[indexLow] * (1 - frac) + input[indexHigh] * frac;
  }

  return result;
}

/**
 * Calculate Root Mean Square (RMS) energy of an audio buffer
 */
export function calculateRms(buffer: Float32Array): number {
  if (buffer.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

/**
 * Calculate peak amplitude of an audio buffer (0.0 to 1.0)
 */
export function calculatePeak(buffer: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < buffer.length; i++) {
    const abs = Math.abs(buffer[i]);
    if (abs > peak) peak = abs;
  }
  return Math.min(1, peak);
}

/**
 * Convert Float32Array [-1.0, 1.0] to 16-bit Int16Array PCM
 */
export function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

/**
 * Convert 16-bit Int16Array PCM to Float32Array [-1.0, 1.0]
 */
export function int16ToFloat32(int16: Int16Array): Float32Array {
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
  }
  return float32;
}

/**
 * Create a standard 16kHz mono WAV header and data Buffer for cloud or worker APIs
 */
export function encodeWav(samples: Float32Array, sampleRate = 16000): Uint8Array {
  const int16 = float32ToInt16(samples);
  const buffer = new ArrayBuffer(44 + int16.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + int16.length * 2, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw PCM = 1)
  view.setUint16(20, 1, true);
  // channel count (1 = mono)
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sampleRate * 1 * 2)
  view.setUint32(28, sampleRate * 2, true);
  // block align (1 * 2)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, int16.length * 2, true);

  // Write PCM audio samples
  let offset = 44;
  for (let i = 0; i < int16.length; i++, offset += 2) {
    view.setInt16(offset, int16[i], true);
  }

  return new Uint8Array(buffer);
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
