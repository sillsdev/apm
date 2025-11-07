import { useCallback, useEffect, useRef } from 'react';

export function useUserMedia(requestedMedia: MediaStreamConstraints) {
  const mediaStreamRef = useRef<MediaStream | undefined>(undefined);
  const constraintsRef = useRef<MediaStreamConstraints>(requestedMedia);

  useEffect(() => {
    constraintsRef.current = requestedMedia;
  }, [requestedMedia]);

  const getStream = useCallback(
    async (forceNew = false): Promise<MediaStream> => {
      if (mediaStreamRef.current && !forceNew) {
        return mediaStreamRef.current;
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = undefined;
      }

      const stream = await navigator.mediaDevices.getUserMedia(
        constraintsRef.current
      );
      mediaStreamRef.current = stream;
      return stream;
    },
    []
  );

  useEffect(() => {
    return function cleanup() {
      mediaStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
      mediaStreamRef.current = undefined;
    };
  }, []);

  return getStream;
}
