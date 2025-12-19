import { convertToWav } from '../utils/wav';
import { APMRecorder } from './useWavRecorder';

// Web Audio API-based WAV recorder using AudioWorklet
export function createWavRecorder(
  stream: MediaStream,
  onDataAvailable: (blob: Blob) => void
): APMRecorder {
  const audioContext = new AudioContext();
  const mediaStreamSource = audioContext.createMediaStreamSource(stream);
  let workletNode: AudioWorkletNode | null = null;
  let audioData: Float32Array[] = [];
  let isRecording = false;
  let workletLoaded = false;
  let dataAvailableTimer: ReturnType<typeof setInterval> | null = null;
  let timeSlice: number = 1000; // Default 1 second

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

    // Send start message to worklet
    workletNode?.port.postMessage({ type: 'startRecording' });

    // Connect the audio graph
    mediaStreamSource.connect(workletNode!);
    workletNode!.connect(audioContext.destination);

    // Start the data available timer
    startDataAvailableTimer();
  }

  function startDataAvailableTimer(): void {
    if (dataAvailableTimer) {
      clearInterval(dataAvailableTimer);
    }

    dataAvailableTimer = setInterval(async () => {
      if (isRecording && audioData.length > 0) {
        // Convert AudioBuffer to WAV blob before calling onDataAvailable
        onDataAvailable(await convertAudioDataToWav());
      }
    }, timeSlice);
  }

  async function audioBufferToWavBlob(buffer: AudioBuffer): Promise<Blob> {
    const sampleRate = buffer.sampleRate;
    const channels = buffer.numberOfChannels;

    if (buffer.length === 0) {
      // Create empty WAV if no data
      return new Blob([], { type: 'audio/wav' });
    }

    const leftChannel = buffer.getChannelData(0);
    const rightChannel = channels > 1 ? buffer.getChannelData(1) : null;

    // Convert to WAV
    return convertToWav(leftChannel, rightChannel, {
      isFloat: true,
      numChannels: channels,
      sampleRate: sampleRate,
    });
  }

  function stopDataAvailableTimer(): void {
    if (dataAvailableTimer) {
      clearInterval(dataAvailableTimer);
      dataAvailableTimer = null;
    }
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

  async function stop(): Promise<Blob> {
    isRecording = false;

    // Stop the data available timer
    stopDataAvailableTimer();

    // Disconnect the worklet
    if (workletNode) {
      workletNode.disconnect();
    }

    // Send stop message to worklet
    workletNode?.port.postMessage({ type: 'stopRecording' });

    // Wait a bit for the worklet to process the stop message
    await new Promise((resolve) => setTimeout(resolve, 100));
    return convertAudioDataToWav();
  }

  /**
   * Clean up resources and close the AudioContext.
   * Should be called when the WavRecorder is being destroyed.
   */
  function cleanup(): void {
    // Disconnect media stream source
    if (mediaStreamSource) {
      mediaStreamSource.disconnect();
    }

    // Close audio context
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
