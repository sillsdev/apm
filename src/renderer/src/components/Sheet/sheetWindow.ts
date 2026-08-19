export const overscanOf = (pageSize: number) =>
  Math.max(1, Math.floor((pageSize || 1) / 2));

/** Mounted data-row range (absolute indices, header excluded). */
export const sheetWindow = (
  curTop: number,
  pageSize: number,
  dataLen: number
) => {
  if (dataLen <= 1) return { first: 1, last: 1 };
  const n = pageSize || 1;
  const over = overscanOf(n);
  const top = Math.max(curTop, 1);
  let last = Math.min(dataLen, top + n + over);
  let first = Math.max(1, top - over);
  if (last >= dataLen) {
    last = dataLen;
    first = Math.max(1, dataLen - n - over);
  }
  return { first, last };
};

/** Absolute data row at the visible top (header excluded). */
export const curTopFromViewport = (
  clipTop: number,
  firstDataRowTop: number,
  windowFirst: number,
  rh: number
) => Math.max(1, windowFirst + Math.floor((clipTop - firstDataRowTop) / rh));

/**
 * How many rows fit in the visible sheet. If the sheet scroller is sized by
 * its content (no inner overflow), use remaining window space so paste/save
 * cannot lock pageSize to the first short window.
 */
export const pageSizeForView = (
  rowHeight: number,
  clientHeight: number,
  scrollHeight: number,
  scrollerTop: number,
  viewBottom: number
) => {
  if (rowHeight <= 0) return 1;
  const room = Math.max(0, viewBottom - scrollerTop);
  const innerScrolls = scrollHeight > clientHeight + 1;
  const height = innerScrolls ? clientHeight : Math.max(clientHeight, room);
  return Math.max(1, Math.ceil(height / rowHeight));
};

/** Visible top used to map scroll position → curTop. */
export const clipTopForCurTop = (clipTop: number, scrollerTop: number) =>
  Math.max(clipTop, scrollerTop);

const clipsY = (overflowY: string) =>
  overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'hidden';

/**
 * Top of the on-screen intersection of every Y-clipping ancestor (and the
 * viewport). Unlike overflowScrollParent, this does not stop at the innermost
 * overflowing box — AppLayout and the sheet scroller can overflow together.
 */
export const visibleClipTop = (el: HTMLElement | null, viewportTop = 0) => {
  let top = viewportTop;
  let p: HTMLElement | null = el;
  while (p) {
    if (clipsY(getComputedStyle(p).overflowY)) {
      top = Math.max(top, p.getBoundingClientRect().top);
    }
    p = p.parentElement;
  }
  return top;
};

/** Innermost overflowing ancestor — the element to scrollTo, not the visible clip. */
export const overflowScrollParent = (
  el: HTMLElement | null
): HTMLElement | null => {
  let p: HTMLElement | null = el;
  while (p) {
    const oy = getComputedStyle(p).overflowY;
    if (
      (oy === 'auto' || oy === 'scroll') &&
      p.scrollHeight > p.clientHeight + 1
    ) {
      return p;
    }
    p = p.parentElement;
  }
  return null;
};

/** True when `target` is the sheet scroller or an ancestor that can move it. */
export const isSheetScrollTarget = (
  sheetEl: HTMLElement | null,
  target: EventTarget | null
) => {
  if (!sheetEl || target == null) return false;
  if (target === window) return true;
  if (!(target instanceof Node)) return false;
  return target === sheetEl || target.contains(sheetEl);
};

/**
 * Minimum clip.scrollTop so the sheet top spacer stays above the clip viewport.
 * `padHeight === 0` → 0 (no spacer). Otherwise convert pad bottom into the
 * clip's content coordinates so an ancestor scroller is not floored at raw topPad.
 */
export const scrollTopFloorForPad = (
  clipScrollTop: number,
  clipTop: number,
  padBottom: number,
  padHeight: number
) => (padHeight > 0 ? clipScrollTop + (padBottom - clipTop) : 0);
