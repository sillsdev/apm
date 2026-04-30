import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { burritoSelector, sharedSelector } from '../selector';
import type { IBurritoStrings, ISharedStrings } from '@model/index';

interface Props {
  open: boolean;
  missingRefs: string[];
  onCancel: () => void;
  onConfirm: () => void;
}

export function VernacularAudioMissingTranscriptionDialog({
  open,
  missingRefs,
  onCancel,
  onConfirm,
}: Props) {
  const t: IBurritoStrings = useSelector(burritoSelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);

  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>{t.vernacularAudioMissingTranscriptionTitle}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t.vernacularAudioMissingTranscriptionWarning}
        </DialogContentText>
        <Typography variant="subtitle2" sx={{ mt: 2 }}>
          {t.vernacularAudioMissingTranscriptionListTitle.replace(
            '{0}',
            `${missingRefs.length}`
          )}
        </Typography>
        <List dense>
          {missingRefs.map((r) => (
            <ListItem key={r} disablePadding>
              <ListItemText primary={r} />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{ts.cancel}</Button>
        <Button onClick={onConfirm} variant="contained">
          {ts.confirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

