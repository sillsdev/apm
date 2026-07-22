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
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  editReferenceValuesEqual,
  normalizeEditReferenceDraft,
  type PassageVerseOption,
  toPassageVerseKey,
} from '../../../../utils/markVersesPassageVerses';

const suffixOptions = ['', 'a', 'b', 'c', 'd', 'e'];
const selectSx = {
  width: 'auto',
  '& .MuiNativeSelect-select': {
    fontSize: '1.25rem',
    lineHeight: 1.2,
    textAlign: 'center',
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
   * When true, the whole range is freely editable, so that the user can correct
   * an out-of-range / non-consecutive reference. In that mode both endpoints
   * render as discrete chapter + verse dropdowns (`a:b - x:y`) drawn from every
   * verse in the passage. When false the start is a fixed label and only the end
   * verse can move (the established, in-range case).
   */
  unrestricted?: boolean;
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
  unrestricted = false,
  onCancel,
  onSave,
}: EditReferenceDropdownProps) {
  const [draft, setDraft] = useState<EditReferenceValue>(value);
  const [initialSnapshot, setInitialSnapshot] =
    useState<EditReferenceValue>(value);
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

  // The distinct chapters present in the passage, ascending. When the passage
  // covers more than one chapter the editable endpoints expose a chapter
  // dropdown; a single-chapter passage shows the chapter as a fixed label.
  const chapterOptions = useMemo(() => {
    const chapters = new Set<number>();
    resolvedEndOptions.forEach((option) => chapters.add(option.chapter));
    return Array.from(chapters).sort((a, b) => a - b);
  }, [resolvedEndOptions]);
  const hasMultipleChapters = chapterOptions.length > 1;

  // Verse numbers belonging to a given chapter within the passage, ascending —
  // the option list for a verse dropdown once its chapter is chosen.
  const versesForChapter = useCallback(
    (chapter: number) => {
      const verses = new Set<number>();
      resolvedEndOptions.forEach((option) => {
        if (option.chapter === chapter) verses.add(option.verse);
      });
      return Array.from(verses).sort((a, b) => a - b);
    },
    [resolvedEndOptions]
  );

  // Restricted end: start and end share one combined chapter:verse list, so
  // the end dropdown shows the chapter prefix only when the range can cross into
  // another chapter.
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

  // Changing a chapter may leave the current verse out of that chapter's range;
  // fall back to the chapter's first verse so the endpoint stays valid.
  const handleStartChapterChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const chapter = Number(event.target.value);
    const verses = versesForChapter(chapter);
    setDraft((current) => ({
      ...current,
      startChapter: chapter,
      startVerse: verses.includes(current.startVerse)
        ? current.startVerse
        : (verses[0] ?? current.startVerse),
    }));
  };

  const handleStartVerseNumberChange = (
    event: ChangeEvent<HTMLSelectElement>
  ) => {
    const verse = Number(event.target.value);
    setDraft((current) => ({ ...current, startVerse: verse }));
  };

  const handleEndChapterChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const chapter = Number(event.target.value);
    const verses = versesForChapter(chapter);
    setDraft((current) => ({
      ...current,
      endChapter: chapter,
      endVerse: verses.includes(current.endVerse)
        ? current.endVerse
        : (verses[0] ?? current.endVerse),
    }));
  };

  const handleEndVerseNumberChange = (
    event: ChangeEvent<HTMLSelectElement>
  ) => {
    const verse = Number(event.target.value);
    setDraft((current) => ({ ...current, endVerse: verse }));
  };

  // Restricted end: the combined chapter:verse dropdown keyed on the passage
  // verse list.
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

  const renderSuffixSelect = (side: 'start' | 'end') => {
    const isStart = side === 'start';
    const suffix = isStart ? draft.startSuffix : draft.endSuffix;
    const suffixLabel = `${side} verse suffix`;
    return (
      <NativeSelect
        value={suffix}
        onChange={handleSuffixChange(isStart ? 'startSuffix' : 'endSuffix')}
        inputProps={{ 'aria-label': suffixLabel, title: suffixLabel }}
        sx={selectSx}
      >
        {suffixOptions.map((option) => (
          <option
            key={option || `none-${side}`}
            value={option}
            style={suffixOptionStyle}
          >
            {option || ' '}
          </option>
        ))}
      </NativeSelect>
    );
  };

  /**
   * An editable `chapter:verse` endpoint (`unrestricted` mode). The chapter is a
   * dropdown only when the passage spans multiple chapters; the verse is always
   * a dropdown scoped to the chosen chapter.
   */
  const renderEditableEndpoint = (side: 'start' | 'end') => {
    const isStart = side === 'start';
    const chapter = isStart ? draft.startChapter : draft.endChapter;
    const verse = isStart ? draft.startVerse : draft.endVerse;
    const verseOptions = versesForChapter(chapter);
    const chapterLabel = `${side} chapter number`;
    const verseLabel = `${side} verse number`;
    return (
      <Box sx={{ textAlign: 'center', minWidth: 96 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.25,
          }}
        >
          {hasMultipleChapters ? (
            <NativeSelect
              value={String(chapter)}
              onChange={
                isStart ? handleStartChapterChange : handleEndChapterChange
              }
              inputProps={{ 'aria-label': chapterLabel, title: chapterLabel }}
              sx={verseSelectSx}
            >
              {chapterOptions.map((option) => (
                <option
                  key={`${side}-chapter-${option}`}
                  value={String(option)}
                  style={verseOptionStyle}
                >
                  {option}
                </option>
              ))}
            </NativeSelect>
          ) : (
            <Typography sx={{ fontSize: 24 }}>{chapter}</Typography>
          )}
          <Typography sx={{ fontSize: 24 }}>:</Typography>
          <NativeSelect
            value={String(verse)}
            onChange={
              isStart
                ? handleStartVerseNumberChange
                : handleEndVerseNumberChange
            }
            inputProps={{ 'aria-label': verseLabel, title: verseLabel }}
            sx={verseSelectSx}
          >
            {verseOptions.map((option) => (
              <option
                key={`${side}-verse-${option}`}
                value={String(option)}
                style={verseOptionStyle}
              >
                {option}
              </option>
            ))}
          </NativeSelect>
          {draft.splitVerse ? renderSuffixSelect(side) : null}
        </Box>
      </Box>
    );
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
            alignItems: 'center',
            gap: 0.5,
            mb: 2,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {unrestricted ? (
            renderEditableEndpoint('start')
          ) : (
            <Box sx={{ textAlign: 'center', minWidth: 96 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                }}
              >
                <Typography
                  component="div"
                  aria-label="start verse reference"
                  sx={{ fontSize: 28, lineHeight: 1.2, py: 0.5 }}
                >
                  {`${draft.startChapter}:${draft.startVerse}`}
                </Typography>
                {draft.splitVerse ? renderSuffixSelect('start') : null}
              </Box>
            </Box>
          )}
          <Typography variant="h6">-</Typography>
          {unrestricted ? (
            renderEditableEndpoint('end')
          ) : (
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
                      {option.verse}
                    </option>
                  ))}
                </NativeSelect>
                {draft.splitVerse ? renderSuffixSelect('end') : null}
              </Box>
            </Box>
          )}
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
