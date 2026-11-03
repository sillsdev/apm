import { Typography } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { ttsVoicesSelector } from '../../../selector';
import { ITtsVoicesStrings } from '../../../model';
import {
  currentSpeechPlatform,
  speechInstallNote,
} from '../../../business/referenceText/speechPlatform';

/** Where this device's operating system adds voices; nothing on platforms we have no steps for. */
export function VoiceInstallNote() {
  const t: ITtsVoicesStrings = useSelector(ttsVoicesSelector, shallowEqual);
  const note = speechInstallNote(t, currentSpeechPlatform());
  if (!note) return null;
  return (
    <Typography variant="caption" color="text.secondary" component="p">
      {note}
    </Typography>
  );
}
