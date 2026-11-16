import { useMemo } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import { replaceAudioSegment } from './audioUtils';
import { createWavRecorder } from '../crud/WavRecorder';
import {
  createRecordPeaksCapture,
  RECORD_PEAKS_PER_SECOND,
} from '../crud/recordPeaksCapture';

/**
 * Records using a given microphone stream, as lossless WAV where an
 * AudioWorklet starts and in the browser's default format otherwise. A
 * recording is inserted into the audio passed to `startRecording` at `at` (or
 * becomes the audio when there is none), and the result is reported through
 * `onRecorded` once stopped.
 */
export function useRecorder(stream: MediaStream | undefined): {
  startRecording: (
    audio: Blob | null,
    at: number,
    ws: WaveSurfer | null,
    onRecorded: (audio: Blob) => void
  ) => Promise<void>;
  stopRecording: () => void;
} {
  return useMemo(() => {
    let stop: () => void = () => {};
    return {
      /** Resolves once the take is being captured. */
      startRecording: async (
        audio: Blob | null,
        at: number,
        ws: WaveSurfer | null,
        onRecorded: (audio: Blob) => void
      ) => {
        if (!stream)
          throw new Error('Error starting recording: no microphone found.');
        const stopTake = await startTake(stream);
        const stopDrawing = ws ? drawRecording(ws, stream, at) : () => {};
        stop = async () => {
          stop = () => {};
          stopDrawing();
          const take = await stopTake();
          onRecorded(
            audio?.size
              ? (await replaceAudioSegment(audio, at, at, take)).blob
              : take
          );
        };
      },
      stopRecording: () => stop(),
    };
  }, [stream]);
}

/** Lossless WAV via AudioWorklet, else the browser's default MediaRecorder format. */
async function startTake(stream: MediaStream): Promise<() => Promise<Blob>> {
  const wav = createWavRecorder(stream, () => {});
  try {
    await wav.start();
    return () => wav.stop().finally(wav.cleanup);
  } catch {
    wav.cleanup();
    const recorder = new MediaRecorder(stream);
    const audio = new Promise<Blob>((resolve) => {
      recorder.ondataavailable = ({ data }) => resolve(data);
    });
    recorder.start();
    return () => {
      recorder.stop();
      return audio;
    };
  }
}

/**
 * Draws the audio from `stream` live into `ws`, inserted at `at` seconds of the
 * loaded audio. Returns a function that stops drawing.
 */
function drawRecording(ws: WaveSurfer, stream: MediaStream, at: number) {
  const duration = ws.getDuration();
  const [peaks = []] = ws.getDecodedData()
    ? ws.exportPeaks({
        channels: 1,
        maxLength: Math.round(duration * RECORD_PEAKS_PER_SECOND) || 2500,
      })
    : [];
  const split = Math.round(at * RECORD_PEAKS_PER_SECOND);
  const pre = peaks.slice(0, split);
  const post = peaks.slice(split);
  // Unload media so setTime doesn't refetch the blob URL load('') revokes.
  const media = ws.getMediaElement();
  media.removeAttribute('src');
  media.load();
  return createRecordPeaksCapture(stream, (live, seconds) => {
    ws.load('', [[...pre, ...live, ...post]], duration + seconds)
      .then(() => ws.setTime(at)) // load resets the cursor; keep it at the record start
      .catch(() => {}); // preview only — the next frame redraws
  }).stop;
}
