// AudioMediaRecorder - Wrapper around browser MediaRecorder API
// Used for devices without AudioWorklet support (e.g., iOS Safari)
// or when recording directly to compressed formats

import { APMRecorder } from './useWavRecorder';

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

      try {
        mediaRecorder = new MediaRecorder(mediaStream);

        // Collect chunks as they become available (for final output)
        // Combine all accumulated chunks and pass to onDataAvailable callback - let wavesurfer decode
        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunks.push(event.data);
            // Combine all accumulated chunks into a single blob (complete recording so far)
            const accumulatedBlob = new Blob(recordedChunks);
            // Pass complete accumulated blob to onDataAvailable - wavesurfer will decode it
            onDataAvailable(accumulatedBlob);
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

      isRecording = false;

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

          try {
            // Wait a bit to ensure all chunks are collected
            await new Promise((r) => setTimeout(r, 100));

            // Combine all recorded chunks
            if (recordedChunks.length === 0) {
              console.error(
                'No chunks recorded - MediaRecorder state was:',
                mediaRecorder?.state
              );
              reject(new Error('No audio data recorded'));
              return;
            }

            // Combine all recorded chunks
            const finalBlob = new Blob(recordedChunks);
            // Verify the blob has data
            if (finalBlob.size === 0) {
              console.error(
                'Blob is empty! Chunks:',
                recordedChunks.map((c) => c.size)
              );
              reject(new Error('Recorded audio blob is empty'));
              return;
            }

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
