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
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const stopCapture = useCallback(() => {
    if (processorRef.current) {
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
      const bufferSize = 4096;
      const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (useSessionStore.getState().isPaused) {
          setAudioLevels(0, 0);
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        // Calculate RMS
        let sum = 0;
        let peak = 0;
        for (let i = 0; i < inputData.length; i++) {
          const val = inputData[i];
          sum += val * val;
          const abs = Math.abs(val);
          if (abs > peak) peak = abs;
        }
        const rms = Math.sqrt(sum / inputData.length);
        setAudioLevels(rms, peak);

        // Downsample inputData from AudioContext sampleRate to 16kHz
        const inRate = audioCtx.sampleRate;
        const outRate = 16000;
        const ratio = inRate / outRate;
        const outLength = Math.round(inputData.length / ratio);
        const resampled = new Float32Array(outLength);

        for (let i = 0; i < outLength; i++) {
          const origIdx = i * ratio;
          const low = Math.floor(origIdx);
          const high = Math.min(low + 1, inputData.length - 1);
          const frac = origIdx - low;
          resampled[i] = inputData[low] * (1 - frac) + inputData[high] * frac;
        }

        const isSpeech = rms >= (vadSensitivity ?? 0.008);

        // Send resampled chunks to main process for VAD & speech recognition
        if (window.electronAPI) {
          window.electronAPI.audio.processChunk(Array.from(resampled), isSpeech).catch(console.error);
        }
      };

      sourceNode.connect(processor);
      processor.connect(audioCtx.destination);
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
