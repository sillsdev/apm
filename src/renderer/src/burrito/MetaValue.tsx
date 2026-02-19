import * as React from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { shallowEqual, useSelector } from 'react-redux';
import { burritoSelector, sharedSelector } from '../selector';
import { IBurritoStrings, ISharedStrings } from '@model/index';

interface MetaValueProps {
  idKey: string;
  value: unknown;
  onConfirm: (key: string, value: unknown) => void;
  isOpen: boolean;
  onOpen: (isOpen: boolean) => void;
}

export default function MetaValue({
  idKey,
  value,
  onConfirm,
  isOpen,
  onOpen,
}: MetaValueProps) {
  const [open, setOpen] = React.useState(isOpen);
  const [newValue, setNewValue] = React.useState(value);
  const t: IBurritoStrings = useSelector(burritoSelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);

  const handleClose = () => {
    setOpen(false);
    onOpen(false);
  };

  React.useEffect(() => {
    setOpen(isOpen);
  }, [isOpen]);

  React.useEffect(() => {
    setNewValue(value);
  }, [value]);

  const containsJsonChars = (val: unknown): boolean => {
    if (typeof val !== 'string') return false;
    return /[{}[\]"']/.test(val);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      slotProps={{
        paper: {
          component: 'form',
          onSubmit: (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            onConfirm(idKey, newValue);
            handleClose();
          },
        },
      }}
    >
      <DialogTitle>{t.updateValue}</DialogTitle>
      <DialogContent>
        <DialogContentText>{t.enterNewValue}</DialogContentText>
        <TextField
          autoFocus
          margin="dense"
          id="name"
          data-cy="value-input"
          value={newValue}
          onChange={(event) => setNewValue(event.target.value)}
          name={idKey}
          label={idKey as string}
          fullWidth
          multiline
          variant="standard"
          error={containsJsonChars(newValue)}
          helperText={containsJsonChars(newValue) ? t.valueWarning : ''}
          sx={{ width: '500px' }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{ts.cancel}</Button>
        <Button type="submit" disabled={containsJsonChars(newValue)}>
          {ts.confirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
