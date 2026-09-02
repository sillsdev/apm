// AudioMediaRecorder - Wrapper around browser MediaRecorder API
// Used for devices without AudioWorklet support (e.g., iOS Safari)
// or when recording directly to compressed formats

import { decodeAudioData } from '../utils/decodeAudioData';
import { audioBufferToWavBlob } from '../utils/audioBufferToWavBlob';
import { APMRecorder } from './useWavRecorder';
import {
  getAudioTrackDiagnostics,
  getBlobDiagnostics,
  logAudioDiagnostic,
} from './audioDiagnostics';

function concatenateAudioBuffers(
  audioContext: AudioContext,
  buffers: AudioBuffer[]
): AudioBuffer {
  const sampleRate = buffers[0].sampleRate;
  const channels = buffers[0].numberOfChannels;
  const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
  const merged = audioContext.createBuffer(channels, totalLength, sampleRate);
  let offset = 0;
  for (const buffer of buffers) {
    for (let ch = 0; ch < channels; ch++) {
      const sourceCh = Math.min(ch, buffer.numberOfChannels - 1);
      merged.getChannelData(ch).set(buffer.getChannelData(sourceCh), offset);
    }
    offset += buffer.length;
  }
  return merged;
}

async function decodeRecordedChunks(
  audioContext: AudioContext,
  recordedChunks: Blob[],
  mimeType: string
): Promise<AudioBuffer | null> {
  if (recordedChunks.length === 0) return null;

  // Multiple standalone WAV fragments decode as one short buffer when concatenated
  // (first RIFF only). Skip the accumulated attempt so per-chunk merge runs.
  const skipAccumulatedDecode =
    recordedChunks.length > 1 &&
    recordedChunks.every((chunk) => chunk.type.includes('wav'));

  if (!skipAccumulatedDecode) {
    try {
      return await decodeAudioData(
        audioContext,
        await new Blob(recordedChunks, { type: mimeType }).arrayBuffer()
      );
    } catch {
      // Accumulated container blobs are often undecodable (e.g. concatenated WAV).
    }
  }

  const decodedChunks: AudioBuffer[] = [];
  for (const chunk of recordedChunks) {
    try {
      decodedChunks.push(
        await decodeAudioData(audioContext, await chunk.arrayBuffer())
      );
    } catch {
      // Skip chunks that do not decode on their own.
    }
  }
  if (decodedChunks.length === 0) return null;

  const isCumulative =
    decodedChunks.length > 1 &&
    decodedChunks.some(
      (buffer, index) =>
        index > 0 && buffer.length > decodedChunks[index - 1].length
    );
  if (isCumulative) {
    return decodedChunks[decodedChunks.length - 1];
  }

  return concatenateAudioBuffers(audioContext, decodedChunks);
}

