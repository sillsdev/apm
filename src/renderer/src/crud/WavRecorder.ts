import { convertToWav } from '../utils/wav';

// Web Audio API-based WAV recorder using AudioWorklet
export class WavRecorder {
  private audioContext: AudioContext;
  private mediaStreamSource: MediaStreamAudioSourceNode;
  private workletNode: AudioWorkletNode | null = null;
  private audioData: Float32Array[] = [];
  private isRecording = false;
  private workletLoaded = false;
  private onDataAvailable: (buffer: AudioBuffer) => void;
  private dataAvailableTimer: ReturnType<typeof setInterval> | null = null;
  private timeSlice: number = 1000; // Default 1 second

  constructor(
    stream: MediaStream,
    onDataAvailable: (buffer: AudioBuffer) => void
  ) {
    this.audioContext = new AudioContext();
    this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
    this.onDataAvailable = onDataAvailable;
  }

  async initializeWorklet(): Promise<void> {
    if (this.workletLoaded) return;

    try {
      // Load the audio worklet processor
      // Use relative path that works in both dev and Electron
      const workletPath = new URL(
        '/worker/audio-recorder-processor.js',
        window.location.href
      ).href;

      await this.audioContext.audioWorklet.addModule(workletPath);

      // Create the worklet node
      this.workletNode = new AudioWorkletNode(
        this.audioContext,
        'audio-recorder-processor'
      );

      // Handle messages from the worklet
      this.workletNode.port.onmessage = (event) => {
        const { type, data } = event.data;
        switch (type) {
          case 'audioData':
            if (this.isRecording) {
              this.audioData.push(data);
            }
            break;

          case 'recordingComplete':
            // All audio data has been collected
            this.audioData = data;
            break;
        }
      };

      this.workletLoaded = true;
    } catch (error) {
      console.error('Failed to initialize audio worklet:', error);
      throw error;
    }
  }

  async start(timeSlice?: number): Promise<void> {
    if (!this.workletLoaded) {
      await this.initializeWorklet();
    }

    // Ensure audio context is running
    if (this.audioContext.state === 'suspended') {
      console.log('resuming audio context...');
      await this.audioContext.resume();
    }

    // Set timeSlice if provided
    if (timeSlice && timeSlice > 0) {
      this.timeSlice = timeSlice;
    }

    this.isRecording = true;
    this.audioData = [];

    // Send start message to worklet
    this.workletNode?.port.postMessage({ type: 'startRecording' });

    // Connect the audio graph
    this.mediaStreamSource.connect(this.workletNode!);
    this.workletNode!.connect(this.audioContext.destination);

    // Start the data available timer
    this.startDataAvailableTimer();
  }

  private startDataAvailableTimer(): void {
    if (this.dataAvailableTimer) {
      clearInterval(this.dataAvailableTimer);
    }

    this.dataAvailableTimer = setInterval(() => {
      if (this.isRecording && this.audioData.length > 0) {
        this.onDataAvailable(this.createAudioBuffer());
      }
    }, this.timeSlice);
  }

  private stopDataAvailableTimer(): void {
    if (this.dataAvailableTimer) {
      clearInterval(this.dataAvailableTimer);
      this.dataAvailableTimer = null;
    }
  }

  private createAudioBuffer(): AudioBuffer {
    const sampleRate = this.audioContext.sampleRate;
    const channels = 1;

    if (this.audioData.length === 0) {
      // Create empty AudioBuffer if no data
      return this.audioContext.createBuffer(channels, 0, sampleRate);
    }

    const length = this.audioData.reduce((sum, chunk) => sum + chunk.length, 0);
    const audioBuffer = this.audioContext.createBuffer(
      channels,
      length,
      sampleRate
    );

    // Combine all audio chunks into the AudioBuffer
    const combinedData = audioBuffer.getChannelData(0);
    let offset = 0;
    for (const chunk of this.audioData) {
      combinedData.set(chunk, offset);
      offset += chunk.length;
    }

    return audioBuffer;
  }

  convertAudioDataToWav = async (): Promise<Blob> => {
    // Convert audio data to WAV (for final stop result)
    const audioBuffer = this.createAudioBuffer();
    const sampleRate = audioBuffer.sampleRate;
    const channels = audioBuffer.numberOfChannels;

    if (audioBuffer.length === 0) {
      // Create empty WAV if no data
      return new Blob([], { type: 'audio/wav' });
    }

    const leftChannel = audioBuffer.getChannelData(0);
    const rightChannel = channels > 1 ? audioBuffer.getChannelData(1) : null;

    // Convert to WAV
    return convertToWav(leftChannel, rightChannel, {
      isFloat: true,
      numChannels: channels,
      sampleRate: sampleRate,
    });
  };

  async stop(): Promise<Blob> {
    this.isRecording = false;

    // Stop the data available timer
    this.stopDataAvailableTimer();

    // Disconnect the worklet
    if (this.workletNode) {
      this.workletNode.disconnect();
    }

    // Send stop message to worklet
    this.workletNode?.port.postMessage({ type: 'stopRecording' });

    // Wait a bit for the worklet to process the stop message
    await new Promise((resolve) => setTimeout(resolve, 100));
    return this.convertAudioDataToWav();
  }
}
