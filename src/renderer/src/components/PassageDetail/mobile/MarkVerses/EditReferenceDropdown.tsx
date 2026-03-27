import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  NativeSelect,
  Typography,
} from '@mui/material';
import type { ChangeEvent } from 'react';
import { useEffect, useState } from 'react';

const suffixOptions = ['', 'a', 'b', 'c', 'd', 'e'];
const selectSx = {
  minWidth: 64,
  '& .MuiNativeSelect-select': {
    fontSize: 40,
    lineHeight: 1.1,
    textAlign: 'center',
    pr: 3,
  },
  '& .MuiNativeSelect-icon': {
    fontSize: 24,
    right: 0,
  },
};
const verseSelectSx = {
  ...selectSx,
  '& .MuiNativeSelect-select': {
    ...selectSx['& .MuiNativeSelect-select'],
    fontSize: 28,
  },
};
const suffixOptionStyle = {
  fontSize: 50,
};
const verseOptionStyle = {
  fontSize: 48,
};

export interface EditReferenceValue {
  splitVerse: boolean;
  canSplit: boolean;
  startChapter: number;
  startVerse: number;
  startSuffix: string;
  endChapter: number;
  endVerse: number;
  endSuffix: string;
}

interface EditReferenceDropdownProps {
  open: boolean;
  limits: string;
  maxVerse: number;
  verseOptions: number[];
  title: string;
  cancelLabel: string;
  saveLabel: string;
  splitVerseLabel: string;
  value: EditReferenceValue;
  onCancel: () => void;
  onSave: (value: EditReferenceValue) => void;
}

export default function EditReferenceDropdown({
  open,
  limits,
  maxVerse,
  verseOptions,
  title,
  cancelLabel,
  saveLabel,
  splitVerseLabel,
  value,
  onCancel,
  onSave,
}: EditReferenceDropdownProps) {
  const [draft, setDraft] = useState<EditReferenceValue>(value);
  const verseNumberOptions = Array.from(
    new Set([...verseOptions, draft.startVerse, draft.endVerse, maxVerse])
  ).sort((left, right) => left - right);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const handleSplitChange = (
    event: ChangeEvent<HTMLInputElement>,
    checked: boolean
  ) => {
    setDraft((current) => ({
      ...current,
      splitVerse: checked,
    }));
  };

  const handleSuffixChange =
    (key: 'startSuffix' | 'endSuffix') =>
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextSuffix = event.target.value.toLowerCase();
      setDraft((current) => ({
        ...current,
        [key]: nextSuffix,
      }));
    };

  const handleVerseChange =
    (key: 'startVerse' | 'endVerse') =>
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextVerse = parseInt(event.target.value, 10);
      if (Number.isNaN(nextVerse)) return;

      setDraft((current) => ({
        ...current,
        [key]: nextVerse,
      }));
    };

  const displayEndChapter = draft.endChapter;
  const displayEndVerse = draft.endVerse;
  const canEditEndSuffix = draft.canSplit || draft.splitVerse;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="edit-reference-dialog-title"
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle id="edit-reference-dialog-title">
        {`${title} ${limits}`}
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 1.5,
            mb: 2,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.5,
              }}
            >
              <Typography
                sx={{ fontSize: 28 }}
              >{`${draft.startChapter}:`}</Typography>
              <NativeSelect
                value={draft.startVerse}
                onChange={handleVerseChange('startVerse')}
                inputProps={{ 'aria-label': 'start verse number' }}
                sx={verseSelectSx}
              >
                {verseNumberOptions.map((option) => (
                  <option
                    key={`start-verse-${option}`}
                    value={option}
                    style={verseOptionStyle}
                  >
                    {option}
                  </option>
                ))}
              </NativeSelect>
            </Box>
            <NativeSelect
              value={draft.startSuffix}
              onChange={handleSuffixChange('startSuffix')}
              inputProps={{ 'aria-label': 'start verse suffix' }}
              sx={selectSx}
            >
              {suffixOptions.map((option) => (
                <option
                  key={option || 'none-start'}
                  value={option}
                  style={suffixOptionStyle}
                >
                  {option || ' '}
                </option>
              ))}
            </NativeSelect>
          </Box>
          <Typography variant="h6">-</Typography>
          <Box sx={{ textAlign: 'center' }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.5,
              }}
            >
              <Typography
                sx={{ fontSize: 24 }}
              >{`${displayEndChapter}:`}</Typography>
              <NativeSelect
                value={displayEndVerse}
                onChange={handleVerseChange('endVerse')}
                disabled={!draft.splitVerse}
                inputProps={{ 'aria-label': 'end verse number' }}
                sx={verseSelectSx}
              >
                {verseNumberOptions.map((option) => (
                  <option
                    key={`end-verse-${option}`}
                    value={option}
                    style={verseOptionStyle}
                  >
                    {option}
                  </option>
                ))}
              </NativeSelect>
            </Box>
            <NativeSelect
              value={draft.endSuffix}
              onChange={handleSuffixChange('endSuffix')}
              disabled={!canEditEndSuffix}
              inputProps={{ 'aria-label': 'end verse suffix' }}
              sx={selectSx}
            >
              {suffixOptions.map((option) => (
                <option
                  key={option || 'none-end'}
                  value={option}
                  style={suffixOptionStyle}
                >
                  {option || ' '}
                </option>
              ))}
            </NativeSelect>
          </Box>
        </Box>

        <FormControlLabel
          control={
            <Checkbox checked={draft.splitVerse} onChange={handleSplitChange} />
          }
          label={splitVerseLabel}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel}>{cancelLabel}</Button>
        <Button variant="contained" onClick={() => onSave(draft)}>
          {saveLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
// test
