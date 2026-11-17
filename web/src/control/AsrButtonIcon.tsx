import { Badge, type SxProps } from '@mui/material';
import TranscriptionLogo from './TranscriptionLogo';

interface IProps {
  /** Blue dot when a transcription task is running and progress is closed. */
  active?: boolean;
  disabled?: boolean;
  sx?: SxProps;
  logoSx?: SxProps;
}

/** Transcription logo, optionally badged for an in-flight ASR task. */
export function AsrButtonIcon({ active, disabled, sx, logoSx }: IProps) {
  return (
    <Badge variant="dot" color="primary" invisible={!active} sx={sx}>
      <TranscriptionLogo disabled={disabled} sx={logoSx} />
    </Badge>
  );
}

export default AsrButtonIcon;
