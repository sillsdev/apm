/**
 * Converts an AudioBuffer to WebM using MediaRecorder API.
 * This is the most efficient method as it uses native browser encoding.
 * @param audioBuffer - The input AudioBuffer.
 * @returns Promise<Blob> - The resulting WebM Blob.
 */
export async function convertAudioBufferToWebM(
  audioBuffer: AudioBuffer
): Promise<Blob> {
  // Create an audio context for MediaStreamDestination
  const audioContext = new AudioContext();

  // Create a buffer source
  const bufferSource = audioContext.createBufferSource();
  bufferSource.buffer = audioBuffer;

  // Create a MediaStreamDestination
  const destination = audioContext.createMediaStreamDestination();
  bufferSource.connect(destination);
  bufferSource.start();

  // Use MediaRecorder to encode to WebM
  const mediaRecorder = new MediaRecorder(destination.stream, {
    mimeType: 'audio/webm;codecs=opus',
  });

  const chunks: Blob[] = [];

  return new Promise((resolve, reject) => {
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const webmBlob = new Blob(chunks, { type: 'audio/webm;codecs=opus' });
      resolve(webmBlob);
    };

    mediaRecorder.onerror = (event) => {
      reject(new Error(`MediaRecorder error: ${event}`));
    };

    // Start recording
    mediaRecorder.start();

    // Stop recording after the audio buffer duration
    const duration = (audioBuffer.length / audioBuffer.sampleRate) * 1000; // Convert to milliseconds
    setTimeout(() => {
      mediaRecorder.stop();
    }, duration + 100); // Add small buffer
  });
}

/**
 * Converts any audio Blob to WebM using MediaRecorder API.
 * @param audioBlob - The input audio Blob (WAV, MP3, etc.)
 * @returns Promise<Blob> - The resulting WebM Blob
 */
export async function convertToWebM(audioBlob: Blob): Promise<Blob> {
  // Read audio data as ArrayBuffer
  const audioBuffer = await audioBlob.arrayBuffer();

  // Use Web Audio API to decode any supported audio format
  const audioContext = new AudioContext();
  const decodedAudioBuffer = await audioContext.decodeAudioData(audioBuffer);

  // Convert the AudioBuffer to WebM
  return convertAudioBufferToWebM(decodedAudioBuffer);
}
