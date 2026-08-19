import {
  clipTopForCurTop,
  curTopFromViewport,
  overscanOf,
  pageSizeForView,
  sheetWindow,
} from './sheetWindow';

describe('sheetWindow', () => {
  it('keeps a one-row sheet at the header', () => {
    expect(sheetWindow(1, 10, 1)).toEqual({ first: 1, last: 1 });
  });

  it('mounts the first page plus overscan from the top', () => {
    // pageSize 5 → overscan 2; last = 1+5+2 = 8
    expect(overscanOf(5)).toBe(2);
    expect(sheetWindow(1, 5, 23)).toEqual({ first: 1, last: 8 });
  });

  it('snaps to the last rows when the window reaches the end', () => {
    expect(sheetWindow(20, 5, 23)).toEqual({ first: 16, last: 23 });
  });
});

describe('pageSizeForView', () => {
  it('uses the inner scroller height when that scroller overflows', () => {
    expect(pageSizeForView(48, 480, 1200, 200, 900)).toBe(10);
  });

  it('uses remaining window space when the scroller is sized by short content', () => {
    // First paint after paste: a few rows, no inner overflow, lots of unused viewport.
    expect(pageSizeForView(48, 144, 144, 200, 900)).toBe(
      Math.ceil((900 - 200) / 48)
    );
  });
});

describe('curTopFromViewport', () => {
  it('advances curTop when rows move above the visible clip (page or inner scroll)', () => {
    expect(curTopFromViewport(200, 200, 1, 48)).toBe(1);
    expect(curTopFromViewport(200, 200 - 48 * 3, 1, 48)).toBe(4);
  });

  it('uses the clip when the sheet itself has scrolled up the page', () => {
    expect(clipTopForCurTop(180, 40)).toBe(180);
    expect(clipTopForCurTop(180, 220)).toBe(220);
  });
});
