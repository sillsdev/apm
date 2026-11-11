import { useCallback, useEffect, useRef } from 'react';

/**
 * Remembers the Edit Workflow DialogContent scroll position and puts it back.
 * Nested settings dialogs (MUI scroll lock / focus restore) and list remounts
 * can reset it, so callers `remember()` before opening a settings dialog and
 * `restoreAfterRender()` when a settings write or close re-renders the list.
 */
export function useRememberedScroll() {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const topRef = useRef(0);
  const restorePendingRef = useRef(false);
  const frameRef = useRef<number | undefined>(undefined);

  const scrollParent = useCallback(() => {
    let p: HTMLElement | null = anchorRef.current?.parentElement ?? null;
    while (p) {
      const oy = getComputedStyle(p).overflowY;
      if (oy === 'auto' || oy === 'scroll') return p;
      p = p.parentElement;
    }
    return null;
  }, []);

  const remember = () => {
    const sp = scrollParent();
    if (sp) topRef.current = sp.scrollTop;
  };

  const restoreAfterRender = () => {
    restorePendingRef.current = true;
  };

  const cancelFrame = () => {
    if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    frameRef.current = undefined;
  };

  // Runs after every render but only acts when a restore was requested. MUI
  // focus restore can clear the scroll after layout, so wait two frames. Both
  // frame ids are tracked in frameRef so either can be cancelled.
  useEffect(() => {
    if (!restorePendingRef.current) return;
    restorePendingRef.current = false;
    const top = topRef.current;
    cancelFrame();
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = undefined;
        const sp = scrollParent();
        if (sp) sp.scrollTop = top;
      });
    });
  });

  useEffect(() => cancelFrame, []);

  return { anchorRef, scrollParent, remember, restoreAfterRender };
}
