import { useGlobal } from '../context/useGlobal';
import { useEffect, useMemo, useRef } from 'react';
import { useUserMedia } from './useUserMedia';
import { useSnackBar } from '../hoc/SnackBar';
import { logError, Severity } from '../utils';
import { WavRecorder } from './WavRecorder';
import { AudioMediaRecorder } from './AudioMediaRecorder';

const createCaptureOptions = (deviceId?: string): MediaStreamConstraints => ({
  audio: {
    autoGainControl: false,
    echoCancellation: true,
    noiseSuppression: true,
    sampleRate: 48000, // Request high sample rate
    channelCount: 1, // Mono recording
    ...(deviceId ? { deviceId } : {}),
  },
  video: false,
});
const noop = () => {};

export interface MimeInfo {
  mimeType: string;
  extension: string;
}

// Type for recorder that can be either WavRecorder or AudioMediaRecorder
type Recorder = WavRecorder | AudioMediaRecorder;

// Check if AudioWorklet is available (not available on iOS Safari)
function isAudioWorkletAvailable(): boolean {
  try {
    // Check if AudioWorklet is supported
    if (typeof AudioWorklet === 'undefined') {
      return false;
    }
    // Try to create an AudioContext to verify
    const context = new AudioContext();
    return typeof context.audioWorklet !== 'undefined';
  } catch {
    return false;
  }
}

export function useWavRecorder(
  allowRecord: boolean = true,
  onStart: () => void = noop,
  onStop: (blob: Blob) => void = noop,
  onError: (e: any) => void = noop,
  onDataAvailable: (blob: Blob) => Promise<void>,
  deviceId?: string
) {
  const recorderRef = useRef<Recorder | undefined>(undefined);
  const useFallbackRef = useRef<boolean | null>(null); // null = not checked yet
  const isRecordingRef = useRef(false);
  const captureOptions = useMemo(
    () => createCaptureOptions(deviceId),
    [deviceId]
  );
  const getMediaStream = useUserMedia(captureOptions);
  const mediaStreamRef = useRef<MediaStream | undefined>(undefined);
  const previousDeviceIdRef = useRef<string | undefined>(undefined);
  const recorderStreamIdRef = useRef<string | undefined>(undefined);
  const [reporter] = useGlobal('errorReporter');
  const { showMessage } = useSnackBar();

  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
      if (recorderRef.current) {
        recorderRef.current
          .stop()
          .then(() => {
            recorderRef.current = undefined;
          })
          .catch(() => {
            recorderRef.current = undefined;
          });
      }
    };
  }, []);

  useEffect(() => {
    if (!allowRecord) {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = undefined;
      previousDeviceIdRef.current = deviceId;
      return;
    }

    const deviceChanged =
      previousDeviceIdRef.current !== deviceId &&
      mediaStreamRef.current !== undefined;

    const ensureStream = async () => {
      try {
        const stream = await getMediaStream(
          deviceChanged || !mediaStreamRef.current
        );
        if (stream && stream.id && stream.active) {
          mediaStreamRef.current = stream;
        } else {
          const err = 'no media stream ' + stream?.toString();
          logError(Severity.error, reporter, err);
          showMessage(err);
        }
      } catch (e) {
        handleError(e as Error);
      }
    };

    if (!mediaStreamRef.current || deviceChanged) {
      ensureStream();
    }

    if (deviceChanged && !isRecordingRef.current) {
      recorderRef.current = undefined;
      recorderStreamIdRef.current = undefined;
    }

    previousDeviceIdRef.current = deviceId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowRecord, deviceId, reporter]);

  function handleError(e: any) {
    const message =
      e?.error || e?.message || e?.toString?.() || 'Recorder error';
    logError(Severity.error, reporter, message);
    onError({ error: message });
  }

  async function startRecorder() {
    if (!mediaStreamRef.current) {
      try {
        mediaStreamRef.current = await getMediaStream();
      } catch (error) {
        handleError(error);
        return undefined;
      }
    }
    if (mediaStreamRef.current) {
      try {
        // Check AudioWorklet availability (cache the result)
        if (useFallbackRef.current === null) {
          useFallbackRef.current = !isAudioWorkletAvailable();
        }
        let recorder: Recorder;

        if (useFallbackRef.current) {
          recorder = new AudioMediaRecorder(
            mediaStreamRef.current,
            onDataAvailable
          );
        } else {
          // Use WavRecorder with AudioWorklet (when we need WAV format)
          recorder = new WavRecorder(mediaStreamRef.current, onDataAvailable);
        }

        await recorder.initializeWorklet();
        recorderRef.current = recorder;
        recorderStreamIdRef.current = mediaStreamRef.current.id;
        return recorder;
      } catch (error) {
        // If WavRecorder fails, try fallback
        if (!useFallbackRef.current) {
          try {
            useFallbackRef.current = true;
            const fallbackRecorder = new AudioMediaRecorder(
              mediaStreamRef.current,
              onDataAvailable
            );
            await fallbackRecorder.initializeWorklet();
            recorderRef.current = fallbackRecorder;
            recorderStreamIdRef.current = mediaStreamRef.current.id;
            return fallbackRecorder;
          } catch (fallbackError) {
            handleError(fallbackError);
            return undefined;
          }
        } else {
          handleError(error);
          return undefined;
        }
      }
    }
    return undefined;
  }

  async function startRecording(timeSlice?: number) {
    let recorder = recorderRef.current;
    if (
      !recorder ||
      recorderStreamIdRef.current !== mediaStreamRef.current?.id
    ) {
      recorder = await startRecorder();
    }
    if (recorder) {
      try {
        await recorder.start(timeSlice);
        isRecordingRef.current = true;
        onStart();
        return true;
      } catch (error) {
        handleError(error);
        return false;
      }
    } else {
      onError({ error: 'No recorder available' });
      return false;
    }
  }

  function stopRecording() {
    if (isRecordingRef.current && recorderRef.current) {
      recorderRef.current
        .stop()
        .then((blob: Blob) => {
          isRecordingRef.current = false;
          onStop(blob);
        })
        .catch((error: any) => {
          handleError(error);
        });
    } else {
      onError({ error: 'Not recording' });
    }
  }
  return {
    startRecording: allowRecord
      ? (timeSlice?: number) => startRecording(timeSlice)
      : () => Promise.resolve(false),
    stopRecording: allowRecord ? stopRecording : noop,
  };
}
