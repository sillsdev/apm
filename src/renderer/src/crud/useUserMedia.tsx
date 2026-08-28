import { useCallback, useEffect, useRef } from 'react';
import {
  getUserMediaWithDeviceFallback,
  isUnusableCaptureStream,
} from './captureConstraints';

export function useUserMedia(requestedMedia: MediaStreamConstraints) {
  const mediaStreamRef = useRef<MediaStream | undefined>(undefined);
  const constraintsRef = useRef<MediaStreamConstraints>(requestedMedia);

  useEffect(() => {
    constraintsRef.current = requestedMedia;
  }, [requestedMedia]);

  const getStream = useCallback(
    async (forceNew = false): Promise<MediaStream> => {
      if (
        mediaStreamRef.current &&
        !forceNew &&
        !isUnusableCaptureStream(mediaStreamRef.current)
      ) {
        return mediaStreamRef.current;
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // Device may already be gone (headset unplug / audio shutdown).
          }
        });
        mediaStreamRef.current = undefined;
      }

      const stream = await getUserMediaWithDeviceFallback(
        constraintsRef.current,
        (next) => navigator.mediaDevices.getUserMedia(next)
      );
      mediaStreamRef.current = stream;
      return stream;
    },
    []
  );

  useEffect(() => {
    return function cleanup() {
      mediaStreamRef.current?.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          /* device already gone */
        }
      });
      mediaStreamRef.current = undefined;
    };
  }, []);

  return getStream;
}
