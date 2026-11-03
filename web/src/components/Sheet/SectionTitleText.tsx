import type {
  CSSProperties,
  ChangeEvent,
  KeyboardEvent,
  SyntheticEvent,
} from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type DataSheet from 'react-datasheet';
import { useSelector, shallowEqual } from 'react-redux';
import type { IScriptureTableStrings } from '@model/index';
import { scriptureTableSelector } from '../../selector';
import type { ICell } from './PlanSheet';

/** A section title cell; onTitleCommit is absent when the title is read-only. */
export interface ISectionTitleCell extends ICell {
  onTitleCommit?: (next: string) => void;
}

// Same control as the publishing title: a textarea. Chromium draws the
// spelling underline on it after a click, and keeps the underline after blur.
// The grid's own editor is an input that closes when it commits, taking its
// underline with it; PlanSheet's title-spell rule only keeps that underline
// from being clipped while the editor is open.
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

// Leaving the title hands focus back to the grid, so its next key press
// moves the selection instead of going to the page body.
const returnFocusToGrid = (el: HTMLTextAreaElement) => {
  const grid = el.closest<HTMLElement>('.data-grid-container');
  if (grid) grid.focus();
  else el.blur();
};

// The grid listens for double-click on the cell, and for copy, cut and paste
// on the document; it would open its own editor or act on the whole selected
// cell instead of the text selected here.
const keepFromGrid = (event: SyntheticEvent) => {
  event.stopPropagation();
};

interface SectionEdit {
  text: string;
  save: (next: string) => void;
}

const saveEdit = (edit: SectionEdit | null, draft: string | null) => {
  // Only an edit the user made is saved, so focusing a title that ends in a
  // space and leaving it does not rewrite the title.
  if (!edit || draft === null || draft === edit.text) return;
  const next = draft.trim();
  if (next !== edit.text) edit.save(next);
};

export function SectionTitleText({
  value,
  cell,
}: Readonly<
  Pick<DataSheet.ValueViewerProps<ICell>, 'value'> & {
    cell?: ISectionTitleCell;
  }
>) {
  const t: IScriptureTableStrings = useSelector(
    scriptureTableSelector,
    shallowEqual
  );
  const text = value == null ? '' : String(value);
  const onTitleCommit = cell?.onTitleCommit;
  const areaRef = useRef<HTMLTextAreaElement>(null);
  // Edits stay local while the title has focus and are saved on blur, so a
  // save in progress cannot reset the text under the user's typing.
  const [draft, setDraftx] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const setDraft = (next: string | null) => {
    setDraftx(next);
    draftRef.current = next;
  };
  // The title and save callback of the section being edited, taken when
  // editing starts, so the draft is saved to that section and no other.
  const editRef = useRef<SectionEdit>(null);
  const cancelRef = useRef(false);
  const shown = draft ?? text;

  // The scroll window can unmount this title while it has focus, and no blur
  // comes then. Save the draft so the edit is not lost.
  useEffect(() => {
    const edit = editRef;
    const pending = draftRef;
    return () => saveEdit(edit.current, pending.current);
  }, []);

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (el) fitHeight(el);
  }, [shown]);

  // Wrapping changes when the column width changes. Only a width change
  // refits, and the refit waits a frame: resizing the observed textarea
  // inside the callback sets off Chromium's "ResizeObserver loop" warning.
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let width = el.clientWidth;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => fitHeight(el));
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  const handleFocus = () => {
    if (!onTitleCommit) return;
    editRef.current = { text, save: onTitleCommit };
    setDraft(text);
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    if (editRef.current) setDraft(event.currentTarget.value);
  };

  const handleBlur = () => {
    if (!cancelRef.current) saveEdit(editRef.current, draftRef.current);
    cancelRef.current = false;
    editRef.current = null;
    setDraft(null);
  };

  // Other keys belong to this title. If they reach the grid, it starts its own
  // editor and wipes the title.
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter and Escape during IME composition pick or cancel a candidate.
    // Safari sends the confirming Enter with isComposing already false, but
    // with keyCode 229.
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      event.stopPropagation();
      return;
    }
    if (gridKeys.has(event.key)) {
      cancelRef.current = event.key === 'Escape';
      returnFocusToGrid(event.currentTarget);
      return;
    }
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      returnFocusToGrid(event.currentTarget);
    }
  };

  return (
    <textarea
      ref={areaRef}
      className="section-title-spell"
      // Same text as the visible Title column header.
      aria-label={t.title}
      style={titleStyle}
      spellCheck
      readOnly={!onTitleCommit}
      rows={1}
      tabIndex={-1}
      value={shown}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onCopy={keepFromGrid}
      onCut={keepFromGrid}
      onPaste={keepFromGrid}
      onDoubleClick={keepFromGrid}
    />
  );
}
