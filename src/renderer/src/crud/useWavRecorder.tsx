import { useGlobal } from '../context/useGlobal';
import { useEffect, useMemo, useRef } from 'react';
import { useUserMedia } from './useUserMedia';
import { useSnackBar } from '../hoc/SnackBar';
import { logError, Severity } from '../utils';
import { WavRecorder } from './WavRecorder';

const createCaptureOptions = (deviceId?: string): MediaStreamConstraints => ({
  audio: {
    autoGainControl: false,
    echoCancellation: true,
    noiseSuppression: true,
    ...(deviceId ? { deviceId } : {}),
  },
  video: false,
});
const noop = () => {};

export interface MimeInfo {
  mimeType: string;
  extension: string;
}
export function useWavRecorder(
  allowRecord: boolean = true,
  onStart: () => void = noop,
  onStop: (blob: Blob) => void = noop,
  onError: (e: any) => void = noop,
  onDataAvailable: (buffer: AudioBuffer) => Promise<void>,
  deviceId?: string
) {
  const wavRecorderRef = useRef<WavRecorder>();
  const isRecordingRef = useRef(false);
  const captureOptions = useMemo(
    () => createCaptureOptions(deviceId),
    [deviceId]
  );
  const getMediaStream = useUserMedia(captureOptions);
  const mediaStreamRef = useRef<MediaStream | undefined>(undefined);
  const previousDeviceIdRef = useRef<string | undefined>();
  const recorderStreamIdRef = useRef<string | undefined>();
  const [reporter] = useGlobal('errorReporter');
  const { showMessage } = useSnackBar();

  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
      if (wavRecorderRef.current) {
        wavRecorderRef.current
          .stop()
          .then(() => {
            wavRecorderRef.current = undefined;
          })
          .catch(() => {
            wavRecorderRef.current = undefined;
          });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      wavRecorderRef.current = undefined;
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
        const recorder = new WavRecorder(
          mediaStreamRef.current,
          onDataAvailable
        );
        await recorder.initializeWorklet();
        wavRecorderRef.current = recorder;
        recorderStreamIdRef.current = mediaStreamRef.current.id;
        return recorder;
      } catch (error) {
        handleError(error);
        return undefined;
      }
    }
    return undefined;
  }

  async function startRecording(timeSlice?: number) {
    let recorder = wavRecorderRef.current;
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
      onError({ error: 'No WAV recorder available' });
      return false;
    }
  }

  function stopRecording() {
    if (isRecordingRef.current && wavRecorderRef.current) {
      wavRecorderRef.current
        .stop()
        .then((wavBlob) => {
          isRecordingRef.current = false;
          onStop(wavBlob);
        })
        .catch((error) => {
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
