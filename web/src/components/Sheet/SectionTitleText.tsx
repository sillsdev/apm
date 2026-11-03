import type {
  CSSProperties,
  ChangeEvent,
  ClipboardEvent,
  KeyboardEvent,
  MouseEvent,
} from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import type DataSheet from 'react-datasheet';
import type { ICell } from './PlanSheet';

// Same control as the publishing title: a textarea. Chromium draws the
// spelling underline on it after a click, and keeps the underline after blur.
// An input in this grid never shows that mark.
const titleStyle: CSSProperties = {
  border: 'none',
  padding: '1px 0 2px',
  margin: 0,
  background: 'transparent',
  outline: 'none',
  boxShadow: 'none',
  display: 'block',
  boxSizing: 'border-box',
  width: '100%',
  minHeight: 23,
  resize: 'none',
  overflow: 'hidden',
  font: 'inherit',
  color: 'inherit',
  lineHeight: '23px',
  whiteSpace: 'pre-wrap',
  textAlign: 'left',
  cursor: 'cell',
  userSelect: 'text',
};

// Keys the grid still needs while the title has focus: Tab moves to the next
// cell, Escape leaves the title.
const gridKeys = new Set(['Tab', 'Escape']);

const fitHeight = (el: HTMLTextAreaElement) => {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

export function SectionTitleText({
  value,
  cell,
}: Readonly<Pick<DataSheet.ValueViewerProps<ICell>, 'value' | 'cell'>>) {
  const text = value == null ? '' : String(value);
  const onSpellReplace = cell?.onSpellReplace;
  const areaRef = useRef<HTMLTextAreaElement>(null);
  // Edits stay local while the title has focus and are saved on blur, so a
  // save in progress cannot reset the text under the user's typing.
  const [draft, setDraft] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const shown = draft ?? text;

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (el) fitHeight(el);
  }, [shown]);

  // Wrapping changes when the column width changes.
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => fitHeight(el));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleFocus = () => {
    if (onSpellReplace) setDraft(text);
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    if (onSpellReplace) setDraft(event.currentTarget.value);
  };

  const handleBlur = () => {
    const next = draft?.trim();
    const cancelled = cancelRef.current;
    cancelRef.current = false;
    setDraft(null);
    if (!cancelled && next !== undefined && next !== text)
      onSpellReplace?.(next);
  };

  // Other keys belong to this title. If they reach the grid, it starts its own
  // editor and wipes the title.
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (gridKeys.has(event.key)) {
      cancelRef.current = event.key === 'Escape';
      event.currentTarget.blur();
      return;
    }
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  // The grid listens for copy, cut and paste on the document and would act on
  // the whole selected cell instead of the text selected here.
  const handleClipboard = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    event.stopPropagation();
  };

  const handleDoubleClick = (event: MouseEvent<HTMLTextAreaElement>) => {
    event.stopPropagation();
  };

  return (
    <textarea
      ref={areaRef}
      className="section-title-spell"
      style={titleStyle}
      spellCheck
      readOnly={!onSpellReplace}
      rows={1}
      tabIndex={-1}
      value={shown}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onCopy={handleClipboard}
      onCut={handleClipboard}
      onPaste={handleClipboard}
      onDoubleClick={handleDoubleClick}
    />
  );
}
