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

      // Ensure audio context is running
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
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

    async stop(): Promise<Blob> {
      if (!isRecording || !mediaRecorder) {
        // Return empty blob
        return new Blob([]);
      }

      return new Promise((resolve, reject) => {
        if (!mediaRecorder) {
          reject(new Error('AudioMediaRecorder not initialized'));
          return;
        }

        // Request any remaining data before stopping
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.requestData();
        }

        let stopTimeout: ReturnType<typeof setTimeout> | null = null;

        mediaRecorder.onstop = async () => {
          if (stopTimeout) {
            clearTimeout(stopTimeout);
            stopTimeout = null;
          }

          isRecording = false;

          try {
            if (audioContext.state === 'suspended') {
              await audioContext.resume();
            }
            // Wait a bit to ensure all chunks are collected
            await new Promise((r) => setTimeout(r, 100));

            if (recordedChunks.length === 0) {
              console.error(
                'No chunks recorded - MediaRecorder state was:',
                mediaRecorder?.state
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
                type: mediaRecorder?.mimeType || 'audio/webm',
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
                mimeType: mediaRecorder?.mimeType,
                audioBitsPerSecond: mediaRecorder?.audioBitsPerSecond,
                videoBitsPerSecond: mediaRecorder?.videoBitsPerSecond,
                state: mediaRecorder?.state,
              },
              tracks: getAudioTrackDiagnostics(mediaStream),
            });
            resolve(finalBlob);
          } catch (error) {
            reject(error);
          }
        };

        mediaRecorder.onerror = (event) => {
          if (stopTimeout) {
            clearTimeout(stopTimeout);
          }
          reject(new Error(`Browser MediaRecorder error: ${event}`));
        };

        // Stop the recorder
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
          // Set a timeout in case onstop doesn't fire
          stopTimeout = setTimeout(() => {
            reject(new Error('MediaRecorder stop timeout'));
          }, 5000);
        } else {
          // Already stopped, resolve with empty blob
          resolve(new Blob([]));
        }
      });
    },

    /**
     * Clean up resources and close the AudioContext.
     * Should be called when the AudioMediaRecorder is being destroyed.
     */
    cleanup(): void {
      // Close audio context
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch((error) => {
          console.error('Error closing audio context:', error);
        });
      }
    },
  };
}
