import { act, renderHook } from '@testing-library/react';

/**
 * Segment lock spec (TT-7437).
 *
 * While recording, selection must stay on the start segment.
 * We verify all paths that can change selection: click, region-in, and drag.
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

// The hook finds plugins with `instanceof RegionsPlugin`, so this fake must be
// that mocked class.
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
      // wavesurfer returns a Region object and the hook calls setOptions on it.
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
  /** Playhead position used by split tests. */
  progressAt?: number;
  /** Sorted indices of recorded segments (TT-7666). */
  recordedIndices?: number[];
  /** Provide a color function so applyRegionColors runs. */
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

  // Props threaded through renderHook so a rerender models the real reactivity:
  // a fresh isSegmentRecorded identity (when recordings change) and a new lock
  // value both re-run the hook's effects.
  const { result, rerender } = renderHook(
    ({ lock, recorded }: { lock: boolean; recorded: number[] }) =>
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
        lock,
        undefined, // getDecodedBuffer
        true, // disableDragSelection
        onRegionClicked,
        (index: number) => recorded.includes(index)
      ),
    {
      initialProps: {
        lock: lockSegmentSelection,
        recorded: recordedIndices,
      },
    }
  );

  act(() => {
    result.current.setupRegions(ws);
  });

  /** Re-run the hook with a changed lock and/or recorded set. */
  const update = (next: { lock?: boolean; recorded?: number[] }) =>
    act(() => {
      rerender({
        lock: next.lock ?? lockSegmentSelection,
        recorded: next.recorded ?? recordedIndices,
      });
    });

  return {
    result,
    plugin,
    segs,
    onCurrentRegion,
    onRegionClicked,
    goto,
    setPlaying,
    update,
  };
};

// The user taps a segment on the waveform.
const clickSegment = (plugin: IFakePlugin, r: any) =>
  act(() => {
    plugin.emit('region-clicked', r, { stopPropagation: jest.fn() });
  });

// Playhead enters a segment (for example, after a tap seeks).
const playheadEnters = (plugin: IFakePlugin, r: any) =>
  act(() => {
    plugin.emit('region-in', r);
  });

// Drag a segment boundary and finish the drag.
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
    // A tap can still seek and emit region-in. Lock must block that path too.
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
    // Dragging must not reshape the active take's segment.
    const { plugin, segs } = renderRegions({ lockSegmentSelection: true });

    dragBoundary(plugin, segs[1], 'end', 22);

    expect(segs[2].start).toBe(20);
    expect(segs[1].setOptions).not.toHaveBeenCalledWith(
      expect.objectContaining({ end: expect.anything() })
    );
  });

  it('does not split a segment on double-click', () => {
    // Double-click split also changes boundaries, so it must be blocked.
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

  it('refuses Add while recording, before the take is saved', () => {
    // The in-progress segment is not yet in the recorded set, so only the lock
    // stops +/- from splitting the take mid-record (TT-7437).
    const { result, plugin, goto } = renderRegions({
      lockSegmentSelection: true,
      progressAt: 15, // inside segment 1
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

  it('keeps the boundary handles visible while locked', () => {
    // Handles are the only marker of where a segment ends; the lock must never
    // remove them (it disables the drag per side instead).
    const { segs } = renderRegions({
      lockSegmentSelection: true,
      withColors: true,
    });

    segs.forEach((s) => {
      expect(s.setOptions).not.toHaveBeenCalledWith(
        expect.objectContaining({ resize: false })
      );
    });
  });

  it('freezes both sides of every segment while locked', () => {
    const { segs } = renderRegions({
      lockSegmentSelection: true,
      withColors: true,
    });

    // A middle segment: both edges inert during the lock.
    expect(segs[1].setOptions).toHaveBeenCalledWith(
      expect.objectContaining({ resizeStart: false, resizeEnd: false })
    );
  });
});

describe('useWaveSurferRegions — boundary drag on a recorded segment (TT-7666)', () => {
  // Recorded boundaries are frozen (TT-7666). Since a boundary is shared,
  // drag is blocked when either neighboring segment is recorded.

  it('refuses to move a recorded segment via its own boundary', () => {
    // Segment 1 is recorded. Dragging its end would resize it.
    const { plugin, segs, onCurrentRegion } = renderRegions({
      lockSegmentSelection: false,
      recordedIndices: [1],
    });

    dragBoundary(plugin, segs[1], 'end', 22);

    // Neighbor stays unchanged and no update is emitted.
    expect(segs[2].start).toBe(20);
    expect(onCurrentRegion).not.toHaveBeenCalled();
  });

  it('refuses to move a recorded neighbour via the shared boundary', () => {
    // Dragging this edge would also move recorded segment 2, so block it.
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
    // This boundary is between unrecorded segments, so it stays draggable.
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
    // Keep the handle visible, but disable dragging on both sides (TT-7666).
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

  it('does not make an unrecorded segment draggable on a color pass while locked', () => {
    // The lock forbids dragging every segment. A color update must not re-arm a
    // side — but it must still leave the handles visible (resize stays true).
    const { result, segs } = renderRegions({
      lockSegmentSelection: true,
      recordedIndices: [1],
      withColors: true,
    });
    segs.forEach((s) => s.setOptions.mockClear());

    act(() => {
      result.current.applyRegionColors();
    });

    // Segment 0 is unrecorded, but the lock keeps both its edges inert.
    expect(segs[0].setOptions).not.toHaveBeenCalledWith(
      expect.objectContaining({ resizeStart: true })
    );
    expect(segs[0].setOptions).not.toHaveBeenCalledWith(
      expect.objectContaining({ resizeEnd: true })
    );
    // ...and never removes the handle.
    expect(segs[0].setOptions).not.toHaveBeenCalledWith(
      expect.objectContaining({ resize: false })
    );
  });

  it('re-enables a boundary when its recording is removed', () => {
    // Consistency + the delete case: once the take is gone, the segment's edges
    // come back — the same way Combine/Split re-enable.
    const { segs, update } = renderRegions({
      lockSegmentSelection: false,
      recordedIndices: [1],
      withColors: true,
    });
    segs.forEach((s) => s.setOptions.mockClear());

    update({ recorded: [] }); // recording deleted

    expect(segs[1].setOptions).toHaveBeenCalledWith(
      expect.objectContaining({ resizeStart: true, resizeEnd: true })
    );
  });
});

describe('useWaveSurferRegions — the +/- controls on a recorded segment (TT-7666)', () => {
  // Add splits and Remove merges. Neither may modify recorded segments.
  // Blocked actions should do nothing.

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
