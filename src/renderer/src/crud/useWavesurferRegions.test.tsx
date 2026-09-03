import { act, renderHook } from '@testing-library/react';

/**
 * Segment-selection lock spec (TT-7437).
 *
 * While a take is being recorded the selected segment must not move: the take
 * belongs to the segment recording started on. Three engine events can move it
 * and each one is a separate route the user can take from the waveform:
 *
 *   - `region-clicked`  — tapping another segment,
 *   - `region-in`       — the playhead entering another segment after the tap
 *                         seeks it (the click also seeks, so this fires even
 *                         when the click itself was dropped),
 *   - `region-updated`  — dragging a segment boundary.
 *
 * All three land on `onCurrentRegion`, which is what drives
 * PassageDetailContext's currentSegment. So the lock is asserted there rather
 * than on any one handler's internals.
 */

// ---- fake wavesurfer regions plugin -----------------------------------------
type Handler = (...args: any[]) => void;

/** The bits of the regions plugin the hook uses, plus an emit for the tests. */
interface IFakePlugin {
  regionList: any[];
  on(evt: string, cb: Handler): void;
  unAll(): void;
  emit(evt: string, ...args: any[]): void;
  getRegions(): any[];
  addRegion(r: any): any;
  enableDragSelection(): void;
}

// The hook picks its plugin out of ws.getActivePlugins() with
// `instanceof RegionsPlugin`, so the fake has to *be* the mocked class.
jest.mock('wavesurfer.js/dist/plugins/regions', () => {
  class FakeRegionsPlugin {
    handlers: Record<string, Handler[]> = {};
    regionList: any[] = [];

    on(evt: string, cb: Handler) {
      (this.handlers[evt] ||= []).push(cb);
    }
    unAll() {
      this.handlers = {};
    }
    emit(evt: string, ...args: any[]) {
      (this.handlers[evt] ?? []).forEach((cb) => cb(...args));
    }
    getRegions() {
      return this.regionList;
    }
    addRegion(params: any) {
      // wavesurfer hands back a Region, not the params object — the hook
      // immediately calls setOptions on it.
      const r: any = {
        id: `added-${this.regionList.length}`,
        attributes: {},
        ...params,
        setOptions: jest.fn((o: any) => Object.assign(r, o)),
        play: jest.fn(),
        remove: jest.fn(),
      };
      this.regionList.push(r);
      return r;
    }
    enableDragSelection = jest.fn();
  }
  return { __esModule: true, default: FakeRegionsPlugin };
});
jest.mock('wavesurfer.js', () => ({ __esModule: true, default: class {} }));

// imported after the mocks so the hook picks them up
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';
import { useWaveSurferRegions } from './useWavesurferRegions';

const newPlugin = () =>
  new (RegionsPlugin as unknown as new () => IFakePlugin)();

const makeRegion = (id: string, start: number, end: number) => {
  const r: any = {
    id,
    start,
    end,
    color: '',
    drag: false,
    resize: false,
    content: undefined,
    element: undefined,
    attributes: {},
    setOptions: jest.fn((opts: any) => Object.assign(r, opts)),
    play: jest.fn(),
    remove: jest.fn(),
  };
  return r;
};

const DURATION = 30;

interface IHarnessOpts {
  lockSegmentSelection: boolean;
  /** Playhead position. A split happens at the playhead, so the double-click
   *  tests need one that is inside a segment rather than on its edge. */
  progressAt?: number;
  /** Sorted indices of segments that already have a recording. A boundary
   *  between a recorded segment and its neighbor may not be dragged (TT-7666). */
  recordedIndices?: number[];
  /** Supply a color function so `applyRegionColors` runs its body (it is a
   *  no-op without one) — needed to exercise the recorded-resize pass. */
  withColors?: boolean;
}

