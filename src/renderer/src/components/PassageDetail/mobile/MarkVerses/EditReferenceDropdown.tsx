import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Typography,
} from '@mui/material';
import type { ChangeEvent, MouseEvent, ReactNode } from 'react';
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

const suffixOptions = ['', 'a', 'b', 'c', 'd', 'e'];
/** Match readonly chapter/verse labels to the wheel option size. */
const labelSx = {
  fontSize: '1.1rem',
  lineHeight: 1.2,
  py: 0.5,
};

/**
 * Match wheel option/highlight text to labelSx (1.1rem, normal weight).
 * Library defaults are 0.875rem options and 1rem / weight 500 for the highlight.
 */
const wheelFontSx = {
  fontSize: '1.1rem',
  fontWeight: 400,
  fontFamily: 'inherit',
};

/**
 * Wheel options are absolutely positioned, so columns have no intrinsic width.
 * Size each column from its longest label (+ padding) and never grow.
 */
const wheelColumnWidth = (options: { label: ReactNode }[]) => {
  const maxChars = Math.max(
    2, // At least ~2 character widths (e.g. "12", "a ") so it's not too hard to scroll
    ...options.map((option) => {
      if (
        typeof option.label === 'string' ||
        typeof option.label === 'number'
      ) {
        return (
          String(option.label)
            .replace(/\u00A0/g, ' ')
            .trim().length || 1
        );
      }
      return 1;
    })
  );
  return `calc(${maxChars}ch + 12px)`;
};

/**
 * Content-sized column; overrides library width:100% / flex:1 growth.
 * fontSize on the column itself so `ch` in wheelColumnWidth matches option text.
 */
const wheelColumnSx = {
  flex: '0 0 auto',
  maxWidth: '100%',
  ...wheelFontSx,
  '& [data-rwp-wrapper]': {
    width: '100%',
  },
  '& [data-rwp]': {
    flex: '0 0 auto',
    width: '100%',
  },
  // Unselected 3D options: muted/faded vs the selected highlight.
  '& [data-rwp-option]': {
    ...wheelFontSx,
    color: 'text.secondary',
    opacity: 0.45,
  },
  '& [data-rwp-highlight-wrapper]': {
    ...wheelFontSx,
    color: 'text.primary',
    // Hairlines frame the selection (iOS-style).
    borderTop: '1px solid',
    borderBottom: '1px solid',
    borderColor: 'grey.400',
    bgcolor: 'transparent',
  },
  '& [data-rwp-highlight-item]': {
    ...wheelFontSx,
    color: 'text.primary',
  },
};

/**
 * Mid-height cylinder — taller than the original compact 8/28, shorter than 16/32.
 * visibleCount must be a multiple of 4 (library constraint).
 */
const wheelPickerProps = {
  visibleCount: 12 as const,
  optionItemHeight: 30,
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
   * The wheel library has its own Arrow-key handling on its internal `[data-rwp]`
   * div, but that div only receives keyboard focus when tabbed to: on click the
   * library calls `preventDefault()` on mousedown (to drive its drag/scroll),
   * which also stops the browser from focusing the wheel. So after clicking a
   * wheel the arrow keys did nothing (TT-7622). Focus the wheel ourselves on
   * click to close that gap; keyboard users who tab in already get focus for
   * free and this is a no-op for them.
   */
  const focusWheelOnClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.currentTarget.querySelector<HTMLElement>('[data-rwp]')?.focus();
  }, []);

  /**
   * One iOS-style wheel column.
   *
   * ARIA stops at the label here. The focusable, arrow-key-driven element is the
   * library's own internal `[data-rwp]` div, which accepts no props from us, so
   * there is no element we control that could carry the current value: an
   * `aria-valuetext` on this wrapper would sit on a `role="group"`, where screen
   * readers ignore it. Announcing the value would mean reaching into the
   * library's DOM after render, which isn't worth an effect — if the library
   * grows real ARIA support, drop the wrapper's role and use it.
   */
  const renderValuePicker = ({
    value: pickerValue,
    options,
    onChange,
    ariaLabel,
  }: ValuePickerProps) => {
    const wheelOptions: WheelPickerOption[] = options.map((option) => ({
      value: option.value,
      label: option.label,
    }));
    // Remount when the option set changes so the cylinder re-centers after
    // chapter switches clamp/re-scope the verse list.
    const optionsKey = wheelOptions.map((option) => option.value).join('|');
    return (
      <Box
        sx={{ ...wheelColumnSx, width: wheelColumnWidth(options) }}
        aria-label={ariaLabel}
        title={ariaLabel}
        role="group"
        onClick={focusWheelOnClick}
      >
        <WheelPickerWrapper>
          <WheelPicker
            key={`${ariaLabel}:${optionsKey}`}
            options={wheelOptions}
            value={pickerValue}
            onValueChange={onChange}
            {...wheelPickerProps}
          />
        </WheelPickerWrapper>
      </Box>
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
    // Only passage verses are offered, so a reference that falls outside the
    // passage can't be re-picked. The caller snaps such an endpoint onto a real
    // passage verse before opening, which is what forces the user onto a good
    // value.
    const verseOptions = versesForChapter(chapter);
    const chapterLabel = `${side} chapter number`;
    const verseLabel = `${side} verse number`;
    return (
      <Box sx={{ textAlign: 'center', minWidth: 0 }}>
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
            <Box sx={{ textAlign: 'center', minWidth: 0 }}>
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
          <Typography variant="h6" sx={{ mx: 1 }}>
            -
          </Typography>
          {unrestricted ? (
            renderEditableEndpoint('end')
          ) : (
            <Box sx={{ textAlign: 'center', minWidth: 0 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                }}
              >
                {showChapterPrefix ? (
                  <Typography sx={labelSx}>{`${draft.endChapter}:`}</Typography>
                ) : null}
                {renderValuePicker({
                  value: endSelectValue,
                  options: resolvedEndOptions.map((option) => ({
                    value: option.key,
                    label: String(option.verse),
                  })),
                  onChange: handleEndVerseChange,
                  ariaLabel: 'end verse number',
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
