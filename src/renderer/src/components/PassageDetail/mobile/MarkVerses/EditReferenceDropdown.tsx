import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Typography,
} from '@mui/material';
import type { ChangeEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  WheelPicker,
  WheelPickerWrapper,
  type WheelPickerOption,
} from '@ncdai/react-wheel-picker';
import '@ncdai/react-wheel-picker/style.css';
import {
  editReferenceValuesEqual,
  normalizeEditReferenceDraft,
  type PassageVerseOption,
  toPassageVerseKey,
} from '../../../../utils/markVersesPassageVerses';
import { useMobile } from '../../../../utils/useMobile';

const suffixOptions = ['', 'a', 'b', 'c', 'd', 'e'];
const selectSx = {
  width: 'auto',
  minWidth: 0,
  '& .MuiSelect-select': {
    fontSize: '1.25rem',
    lineHeight: 1.2,
    textAlign: 'center',
    py: 0.5,
  },
  '& .MuiSelect-icon': {
    fontSize: '1.25rem',
    right: 0,
  },
};
const verseSelectSx = {
  ...selectSx,
  '& .MuiSelect-select': {
    ...selectSx['& .MuiSelect-select'],
    fontSize: '1.1rem',
  },
};
/** Match readonly chapter/verse labels to editable Select size. */
const labelSx = {
  fontSize: '1.1rem',
  lineHeight: 1.2,
  py: 0.5,
};

/** Narrow width for a single wheel column in the horizontal reference row. */
const wheelColumnSx = {
  width: 44,
  minWidth: 0,
  flex: '0 1 auto',
  // Library wrapper defaults to width:100%; constrain it to the column.
  '& [data-rwp-wrapper]': {
    width: '100%',
  },
};
const wheelSuffixColumnSx = {
  ...wheelColumnSx,
  width: 36,
};
const wheelVerseColumnSx = {
  ...wheelColumnSx,
  width: 52,
};

/** Compact wheel sizing so the dialog stays short. */
const wheelPickerProps = {
  visibleCount: 8 as const,
  optionItemHeight: 28,
};

interface PickerOption {
  value: string;
  label: ReactNode;
}

