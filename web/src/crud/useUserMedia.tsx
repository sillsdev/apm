import { useCallback, useEffect, useRef } from 'react';
import {
  getUserMediaWithDeviceFallback,
  isUnusableCaptureStream,
} from './captureConstraints';

export class CaptureAcquireSupersededError extends Error {
  constructor() {
    super('capture acquire superseded');
    this.name = 'CaptureAcquireSupersededError';
  }
}

function stopStream(stream?: MediaStream) {
  stream?.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      /* device already gone */
    }
  });
}

export function useUserMedia(requestedMedia: MediaStreamConstraints) {
  const mediaStreamRef = useRef<MediaStream | undefined>(undefined);
  const constraintsRef = useRef<MediaStreamConstraints>(requestedMedia);
  const acquireGenerationRef = useRef(0);

  useEffect(() => {
    constraintsRef.current = requestedMedia;
  }, [requestedMedia]);

  const getStream = useCallback(
    async (
      forceNew = false
    ): Promise<{
      stream: MediaStream;
      fellBack: boolean;
    }> => {
      if (
        mediaStreamRef.current &&
        !forceNew &&
        !isUnusableCaptureStream(mediaStreamRef.current)
      ) {
        return { stream: mediaStreamRef.current, fellBack: false };
      }

      const generation = ++acquireGenerationRef.current;
      stopStream(mediaStreamRef.current);
      mediaStreamRef.current = undefined;

      const constraints = constraintsRef.current;
      try {
        const { stream, fellBack } = await getUserMediaWithDeviceFallback(
          constraints,
          (next) => navigator.mediaDevices.getUserMedia(next)
        );
        if (generation !== acquireGenerationRef.current) {
          stopStream(stream);
          throw new CaptureAcquireSupersededError();
        }
        mediaStreamRef.current = stream;
        return { stream, fellBack };
      } catch (error) {
        if (generation !== acquireGenerationRef.current) {
          throw error instanceof CaptureAcquireSupersededError
            ? error
            : new CaptureAcquireSupersededError();
        }
        throw error;
      }
    },
    []
  );

  useEffect(() => {
    return function cleanup() {
      acquireGenerationRef.current += 1;
      stopStream(mediaStreamRef.current);
      mediaStreamRef.current = undefined;
    };
  }, []);

  return getStream;
}
