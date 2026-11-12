import { getBlobDiagnostics, logAudioDiagnostic } from './audioDiagnostics';

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
  const durationSeconds = audioBuffer.length / audioBuffer.sampleRate;
  logAudioDiagnostic('convert-webm-start', {
    conversion: {
      targetMimeType: 'audio/webm;codecs=opus',
      requestedMimeType: 'audio/webm;codecs=opus',
      requestedAudioBitsPerSecond: undefined,
      requestedBitsPerSecond: undefined,
      requestedQuality: undefined,
      encoder: 'MediaRecorder',
    },
    inputAudioBuffer: {
      durationSeconds,
      sampleRate: audioBuffer.sampleRate,
      length: audioBuffer.length,
      numberOfChannels: audioBuffer.numberOfChannels,
    },
    mediaRecorder: {
      mimeType: mediaRecorder.mimeType,
      audioBitsPerSecond: mediaRecorder.audioBitsPerSecond,
      videoBitsPerSecond: mediaRecorder.videoBitsPerSecond,
      state: mediaRecorder.state,
    },
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
      logAudioDiagnostic('convert-webm-complete', {
        conversion: {
          targetMimeType: 'audio/webm;codecs=opus',
          requestedAudioBitsPerSecond: undefined,
          requestedQuality: undefined,
          encoder: 'MediaRecorder',
        },
        outputBlob: getBlobDiagnostics(webmBlob, durationSeconds),
        chunkCount: chunks.length,
        chunkSizes: chunks.map((chunk) => chunk.size),
        mediaRecorder: {
          mimeType: mediaRecorder.mimeType,
          audioBitsPerSecond: mediaRecorder.audioBitsPerSecond,
          videoBitsPerSecond: mediaRecorder.videoBitsPerSecond,
          state: mediaRecorder.state,
        },
      });
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
  logAudioDiagnostic('convert-input-read-start', {
    inputBlob: getBlobDiagnostics(audioBlob),
    targetMimeType: 'audio/webm;codecs=opus',
  });
  // Read audio data as ArrayBuffer
  const audioBuffer = await audioBlob.arrayBuffer();

  // Use Web Audio API to decode any supported audio format
  const audioContext = new AudioContext();
  const decodedAudioBuffer = await audioContext.decodeAudioData(audioBuffer);
  logAudioDiagnostic('convert-input-decoded', {
    inputBlob: getBlobDiagnostics(
      audioBlob,
      decodedAudioBuffer.duration || undefined
    ),
    decodedAudioBuffer: {
      durationSeconds: decodedAudioBuffer.duration,
      sampleRate: decodedAudioBuffer.sampleRate,
      length: decodedAudioBuffer.length,
      numberOfChannels: decodedAudioBuffer.numberOfChannels,
    },
  });

  // Convert the AudioBuffer to WebM
  return convertAudioBufferToWebM(decodedAudioBuffer);
}

/**
 * Converts audio blob to OGG using worker-based encoding (for browsers that don't support OGG in MediaRecorder)
 * @param audioBlob - The input audio Blob
 * @param targetMimeType - The target MIME type (should be 'audio/ogg;codecs=opus' or 'audio/ogg')
 * @returns Promise<Blob> - The resulting OGG Blob
 */
async function convertToOggWithWorker(
  audioBlob: Blob,
  targetMimeType: string
): Promise<Blob> {
  // Dynamic import to avoid circular dependencies
  const { appPath } = await import('../utils');

  return new Promise((resolve, reject) => {
    const fakeSourceName = 'fname.wav';
    const fakeOggName = 'encoded.ogg';
    let worker: Worker | undefined = undefined;
    let blobData: ArrayBuffer | string | null = null;

    const fileReader = new FileReader();
    fileReader.onload = function () {
      blobData = this.result as ArrayBuffer;
      postMessage();
    };
    fileReader.onerror = () => {
      reject(new Error('Failed to read audio blob'));
    };

    fileReader.readAsArrayBuffer(audioBlob);

    const postMessage = () => {
      if (worker && blobData) {
        const inData: any = {};
        inData[fakeSourceName] = new Uint8Array(blobData as ArrayBuffer);
        const outData: any = {};
        outData[fakeOggName] = { MIME: targetMimeType };
        const args = [fakeSourceName, fakeOggName];
        logAudioDiagnostic('convert-ogg-worker-start', {
          inputBlob: getBlobDiagnostics(audioBlob),
          conversion: {
            targetMimeType,
            requestedAudioBitsPerSecond: undefined,
            requestedBitRate: undefined,
            requestedQuality: undefined,
            encoder: 'opusenc.js worker',
            args,
          },
        });

        worker.postMessage({
          command: 'encode',
          args,
          outData: outData,
          fileData: inData,
        });
      }
    };

    worker = new Worker(appPath() + '/worker/EmsWorkerProxy.js');

    worker.onmessage = function (event) {
      const message = event.data;
      if (message.reply === 'err') {
        worker?.terminate();
        reject(new Error(message.values.toString()));
      } else if (message.reply === 'done') {
        const result = message.values[fakeOggName];
        worker?.terminate();
        logAudioDiagnostic('convert-ogg-worker-complete', {
          conversion: {
            targetMimeType,
            requestedAudioBitsPerSecond: undefined,
            requestedBitRate: undefined,
            requestedQuality: undefined,
            encoder: 'opusenc.js worker',
          },
          outputBlob: getBlobDiagnostics(result.blob),
        });
        resolve(result.blob);
      }
      // Progress messages are ignored in this context
    };

    worker.onerror = (error) => {
      worker?.terminate();
      reject(new Error(`Worker error: ${error.message}`));
    };
  });
}

/**
 * Converts any audio Blob to a target format using MediaRecorder API or worker-based conversion.
 * Currently only OGG and WebM are supported output formats.
 * @param audioBlob - The input audio Blob (WAV, MP3, MP4, etc.)
 * @param targetMimeType - The target MIME type. Supported values:
 *   - 'audio/webm'
 *   - 'audio/webm;codecs=opus'
 *   - 'audio/ogg'
 *   - 'audio/ogg;codecs=opus'
 * @returns Promise<Blob> - The resulting Blob in the requested target format
 * @throws Error if the targetMimeType is not a supported OGG or WebM MIME type.
 */
export async function convertToFormat(
  audioBlob: Blob,
  targetMimeType: string
): Promise<Blob> {
  // Normalize the target MIME type to avoid subtle mismatches
  const normalizedMimeType = targetMimeType.trim().toLowerCase();
  logAudioDiagnostic('convert-format-requested', {
    inputBlob: getBlobDiagnostics(audioBlob),
    targetMimeType,
    normalizedMimeType,
  });

  // For OGG formats, always use worker-based conversion to ensure the output matches the request.
  if (
    normalizedMimeType === 'audio/ogg;codecs=opus' ||
    normalizedMimeType === 'audio/ogg'
  ) {
    return convertToOggWithWorker(audioBlob, normalizedMimeType);
  }

  // For WebM formats, use the MediaRecorder-based WebM conversion.
  if (
    normalizedMimeType === 'audio/webm;codecs=opus' ||
    normalizedMimeType === 'audio/webm'
  ) {
    return convertToWebM(audioBlob);
  }

  // Any other MIME type is not supported by this helper.
  throw new Error(
    `Unsupported target MIME type: ${targetMimeType}. ` +
      `Supported types are 'audio/webm', 'audio/webm;codecs=opus', ` +
      `'audio/ogg', and 'audio/ogg;codecs=opus'.`
  );
}
