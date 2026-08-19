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
