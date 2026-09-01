import { audioBufferToWavBlob } from '../utils/audioBufferToWavBlob';
import { logAudioDiagnostic } from './audioDiagnostics';
import type { APMRecorder } from './useWavRecorder';

const PREFERRED_RECORD_SAMPLE_RATE = 48000;

function createRecorderAudioContext(): AudioContext {
  try {
    return new AudioContext({ sampleRate: PREFERRED_RECORD_SAMPLE_RATE });
  } catch {
    return new AudioContext();
  }
}

/** New Float32 chunks since last preview emit (exported for unit tests). */
export function takeRecordingDeltaChunks(
  chunks: Float32Array[],
  lastEmittedExclusiveIndex: number
): { delta: Float32Array[]; nextIndex: number } {
  const len = chunks.length;
  if (len <= lastEmittedExclusiveIndex) {
    return { delta: [], nextIndex: lastEmittedExclusiveIndex };
  }
  return {
    delta: chunks.slice(lastEmittedExclusiveIndex),
    nextIndex: len,
  };
}

// Web Audio API-based WAV recorder using AudioWorklet
export function createWavRecorder(
  stream: MediaStream,
  onDataAvailable: (blob: Blob) => void
): APMRecorder {
  const audioContext = createRecorderAudioContext();
  logAudioDiagnostic('wav-recorder-audio-context', {
    audioContext: {
      sampleRate: audioContext.sampleRate,
      requestedSampleRate: PREFERRED_RECORD_SAMPLE_RATE,
      state: audioContext.state,
    },
  });
  const mediaStreamSource = audioContext.createMediaStreamSource(stream);
  const silentSinkGain = audioContext.createGain();
  silentSinkGain.gain.value = 0;
  let workletNode: AudioWorkletNode | null = null;
  let audioData: Float32Array[] = [];
  let isRecording = false;
  let workletLoaded = false;
  let dataAvailableTimer: ReturnType<typeof setInterval> | null = null;
  let timeSlice: number = 1000; // Default 1 second
  let lastEmittedChunkIndex = 0;
  let pendingRecordingCompleteResolve: (() => void) | null = null;
  let previewTickInFlight = false;
  let inFlightStop: Promise<Blob> | undefined;

  async function initializeWorklet(): Promise<void> {
    if (workletLoaded) return;

    try {
      // Inline the worklet code to work in Electron
      const workletCode = `
        class AudioRecorderProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.isRecording = false;
            this.audioData = [];

            // Set up message handler
            this.port.onmessage = (event) => {
              const { type, data } = event.data;
              console.log('worklet received message:', type);

              switch (type) {
                case 'startRecording':
                  this.isRecording = true;
                  this.audioData = [];
                  console.log('worklet: started recording');
                  break;

                case 'stopRecording':
                  this.isRecording = false;
                  console.log('worklet: stopped recording, data chunks:', this.audioData.length);
                  // Send all collected audio data
                  this.port.postMessage({
                    type: 'recordingComplete',
                    data: this.audioData,
                  });
                  this.audioData = [];
                  break;
              }
            };
          }

          static get parameterDescriptors() {
            return [];
          }

          process(inputs, outputs, parameters) {
            const input = inputs[0];

            if (input.length > 0 && this.isRecording) {
              // Get the first channel (mono recording)
              const inputChannel = input[0];

              // Copy the audio data to our buffer
              const audioChunk = new Float32Array(inputChannel.length);
              audioChunk.set(inputChannel);

              this.audioData.push(audioChunk);

              // Send the audio data to the main thread (optional - for real-time feedback)
              this.port.postMessage({
                type: 'audioData',
                data: audioChunk,
              });
            }

            return true; // Keep the processor alive
          }
        }

        registerProcessor('audio-recorder-processor', AudioRecorderProcessor);
      `;

      // Create a blob URL from the worklet code
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);

      await audioContext.audioWorklet.addModule(workletUrl);

      // Clean up the blob URL after loading
      URL.revokeObjectURL(workletUrl);

      // Create the worklet node
      workletNode = new AudioWorkletNode(
        audioContext,
        'audio-recorder-processor'
      );

      // Handle messages from the worklet
      workletNode.port.onmessage = (event) => {
        const { type, data } = event.data;
        switch (type) {
          case 'audioData':
            if (isRecording) {
              audioData.push(data);
            }
            break;

          case 'recordingComplete':
            // All audio data has been collected
            audioData = data;
            pendingRecordingCompleteResolve?.();
            pendingRecordingCompleteResolve = null;
            break;
        }
      };

      workletLoaded = true;
    } catch (error) {
      console.error('Failed to initialize audio worklet:', error);
      throw error;
    }
  }

  async function start(timeSliceParam?: number): Promise<void> {
    if (!workletLoaded) {
      await initializeWorklet();
    }

    // Ensure audio context is running
    if (audioContext.state === 'suspended') {
      console.log('resuming audio context...');
      await audioContext.resume();
    }

    // Set timeSlice if provided
    if (timeSliceParam && timeSliceParam > 0) {
      timeSlice = timeSliceParam;
    }

    isRecording = true;
    audioData = [];
    lastEmittedChunkIndex = 0;
    pendingRecordingCompleteResolve = null;

    // Send start message to worklet
    workletNode?.port.postMessage({ type: 'startRecording' });

    // Connect the audio graph (silent sink keeps the graph active without routing mic to speakers)
    try {
      mediaStreamSource.disconnect();
    } catch {
      /* not connected yet */
    }
    workletNode?.disconnect();
    silentSinkGain.disconnect();
    mediaStreamSource.connect(workletNode!);
    workletNode!.connect(silentSinkGain);
    silentSinkGain.connect(audioContext.destination);

    // Start the data available timer
    startDataAvailableTimer();
  }

  function startDataAvailableTimer(): void {
    if (dataAvailableTimer) {
      clearInterval(dataAvailableTimer);
    }

    dataAvailableTimer = setInterval(() => {
      void (async () => {
        if (!isRecording || previewTickInFlight) return;
        previewTickInFlight = true;
        try {
          const { delta, nextIndex } = takeRecordingDeltaChunks(
            audioData,
            lastEmittedChunkIndex
          );
          if (delta.length === 0) return;
          const blob = await deltaChunksToWavBlob(delta);
          if (blob.size > 0) {
            onDataAvailable(blob);
          }
          lastEmittedChunkIndex = nextIndex;
        } catch (e) {
          console.error('WavRecorder preview tick failed:', e);
        } finally {
          previewTickInFlight = false;
        }
      })();
    }, timeSlice);
  }

  function stopDataAvailableTimer(): void {
    if (dataAvailableTimer) {
      clearInterval(dataAvailableTimer);
      dataAvailableTimer = null;
    }
  }

  function deltaChunksToWavBlob(chunks: Float32Array[]): Promise<Blob> {
    const sampleRate = audioContext.sampleRate;
    const channels = 1;
    if (chunks.length === 0) {
      return Promise.resolve(new Blob([], { type: 'audio/wav' }));
    }
    const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    if (length === 0) {
      return Promise.resolve(new Blob([], { type: 'audio/wav' }));
    }
    const audioBuffer = audioContext.createBuffer(channels, length, sampleRate);
    const combinedData = audioBuffer.getChannelData(0);
    let offset = 0;
    for (const chunk of chunks) {
      combinedData.set(chunk, offset);
      offset += chunk.length;
    }
    return audioBufferToWavBlob(audioBuffer);
  }

  function createAudioBuffer(): AudioBuffer {
    const sampleRate = audioContext.sampleRate;
    const channels = 1;

    if (audioData.length === 0) {
      // Create empty AudioBuffer if no data
      return audioContext.createBuffer(channels, 0, sampleRate);
    }

    const length = audioData.reduce((sum, chunk) => sum + chunk.length, 0);
    const audioBuffer = audioContext.createBuffer(channels, length, sampleRate);

    // Combine all audio chunks into the AudioBuffer
    const combinedData = audioBuffer.getChannelData(0);
    let offset = 0;
    for (const chunk of audioData) {
      combinedData.set(chunk, offset);
      offset += chunk.length;
    }

    return audioBuffer;
  }

  async function convertAudioDataToWav(): Promise<Blob> {
    // Convert audio data to WAV (for final stop result)
    const audioBuffer = createAudioBuffer();
    return audioBufferToWavBlob(audioBuffer);
  }

  function stop(): Promise<Blob> {
    if (inFlightStop) return inFlightStop;
    if (!isRecording) {
      return Promise.resolve(new Blob([]));
    }
    const pending = (async () => {
      isRecording = false;
      stopDataAvailableTimer();

      try {
        mediaStreamSource.disconnect();
      } catch {
        /* */
      }
      if (workletNode) {
        workletNode.disconnect();
      }
      try {
        silentSinkGain.disconnect();
      } catch {
        /* */
      }

      const waitComplete = new Promise<void>((resolve) => {
        pendingRecordingCompleteResolve = resolve;
      });

      workletNode?.port.postMessage({ type: 'stopRecording' });

      const RECORDING_COMPLETE_MS = 15000;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      try {
        await Promise.race([
          waitComplete,
          new Promise<void>((_, reject) => {
            timeoutHandle = setTimeout(
              () =>
                reject(
                  new Error(
                    'WavRecorder: recordingComplete timeout from worklet'
                  )
                ),
              RECORDING_COMPLETE_MS
            );
          }),
        ]);
      } catch (e) {
        console.error(e);
        pendingRecordingCompleteResolve = null;
      } finally {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
      }

      return convertAudioDataToWav();
    })();
    inFlightStop = pending;
    void pending.finally(() => {
      if (inFlightStop === pending) inFlightStop = undefined;
    }).catch(() => undefined);
    return pending;
  }

  /**
   * Clean up resources and close the AudioContext.
   * Should be called when the WavRecorder is being destroyed.
   */
  function cleanup(): void {
    isRecording = false;
    stopDataAvailableTimer();
    if (inFlightStop) return;
    pendingRecordingCompleteResolve = null;
    try {
      mediaStreamSource.disconnect();
    } catch {
      /* */
    }
    if (workletNode) {
      try {
        workletNode.disconnect();
      } catch {
        /* */
      }
    }
    try {
      silentSinkGain.disconnect();
    } catch {
      /* */
    }

    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch((error) => {
        console.error('Error closing audio context:', error);
      });
    }
  }

  return {
    initializeWorklet,
    start,
    stop,
    cleanup,
  };
}
