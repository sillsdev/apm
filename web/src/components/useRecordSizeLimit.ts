import { useEffect, useState } from 'react';
import { MB } from '../utils/mb';
import { toError } from '../utils/toError';
import {
  estimatedLiveWavBytes,
  estimatedOpusBytes,
  wavChannelCount,
} from '../utils/mediaRecordSize';

export type SizeStatus = 'pending' | 'ok' | 'warn' | 'over' | 'rejected';

/** Within this many MB of the limit, warn but still allow save. */
const NEAR_LIMIT_MB = 1;

export type RejectionKind = 'afterCompression' | 'compressFailed';

export type SizeRejection = {
  kind: RejectionKind;
  bytes: number;
  detail?: string;
};

type RejectedTake = SizeRejection & { blob: Blob };

export type RecordSizeLimitInput = {
  audioBlob: Blob | undefined;
  recording: boolean;
  /** Seconds in the waveform: the live clock while recording, the take after. */
  waveformDuration: number;
  /** Upload the editor WAV as-is instead of encoding to Opus. */
  saveAsWav: boolean;
  sizeLimit: number;
  overTemplate: string;
  warnTemplate: string;
  afterCompressionTemplate: string;
  compressFailedTemplate: string;
  /** Must be stable (useCallback). A new identity re-reads the header. */
  onHeaderError: (error: Error) => void;
};

/** pending, over, and rejected block save. warn still allows it. */
export function deriveSizeStatus(input: {
  recording: boolean;
  headerPending: boolean;
  rejected: boolean;
  estimatedBytes: number;
  limitBytes: number;
  warnBytes: number;
}): SizeStatus {
  // While recording, the live clock is the take being sized.
  if (!input.recording && input.rejected) return 'rejected';
  if (!input.recording && input.headerPending) return 'pending';
  if (input.estimatedBytes > input.limitBytes) return 'over';
  if (input.estimatedBytes > input.warnBytes) return 'warn';
  return 'ok';
}

export function useRecordSizeLimit(input: RecordSizeLimitInput) {
  const {
    audioBlob,
    recording,
    waveformDuration,
    saveAsWav,
    sizeLimit,
    overTemplate,
    warnTemplate,
    afterCompressionTemplate,
    compressFailedTemplate,
    onHeaderError,
  } = input;

  /** Channel count read from audioBlob's header. Opus prices stereo at 1.5 times mono. */
  const [wavChannels, setWavChannels] = useState<{
    blob?: Blob;
    count: number;
  }>({ count: 1 });
  /** Take whose encoded size already failed. A missing blob is a gap, not a new file. */
  const [rejectedTake, setRejectedTake] = useState<RejectedTake | undefined>();

  const channels = wavChannels.blob === audioBlob ? wavChannels.count : 1;
  const headerPending = !!audioBlob && wavChannels.blob !== audioBlob;
  // A different file drops the rejection in this render, before save is derived.
  const activeRejection =
    audioBlob && rejectedTake && rejectedTake.blob !== audioBlob
      ? undefined
      : rejectedTake;
  if (activeRejection !== rejectedTake) setRejectedTake(undefined);

  const formatSize = (template: string, bytes: number) =>
    template
      .replace('{0}', (bytes / MB).toFixed(2))
      .replace('{1}', sizeLimit.toString());

  const rejectionText = (rejection: SizeRejection) => {
    if (rejection.kind === 'afterCompression') {
      return formatSize(afterCompressionTemplate, rejection.bytes);
    }
    const sized = formatSize(overTemplate, rejection.bytes);
    return rejection.detail
      ? `${compressFailedTemplate} ${sized} ${rejection.detail}`
      : `${compressFailedTemplate} ${sized}`;
  };

  // Opusenc encodes at a fixed bitrate, so the upload depends only on how long
  // the take is and whether it is stereo. That holds for a live take, a
  // recorder WAV, and an edited mp3 the editor re-exported as WAV.
  // While recording, audioBlob is the previous take, so a WAV save is
  // estimated from the clock until the recorder hands over the file.
  const estimatedBytes = !saveAsWav
    ? estimatedOpusBytes(waveformDuration, channels)
    : recording || !audioBlob
      ? estimatedLiveWavBytes(waveformDuration, channels)
      : audioBlob.size;

  const limitBytes = sizeLimit * MB;
  const heldRejection =
    activeRejection !== undefined &&
    (audioBlob === activeRejection.blob || audioBlob === undefined)
      ? activeRejection
      : undefined;
  const sizeStatus = deriveSizeStatus({
    recording,
    headerPending,
    rejected: heldRejection !== undefined,
    estimatedBytes,
    limitBytes,
    warnBytes: (sizeLimit - NEAR_LIMIT_MB) * MB,
  });
  const sizeBlocksSave =
    sizeStatus === 'pending' ||
    sizeStatus === 'over' ||
    sizeStatus === 'rejected';
  const formattedRejection = heldRejection
    ? rejectionText(heldRejection)
    : undefined;
  const sizeWarning =
    sizeStatus === 'rejected'
      ? (formattedRejection ?? '')
      : sizeStatus === 'over'
        ? formatSize(overTemplate, estimatedBytes)
        : sizeStatus === 'warn'
          ? formatSize(warnTemplate, estimatedBytes)
          : '';

  useEffect(() => {
    if (!audioBlob) {
      setWavChannels({ count: 1 });
      return;
    }
    let cancelled = false;
    // A failed header read must not leave Save disabled. Price it as mono.
    void wavChannelCount(audioBlob)
      .then((count) => {
        if (!cancelled) setWavChannels({ blob: audioBlob, count });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        onHeaderError(toError(error));
        setWavChannels({ blob: audioBlob, count: 1 });
      });
    return () => {
      cancelled = true;
    };
  }, [audioBlob, onHeaderError]);

  return {
    sizeStatus,
    sizeBlocksSave,
    sizeWarning,
    estimatedBytes,
    limitBytes,
    rejectionMessage: formattedRejection,
    formatSize,
    rejectTake: (blob: Blob, rejection: SizeRejection) => {
      setRejectedTake({ blob, ...rejection });
      return rejectionText(rejection);
    },
    clearRejection: () => setRejectedTake(undefined),
  };
}
