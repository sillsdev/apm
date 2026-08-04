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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  WheelPicker,
  WheelPickerWrapper,
  type WheelPickerOption,
} from '@ncdai/react-wheel-picker';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  editReferenceValuesEqual,
  normalizeEditReferenceDraft,
  type PassageVerseOption,
  toPassageVerseKey,
} from '../../../../utils/markVersesPassageVerses';
import '@ncdai/react-wheel-picker/style.css';

const suffixOptions = ['', 'a', 'b', 'c', 'd', 'e'];

/** Shared size for editable controls and readonly chapter/verse labels. */
const fieldFontSize = '1.1rem';

const selectSx = {
  width: 'auto',
  '& .MuiNativeSelect-select': {
    fontSize: fieldFontSize,
    lineHeight: 1.2,
    textAlign: 'center',
    py: 0.5,
  },
  '& .MuiNativeSelect-icon': {
    fontSize: fieldFontSize,
    right: 0,
  },
};

const labelSx = {
  fontSize: fieldFontSize,
  lineHeight: 1.2,
  py: 0.5,
};

const separatorSx = {
  fontSize: fieldFontSize,
  lineHeight: 1.2,
  px: 1.25,
  flexShrink: 0,
};

const optionStyle = {
  fontSize: fieldFontSize,
};

const wheelItemHeight = 36;

