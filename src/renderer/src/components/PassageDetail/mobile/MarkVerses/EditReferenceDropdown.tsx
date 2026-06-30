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
import { useEffect, useMemo, useState } from 'react';
import {
  editReferenceValuesEqual,
  normalizeEditReferenceDraft,
  type PassageVerseOption,
  toPassageVerseKey,
} from '../../../../utils/markVersesPassageVerses';

const suffixOptions = ['', 'a', 'b', 'c', 'd', 'e'];
const selectSx = {
  minWidth: 56,
  '& .MuiNativeSelect-select': {
    fontSize: '1.25rem',
    lineHeight: 1.2,
    textAlign: 'center',
    pr: 2.5,
    py: 0.5,
  },
  '& .MuiNativeSelect-icon': {
    fontSize: '1.25rem',
    right: 0,
  },
};
const verseSelectSx = {
  ...selectSx,
  '& .MuiNativeSelect-select': {
    ...selectSx['& .MuiNativeSelect-select'],
    fontSize: '1.1rem',
  },
};
const suffixOptionStyle = {
  fontSize: '1.1rem',
};
const verseOptionStyle = {
  fontSize: '1rem',
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
  endVerseOptions: PassageVerseOption[];
  title: string;
  cancelLabel: string;
  saveLabel: string;
  splitVerseLabel: string;
  value: EditReferenceValue;
  /**
   * When true (the row carries a warning icon), the start verse is editable via
   * a dropdown that mirrors the end verse and shares its option list, so the
   * user can correct an out-of-range / non-consecutive start.
   */
  editStart?: boolean;
  onCancel: () => void;
  onSave: (value: EditReferenceValue) => void;
}

export default function EditReferenceDropdown({
  open,
  limits,
  endVerseOptions,
  title,
  cancelLabel,
  saveLabel,
  splitVerseLabel,
  value,
  editStart = false,
  onCancel,
  onSave,
}: EditReferenceDropdownProps) {
  const [draft, setDraft] = useState<EditReferenceValue>(value);
  const [initialSnapshot, setInitialSnapshot] =
    useState<EditReferenceValue>(value);
  const startSelectValue = toPassageVerseKey(
    draft.startChapter,
    draft.startVerse
  );
  const endSelectValue = toPassageVerseKey(draft.endChapter, draft.endVerse);
  const isDirty = useMemo(
    () => !editReferenceValuesEqual(draft, initialSnapshot),
    [draft, initialSnapshot]
  );

  const resolvedEndOptions = useMemo(() => {
    if (endVerseOptions.length > 0) return endVerseOptions;
    return [
      {
        chapter: draft.startChapter,
        verse: draft.startVerse,
        key: toPassageVerseKey(draft.startChapter, draft.startVerse),
      },
    ];
  }, [draft.startChapter, draft.startVerse, endVerseOptions]);

  // Shared by both selects when the start is editable: the start and end
  // dropdowns draw from the same option list, so they show the chapter prefix
  // under the same condition.
  const showChapterPrefix = resolvedEndOptions.some(
    (option) => option.chapter !== draft.startChapter
  );

  useEffect(() => {
    if (!open) return;
    const normalized = normalizeEditReferenceDraft(value);
    setDraft(normalized);
    setInitialSnapshot(normalized);
  }, [open, value]);

  const handleSplitChange = (
    _event: ChangeEvent<HTMLInputElement>,
    checked: boolean
  ) => {
    setDraft((current) => ({
      ...current,
      splitVerse: checked,
      startSuffix: checked ? current.startSuffix : '',
      endSuffix: checked ? current.endSuffix : '',
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

  const handleStartVerseChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const selected = resolvedEndOptions.find(
      (option) => option.key === event.target.value
    );
    if (!selected) return;

    setDraft((current) => ({
      ...current,
      startChapter: selected.chapter,
      startVerse: selected.verse,
    }));
  };

  const handleEndVerseChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const selected = resolvedEndOptions.find(
      (option) => option.key === event.target.value
    );
    if (!selected) return;

    setDraft((current) => ({
      ...current,
      endChapter: selected.chapter,
      endVerse: selected.verse,
    }));
  };

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
            alignItems: 'flex-start',
            gap: 3,
            mb: 2,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <Box sx={{ textAlign: 'center', minWidth: 96 }}>
            {editStart ? (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                }}
              >
                {showChapterPrefix ? (
                  <Typography sx={{ fontSize: 24 }}>
                    {`${draft.startChapter}:`}
                  </Typography>
                ) : null}
                <NativeSelect
                  value={startSelectValue}
                  onChange={handleStartVerseChange}
                  inputProps={{
                    'aria-label': 'start verse number',
                    title: 'start verse number',
                  }}
                  sx={verseSelectSx}
                >
                  {resolvedEndOptions.map((option) => (
                    <option
                      key={`start-verse-${option.key}`}
                      value={option.key}
                      style={verseOptionStyle}
                    >
                      {showChapterPrefix ? option.key : `${option.verse}`}
                    </option>
                  ))}
                </NativeSelect>
              </Box>
            ) : (
              <Typography
                component="div"
                aria-label="start verse reference"
                sx={{ fontSize: 28, lineHeight: 1.2, py: 0.5 }}
              >
                {`${draft.startChapter}:${draft.startVerse}`}
              </Typography>
            )}
            {draft.splitVerse ? (
              <NativeSelect
                value={draft.startSuffix}
                onChange={handleSuffixChange('startSuffix')}
                inputProps={{
                  'aria-label': 'start verse suffix',
                  title: 'start verse suffix',
                }}
                sx={{ ...selectSx, mt: 0.5 }}
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
            ) : null}
          </Box>
          <Typography variant="h6" sx={{ mt: 0.75 }}>
            -
          </Typography>
          <Box sx={{ textAlign: 'center', minWidth: 96 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.5,
              }}
            >
              {showChapterPrefix ? (
                <Typography sx={{ fontSize: 24 }}>
                  {`${draft.endChapter}:`}
                </Typography>
              ) : null}
              <NativeSelect
                value={endSelectValue}
                onChange={handleEndVerseChange}
                inputProps={{
                  'aria-label': 'end verse number',
                  title: 'end verse number',
                }}
                sx={verseSelectSx}
              >
                {resolvedEndOptions.map((option) => (
                  <option
                    key={`end-verse-${option.key}`}
                    value={option.key}
                    style={verseOptionStyle}
                  >
                    {showChapterPrefix ? option.key : `${option.verse}`}
                  </option>
                ))}
              </NativeSelect>
            </Box>
            {draft.splitVerse ? (
              <NativeSelect
                value={draft.endSuffix}
                onChange={handleSuffixChange('endSuffix')}
                inputProps={{
                  'aria-label': 'end verse suffix',
                  title: 'end verse suffix',
                }}
                sx={{ ...selectSx, mt: 0.5 }}
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
            ) : null}
          </Box>
        </Box>

        {draft.canSplit ? (
          <FormControlLabel
            control={
              <Checkbox
                checked={draft.splitVerse}
                onChange={handleSplitChange}
              />
            }
            label={splitVerseLabel}
          />
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel}>{cancelLabel}</Button>
        <Button
          variant="contained"
          disabled={!isDirty}
          onClick={() => onSave(draft)}
        >
          {saveLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