const renderRegions = ({
  lockSegmentSelection,
  progressAt = 0,
  recordedIndices = [],
  withColors = false,
}: IHarnessOpts) => {
  const plugin = newPlugin();
  // three contiguous segments, linked the way setPrevNext links them
  const segs = [
    makeRegion('r0', 0, 10),
    makeRegion('r1', 10, 20),
    makeRegion('r2', 20, 30),
  ];
  segs.forEach((r, i) => {
    r.attributes.prevRegion = segs[i - 1];
    r.attributes.nextRegion = segs[i + 1];
  });
  plugin.regionList = segs;

  const ws: any = {
    getActivePlugins: () => [plugin],
    on: jest.fn(),
    un: jest.fn(),
    play: jest.fn(),
    getCurrentTime: () => 0,
  };

  const onCurrentRegion = jest.fn();
  const onRegionClicked = jest.fn();
  const goto = jest.fn();
  const onRegion = jest.fn();
  const setPlaying = jest.fn();
  const isSegmentRecorded = jest.fn((index: number) =>
    recordedIndices.includes(index)
  );

  const { result } = renderHook(() =>
    useWaveSurferRegions(
      false, // singleRegionOnly — Careful Speech is multi-region
      0,
      ws,
      { current: undefined },
      onRegion,
      () => DURATION,
      () => false,
      goto,
      () => progressAt,
      () => false,
      setPlaying,
      onCurrentRegion,
      undefined, // onStartRegion
      undefined, // onRegionPlayEnd
      undefined, // onMarkerClick
      undefined, // verses
      undefined, // hasSegmentUndo
      withColors ? () => 'rgba(1, 2, 3, 0.5)' : undefined, // applyRegionColor
      lockSegmentSelection,
      undefined, // getDecodedBuffer
      true, // disableDragSelection
      onRegionClicked,
      isSegmentRecorded
    )
  );

  act(() => {
    result.current.setupRegions(ws);
  });

  return {
    result,
    plugin,
    segs,
    onCurrentRegion,
    onRegionClicked,
    goto,
    setPlaying,
    isSegmentRecorded,
  };
};

// The user taps a segment on the waveform.
const clickSegment = (plugin: IFakePlugin, r: any) =>
  act(() => {
    plugin.emit('region-clicked', r, { stopPropagation: jest.fn() });
  });

// The playhead crosses into a segment (what the tap's seek causes next).
const playheadEnters = (plugin: IFakePlugin, r: any) =>
  act(() => {
    plugin.emit('region-in', r);
  });

// The user drags a segment boundary and lets go. 'region-update' is what tells
// the hook a resize (rather than a whole-region move) is underway.
const dragBoundary = (
  plugin: IFakePlugin,
  r: any,
  side: 'start' | 'end',
  to: number
) =>
  act(() => {
    r.resize = true;
    plugin.emit('region-update', r, side);
    r[side] = to;
    plugin.emit('region-updated', r, side);
  });

describe('useWaveSurferRegions — segment selection unlocked', () => {
  it('a click selects the segment', () => {
    const { plugin, segs, onCurrentRegion, onRegionClicked, goto } =
      renderRegions({ lockSegmentSelection: false });

    clickSegment(plugin, segs[2]);

    expect(onRegionClicked).toHaveBeenCalledWith(
      expect.objectContaining({ start: 20, end: 30 })
    );
    expect(onCurrentRegion).toHaveBeenCalledWith({ start: 20, end: 30 }, 2);
    expect(goto).toHaveBeenCalled();
  });

  it('the playhead entering a segment selects it', () => {
    const { plugin, segs, onCurrentRegion } = renderRegions({
      lockSegmentSelection: false,
    });

    playheadEnters(plugin, segs[1]);

    expect(onCurrentRegion).toHaveBeenCalledWith({ start: 10, end: 20 }, 1);
  });

  it('dragging a boundary reports the resized segment', () => {
    const { plugin, segs, onCurrentRegion } = renderRegions({
      lockSegmentSelection: false,
    });

    dragBoundary(plugin, segs[1], 'end', 22);

    expect(onCurrentRegion).toHaveBeenCalledWith(
      expect.objectContaining({ start: 10 }),
      1
    );
  });

  it('double-clicking splits the segment', () => {
    const { plugin, segs } = renderRegions({
      lockSegmentSelection: false,
      progressAt: 15,
    });
    const before = plugin.regionList.length;

    act(() => {
      plugin.emit('region-double-clicked', segs[1], {
        stopPropagation: jest.fn(),
      });
    });

    expect(plugin.regionList.length).toBeGreaterThan(before);
  });
});