const wheelWrapperSx = {
  width: 'auto',
  minWidth: 48,
  height: wheelItemHeight * 3,
  '& [data-rwp-option], & [data-rwp-highlight-item]': {
    fontSize: fieldFontSize,
  },
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

function toNumberOptions(values: number[]): WheelPickerOption<string>[] {
  return values.map((value) => ({
    value: String(value),
    label: String(value),
  }));
}

function toSuffixOptions(): WheelPickerOption<string>[] {
  return suffixOptions.map((option) => ({
    value: option,
    label: option || '\u00A0',
    textValue: option || 'none',
  }));
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
  const theme = useTheme();
  const useWheels = useMediaQuery(theme.breakpoints.down('sm'));
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

  const setSuffix = (key: 'startSuffix' | 'endSuffix', nextSuffix: string) => {
    setDraft((current) => ({
      ...current,
      [key]: nextSuffix.toLowerCase(),
    }));
  };

  const handleSuffixChange =
    (key: 'startSuffix' | 'endSuffix') =>
    (event: ChangeEvent<HTMLSelectElement>) => {
      setSuffix(key, event.target.value);
    };

  // Changing a chapter may leave the current verse out of that chapter's range;
  // fall back to the chapter's first verse so the endpoint stays valid.
  const setStartChapter = (chapter: number) => {
    const verses = versesForChapter(chapter);
    setDraft((current) => ({
      ...current,
      startChapter: chapter,
      startVerse: verses.includes(current.startVerse)
        ? current.startVerse
        : (verses[0] ?? current.startVerse),
    }));
  };

  const setStartVerse = (verse: number) => {
    setDraft((current) => ({ ...current, startVerse: verse }));
  };

  const setEndChapter = (chapter: number) => {
    const verses = versesForChapter(chapter);
    setDraft((current) => ({
      ...current,
      endChapter: chapter,
      endVerse: verses.includes(current.endVerse)
        ? current.endVerse
        : (verses[0] ?? current.endVerse),
    }));
  };

  const setEndVerse = (verse: number) => {
    setDraft((current) => ({ ...current, endVerse: verse }));
  };

  // Restricted end: the combined chapter:verse dropdown keyed on the passage
  // verse list.
  const setEndPassageVerse = (key: string) => {
    const selected = resolvedEndOptions.find((option) => option.key === key);
    if (!selected) return;

    setDraft((current) => ({
      ...current,
      endChapter: selected.chapter,
      endVerse: selected.verse,
    }));
  };

  const renderWheel = (
    ariaLabel: string,
    options: WheelPickerOption<string>[],
    value: string,
    onValueChange: (next: string) => void,
    minWidth = 48
  ) => (
    <Box
      aria-label={ariaLabel}
      title={ariaLabel}
      sx={{ ...wheelWrapperSx, minWidth }}
    >
      <WheelPickerWrapper>
        <WheelPicker
          options={options}
          value={value}
          onValueChange={onValueChange}
          optionItemHeight={wheelItemHeight}
          visibleCount={12}
        />
      </WheelPickerWrapper>
    </Box>
  );

  const renderSuffixSelect = (side: 'start' | 'end') => {
    const isStart = side === 'start';
    const suffix = isStart ? draft.startSuffix : draft.endSuffix;
    const suffixLabel = `${side} verse suffix`;
    const suffixKey = isStart ? 'startSuffix' : 'endSuffix';

    if (useWheels) {
      return renderWheel(
        suffixLabel,
        toSuffixOptions(),
        suffix,
        (next) => setSuffix(suffixKey, next),
        40
      );
    }

    return (
      <NativeSelect
        value={suffix}
        onChange={handleSuffixChange(suffixKey)}
        inputProps={{ 'aria-label': suffixLabel, title: suffixLabel }}
        sx={selectSx}
      >
        {suffixOptions.map((option) => (
          <option
            key={option || `none-${side}`}
            value={option}
            style={optionStyle}
          >
            {option || ' '}
          </option>
        ))}
      </NativeSelect>
    );
  };

  /**
   * An editable `chapter:verse` endpoint (`unrestricted` mode). The chapter is a
   * control only when the passage spans multiple chapters; the verse is always
   * editable and scoped to the chosen chapter.
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
            gap: useWheels ? 0.5 : 0.25,
          }}
        >
          {hasMultipleChapters ? (
            useWheels ? (
              renderWheel(
                chapterLabel,
                toNumberOptions(chapterOptions),
                String(chapter),
                (next) =>
                  isStart ? setStartChapter(Number(next)) : setEndChapter(Number(next))
              )
            ) : (
              <NativeSelect
                value={String(chapter)}
                onChange={(event) =>
                  isStart
                    ? setStartChapter(Number(event.target.value))
                    : setEndChapter(Number(event.target.value))
                }
                inputProps={{ 'aria-label': chapterLabel, title: chapterLabel }}
                sx={selectSx}
              >
                {chapterOptions.map((option) => (
                  <option
                    key={`${side}-chapter-${option}`}
                    value={String(option)}
                    style={optionStyle}
                  >
                    {option}
                  </option>
                ))}
              </NativeSelect>
            )
          ) : (
            <Typography sx={labelSx}>{chapter}</Typography>
          )}
          <Typography sx={{ ...labelSx, px: 0.25 }}>:</Typography>
          {useWheels ? (
            renderWheel(
              verseLabel,
              toNumberOptions(verseOptions),
              String(verse),
              (next) =>
                isStart ? setStartVerse(Number(next)) : setEndVerse(Number(next)),
              56
            )
          ) : (
            <NativeSelect
              value={String(verse)}
              onChange={(event) =>
                isStart
                  ? setStartVerse(Number(event.target.value))
                  : setEndVerse(Number(event.target.value))
              }
              inputProps={{ 'aria-label': verseLabel, title: verseLabel }}
              sx={selectSx}
            >
              {verseOptions.map((option) => (
                <option
                  key={`${side}-verse-${option}`}
                  value={String(option)}
                  style={optionStyle}
                >
                  {option}
                </option>
              ))}
            </NativeSelect>
          )}
          {draft.splitVerse ? renderSuffixSelect(side) : null}
        </Box>
      </Box>
    );
  };

  const renderRestrictedEnd = () => {
    const endOptions: WheelPickerOption<string>[] = resolvedEndOptions.map(
      (option) => ({
        value: option.key,
        label: showChapterPrefix
          ? `${option.chapter}:${option.verse}`
          : String(option.verse),
        textValue: option.key,
      })
    );

    return (
      <Box sx={{ textAlign: 'center', minWidth: 96 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: useWheels ? 0.5 : 0.5,
          }}
        >
          {useWheels ? (
            renderWheel(
              'end verse number',
              endOptions,
              endSelectValue,
              setEndPassageVerse,
              showChapterPrefix ? 72 : 56
            )
          ) : (
            <>
              {showChapterPrefix ? (
                <Typography sx={labelSx}>{`${draft.endChapter}:`}</Typography>
              ) : null}
              <NativeSelect
                value={endSelectValue}
                onChange={(event) => setEndPassageVerse(event.target.value)}
                inputProps={{
                  'aria-label': 'end verse number',
                  title: 'end verse number',
                }}
                sx={selectSx}
              >
                {resolvedEndOptions.map((option) => (
                  <option
                    key={`end-verse-${option.key}`}
                    value={option.key}
                    style={optionStyle}
                  >
                    {option.verse}
                  </option>
                ))}
              </NativeSelect>
            </>
          )}
          {draft.splitVerse ? renderSuffixSelect('end') : null}
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
      maxWidth={useWheels ? 'xs' : 'sm'}
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
                  sx={labelSx}
                >
                  {`${draft.startChapter}:${draft.startVerse}`}
                </Typography>
                {draft.splitVerse ? renderSuffixSelect('start') : null}
              </Box>
            </Box>
          )}
          <Typography aria-hidden sx={separatorSx}>
            –
          </Typography>
          {unrestricted ? renderEditableEndpoint('end') : renderRestrictedEnd()}
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