interface ValuePickerProps {
  value: string;
  options: PickerOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  /** When true, use the slightly narrower suffix column on mobile. */
  narrow?: boolean;
  /** When true, use the slightly wider verse column on mobile. */
  wide?: boolean;
  selectSx?: typeof selectSx;
}

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
  const { isMobileWidth } = useMobile();
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
    (key: 'startSuffix' | 'endSuffix') => (nextSuffix: string) => {
      setDraft((current) => ({
        ...current,
        [key]: nextSuffix.toLowerCase(),
      }));
    };

  // Changing a chapter may leave the current verse out of that chapter's range;
  // fall back to the chapter's first verse so the endpoint stays valid.
  const handleStartChapterChange = (next: string) => {
    const chapter = Number(next);
    const verses = versesForChapter(chapter);
    setDraft((current) => ({
      ...current,
      startChapter: chapter,
      startVerse: verses.includes(current.startVerse)
        ? current.startVerse
        : (verses[0] ?? current.startVerse),
    }));
  };

  const handleStartVerseNumberChange = (next: string) => {
    setDraft((current) => ({ ...current, startVerse: Number(next) }));
  };

  const handleEndChapterChange = (next: string) => {
    const chapter = Number(next);
    const verses = versesForChapter(chapter);
    setDraft((current) => ({
      ...current,
      endChapter: chapter,
      endVerse: verses.includes(current.endVerse)
        ? current.endVerse
        : (verses[0] ?? current.endVerse),
    }));
  };

  const handleEndVerseNumberChange = (next: string) => {
    setDraft((current) => ({ ...current, endVerse: Number(next) }));
  };

  // Restricted end: the combined chapter:verse dropdown keyed on the passage
  // verse list.
  const handleEndVerseChange = (next: string) => {
    const selected = resolvedEndOptions.find((option) => option.key === next);
    if (!selected) return;

    setDraft((current) => ({
      ...current,
      endChapter: selected.chapter,
      endVerse: selected.verse,
    }));
  };

  /**
   * Mobile: iOS-style wheel. Otherwise: MUI Select.
   * Drop the mobile branch (and the style.css import) if we abandon the wheel.
   */
  const renderValuePicker = ({
    value: pickerValue,
    options,
    onChange,
    ariaLabel,
    narrow,
    wide,
    selectSx: pickerSelectSx = selectSx,
  }: ValuePickerProps) => {
    if (isMobileWidth) {
      const wheelOptions: WheelPickerOption[] = options.map((option) => ({
        value: option.value,
        label: option.label,
      }));
      const columnSx = narrow
        ? wheelSuffixColumnSx
        : wide
          ? wheelVerseColumnSx
          : wheelColumnSx;
      return (
        <Box
          sx={columnSx}
          aria-label={ariaLabel}
          title={ariaLabel}
          role="group"
        >
          <WheelPickerWrapper>
            <WheelPicker
              options={wheelOptions}
              value={pickerValue}
              onValueChange={onChange}
              {...wheelPickerProps}
            />
          </WheelPickerWrapper>
        </Box>
      );
    }

    const handleSelectChange = (event: SelectChangeEvent<string>) => {
      onChange(event.target.value);
    };

    return (
      <Select
        variant="standard"
        displayEmpty
        value={pickerValue}
        onChange={handleSelectChange}
        inputProps={{ 'aria-label': ariaLabel, title: ariaLabel }}
        sx={pickerSelectSx}
      >
        {options.map((option) => (
          <MenuItem
            key={option.value === '' ? `empty-${ariaLabel}` : option.value}
            value={option.value}
            sx={{ fontSize: '1.1rem', justifyContent: 'center' }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Select>
    );
  };

  const renderSuffixSelect = (side: 'start' | 'end') => {
    const isStart = side === 'start';
    const suffix = isStart ? draft.startSuffix : draft.endSuffix;
    const suffixLabel = `${side} verse suffix`;
    return renderValuePicker({
      value: suffix,
      options: suffixOptions.map((option) => ({
        value: option,
        // Non-breaking space so the empty (no suffix) choice stays tappable.
        label: option || '\u00A0',
      })),
      onChange: handleSuffixChange(isStart ? 'startSuffix' : 'endSuffix'),
      ariaLabel: suffixLabel,
      narrow: true,
    });
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
      <Box sx={{ textAlign: 'center', minWidth: isMobileWidth ? 0 : 96 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.25,
          }}
        >
          {hasMultipleChapters ? (
            renderValuePicker({
              value: String(chapter),
              options: chapterOptions.map((option) => ({
                value: String(option),
                label: String(option),
              })),
              onChange: isStart
                ? handleStartChapterChange
                : handleEndChapterChange,
              ariaLabel: chapterLabel,
              selectSx: verseSelectSx,
            })
          ) : (
            <Typography sx={labelSx}>{chapter}</Typography>
          )}
          <Typography sx={labelSx}>:</Typography>
          {renderValuePicker({
            value: String(verse),
            options: verseOptions.map((option) => ({
              value: String(option),
              label: String(option),
            })),
            onChange: isStart
              ? handleStartVerseNumberChange
              : handleEndVerseNumberChange,
            ariaLabel: verseLabel,
            wide: true,
            selectSx: verseSelectSx,
          })}
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
            <Box sx={{ textAlign: 'center', minWidth: isMobileWidth ? 0 : 96 }}>
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
                  sx={labelSx}
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
            <Box sx={{ textAlign: 'center', minWidth: isMobileWidth ? 0 : 96 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                }}
              >
                {showChapterPrefix ? (
                  <Typography sx={labelSx}>
                    {`${draft.endChapter}:`}
                  </Typography>
                ) : null}
                {renderValuePicker({
                  value: endSelectValue,
                  options: resolvedEndOptions.map((option) => ({
                    value: option.key,
                    label: String(option.verse),
                  })),
                  onChange: handleEndVerseChange,
                  ariaLabel: 'end verse number',
                  wide: true,
                  selectSx: verseSelectSx,
                })}
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
