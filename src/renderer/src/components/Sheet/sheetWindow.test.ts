import {
  curTopFromViewport,
  isSheetScrollTarget,
  overflowScrollParent,
  overscanOf,
  pageSizeForView,
  scrollTopFloorForPad,
  sheetWindow,
  visibleClip,
} from './sheetWindow';

describe('sheetWindow', () => {
  it('keeps a one-row sheet at the header', () => {
    expect(sheetWindow(1, 10, 1)).toEqual({ first: 1, last: 1 });
  });

  it('mounts the first page plus overscan from the top', () => {
    expect(overscanOf(5)).toBe(2);
    expect(sheetWindow(1, 5, 23)).toEqual({ first: 1, last: 8 });
  });

  it('snaps to the last rows when the window reaches the end', () => {
    expect(sheetWindow(20, 5, 23)).toEqual({ first: 16, last: 23 });
  });
});

describe('pageSizeForView', () => {
  it('ceils visible clip height to a whole number of rows', () => {
    expect(pageSizeForView(48, 480)).toBe(10);
    expect(pageSizeForView(48, 700)).toBe(Math.ceil(700 / 48));
  });
});

describe('curTopFromViewport', () => {
  it('advances curTop when rows move above the visible clip', () => {
    expect(curTopFromViewport(200, 200, 1, 48)).toBe(1);
    expect(curTopFromViewport(200, 200 - 48 * 3, 1, 48)).toBe(4);
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

describe('visibleClip / overflowScrollParent', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('uses ancestor clip top when inner and outer both overflow', () => {
    const outer = overflowBox(2000, 500);
    const inner = overflowBox(1500, 400);
    outer.appendChild(inner);
    document.body.appendChild(outer);
    mockRect(outer, 64, 500);
    mockRect(inner, -80, 400);
    expect(overflowScrollParent(inner)).toBe(inner);
    expect(visibleClip(inner, 0, 900).top).toBe(64);
  });

  it('ignores a content-sized pane so growing rows cannot inflate height', () => {
    const outer = overflowBox(2000, 500);
    const inner = overflowBox(2200, 2200);
    outer.appendChild(inner);
    document.body.appendChild(outer);
    mockRect(outer, 64, 500);
    mockRect(inner, 200, 2200);
    expect(visibleClip(inner, 0, 900).height).toBe(64 + 500 - 200);
  });

  it('uses remaining viewport when nothing overflows yet', () => {
    const inner = overflowBox(144, 144);
    document.body.appendChild(inner);
    mockRect(inner, 200, 144);
    expect(visibleClip(inner, 0, 900).height).toBe(700);
  });
});

describe('isSheetScrollTarget', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('accepts the sheet and ancestors, ignores sibling overflow', () => {
    const outer = overflowBox(2000, 500);
    const inner = overflowBox(1500, 400);
    const dialog = overflowBox(800, 200);
    outer.appendChild(inner);
    document.body.append(outer, dialog);
    expect(isSheetScrollTarget(inner, inner)).toBe(true);
    expect(isSheetScrollTarget(inner, outer)).toBe(true);
    expect(isSheetScrollTarget(inner, document)).toBe(true);
    expect(isSheetScrollTarget(inner, dialog)).toBe(false);
  });
});

describe('scrollTopFloorForPad', () => {
  it('is 0 when there is no spacer', () => {
    expect(scrollTopFloorForPad(120, 64, 200, 0)).toBe(0);
  });

  it('equals topPad on the sheet scroller and adds offset on an ancestor', () => {
    expect(scrollTopFloorForPad(40, 200, 240, 80)).toBe(80);
    expect(scrollTopFloorForPad(10, 64, 264, 80)).toBe(210);
  });
});
