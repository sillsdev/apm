import { useRef, useEffect } from 'react';

export function useUserMedia(requestedMedia: MediaStreamConstraints) {
  const mediaStreamRef = useRef<MediaStream | undefined>(undefined);
  async function getStream(): Promise<MediaStream> {
    if (mediaStreamRef.current) return mediaStreamRef.current;
    else {
      const stream = await navigator.mediaDevices.getUserMedia(requestedMedia);
      mediaStreamRef.current = stream;
      return stream;
    }
  }

  useEffect(() => {
    return function cleanup() {
      mediaStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
      mediaStreamRef.current = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return getStream;
}