describe('useWaveSurferRegions — segment selection locked while recording (TT-7437)', () => {
  it('drops a click on another segment', () => {
    const { plugin, segs, onCurrentRegion, onRegionClicked, goto } =
      renderRegions({ lockSegmentSelection: true });

    clickSegment(plugin, segs[2]);

    expect(onRegionClicked).not.toHaveBeenCalled();
    expect(onCurrentRegion).not.toHaveBeenCalled();
    // no seek either: seeking is what makes the playhead enter the segment
    expect(goto).not.toHaveBeenCalled();
  });

  it('does not follow the playhead into another segment', () => {
    // The click above is dropped, but a tap on the waveform also seeks. If the
    // seek lands in another segment, region-in fires with the lock none the
    // wiser — this is the route that kept moving the selection mid-record.
    const { plugin, segs, onCurrentRegion } = renderRegions({
      lockSegmentSelection: true,
    });

    playheadEnters(plugin, segs[2]);

    expect(onCurrentRegion).not.toHaveBeenCalled();
  });

  it('does not move the selection when a boundary is dragged', () => {
    const { plugin, segs, onCurrentRegion } = renderRegions({
      lockSegmentSelection: true,
    });

    dragBoundary(plugin, segs[1], 'end', 22);

    expect(onCurrentRegion).not.toHaveBeenCalled();
  });

  it('leaves the segment bounds alone when a boundary is dragged', () => {
    // Dragging must not silently reshape the segment the take is being
    // recorded into either — the take's start/end are what identify it.
    const { plugin, segs } = renderRegions({ lockSegmentSelection: true });

    dragBoundary(plugin, segs[1], 'end', 22);

    expect(segs[2].start).toBe(20);
    expect(segs[1].setOptions).not.toHaveBeenCalledWith(
      expect.objectContaining({ end: expect.anything() })
    );
  });

  it('does not split a segment on double-click', () => {
    // Double-click splits, which reshapes the segment map exactly as a boundary
    // drag does — the take's own boundaries would move under it.
    const { plugin, segs } = renderRegions({
      lockSegmentSelection: true,
      progressAt: 15,
    });
    const before = plugin.regionList.length;

    act(() => {
      plugin.emit('region-double-clicked', segs[1], {
        stopPropagation: jest.fn(),
      });
    });

    expect(plugin.regionList).toHaveLength(before);
  });

  it('refuses prev/next segment navigation', () => {
    const { result } = renderRegions({ lockSegmentSelection: true });

    expect(result.current.wsPrevRegion()).toBe(false);
    expect(result.current.wsNextRegion()).toBe(false);
  });
});

describe('useWaveSurferRegions — boundary drag on a recorded segment (TT-7666)', () => {
  // A recording is tied to a segment's exact time range, so once a segment has
  // a Phrase BT (or Careful Speech) recording its boundaries are frozen. A
  // boundary is shared by two segments, so a drag is refused when *either*
  // side of it is recorded — this is separate from the recording-in-progress
  // lock: it holds whenever the neighbouring recording exists, recording or
  // not.

  it('refuses to move a recorded segment via its own boundary', () => {
    // Segment 1 is recorded. Dragging its end would resize it.
    const { plugin, segs, onCurrentRegion } = renderRegions({
      lockSegmentSelection: false,
      recordedIndices: [1],
    });

    dragBoundary(plugin, segs[1], 'end', 22);

    // The shared neighbour was not pulled along, and nothing downstream heard a
    // boundary change.
    expect(segs[2].start).toBe(20);
    expect(onCurrentRegion).not.toHaveBeenCalled();
  });

  it('refuses to move a recorded neighbour via the shared boundary', () => {
    // Segment 1 is unrecorded but segment 2 is recorded; dragging segment 1's
    // end drags segment 2's start with it, which would reshape the recording.
    const { plugin, segs, onCurrentRegion } = renderRegions({
      lockSegmentSelection: false,
      recordedIndices: [2],
    });

    dragBoundary(plugin, segs[1], 'end', 22);

    expect(segs[2].start).toBe(20);
    expect(onCurrentRegion).not.toHaveBeenCalled();
  });

  it('refuses a start-side drag that would reshape a recorded neighbour', () => {
    // Segment 0 is recorded; segment 1's start is its shared boundary.
    const { plugin, segs, onCurrentRegion } = renderRegions({
      lockSegmentSelection: false,
      recordedIndices: [0],
    });

    dragBoundary(plugin, segs[1], 'start', 8);

    expect(segs[0].end).toBe(10);
    expect(onCurrentRegion).not.toHaveBeenCalled();
  });

  it('still allows dragging a boundary between two unrecorded segments', () => {
    // Segment 2 is recorded, but segment 1's *start* boundary is shared with
    // segment 0 — both unrecorded — so it must stay draggable. The lock is
    // per-boundary, not "any recording nearby freezes everything".
    const { plugin, segs, onCurrentRegion } = renderRegions({
      lockSegmentSelection: false,
      recordedIndices: [2],
    });

    dragBoundary(plugin, segs[1], 'start', 8);

    expect(onCurrentRegion).toHaveBeenCalledWith(
      expect.objectContaining({ start: 8 }),
      1
    );
  });

  it('freezes a recorded segment but keeps its boundary handles visible', () => {
    // The handle is the only clear marker of where a segment ends, so it stays
    // rendered (resize: true) — but both edges are turned off so it cannot be
    // dragged (TT-7666).
    const { segs } = renderRegions({
      lockSegmentSelection: false,
      recordedIndices: [1],
    });

    expect(segs[1].setOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        resize: true,
        resizeStart: false,
        resizeEnd: false,
      })
    );
  });

  it('freezes only the shared side of an unrecorded neighbour', () => {
    // Segment 1 is recorded; its neighbours keep their far edge draggable but
    // freeze the edge shared with it.
    const { segs } = renderRegions({
      lockSegmentSelection: false,
      recordedIndices: [1],
    });

    // segment 0: start is the track edge (free), end is shared with 1 (frozen)
    expect(segs[0].setOptions).toHaveBeenCalledWith(
      expect.objectContaining({ resizeStart: true, resizeEnd: false })
    );
    // segment 2: start shared with 1 (frozen), end is the track edge (free)
    expect(segs[2].setOptions).toHaveBeenCalledWith(
      expect.objectContaining({ resizeStart: false, resizeEnd: true })
    );
  });

  it('does not re-enable handles on a color pass while recording is locked', () => {
    // The recording-in-progress lock (TT-7437) takes every region's handles
    // away. The recorded-resize pass runs on every color update and must not
    // hand a handle back to an unrecorded segment while that lock holds, or the
    // user could resize mid-record.
    const { result, segs } = renderRegions({
      lockSegmentSelection: true,
      recordedIndices: [1],
      withColors: true,
    });
    segs.forEach((s) => s.setOptions.mockClear());

    act(() => {
      result.current.applyRegionColors();
    });

    // segment 0 is unrecorded, but the lock is up: it must not be re-enabled.
    expect(segs[0].setOptions).not.toHaveBeenCalledWith(
      expect.objectContaining({ resize: true })
    );
  });
});

