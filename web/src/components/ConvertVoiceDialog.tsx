import { Typography, useMediaQuery, useTheme } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import BigDialog from '../hoc/BigDialog';
import BigDialogBp from '../hoc/BigDialogBp';
import SelectVoice from '../business/voice/SelectVoice';
import { IWsAudioPlayerStrings } from '../model';
import { wsAudioPlayerSelector } from '../selector';

export interface ConvertVoiceDialogProps {
  onCancel: () => void;
  begin: (voice: string) => void;
}

/** Lets the user pick the voice to convert the recording to. */
export function ConvertVoiceDialog({
  onCancel,
  begin,
}: ConvertVoiceDialogProps) {
  const t: IWsAudioPlayerStrings = useSelector(
    wsAudioPlayerSelector,
    shallowEqual
  );
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
  return (
    <BigDialog
      title={t.selectVoice}
      description={<Typography>{t.selectVoicePrompt}</Typography>}
      isOpen
      onOpen={onCancel}
      bp={isSmallScreen ? BigDialogBp.mobile : BigDialogBp.sm}
    >
      <SelectVoice onOpen={onCancel} begin={begin} />
    </BigDialog>
  );
}