export function createAudioMediaRecorder(
  stream: MediaStream,
  onDataAvailable: (blob: Blob) => void
): APMRecorder {
  let mediaRecorder: MediaRecorder | null = null;
  const mediaStream = stream;
  const audioContext = new AudioContext();
  let timeSlice: number = 1000; // Default 1 second
  let isRecording = false;
  let recordedChunks: Blob[] = [];
  let recordingStartedAt = 0;
  let previewEmitInFlight = false;
  let previewNeedsRetry = false;
  let inFlightStop: Promise<Blob> | undefined;

  const decodeAccumulatedOrLatest = async (): Promise<AudioBuffer | null> => {
    const mimeType = mediaRecorder?.mimeType || 'audio/webm';
    return decodeRecordedChunks(audioContext, recordedChunks, mimeType);
  };

  const emitDecodablePreview = async () => {
    if (previewEmitInFlight) {
      previewNeedsRetry = true;
      return;
    }
    previewEmitInFlight = true;
    try {
      if (!isRecording || recordedChunks.length === 0) return;
      const decoded = await decodeAccumulatedOrLatest();
      if (!decoded || !isRecording) return;
      const previewBlob = await audioBufferToWavBlob(decoded);
      if (previewBlob.size > 0) {
        onDataAvailable(previewBlob);
      }
    } catch (error) {
      console.error('AudioMediaRecorder preview decode failed:', error);
    } finally {
      previewEmitInFlight = false;
      if (previewNeedsRetry && isRecording) {
        previewNeedsRetry = false;
        void emitDecodablePreview();
      }
    }
  };

  return {
    async initializeWorklet(): Promise<void> {
      // No-op for AudioMediaRecorder - it doesn't need initialization
      // This method exists to match WavRecorder interface
      return Promise.resolve();
    },

    async start(timeSliceParam?: number): Promise<void> {
      if (isRecording) {
        return;
      }

      // MediaRecorder captures the stream; this context is for preview/stop
      // decode. Don't await resume() — under missing user-gesture / fake timers
      // it may never settle, and Record would never start.
      if (audioContext.state === 'suspended') {
        void audioContext.resume();
      }

      // Set timeSlice if provided
      if (timeSliceParam && timeSliceParam > 0) {
        timeSlice = timeSliceParam;
      }

      isRecording = true;
      recordedChunks = [];
      previewNeedsRetry = false;

      try {
        mediaRecorder = new MediaRecorder(mediaStream);
        recordingStartedAt = performance.now();
        logAudioDiagnostic('media-recorder-fallback-start', {
          fallbackRecorder: true,
          requestedOptions: {
            mimeType: undefined,
            audioBitsPerSecond: undefined,
            bitsPerSecond: undefined,
          },
          mediaRecorder: {
            mimeType: mediaRecorder.mimeType,
            audioBitsPerSecond: mediaRecorder.audioBitsPerSecond,
            videoBitsPerSecond: mediaRecorder.videoBitsPerSecond,
            state: mediaRecorder.state,
          },
          timeSliceMs: timeSlice,
          audioContext: {
            sampleRate: audioContext.sampleRate,
            state: audioContext.state,
          },
          tracks: getAudioTrackDiagnostics(mediaStream),
        });

        // Collect chunks as they become available. Container-format chunks are
        // merged for decode; preview/stop emit decodable WAV (TT-7276 / TT-7384).
        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunks.push(event.data);
            const elapsedSeconds =
              recordingStartedAt > 0
                ? (performance.now() - recordingStartedAt) / 1000
                : undefined;
            logAudioDiagnostic('media-recorder-fallback-chunk', {
              chunk: getBlobDiagnostics(event.data, elapsedSeconds),
              chunkCount: recordedChunks.length,
              mediaRecorder: {
                mimeType: mediaRecorder?.mimeType,
                audioBitsPerSecond: mediaRecorder?.audioBitsPerSecond,
                state: mediaRecorder?.state,
              },
            });
            void emitDecodablePreview();
          }
        };

        mediaRecorder.onerror = (event) => {
          console.error('Browser MediaRecorder error:', event);
        };

        // Start recording with timeslice for periodic data availability
        mediaRecorder.start(timeSlice);
      } catch (error) {
        isRecording = false;
        throw error;
      }
    },

    stop(): Promise<Blob> {
      if (inFlightStop) return inFlightStop;
      if (!isRecording || !mediaRecorder) {
        return Promise.resolve(new Blob([]));
      }

      isRecording = false;
      const recorder = mediaRecorder;
      const pending = new Promise<Blob>((resolve, reject) => {
        if (recorder.state === 'recording') {
          recorder.requestData();
        }

        let stopTimeout: ReturnType<typeof setTimeout> | null = null;

        recorder.onstop = async () => {
          if (stopTimeout) {
            clearTimeout(stopTimeout);
            stopTimeout = null;
          }

          try {
            if (audioContext.state === 'suspended') {
              await audioContext.resume();
            }
            await new Promise((r) => setTimeout(r, 100));

            if (recordedChunks.length === 0) {
              console.error(
                'No chunks recorded - MediaRecorder state was:',
                recorder.state
              );
              reject(new Error('No audio data recorded'));
              return;
            }

            const durationSeconds =
              recordingStartedAt > 0
                ? (performance.now() - recordingStartedAt) / 1000
                : undefined;

            let finalBlob: Blob;
            const decoded = await decodeAccumulatedOrLatest();
            if (decoded) {
              finalBlob = await audioBufferToWavBlob(decoded);
            } else {
              finalBlob = new Blob(recordedChunks, {
                type: recorder.mimeType || 'audio/webm',
              });
            }

            if (finalBlob.size === 0) {
              console.error(
                'Blob is empty! Chunks:',
                recordedChunks.map((c) => c.size)
              );
              reject(new Error('Recorded audio blob is empty'));
              return;
            }

            logAudioDiagnostic('media-recorder-fallback-stop', {
              fallbackRecorder: true,
              finalBlob: getBlobDiagnostics(finalBlob, durationSeconds),
              chunkCount: recordedChunks.length,
              chunkSizes: recordedChunks.map((chunk) => chunk.size),
              mediaRecorder: {
                mimeType: recorder.mimeType,
                audioBitsPerSecond: recorder.audioBitsPerSecond,
                videoBitsPerSecond: recorder.videoBitsPerSecond,
                state: recorder.state,
              },
              tracks: getAudioTrackDiagnostics(mediaStream),
            });
            resolve(finalBlob);
          } catch (error) {
            reject(error);
          }
        };

        recorder.onerror = (event) => {
          if (stopTimeout) {
            clearTimeout(stopTimeout);
          }
          reject(new Error(`Browser MediaRecorder error: ${event}`));
        };

        if (recorder.state !== 'inactive') {
          recorder.stop();
          stopTimeout = setTimeout(() => {
            reject(new Error('MediaRecorder stop timeout'));
          }, 5000);
        } else {
          resolve(new Blob([]));
        }
      });
      inFlightStop = pending;
      void pending
        .finally(() => {
          if (inFlightStop === pending) inFlightStop = undefined;
        })
        .catch(() => undefined);
      return pending;
    },

    /**
     * Clean up resources and close the AudioContext.
     * Should be called when the AudioMediaRecorder is being destroyed.
     */
    cleanup(): void {
      isRecording = false;
      previewNeedsRetry = false;
      if (inFlightStop) return;
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try {
          mediaRecorder.stop();
        } catch {
          /* already stopping */
        }
      }
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch((error) => {
          console.error('Error closing audio context:', error);
        });
      }
    },
  };
}
