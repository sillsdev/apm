class AudioRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isRecording = false;
    this.audioData = [];

    // Set up message handler
    this.port.onmessage = (event) => {
      const { type, data } = event.data;

      switch (type) {
        case 'startRecording':
          this.isRecording = true;
          this.audioData = [];
          break;

        case 'stopRecording':
          this.isRecording = false;
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
