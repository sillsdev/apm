import { useGlobal } from '../context/useGlobal';
import { useEffect, useMemo, useRef } from 'react';
import { CaptureAcquireSupersededError, useUserMedia } from './useUserMedia';
import { useSnackBar } from '../hoc/SnackBar';
import { logError, Severity } from '../utils';
import { createWavRecorder } from './WavRecorder';
import { createAudioMediaRecorder } from './AudioMediaRecorder';
import {
  createRecordPeaksCapture,
  RecordPeaksCapture,
} from './recordPeaksCapture';
import {
  getAudioTrackDiagnostics,
  getBlobDiagnostics,
  logAudioDiagnostic,
} from './audioDiagnostics';
import {
  buildCaptureConstraints,
  CaptureDeviceLostError,
  captureStreamDeviceId,
  isDeviceLossError,
  isUnusableCaptureStream,
  listenForCaptureDeviceLoss,
  waitOutTransientCaptureMute,
} from './captureConstraints';
import { finalizeRecordingOnDeviceLoss } from './finalizeRecordingOnDeviceLoss';

/** Defaults match Record step toolSettings when keys are absent (both off). */
export function parseRecordCaptureAudioProcessing(
  toolSettings: string | undefined | null
): { echoCancellation: boolean; noiseSuppression: boolean } {
  if (!toolSettings?.trim()) {
    return { echoCancellation: false, noiseSuppression: false };
  }
  try {
    const j = JSON.parse(toolSettings) as {
      echoCancellation?: boolean;
      noiseSuppression?: boolean;
    };
    return {
      echoCancellation: Boolean(j.echoCancellation),
      noiseSuppression: Boolean(j.noiseSuppression),
    };
  } catch {
    return { echoCancellation: false, noiseSuppression: false };
  }
}

const noop = () => {};

export interface MimeInfo {
  mimeType: string;
  extension: string;
}

// Type for recorder that can be either WavRecorder or AudioMediaRecorder
export interface APMRecorder {
  initializeWorklet(): Promise<void>;
  start(timeSlice?: number): Promise<void>;
  stop(): Promise<Blob>;
  cleanup(): void;
}

// Check if AudioWorklet is available (not available on iOS Safari)
function isAudioWorkletAvailable(): boolean {
  try {
    // Check if AudioWorklet is supported
    if (typeof AudioWorklet === 'undefined') {
      return false;
    }
    // Try to create an AudioContext to verify
    const context = new AudioContext();
    const isSupported = typeof context.audioWorklet !== 'undefined';
    // Close the context to avoid leaking audio resources
    void context.close();
    return isSupported;
  } catch {
    return false;
  }
}

