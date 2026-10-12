import { useEffect, useRef, useState, useCallback } from 'react';
import { useSessionStore } from '@/stores/session-store.js';
import { useSettingsStore } from '@/stores/settings-store.js';

function getHumanReadableAudioError(err: unknown): string {
  if (err instanceof DOMException || (typeof err === 'object' && err !== null && 'name' in err)) {
    const domErr = err as { name: string; message: string };
    switch (domErr.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Microphone permission was denied. Please allow microphone access in Windows Settings > Privacy & security > Microphone.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'No microphone detected. Please connect an audio input device or switch Audio Source to "System Audio" in the Dashboard.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'Microphone is currently in use by another application or audio driver is busy.';
      case 'OverconstrainedError':
        return 'The selected microphone is unavailable. Reverting to default system audio device.';
      case 'AbortError':
        return 'Audio capture was canceled or interrupted.';
      default:
        return `Audio device error (${domErr.name}): ${domErr.message || 'Unable to access audio input.'}`;
    }
  }
  return err instanceof Error ? err.message : 'Unknown audio capture error';
}

const WORKLET_PROCESSOR_CODE = `
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
`;

export function useAudioCapture() {
  const isListening = useSessionStore((s) => s.isListening);
  const isPaused = useSessionStore((s) => s.isPaused);
  const setAudioLevels = useSessionStore((s) => s.setAudioLevels);
  const setAudioError = useSessionStore((s) => s.setAudioError);
  const { audioSourceType, audioDeviceId, vadSensitivity } = useSettingsStore((s) => s.settings);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<AudioWorkletNode | null>(null);

  const stopCapture = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.port.onmessage = null;
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
    setAudioLevels(0, 0);
  }, [setAudioLevels]);

  const startCapture = useCallback(async () => {
    stopCapture();
    setErrorMessage(null);
    setAudioError(null);

    try {
      let stream: MediaStream;

      if (audioSourceType === 'system') {
        // Capture system/desktop audio via getDisplayMedia
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: true, // required by browser standard, audio tracks extracted
          });

          const audioTracks = stream.getAudioTracks();
          if (audioTracks.length === 0) {
            throw new Error(
              'No system audio track provided. When prompted, ensure "Share system audio" is enabled.'
            );
          }

          // Mute video tracks without calling track.stop() which terminates display media in Chromium
          stream.getVideoTracks().forEach((t) => {
            t.enabled = false;
          });
        } catch (e: any) {
          const domName = e?.name || 'Error';
          const domMsg = e?.message || 'Access canceled';
          throw new Error(`System audio capture could not be started (${domName}: ${domMsg})`);
        }
      } else {
        // Standard microphone audio with soft ideal constraints
        const hasSpecificDevice = audioDeviceId && audioDeviceId !== 'default' && audioDeviceId !== 'communications';
        const constraints: MediaStreamConstraints = {
          audio: {
            deviceId: hasSpecificDevice ? { ideal: audioDeviceId } : undefined,
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
            autoGainControl: { ideal: true },
          },
          video: false,
        };

        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (initialErr: any) {
          console.warn('[AudioCapture] Preferred constraints failed, retrying with fallback audio constraints:', initialErr);
          // Fallback to basic unconstrained audio capture
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        }
      }

      setHasPermission(true);
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      // Resume context if suspended by browser policy
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const sourceNode = audioCtx.createMediaStreamSource(stream);

      // Register audio worklet processor via blob URL
      const workletBlob = new Blob([WORKLET_PROCESSOR_CODE], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(workletBlob);
      try {
        await audioCtx.audioWorklet.addModule(workletUrl);
      } finally {
        URL.revokeObjectURL(workletUrl);
      }

      const workletNode = new AudioWorkletNode(audioCtx, 'audio-capture-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 0,
      });
      processorRef.current = workletNode;

      workletNode.port.onmessage = (event: MessageEvent<{ rms: number; peak: number; resampled: ArrayBuffer }>) => {
        if (useSessionStore.getState().isPaused) {
          setAudioLevels(0, 0);
          return;
        }

        const { rms, peak, resampled } = event.data;
        setAudioLevels(rms, peak);

        const isSpeech = rms >= (vadSensitivity ?? 0.008);

        // Send resampled chunks to main process for VAD & speech recognition
        if (window.electronAPI) {
          window.electronAPI.audio.processChunk(Array.from(new Float32Array(resampled)), isSpeech).catch(console.error);
        }
      };

      sourceNode.connect(workletNode);
    } catch (err: any) {
      const errName = err?.name || 'Error';
      const errMsg = err?.message || '';
      console.error(`[AudioCapture] Error accessing audio source [${errName}]: ${errMsg}`, err);

      const friendlyMsg = getHumanReadableAudioError(err);
      setHasPermission(false);
      setErrorMessage(friendlyMsg);
      setAudioError(friendlyMsg);
      useSessionStore.getState().stopSession();
    }
  }, [audioSourceType, audioDeviceId, vadSensitivity, setAudioLevels, setAudioError, stopCapture]);

  useEffect(() => {
    if (isListening && !isPaused) {
      startCapture();
    } else {
      stopCapture();
    }

    return () => {
      stopCapture();
    };
  }, [isListening, isPaused, startCapture, stopCapture]);

  return {
    hasPermission,
    errorMessage,
  };
}
