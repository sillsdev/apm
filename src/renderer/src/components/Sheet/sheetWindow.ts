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

export const curTopFromViewport = (
  clipTop: number,
  firstDataRowTop: number,
  windowFirst: number,
  rh: number
) => Math.max(1, windowFirst + Math.floor((clipTop - firstDataRowTop) / rh));

export const pageSizeForView = (rowHeight: number, clipHeight: number) =>
  rowHeight <= 0
    ? 1
    : Math.max(1, Math.ceil(Math.max(0, clipHeight) / rowHeight));

const clipsY = (oy: string) =>
  oy === 'auto' || oy === 'scroll' || oy === 'hidden';

const overflowsY = (el: HTMLElement) => el.scrollHeight > el.clientHeight + 1;

/** Visible clip: top from every Y-clip; height from overflowing scrollers only. */
export const visibleClip = (
  el: HTMLElement | null,
  viewportTop = 0,
  viewportBottom = 0
) => {
  let top = viewportTop;
  let bottom = viewportBottom;
  for (let p = el; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if (!clipsY(oy)) continue;
    const r = p.getBoundingClientRect();
    top = Math.max(top, r.top);
    if ((oy === 'auto' || oy === 'scroll') && overflowsY(p)) {
      bottom = Math.min(bottom, r.bottom);
    }
  }
  return { top, height: Math.max(0, bottom - top) };
};

/** Innermost overflowing ancestor (scroll target), else null. */
export const overflowScrollParent = (el: HTMLElement | null) => {
  for (let p = el; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && overflowsY(p)) return p;
  }
  return null;
};

export const isSheetScrollTarget = (
  sheetEl: HTMLElement | null,
  target: EventTarget | null
) => {
  if (!sheetEl || target == null) return false;
  if (target === window) return true;
  if (!(target instanceof Node)) return false;
  return target === sheetEl || target.contains(sheetEl);
};

/** Min clip.scrollTop so the sheet spacer stays above the clip viewport. */
export const scrollTopFloorForPad = (
  clipScrollTop: number,
  clipTop: number,
  padBottom: number,
  padHeight: number
) => (padHeight > 0 ? clipScrollTop + (padBottom - clipTop) : 0);