export function useWavRecorder(
  allowRecord: boolean = true,
  onStart: () => void = noop,
  onStop: (blob?: Blob) => void = noop,
  onError: (e: any) => void = noop,
  onDataAvailable: (blob: Blob) => Promise<void>,
  deviceId?: string,
  echoCancellation: boolean = false,
  noiseSuppression: boolean = false,
  /** Live waveform peaks (cheap render path) — see recordPeaksCapture.ts. */
  onLivePeaks?: (peaks: Float32Array, seconds: number) => void
) {
  const recorderRef = useRef<APMRecorder | undefined>(undefined);
  const useFallbackRef = useRef<boolean | null>(null); // null = not checked yet
  const isRecordingRef = useRef(false);
  const peaksCaptureRef = useRef<RecordPeaksCapture | undefined>(undefined);
  const recordingStartedAtRef = useRef<number | undefined>(undefined);
  const captureOptions = useMemo(
    () => buildCaptureConstraints(deviceId, echoCancellation, noiseSuppression),
    [deviceId, echoCancellation, noiseSuppression]
  );
  const getMediaStream = useUserMedia(captureOptions);
  const mediaStreamRef = useRef<MediaStream | undefined>(undefined);
  const ignoreTrackEndedRef = useRef(false);
  const stopWatchingStreamRef = useRef<() => void>(() => undefined);
  const previousDeviceIdRef = useRef<string | undefined>(undefined);
  const recorderStreamIdRef = useRef<string | undefined>(undefined);
  const captureGenerationRef = useRef(0);
  const [reporter] = useGlobal('errorReporter');
  const { showMessage } = useSnackBar();

  function dropCaptureStream() {
    ignoreTrackEndedRef.current = true;
    stopWatchingStreamRef.current();
    stopWatchingStreamRef.current = () => undefined;
    mediaStreamRef.current?.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        /* device already gone */
      }
    });
    mediaStreamRef.current = undefined;
  }

  function adoptCaptureStream(stream: MediaStream) {
    stopWatchingStreamRef.current();
    ignoreTrackEndedRef.current = false;
    mediaStreamRef.current = stream;
    stopWatchingStreamRef.current = listenForCaptureDeviceLoss(
      stream,
      () => {
        if (!ignoreTrackEndedRef.current) {
          handleError(new CaptureDeviceLostError());
        }
      },
      () => isRecordingRef.current
    );
  }

  function takeCaptureStream(stream: MediaStream, fellBack: boolean) {
    adoptCaptureStream(stream);
    logAudioDiagnostic('media-stream-ready', {
      requestedCaptureOptions: captureOptions,
      selectedDeviceId: deviceId,
      stream: { id: stream.id, active: stream.active },
      tracks: getAudioTrackDiagnostics(stream),
    });
    if (fellBack) {
      onError({
        error: 'microphone disconnected',
        deviceLost: true,
        fellBack: true,
        deviceId: captureStreamDeviceId(stream),
      });
    }
  }

  useEffect(() => {
    return () => {
      captureGenerationRef.current += 1;
      peaksCaptureRef.current?.stop();
      peaksCaptureRef.current = undefined;
      dropCaptureStream();
      if (recorderRef.current) {
        const recorder = recorderRef.current;
        recorder
          .stop()
          .then(() => {
            recorder.cleanup();
            recorderRef.current = undefined;
          })
          .catch(() => {
            recorder.cleanup();
            recorderRef.current = undefined;
          });
      }
    };
  }, []);

  const captureProcessingKeyRef = useRef('');

  useEffect(() => {
    const generation = ++captureGenerationRef.current;
    if (!allowRecord) {
      dropCaptureStream();
      previousDeviceIdRef.current = deviceId;
      captureProcessingKeyRef.current = '';
      return;
    }

    const processingKey = `${echoCancellation},${noiseSuppression}`;
    const processingChanged =
      captureProcessingKeyRef.current !== '' &&
      captureProcessingKeyRef.current !== processingKey &&
      mediaStreamRef.current !== undefined;

    if (processingChanged && !isRecordingRef.current) {
      dropCaptureStream();
    }

    const deviceChanged =
      previousDeviceIdRef.current !== deviceId &&
      mediaStreamRef.current !== undefined;
    const streamGone = isUnusableCaptureStream(mediaStreamRef.current);

    const ensureStream = async () => {
      try {
        const { stream, fellBack } = await getMediaStream(
          deviceChanged || processingChanged || streamGone
        );
        if (generation !== captureGenerationRef.current) return;
        if (stream && stream.id && stream.active) {
          takeCaptureStream(stream, fellBack);
        } else {
          const err = 'no media stream ' + stream?.toString();
          logError(Severity.error, reporter, err);
          showMessage(err);
        }
      } catch (e) {
        if (generation !== captureGenerationRef.current) return;
        if (e instanceof CaptureAcquireSupersededError) return;
        handleError(e as Error);
      }
    };

    if (isRecordingRef.current) {
      if (streamGone) handleError(new CaptureDeviceLostError());
    } else if (streamGone || deviceChanged || processingChanged) {
      ensureStream();
    }

    if ((deviceChanged || processingChanged) && !isRecordingRef.current) {
      recorderRef.current = undefined;
      recorderStreamIdRef.current = undefined;
    }

    previousDeviceIdRef.current = deviceId;
    captureProcessingKeyRef.current = processingKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowRecord, deviceId, echoCancellation, noiseSuppression, reporter]);

  function handleError(e: any) {
    const message =
      e?.error || e?.message || e?.toString?.() || 'Recorder error';
    logError(Severity.error, reporter, message);
    if (isDeviceLossError(e)) {
      const wasRecording = isRecordingRef.current;
      const recorder = recorderRef.current;
      isRecordingRef.current = false;
      peaksCaptureRef.current?.stop();
      peaksCaptureRef.current = undefined;
      recorderRef.current = undefined;
      recorderStreamIdRef.current = undefined;
      ignoreTrackEndedRef.current = true;
      stopWatchingStreamRef.current();
      stopWatchingStreamRef.current = () => undefined;
      void (async () => {
        let blob: Blob | undefined;
        try {
          blob = await finalizeRecordingOnDeviceLoss(recorder, wasRecording);
        } catch {
          blob = undefined;
        }
        dropCaptureStream();
        if (wasRecording) onStop(blob);
      })();
      onError({ error: message, deviceLost: true });
      return;
    }
    onError({ error: message });
  }

  function discardRecorder(recorder: APMRecorder | undefined) {
    if (!recorder) return;
    try {
      recorder.cleanup();
    } catch {
      /* AudioContext may already be shut down */
    }
  }

  function recorderStillCurrent(
    generation: number,
    stream: MediaStream | undefined
  ) {
    return (
      generation === captureGenerationRef.current &&
      stream !== undefined &&
      mediaStreamRef.current === stream
    );
  }

  async function startRecorder() {
    const generation = captureGenerationRef.current;
    if (await waitOutTransientCaptureMute(mediaStreamRef.current)) {
      if (generation !== captureGenerationRef.current) return undefined;
      try {
        const { stream, fellBack } = await getMediaStream(true);
        if (generation !== captureGenerationRef.current) return undefined;
        takeCaptureStream(stream, fellBack);
      } catch (error) {
        if (error instanceof CaptureAcquireSupersededError) return undefined;
        handleError(error);
        return undefined;
      }
    }
    const stream = mediaStreamRef.current;
    if (!stream || generation !== captureGenerationRef.current) {
      return undefined;
    }
    try {
      // Check AudioWorklet availability (cache the result)
      if (useFallbackRef.current === null) {
        useFallbackRef.current = !isAudioWorkletAvailable();
        logAudioDiagnostic('recorder-capability-check', {
          audioWorkletAvailable: !useFallbackRef.current,
          fallbackRecorder: useFallbackRef.current,
        });
      }
      let recorder: APMRecorder;

      if (useFallbackRef.current) {
        logAudioDiagnostic('recorder-selected', {
          recorderType: 'MediaRecorder',
          fallbackRecorder: true,
          reason: 'AudioWorklet unavailable',
          tracks: getAudioTrackDiagnostics(stream),
        });
        recorder = createAudioMediaRecorder(stream, onDataAvailable);
      } else {
        // Use WavRecorder with AudioWorklet (when we need WAV format)
        logAudioDiagnostic('recorder-selected', {
          recorderType: 'AudioWorkletWavRecorder',
          fallbackRecorder: false,
          tracks: getAudioTrackDiagnostics(stream),
        });
        recorder = createWavRecorder(stream, onDataAvailable);
      }

      await recorder.initializeWorklet();
      if (!recorderStillCurrent(generation, stream)) {
        discardRecorder(recorder);
        return undefined;
      }
      recorderRef.current = recorder;
      recorderStreamIdRef.current = stream.id;
      return recorder;
    } catch (error) {
      // If WavRecorder fails, try fallback
      if (!useFallbackRef.current) {
        try {
          useFallbackRef.current = true;
          logAudioDiagnostic('recorder-fallback-after-error', {
            fallbackRecorder: true,
            error:
              error instanceof Error
                ? { name: error.name, message: error.message }
                : { message: String(error) },
            tracks: getAudioTrackDiagnostics(stream),
          });
          const fallbackRecorder = createAudioMediaRecorder(
            stream,
            onDataAvailable
          );
          await fallbackRecorder.initializeWorklet();
          if (!recorderStillCurrent(generation, stream)) {
            discardRecorder(fallbackRecorder);
            return undefined;
          }
          recorderRef.current = fallbackRecorder;
          recorderStreamIdRef.current = stream.id;
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

  async function startRecording(timeSlice?: number) {
    const generation = captureGenerationRef.current;
    const streamMuted = Boolean(
      mediaStreamRef.current?.getAudioTracks?.()[0]?.muted
    );
    let recorder = recorderRef.current;
    if (
      !recorder ||
      recorderStreamIdRef.current !== mediaStreamRef.current?.id ||
      isUnusableCaptureStream(mediaStreamRef.current) ||
      streamMuted
    ) {
      recorder = await startRecorder();
    }
    if (generation !== captureGenerationRef.current) {
      discardRecorder(recorder);
      if (recorderRef.current === recorder) {
        recorderRef.current = undefined;
        recorderStreamIdRef.current = undefined;
      }
      return false;
    }
    if (recorder) {
      try {
        await recorder.start(timeSlice);
        if (!recorderStillCurrent(generation, mediaStreamRef.current)) {
          discardRecorder(recorder);
          recorderRef.current = undefined;
          recorderStreamIdRef.current = undefined;
          return false;
        }
        recordingStartedAtRef.current = performance.now();
        logAudioDiagnostic('recording-started', {
          timeSliceMs: timeSlice,
          fallbackRecorder: useFallbackRef.current,
          requestedCaptureOptions: captureOptions,
          selectedDeviceId: deviceId,
          tracks: mediaStreamRef.current
            ? getAudioTrackDiagnostics(mediaStreamRef.current)
            : undefined,
        });
        isRecordingRef.current = true;
        if (onLivePeaks && mediaStreamRef.current) {
          peaksCaptureRef.current?.stop();
          peaksCaptureRef.current = createRecordPeaksCapture(
            mediaStreamRef.current,
            onLivePeaks
          );
        }
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
    peaksCaptureRef.current?.stop();
    peaksCaptureRef.current = undefined;
    if (isRecordingRef.current && recorderRef.current) {
      recorderRef.current
        .stop()
        .then((blob: Blob) => {
          const durationSeconds = recordingStartedAtRef.current
            ? (performance.now() - recordingStartedAtRef.current) / 1000
            : undefined;
          logAudioDiagnostic('recording-stopped', {
            fallbackRecorder: useFallbackRef.current,
            recordedBlob: getBlobDiagnostics(blob, durationSeconds),
            tracks: mediaStreamRef.current
              ? getAudioTrackDiagnostics(mediaStreamRef.current)
              : undefined,
          });
          recordingStartedAtRef.current = undefined;
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