describe('useWaveSurferRegions — the +/- controls on a recorded segment (TT-7666)', () => {
  // The Add (+) button splits the segment under the playhead; Remove (-) merges
  // the current segment with a neighbour. Neither may touch a recorded segment,
  // and a refused click must be inert — no divider added or removed, and the
  // playhead left where it was.

  it('adds a divider inside an unrecorded segment (control)', () => {
    const { result, plugin, goto } = renderRegions({
      lockSegmentSelection: false,
      progressAt: 15, // inside segment 1
    });
    const before = plugin.regionList.length;

    let ret: unknown;
    act(() => {
      ret = result.current.wsAddRegion();
    });

    expect(ret).toBeDefined();
    expect(plugin.regionList.length).toBe(before + 1);
    expect(goto).toHaveBeenCalled();
  });

  it('Add does nothing inside a recorded segment', () => {
    const { result, plugin, goto } = renderRegions({
      lockSegmentSelection: false,
      progressAt: 15, // inside segment 1, which is recorded
      recordedIndices: [1],
    });
    const before = plugin.regionList.length;

    let ret: unknown;
    act(() => {
      ret = result.current.wsAddRegion();
    });

    expect(ret).toBeUndefined();
    expect(plugin.regionList.length).toBe(before); // no divider added
    expect(goto).not.toHaveBeenCalled(); // playhead not moved
  });

  it('Remove merges two unrecorded segments (control)', () => {
    const { result, plugin, segs } = renderRegions({
      lockSegmentSelection: false,
      progressAt: 10,
    });
    playheadEnters(plugin, segs[1]); // current segment = 1

    let ret: unknown;
    act(() => {
      ret = result.current.wsRemoveSplitRegion();
    });

    expect(ret).toBeDefined();
    expect(segs[2].remove).toHaveBeenCalled(); // merged the next segment away
  });

  it('Remove does nothing when the current segment is recorded', () => {
    const { result, plugin, segs, goto } = renderRegions({
      lockSegmentSelection: false,
      progressAt: 10,
      recordedIndices: [1],
    });
    playheadEnters(plugin, segs[1]);
    goto.mockClear();

    let ret: unknown;
    act(() => {
      ret = result.current.wsRemoveSplitRegion();
    });

    expect(ret).toBeUndefined();
    expect(segs[2].remove).not.toHaveBeenCalled(); // no divider removed
    expect(goto).not.toHaveBeenCalled(); // playhead not moved
  });

  it('Remove does nothing when the neighbour it would merge is recorded', () => {
    const { result, plugin, segs } = renderRegions({
      lockSegmentSelection: false,
      progressAt: 10,
      recordedIndices: [2], // the next segment carries the recording
    });
    playheadEnters(plugin, segs[1]);

    let ret: unknown;
    act(() => {
      ret = result.current.wsRemoveSplitRegion();
    });

    expect(ret).toBeUndefined();
    expect(segs[2].remove).not.toHaveBeenCalled();
  });
});
