// AudioMediaRecorder - Wrapper around browser MediaRecorder API
// Used for devices without AudioWorklet support (e.g., iOS Safari)
// or when recording directly to compressed formats
export class AudioMediaRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream;
  private audioContext: AudioContext;
  private onDataAvailable: (blob: Blob) => void;
  private timeSlice: number = 1000; // Default 1 second
  private isRecording = false;
  private recordedChunks: Blob[] = [];

  constructor(stream: MediaStream, onDataAvailable: (blob: Blob) => void) {
    this.mediaStream = stream;
    this.audioContext = new AudioContext();
    this.onDataAvailable = onDataAvailable;
  }

  async initializeWorklet(): Promise<void> {
    // No-op for AudioMediaRecorder - it doesn't need initialization
    // This method exists to match WavRecorder interface
    return Promise.resolve();
  }

  async start(timeSlice?: number): Promise<void> {
    if (this.isRecording) {
      return;
    }

    // Ensure audio context is running
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Set timeSlice if provided
    if (timeSlice && timeSlice > 0) {
      this.timeSlice = timeSlice;
    }

    this.isRecording = true;
    this.recordedChunks = [];

    try {
      this.mediaRecorder = new MediaRecorder(this.mediaStream);

      // Collect chunks as they become available (for final output)
      // Combine all accumulated chunks and pass to onDataAvailable callback - let wavesurfer decode
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
          console.log('Added chunk, total chunks:', this.recordedChunks.length);
          // Combine all accumulated chunks into a single blob (complete recording so far)
          const accumulatedBlob = new Blob(this.recordedChunks);
          // Pass complete accumulated blob to onDataAvailable - wavesurfer will decode it
          this.onDataAvailable(accumulatedBlob);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('Browser MediaRecorder error:', event);
      };

      // Start recording with timeslice for periodic data availability
      this.mediaRecorder.start(this.timeSlice);
    } catch (error) {
      this.isRecording = false;
      throw error;
    }
  }

  async stop(): Promise<Blob> {
    if (!this.isRecording || !this.mediaRecorder) {
      // Return empty blob
      return new Blob([]);
    }

    this.isRecording = false;

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('AudioMediaRecorder not initialized'));
        return;
      }

      // Request any remaining data before stopping
      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.requestData();
      }

      let stopTimeout: ReturnType<typeof setTimeout> | null = null;

      this.mediaRecorder.onstop = async () => {
        if (stopTimeout) {
          clearTimeout(stopTimeout);
          stopTimeout = null;
        }

        try {
          // Wait a bit to ensure all chunks are collected
          await new Promise((r) => setTimeout(r, 100));

          console.log(
            'MediaRecorder onstop - chunks:',
            this.recordedChunks.length,
            'total size:',
            this.recordedChunks.reduce((sum, chunk) => sum + chunk.size, 0)
          );

          // Combine all recorded chunks
          if (this.recordedChunks.length === 0) {
            console.error(
              'No chunks recorded - MediaRecorder state was:',
              this.mediaRecorder?.state
            );
            reject(new Error('No audio data recorded'));
            return;
          }

          // Combine all recorded chunks
          const finalBlob = new Blob(this.recordedChunks);
          // Verify the blob has data
          if (finalBlob.size === 0) {
            console.error(
              'Blob is empty! Chunks:',
              this.recordedChunks.map((c) => c.size)
            );
            reject(new Error('Recorded audio blob is empty'));
            return;
          }

          resolve(finalBlob);
        } catch (error) {
          reject(error);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        if (stopTimeout) {
          clearTimeout(stopTimeout);
        }
        reject(new Error(`Browser MediaRecorder error: ${event}`));
      };

      // Stop the recorder
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
        // Set a timeout in case onstop doesn't fire
        stopTimeout = setTimeout(() => {
          reject(new Error('MediaRecorder stop timeout'));
        }, 5000);
      } else {
        // Already stopped, resolve with empty blob
        resolve(new Blob([]));
      }
    });
  }
}
