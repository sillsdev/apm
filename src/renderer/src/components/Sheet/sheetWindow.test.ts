import {
  clipTopForCurTop,
  curTopFromViewport,
  isSheetScrollTarget,
  overflowScrollParent,
  overscanOf,
  pageSizeForView,
  scrollTopFloorForPad,
  sheetWindow,
  visibleClipTop,
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

const mockRect = (el: HTMLElement, top: number, height: number) => {
  el.getBoundingClientRect = () =>
    ({
      top,
      bottom: top + height,
      left: 0,
      right: 100,
      width: 100,
      height,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;
};

const overflowBox = (scrollHeight: number, clientHeight: number) => {
  const el = document.createElement('div');
  el.style.overflowY = 'auto';
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight });
  Object.defineProperty(el, 'clientHeight', { value: clientHeight });
  return el;
};

describe('visibleClipTop vs overflowScrollParent', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('uses AppLayout clip when the inner sheet scroller also overflows', () => {
    const outer = overflowBox(2000, 500);
    const inner = overflowBox(1500, 400);
    outer.appendChild(inner);
    document.body.appendChild(outer);
    mockRect(outer, 64, 500);
    mockRect(inner, -80, 400);

    expect(overflowScrollParent(inner)).toBe(inner);
    expect(visibleClipTop(inner)).toBe(64);
  });
});

describe('isSheetScrollTarget', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('accepts the sheet scroller and ancestors that contain it', () => {
    const outer = overflowBox(2000, 500);
    const inner = overflowBox(1500, 400);
    outer.appendChild(inner);
    document.body.appendChild(outer);
    expect(isSheetScrollTarget(inner, inner)).toBe(true);
    expect(isSheetScrollTarget(inner, outer)).toBe(true);
    expect(isSheetScrollTarget(inner, document)).toBe(true);
  });

  it('ignores unrelated overflow (dialogs, menus, other panes)', () => {
    const sheet = overflowBox(1500, 400);
    const dialog = overflowBox(800, 200);
    document.body.appendChild(sheet);
    document.body.appendChild(dialog);
    expect(isSheetScrollTarget(sheet, dialog)).toBe(false);
  });
});

describe('scrollTopFloorForPad', () => {
  it('is 0 when there is no spacer', () => {
    expect(scrollTopFloorForPad(120, 64, 200, 0)).toBe(0);
  });

  it('equals topPad when the clip is the sheet scroller', () => {
    // scrollTop 40, topPad 80 → 40px of spacer still in view
    expect(scrollTopFloorForPad(40, 200, 240, 80)).toBe(80);
  });

  it('adds the sheet offset when the clip is an ancestor', () => {
    // AppLayout scrollTop 10, spacer bottom 200px below clip top (offset + topPad)
    expect(scrollTopFloorForPad(10, 64, 264, 80)).toBe(210);
  });
});
