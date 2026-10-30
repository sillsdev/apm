import { Typography } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { ttsVoicesSelector } from '../../../selector';
import { ITtsVoicesStrings } from '../../../model';
import {
  currentSpeechPlatform,
  type SpeechPlatform,
} from '../../../business/referenceText/speechPlatform';

const noteKey: Record<
  SpeechPlatform,
  keyof Pick<ITtsVoicesStrings, 'windowsNote' | 'macNote' | 'linuxNote'> | null
> = {
  windows: 'windowsNote',
  mac: 'macNote',
  linux: 'linuxNote',
  other: null,
};

/** Where this device's operating system adds voices; nothing on platforms we have no steps for. */
export function VoiceInstallNote() {
  const t: ITtsVoicesStrings = useSelector(ttsVoicesSelector, shallowEqual);
  const key = noteKey[currentSpeechPlatform()];
  if (!key) return null;
  return (
    <Typography variant="caption" color="text.secondary" component="p">
      {t[key]}
    </Typography>
  );
}
