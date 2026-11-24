import { useSyncExternalStore } from 'react';
import { IconButton } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import type { TimeRange } from '../control/formatTime';
import { clipAudio, insertAudio } from '../utils/audioUtils';
import usePassageDetailContext from '../context/usePassageDetailContext';

let clip: Blob | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getClip = () => clip;
/** Put audio on the clipboard; Copy and Cut both use it. */
export const setClip = (next: Blob) => {
  clip = next;
  listeners.forEach((l) => l());
};

export interface AudioCopyPasteProps {
  /** The player's current audio */
  audio: Blob | null;
  /** The player's selection; Copy shows with one, Paste without */
  selection: TimeRange | null;
  /** Where Paste inserts the clip, in seconds */
  at: number;
  /** Receives the audio with the clip inserted */
  onPaste: (audio: Blob) => void;
}

/** Copy the selection, or paste the copied clip at the cursor. */
export function AudioCopyPaste({
  audio,
  selection,
  at,
  onPaste,
}: AudioCopyPasteProps) {
  const { recording } = usePassageDetailContext();
  const copied = useSyncExternalStore(subscribe, getClip);

  if (selection && audio) {
    const handleCopy = async () =>
      setClip(await clipAudio(audio, selection.start, selection.end));
    return (
      <IconButton
        disabled={recording}
        size="small"
        aria-label={`copy`}
        sx={{ ml: '12px !important' }}
        onClick={handleCopy}
      >
        <ContentCopyIcon fontSize="small" />
      </IconButton>
    );
  }

  if (!copied) return null;

  const handlePaste = async () => onPaste(await insertAudio(audio, at, copied));
  return (
    <IconButton
      disabled={recording}
      size="small"
      aria-label={`paste`}
      sx={{ ml: '12px !important' }}
      onClick={handlePaste}
    >
      <ContentPasteIcon fontSize="small" />
    </IconButton>
  );
}
