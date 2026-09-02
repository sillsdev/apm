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
    addRegion(r: any) {
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
}

const renderRegions = ({ lockSegmentSelection }: IHarnessOpts) => {
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
      () => 0,
      () => false,
      setPlaying,
      onCurrentRegion,
      undefined, // onStartRegion
      undefined, // onRegionPlayEnd
      undefined, // onMarkerClick
      undefined, // verses
      undefined, // hasSegmentUndo
      undefined, // applyRegionColor
      lockSegmentSelection,
      undefined, // getDecodedBuffer
      true, // disableDragSelection
      onRegionClicked
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

  it('refuses prev/next segment navigation', () => {
    const { result } = renderRegions({ lockSegmentSelection: true });

    expect(result.current.wsPrevRegion()).toBe(false);
    expect(result.current.wsNextRegion()).toBe(false);
  });
});
