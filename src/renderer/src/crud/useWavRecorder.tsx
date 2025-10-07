import { useGlobal } from '../context/useGlobal';
import { useEffect, useRef } from 'react';
import { useUserMedia } from './useUserMedia';
import { useSnackBar } from '../hoc/SnackBar';
import { logError, Severity } from '../utils';
import { WavRecorder } from './WavRecorder';

const CAPTURE_OPTIONS = {
  audio: {
    autoGainControl: false,
    echoCancellation: true,
    noiseSuppression: true,
  },
  video: false,
};
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
  onDataAvailable: (buffer: AudioBuffer) => Promise<void>
) {
  const wavRecorderRef = useRef<WavRecorder>();
  const isRecordingRef = useRef(false);
  const getMediaStream = useUserMedia(CAPTURE_OPTIONS);
  const streamRequested = useRef<boolean>(false);
  const mediaStreamRef = useRef<MediaStream | undefined>(undefined);
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
    if (allowRecord)
      if (!mediaStreamRef.current && !streamRequested.current) {
        streamRequested.current = true;
        try {
          getMediaStream().then((stream) => {
            if (stream && stream.id && stream.active) {
              mediaStreamRef.current = stream;
            } else {
              const err = 'no media stream ' + stream?.toString();
              logError(Severity.error, reporter, err);
              showMessage(err);
            }
          });
        } catch (e) {
          handleError(e as Error);
        }
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowRecord, getMediaStream]);

  function handleError(e: any) {
    logError(Severity.error, reporter, e.error);
    onError(e?.error || 'Recorder error');
  }

  async function startRecorder() {
    if (mediaStreamRef.current) {
      try {
        const recorder = new WavRecorder(
          mediaStreamRef.current,
          onDataAvailable
        );
        await recorder.initializeWorklet();
        wavRecorderRef.current = recorder;
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
    if (!recorder) {
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
