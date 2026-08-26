import { useEffect, useRef } from 'react';
import { waitForIt } from '../utils/waitForIt';
import { findClauseSplitPoint } from '../utils/clauseSplitSilence';
import { clampSharedBoundary } from '../utils/sharedSegmentBoundary';
import RegionsPlugin, {
  Region,
  RegionParams,
  UpdateSide,
} from 'wavesurfer.js/dist/plugins/regions';
import WaveSurfer from 'wavesurfer.js';
import { IMarker } from './useWaveSurfer';
import { waveformPeaks } from './waveformPeaks';
import {
  extractSilenceRegions,
  segmentPeakCount,
} from './extractSilenceRegions';
import { useTheme } from '@mui/material';

export type RegionColorRole = 'base' | 'current' | 'new';

export type ApplyRegionColor = (
  role: RegionColorRole,
  regionIndex: number,
  regionCount: number
) => string;

export interface IRegionChange {
  start: number;
  end: number;
  newStart: number;
  newEnd: number;
}
export interface IRegionParams {
  silenceThreshold: number;
  timeThreshold: number;
  segLenThreshold: number;
}
export interface IRegion {
  start: number;
  end: number;
  label?: string;
}
export interface IRegions {
  params: IRegionParams;
  regions: IRegion[];
}
export interface INamedRegion {
  name: string;
  regionInfo: IRegions;
}
export const parseRegionParams = (
  regionstr: string,
  defaultParams: IRegionParams | undefined
) => {
  if (!regionstr) return defaultParams;
  const segs = JSON.parse(regionstr);
  if (segs.params) {
    if (segs.params.timeThreshold) return segs.params;
  }
  return defaultParams;
};

export const parseRegions = (regionstr: string) => {
  if (!regionstr) return { params: {}, regions: [] as IRegion[] } as IRegions;
  const segs = JSON.parse(regionstr);
  if (segs.regions) {
    if (typeof segs.regions == 'string' || segs.regions instanceof String)
      segs.regions = JSON.parse(segs.regions);
  } else segs.regions = [];
  segs.regions.sort((a: IRegion, b: IRegion) => a.start - b.start);
  return segs as IRegions;
};

// fixed peach shades cycle
const segmentPalette = [
  [255, 224, 200],
  [255, 190, 145],
  [245, 155, 110],
  [255, 210, 175],
  [235, 140, 100],
  [255, 200, 160],
  [240, 170, 125],
  [255, 175, 130],
  [230, 150, 115],
  [255, 230, 210],
];

export const getSegmentRegionColor = (index: number, alpha: number = 0.28) => {
  const [red, green, blue] = segmentPalette[index % segmentPalette.length];
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const withRegionColorAlpha = (color: string, alpha: number) => {
  const match = color.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)/
  );
  if (!match) return color;
  return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
};
export function useWaveSurferRegions(
  singleRegionOnly: boolean,
  defaultRegionIndex: number,
  ws: WaveSurfer | null,
  container: any,
  onRegion: (count: number, newRegion: boolean) => void,
  duration: () => number,
  isNear: (test: number) => boolean,
  goto: (
    position: number,
    keepPlayRegion?: boolean,
    targetRegion?: IRegion
  ) => void,
  progress: () => number,
  isPlaying: () => boolean,
  setPlaying: (playing: boolean) => void,
  onCurrentRegion?: (
    currentRegion: IRegion | undefined,
    index?: number
  ) => void,
  onStartRegion?: (start: number) => void,
  onRegionPlayEnd?: (region: IRegion) => void,
  onMarkerClick?: (time: number) => void,
  verses?: string,
  hasSegmentUndo?: boolean,
  applyRegionColor?: ApplyRegionColor,
  lockSegmentSelection?: boolean,
  getDecodedBuffer?: () => AudioBuffer | undefined,
  /**
   * A region was clicked. Distinct from onCurrentRegion, which also fires for
   * playhead-driven selection: only a deliberate user click reaches this.
   */
  onRegionClicked?: (region: IRegion) => void
) {
  const theme = useTheme();
  const wsRef = useRef<WaveSurfer | null>(ws);
  const regionsRef = useRef<RegionsPlugin | undefined>(undefined);
  const singleRegionRef = useRef(singleRegionOnly);
  const currentRegionRef = useRef<Region | undefined>(undefined);
  const playRegionRef = useRef<Region | undefined>(undefined);
  const loopingRegionRef = useRef<Region | undefined>(undefined);
  const loopingRef = useRef(false);
  const updatingRef = useRef(false);
  const resizingRef = useRef(false);
  const loadingRef = useRef(false);
  const destroyingRef = useRef(false);
  const paramsRef = useRef<IRegionParams | undefined>(undefined);
  const lastClickTimeRef = useRef<number>(0);
  const lastClickedRegionRef = useRef<string>(''); //for both clicks and double clicks
  const lastDoubleClickTimeRef = useRef<number>(0);
  const currentRegionOriginalColorRef = useRef<string>(''); // Store the original color of the current region
  const hasSegmentUndoRef = useRef<boolean | undefined>(hasSegmentUndo);
  const applyRegionColorRef = useRef<ApplyRegionColor | undefined>(
    applyRegionColor
  );
  const lockSegmentSelectionRef = useRef(lockSegmentSelection ?? false);
  const regionBeforeClickRef = useRef<Region | undefined>(undefined);
  const playTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  /** Suppress region-in while the playhead is moved programmatically (table row click). */
  const programmaticSeekRef = useRef(false);
  const pendingSplitRightRegionRef = useRef<Region | undefined>(undefined);
  /** ID of a region that was just truncated by a split — its region-out should
   *  not stop playback or trigger a seek-back, so audio continues into the new
   *  right-side region. Cleared after the first region-out matches it. */
  const splitTruncatedIdRef = useRef<string | undefined>(undefined);
  /** Time of a recent split that happened during playback. Any region-out
   *  whose end matches this time (within tolerance) should be ignored, since
   *  segment autosave can re-create the truncated region with a new ID — we
   *  can't track that by ID alone. Cleared after a short window. */
  const splitTruncatedEndRef = useRef<number | undefined>(undefined);
  const splitTruncatedEndTimerRef = useRef<NodeJS.Timeout | undefined>(
    undefined
  );

  // Store finish handler reference for cleanup
  const finishHandlerRef = useRef<(() => void) | undefined>(undefined);

  const CLICK_DEBOUNCE_MS = 100; // Minimum time between clicks
  const CURRENT_REGION_BORDER = (theme.palette as any).custom.currentRegion;

  useEffect(() => {
    applyRegionColorRef.current = applyRegionColor;
  }, [applyRegionColor]);

  useEffect(() => {
    lockSegmentSelectionRef.current = lockSegmentSelection ?? false;
  }, [lockSegmentSelection]);

  const regionColor = (
    role: RegionColorRole,
    regionIndex: number,
    regionCount: number
  ) => {
    const apply = applyRegionColorRef.current;
    if (apply) return apply(role, regionIndex, regionCount);
    if (role === 'current') {
      return withRegionColorAlpha(getSegmentRegionColor(regionIndex), 0.48);
    }
    return getSegmentRegionColor(regionIndex);
  };

  const defaultNewRegionColor = () => {
    const apply = applyRegionColorRef.current;
    if (apply) return apply('new', 0, numRegions());
    return getSegmentRegionColor(0);
  };

  const sortedRegions = () => [...regions()].sort((a, b) => a.start - b.start);

  const regionIndexInSorted = (r: Region) =>
    sortedRegions().findIndex((x) => x.id === r.id);

  const applyStatusRegionColors = () => {
    const apply = applyRegionColorRef.current;
    if (!apply) return;
    const sorted = sortedRegions();
    sorted.forEach((r, index) => {
      const base = apply('base', index, sorted.length);
      if (currentRegionRef.current?.id === r.id) {
        currentRegionOriginalColorRef.current = base;
        r.setOptions({ color: apply('current', index, sorted.length) });
      } else {
        r.setOptions({ color: base });
      }
    });
  };

  const Regions = () => regionsRef.current;
  const regions = () =>
    Regions()
      ?.getRegions()
      .filter((reg) => reg.start !== reg.end) ?? ([] as Region[]);
  const markers = () =>
    Regions()
      ?.getRegions()
      .filter((reg) => reg.start === reg.end) ?? ([] as Region[]);
  const region = (id: string) => regions().find((x) => x.id === id);
  const numRegions = () => regions().length;
  const currentRegion = () => {
    return currentRegionRef.current;
  };
  const isMarker = (r: any) => r.start === r.end;

  useEffect(() => {
    singleRegionRef.current = singleRegionOnly;
  }, [singleRegionOnly]);

  useEffect(() => {
    hasSegmentUndoRef.current = hasSegmentUndo;
  }, [hasSegmentUndo]);

  useEffect(() => {
    const el = container?.current;
    if (!el) return;

    const handlePointerDown = () => {
      regionBeforeClickRef.current = currentRegionRef.current;
    };

    el.addEventListener('pointerdown', handlePointerDown);
    return () => {
      el.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [container]);

  // Helper to get current time - only called from event handlers, not during render
  const getCurrentTime = () => Date.now();

  // handle region clicks with deduplication
  // This is an event handler, not a render function, so Date.now() is safe here
  const handleRegionClick = (r: Region, e: Event) => {
    if (lockSegmentSelectionRef.current) return;
    const currentTime = getCurrentTime();
    const timeSinceLastClick = currentTime - lastClickTimeRef.current;
    const isSameRegion = lastClickedRegionRef.current === r.id;
    const regionBeforeClick =
      regionBeforeClickRef.current ?? currentRegionRef.current;
    const wasCurrentRegion = regionBeforeClick?.id === r.id;

    // Prevent duplicate clicks within debounce time if it's the same region
    if (timeSinceLastClick < CLICK_DEBOUNCE_MS && isSameRegion) {
      return;
    }
    lastClickTimeRef.current = currentTime;
    lastClickedRegionRef.current = r.id;

    // Process the click
    if (isMarker(r)) {
      onMarkerClick && onMarkerClick(r.start);
    } else {
      setCurrentRegion(r);
      if (!wasCurrentRegion) {
        // Only a click that actually changes the selection counts as deliberate
        // navigation. Clicking the already-current region is a no-op that must
        // not disarm a pending overshoot swallow (see onRegionClicked consumers).
        onRegionClicked?.({
          start: r.start,
          end: r.end,
          label: r.content?.textContent || '',
        });
        goto(r.start, false, { start: r.start, end: r.end });
        e.stopPropagation();
      }
    }
  };

  // handle region double-clicks with deduplication
  // This is an event handler, not a render function, so Date.now() is safe here
  const handleRegionDoubleClick = (r: Region) => {
    const currentTime = getCurrentTime();
    const timeSinceLastDoubleClick =
      currentTime - lastDoubleClickTimeRef.current;
    const isSameRegion = lastClickedRegionRef.current === r.id;

    // Prevent duplicate double-clicks within debounce time or if it's the same region
    if (timeSinceLastDoubleClick < CLICK_DEBOUNCE_MS && isSameRegion) {
      return;
    }
    lastDoubleClickTimeRef.current = currentTime;

    // Process the double-click
    if (!singleRegionRef.current) {
      wsAddRegion();
    }
  };
  const isAtEnd = (position: number) => {
    return Math.abs(position - duration()) < 0.3;
  };

  const setCurrentRegion = (r: Region | undefined) => {
    if (r && isMarker(r)) return;
    if (r !== currentRegionRef.current) {
      // Reset previous current region to its original color and remove border
      if (currentRegionRef.current) {
        if (applyRegionColorRef.current) {
          const sorted = sortedRegions();
          const prevIdx = regionIndexInSorted(currentRegionRef.current);
          currentRegionRef.current.setOptions({
            color: regionColor('base', prevIdx, sorted.length),
          });
        } else if (currentRegionOriginalColorRef.current) {
          currentRegionRef.current.setOptions({
            color: currentRegionOriginalColorRef.current,
          });
        }
        if (!singleRegionRef.current)
          setRegionEndBorderColor(currentRegionRef.current, undefined);
      }

      // Set new current region color and remember its current color
      if (r) {
        if (applyRegionColorRef.current) {
          const sorted = sortedRegions();
          const idx = regionIndexInSorted(r);
          currentRegionOriginalColorRef.current = regionColor(
            'base',
            idx,
            sorted.length
          );
          r.setOptions({ color: regionColor('current', idx, sorted.length) });
        } else {
          currentRegionOriginalColorRef.current =
            r.color || getSegmentRegionColor(0);
          r.setOptions({
            color: withRegionColorAlpha(
              currentRegionOriginalColorRef.current,
              0.48
            ),
          });
        }
        if (
          !singleRegionRef.current &&
          (!isAtEnd(r.end) || numRegions() === 1)
        ) {
          setRegionEndBorderColor(r, CURRENT_REGION_BORDER);
        }
      } else {
        currentRegionOriginalColorRef.current = '';
      }
      loopingRegionRef.current = r;
      currentRegionRef.current = r;

      // Emit the region's *sorted index* alongside its bounds so downstream
      // consumers (currentSegmentIndex, the Mark Verses table) can trust the
      // waveform's exact selection instead of re-deriving it from time ranges.
      onCurrentRegion &&
        onCurrentRegion(
          r ? { start: r.start, end: r.end } : undefined,
          r ? regionIndexInSorted(r) : undefined
        );
    }
  };

  const findNextRegion = (r: Region, selfIfAtStart: boolean) => {
    if (!r) return undefined;
    if (selfIfAtStart && (numRegions() === 1 || isNear(r.start))) return r;
    return (r as any).attributes?.nextRegion;
  };
  const playRegion = (r: Region) => {
    playRegionRef.current = r;
    if (wsRef.current) {
      wsRef.current.play(r.start, r.end);
    } else {
      r.play();
    }
  };
  const wsPlayRegion = (r: IRegion, startAtCurrent: boolean = false) => {
    // updatingRef suppresses the shared-boundary clamp while *we* are moving
    // region bounds; it must be released on every exit path. Players with
    // forceRegionOnly (Phrase Back Translate, Careful Speech) route every play
    // through here, so a latched flag left the clamp off for the rest of the
    // session and dragged boundaries overlapped or disconnected (TT-7625).
    updatingRef.current = true;
    try {
      let reg = findRegion(r.start, true);
      if (!reg) reg = findRegionByIRegion(r);
      if (!reg) return false;
      // region-out uses this to snap back and fire onRegionPlayEnd (CarefulSpeech, prev/next)
      playRegionRef.current = reg;
      const currentTime = ws?.getCurrentTime() ?? progress();
      const inRegion = isInRegion(reg, currentTime);
      if (!inRegion) goto(r.start, true);
      if (wsRef.current) {
        if (startAtCurrent && inRegion) {
          wsRef.current.play(currentTime, reg.end);
        } else {
          wsRef.current.play(reg.start, reg.end);
        }
      } else {
        playRegion(reg);
      }
      // Sync playing state and UI so parent/effects don't override; region-out
      // uses playRegionRef so snap-back still works.
      playTimeoutRef.current = setTimeout(() => setPlaying(true), 100);
      return true;
    } finally {
      updatingRef.current = false;
    }
  };
  // Cleanup function to remove all event listeners
  const cleanupEventListeners = () => {
    // Remove all Regions event listeners
    Regions()?.unAll();
    // Remove finish handler from Wavesurfer instance
    if (finishHandlerRef.current && wsRef.current) {
      wsRef.current.un('finish', finishHandlerRef.current);
      finishHandlerRef.current = undefined;
    }
  };

  useEffect(() => {
    clearClickProcessingStates();

    return () => {
      cleanupEventListeners();
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
        playTimeoutRef.current = undefined;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    wsRef.current = ws;
  }, [ws]);

  const setupRegions = (ws: WaveSurfer) => {
    const regionsPlugin = ws
      .getActivePlugins()
      .find((p) => p instanceof RegionsPlugin) as RegionsPlugin | undefined;
    if (regionsPlugin) {
      regionsRef.current = regionsPlugin;
    }
    if (ws && regionsPlugin) {
      // Clean up existing listeners before setting up new ones
      destroyingRef.current = false;
      cleanupEventListeners();

      wsRef.current = ws;
      regionsPlugin.on('region-created', function (r: Region) {
        if (isMarker(r)) return;
        r.drag = singleRegionRef.current;

        // Round region start and end to 5 decimal places because the seek uses 5 decimal places
        r.start = roundToFiveDecimals(r.start);
        r.end = roundToFiveDecimals(r.end);
        if (singleRegionRef.current && (currentRegion()?.id ?? '') !== r.id) {
          currentRegion()?.remove();
          goto(r.start);
        }

        if (!loadingRef.current) {
          waitForIt(
            'region created',
            () => region(r.id) !== undefined,
            () => false,
            500
          )
            .then(() => {
              setPrevNext(getSortedIds());
              const pendingRight = pendingSplitRightRegionRef.current;
              if (pendingRight && region(pendingRight.id)) {
                pendingSplitRightRegionRef.current = undefined;
                setCurrentRegion(pendingRight);
              } else {
                setCurrentRegion(
                  singleRegionRef.current ? r : findRegion(progress(), true)
                );
              }
              onRegion(numRegions(), true);
            })
            .catch((reason) => console.log(reason));
        }
      });
      regionsPlugin.on('region-removed', function (r: Region) {
        const ra = r as any;
        if (ra.attributes?.prevRegion)
          ra.attributes.prevRegion.attributes.nextRegion =
            ra.attributes?.nextRegion;
        if (ra.attributes?.nextRegion)
          ra.attributes.nextRegion.attributes.prevRegion =
            ra.attributes?.prevRegion;

        // Drop the selection immediately when this removal is the active region.
        // Otherwise currentRegionRef can keep a dead Region reference across
        // wsRegionDelete → loadDecoded while region-removed used waitForIt with a
        // 1s poll interval, causing races and Delete Region to no-op.
        if (currentRegionRef.current?.id === r.id) {
          currentRegionOriginalColorRef.current = '';
          loopingRegionRef.current = undefined;
          currentRegionRef.current = undefined;
          onCurrentRegion && onCurrentRegion(undefined);
        }

        if (wsRef.current && !loadingRef.current && !destroyingRef.current) {
          queueMicrotask(() => {
            if (destroyingRef.current || !wsRef.current) return;
            onRegion(numRegions(), true);
            if (!currentRegionRef.current) {
              setCurrentRegion(findRegion(progress(), true));
            }
          });
        }
      });
      //was region-updated
      regionsPlugin.on(
        'region-update',
        function (r: Region, side?: UpdateSide) {
          resizingRef.current = r.resize;
          // Live-clamp the boundary as the user drags so regions never visually
          // overlap: the dragged boundary stops at the neighbor's edge and the
          // shared neighbor boundary shifts to follow.
          if (!singleRegionRef.current && r.resize && !updatingRef.current) {
            constrainResizedRegion(r, side);
          }
        }
      );
      regionsPlugin.on(
        'region-updated',
        function (r: Region, side?: UpdateSide) {
          if (singleRegionRef.current) {
            if (!loadingRef.current) {
              waitForIt(
                'region update end',
                () => region(r.id) !== undefined,
                () => false,
                400
              ).then(() => {
                goto(r.start);
              });
            }
          } else if (!updatingRef.current && resizingRef.current) {
            resizingRef.current = false;
            // Finalize the drag with the same clamp used live, then follow the
            // playhead to whichever boundary the user just set.
            const boundary = constrainResizedRegion(r, side);
            if (boundary !== undefined) goto(boundary);
          }
          // Emit the (possibly clamped) final bounds + sorted index so consumers
          // (currentSegmentIndex, the Mark Verses table) track the exact region.
          onCurrentRegion &&
            onCurrentRegion(
              { start: r.start, end: r.end },
              regionIndexInSorted(r)
            );
          onRegion(numRegions(), true);
        }
      );
      // other potentially useful messages
      // ws.on('region-play', function (r: any) {
      //   console.log('region-play', r.start, r.loop);
      // });
      regionsPlugin.on('region-in', function (r: Region) {
        if (isMarker(r)) return;
        if (programmaticSeekRef.current) return;
        // When playing a specific region (playRegionRef is set), the audio
        // can overshoot r.end slightly before the region-out handler fires.
        // Ignore region-in for any region other than the one we're targeting so
        // the adjacent segment isn't spuriously selected.
        if (playRegionRef.current && r.id !== playRegionRef.current.id) return;
        // lockSegmentSelection does not apply here — playhead-driven updates must
        // still flow so playback/overshoot logic works; consumers guard effects.
        if (!loopingRef.current) setCurrentRegion(r);
      });
      regionsPlugin.on('region-out', function (r: Region) {
        if (isMarker(r)) return;
        // If this region was just truncated by a split (matched by id, or by
        // end-time within the autosave-replacement window), ignore region-out
        // so playback continues into the new right-side region without
        // stopping or seeking back to the start.
        const matchesTruncatedId = r.id === splitTruncatedIdRef.current;
        const matchesTruncatedEnd =
          splitTruncatedEndRef.current !== undefined &&
          Math.abs(r.end - splitTruncatedEndRef.current) < 0.01;
        if (matchesTruncatedId || matchesTruncatedEnd) {
          if (matchesTruncatedId) splitTruncatedIdRef.current = undefined;
          if (playRegionRef.current?.id === r.id) {
            playRegionRef.current = undefined;
          }
          return;
        }
        //help it in case it forgot -- unless the user clicked out
        //here is where we could add a pause possibly
        if (loopingRef.current) {
          if (r === loopingRegionRef.current && isPlaying()) {
            r.play();
          }
        } else if (playRegionRef.current?.id === r?.id) {
          //we just wanted to play this region
          playRegionRef.current = undefined;
          setPlaying(false);
          // Pass the region as targetRegion so applyRegionAtPosition uses
          // findRegionByIRegion (exact match) instead of findRegion (position-
          // based). This prevents a boundary race where r.start === next.start
          // and the wrong region is selected.
          goto(r.start, false, { start: r.start, end: r.end });
          onRegionPlayEnd?.({
            start: r.start,
            end: r.end,
            label: r.content?.textContent || '',
          });
        }
      });
      regionsPlugin.on('region-clicked', function (r: Region, e: Event) {
        //do NOT stop propagation here or progress doesn't update
        handleRegionClick(r, e);
      });
      regionsPlugin.on('region-double-clicked', function (r: Region, e: Event) {
        e.stopPropagation(); // prevent triggering a dblclick on the waveform
        handleRegionDoubleClick(r);
      });

      const finishHandler = function () {
        if (
          loopingRef.current &&
          currentRegion() === loopingRegionRef.current &&
          isPlaying()
        ) {
          currentRegion()?.play();
        }
      };
      finishHandlerRef.current = finishHandler;
      ws.on('finish', finishHandler);

      // Enable drag selection AFTER all event listeners are set up
      // This ensures the internal listeners set up by enableDragSelection aren't removed
      if (singleRegionRef.current) {
        regionsPlugin.enableDragSelection({
          color: 'rgba(255, 0, 0, 0.1)',
        });
      }
    }
  };

  const isInRegion = (r: Region, value: number) => {
    return value <= r.end && value >= r.start;
  };

  /** Half-open [start, end) except the last segment, which includes its end time. */
  const regionContainsTime = (r: Region, value: number, isLast: boolean) =>
    value >= r.start && (isLast ? value <= r.end : value < r.end);

  const findRegion = (value: number, force: boolean = false) => {
    const sorted = [...regions()].sort((a, b) => a.start - b.start);
    if (!sorted.length) return undefined;

    const current = currentRegion() as Region | undefined;
    if (
      !force &&
      current &&
      regionContainsTime(
        current,
        value,
        sorted[sorted.length - 1]?.id === current.id
      )
    ) {
      return current;
    }

    let foundIt: Region | undefined;
    sorted.forEach((r, index) => {
      if (regionContainsTime(r, value, index === sorted.length - 1)) {
        foundIt = r;
      }
    });
    return foundIt;
  };

  const findRegionByIRegion = (targetRegion: IRegion) => {
    const exact = regions().find(
      (r) =>
        Math.abs(r.start - targetRegion.start) < 0.001 &&
        Math.abs(r.end - targetRegion.end) < 0.001
    );
    if (exact) return exact;
    return regions().find(
      (r) =>
        Math.abs(r.start - targetRegion.start) < 0.6 &&
        Math.abs(r.end - targetRegion.end) < 0.6
    );
  };

  const wsSetRegionColor = (targetRegion: IRegion, color: string) => {
    const region = findRegionByIRegion(targetRegion);
    if (region) {
      region.setOptions({ color });
      return true;
    }
    return false;
  };

  const setRegionEndBorderColor = (
    region: Region,
    color: string | undefined
  ) => {
    if (!region || !region.element) return false;
    if (color) {
      // Apply inline styles directly to the region element
      region.element.style.borderRightWidth = '1px';
      region.element.style.borderRightColor = color;
      region.element.style.borderRightStyle = 'solid';
    } else {
      region.element.style.borderRightWidth = '';
      region.element.style.borderRightColor = '';
      region.element.style.borderRightStyle = '';
    }
    return true;
  };

  const updateRegion = (r: Region, params: any) => {
    updatingRef.current = true;
    r.setOptions(params);
    updatingRef.current = false;
  };

  /**
   * Keep resized regions non-overlapping. In multi-region (Mark Verses,
   * Careful Speech, Phrase Back Translate) mode the end of one region is
   * always the start of the next, so a boundary is shared by two regions.
   * When the user drags one boundary we:
   *   - clamp it so it can't cross the neighbor's far boundary (no overlap) —
   *     the first/last region's outer edge stays pinned to 0 / duration; and
   *   - shift the single adjacent neighbor's shared boundary to follow, so the
   *     two regions stay flush.
   * `side` is provided by the regions plugin ('start' | 'end') and tells us
   * which boundary is moving; when absent (defensive) we constrain both.
   * Returns the boundary time the drag settled on for playhead follow.
   */
  const constrainResizedRegion = (r: Region, side?: 'start' | 'end') => {
    const prev = findPrevRegion(r) as Region | undefined;
    const next = findNextRegion(r, false) as Region | undefined;
    const { start, end, boundary } = clampSharedBoundary({
      segment: { start: r.start, end: r.end },
      prev,
      next,
      duration: duration(),
      side,
    });

    if (side !== 'end') {
      if (start !== r.start) updateRegion(r, { start });
      if (prev && prev.end !== start) updateRegion(prev, { end: start });
    }
    if (side !== 'start') {
      if (end !== r.end) updateRegion(r, { end });
      if (next && next.start !== end) updateRegion(next, { start: end });
    }
    return boundary;
  };

  const getPeaks = (num: number = 512) => {
    const buffer = getDecodedBuffer?.();
    if (!buffer?.length) return undefined;
    return waveformPeaks(buffer, num)[0];
  };

  const mergeVerses = (autosegs: IRegion[]): IRegion[] => {
    if (!verses) return autosegs;
    const versesegs = parseRegions(verses)?.regions;

    if (!versesegs || !versesegs.length) return autosegs;
    if (!autosegs || autosegs.length === 0) return versesegs;
    const minLen: number = paramsRef.current?.segLenThreshold || 0.5;
    //console.log('mergeVerses input:', { verses, autosegs, minLen });
    // Combine all boundary points and sort them
    const boundaries = new Set<number>();

    // Add all start and end points from both arrays
    versesegs.forEach((r) => {
      boundaries.add(roundToFiveDecimals(r.start));
      boundaries.add(roundToFiveDecimals(r.end));
    });
    autosegs.forEach((r) => {
      boundaries.add(roundToFiveDecimals(r.start));
      boundaries.add(roundToFiveDecimals(r.end));
    });

    const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);
    const labelFromVerses = (position: number) =>
      versesegs.find((v) => roundToFiveDecimals(v.start) === position)?.label ||
      '';
    const fromVerses = (position: number) =>
      versesegs.some(
        (v) =>
          roundToFiveDecimals(v.start) === position ||
          roundToFiveDecimals(v.end) === position
      );
    const result: IRegion[] = [];
    let start = sortedBoundaries[0];

    // Create regions between consecutive boundaries
    for (let i = 1; i < sortedBoundaries.length; i++) {
      const end = sortedBoundaries[i];
      const length = end - start;
      // Only add regions that meet the minimum length requirement
      if (length >= minLen) {
        result.push({
          start: start,
          end: end,
          label: labelFromVerses(start),
        });
        start = end;
      } else {
        // A too-short gap is absorbed into the previous region, but the first
        // gap has no previous region to absorb it, so result[-1] threw
        // (TT-7583). Skipping leaves `start` put: the gap joins the next region.
        if (result.length > 0 && !fromVerses(start)) {
          //fix the last one to use end
          result[result.length - 1].end = end;
          start = end;
        }
      }
    }
    //console.log('mergeVerses result:', result);
    return result;
  };

  const extractRegions = (params: IRegionParams) => {
    const minSeconds = params.timeThreshold || 0.05;
    const numPeaks = segmentPeakCount(duration(), minSeconds);
    const peaks = getPeaks(numPeaks);
    if (!peaks) return [];
    return extractSilenceRegions(peaks, duration(), params);
  };

  const setAttribute = (r: Region, attr: string, value: any) => {
    const ra = r as any;
    if (!ra.attributes) {
      ra.attributes = {};
    }
    ra.attributes[attr] = value;
  };

  const setPrevNext = (sortedIds: string[]) => {
    if (!wsRef.current || sortedIds.length === 0 || singleRegionRef.current)
      return;
    let prev: Region | undefined = undefined;
    sortedIds.forEach(function (id, index) {
      const r = region(id);
      if (r && prev) {
        setAttribute(prev, 'nextRegion', r);
        setAttribute(r, 'prevRegion', prev);
      }
      if (r) {
        if (applyRegionColorRef.current) {
          // Colors applied in batch after prev/next links are wired.
        } else {
          const baseColor = getSegmentRegionColor(index);
          if (currentRegionRef.current?.id === r.id) {
            currentRegionOriginalColorRef.current = baseColor;
          } else {
            r.setOptions({ color: baseColor });
          }
        }
      }
      prev = r;
    });
    if (applyRegionColorRef.current) applyStatusRegionColors();
  };

  function clearRegions(
    recreateMarkers: boolean = true,
    quietly: boolean = false
  ) {
    if (!wsRef.current || !numRegions() || loadingRef.current) return;
    loadingRef.current = true;
    const markers = wsGetMarkers();
    const savedMarkers: IMarker[] = [];
    markers.forEach((m) => {
      savedMarkers.push({
        time: m.start,
        color: m.color,
      });
    });
    Regions()?.clearRegions();
    if (recreateMarkers) {
      savedMarkers.forEach((m, i) => {
        wsAddMarker(m, i);
      });
    }
    currentRegionRef.current = undefined;
    loopingRegionRef.current = undefined;
    loadingRef.current = false;

    if (!quietly) onRegion(0, true);
    return savedMarkers;
  }
  function loadRegions(
    regions: IRegions | undefined,
    loop: boolean,
    newRegions: boolean = false
  ) {
    if (!wsRef.current) return false;
    const savedMarkers = clearRegions(false, true);
    loadingRef.current = true;
    paramsRef.current = regions?.params;

    if (!regions || !regions.regions || regions.regions.length === 0) {
      loadingRef.current = false;
      return true;
    }
    const regarray = (
      Array.isArray(regions.regions)
        ? regions.regions
        : JSON.parse(regions.regions)
    )
      .filter((r: any) => r.start !== undefined && r.end - r.start > 0.03)
      .sort((a: any, b: any) => a.start - b.start);
    regarray.forEach(function (region: any, index: number) {
      region.start = roundToFiveDecimals(region.start);
      region.end = roundToFiveDecimals(region.end);
      region.color = applyRegionColorRef.current
        ? applyRegionColorRef.current('new', index, regarray.length)
        : getSegmentRegionColor(index);
      region.drag = false;
      region.content = region.label;
      const r = Regions()?.addRegion(region);
      region.id = r?.id;
    });
    setPrevNext(regarray.map((r: any) => r.id));
    onRegion(regarray.length, newRegions);
    onRegionGoTo(regarray[defaultRegionIndex]?.start ?? 0);
    loadingRef.current = false;

    if (savedMarkers) wsAddMarkers(savedMarkers);
    return true;
  }
  const wsAddMarkers = (markers: IMarker[]) => {
    wsClearMarkers();

    markers.forEach((m, i) => {
      wsAddMarker(m, i);
    });
  };

  const findPrevRegion = (r: Region) => {
    if (!r) return undefined;
    return (r as any).attributes?.prevRegion;
  };

  const wsSplitRegion = (r: any, split: number) => {
    if (r?.start === split || r?.end === split) return undefined;
    const ret: IRegionChange = {
      start: r?.start ?? 0,
      end: r?.end ?? duration(),
      newStart: r?.start ?? 0,
      newEnd: split,
    };
    if (!wsRef.current) return ret;
    let region = {
      start: split,
      end: ret.end,
      drag: false,
      color: defaultNewRegionColor(),
    };
    const sortedIds: string[] = getSortedIds(); //need to get sorted ids before adding the new region
    const newRegion = Regions()?.addRegion(region);

    let newSorted: string[] = [];
    let leftRegion: Region | undefined;
    if (r) {
      const curIndex = sortedIds.findIndex((s) => s === r.id);
      updateRegion(r, { end: split });
      leftRegion = r;
      newSorted = sortedIds
        .slice(0, curIndex + 1)
        .concat(newRegion?.id ?? 'newid')
        .concat(sortedIds.slice(curIndex + 1));
    } else {
      region = {
        start: 0,
        end: split,
        drag: false,
        color: defaultNewRegionColor(),
      };
      leftRegion = Regions()?.addRegion(region);
      newSorted.push(leftRegion?.id ?? 'fr');
      newSorted.push(newRegion?.id ?? 'nr');
    }
    setPrevNext(newSorted);

    if (newRegion) {
      pendingSplitRightRegionRef.current = newRegion;
      setCurrentRegion(newRegion);
      programmaticSeekRef.current = true;
      if (isPlaying()) {
        // Audio is playing: don't seek (avoid jumping back from the live
        // playhead). Mark the left region so its upcoming region-out doesn't
        // stop playback or snap back to the start. Also remember the end-time
        // of the truncated region — segment autosave may re-create it with a
        // new id within the next second or so, and we want to ignore that
        // region-out too.
        if (leftRegion) splitTruncatedIdRef.current = leftRegion.id;
        splitTruncatedEndRef.current = split;
        if (splitTruncatedEndTimerRef.current) {
          clearTimeout(splitTruncatedEndTimerRef.current);
        }
        splitTruncatedEndTimerRef.current = setTimeout(() => {
          splitTruncatedEndRef.current = undefined;
          splitTruncatedEndTimerRef.current = undefined;
        }, 3000);
      } else {
        goto(split + 0.01);
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          programmaticSeekRef.current = false;
        });
      });
    }
    onRegion(numRegions(), true);
    return ret;
  };

  const wsRemoveSplitRegion = () => {
    const r = currentRegion();
    if (!r) return undefined;
    if (numRegions() === 1) {
      clearRegions();
      return;
    }
    const ret: IRegionChange = {
      start: r.start,
      end: r.end,
      newStart: r.start,
      newEnd: r.end,
    };
    // If the playhead is near the current region's start, remove that boundary
    // (merge with the previous region); otherwise remove the next one below.
    const prev = findPrevRegion(r);
    if (isNear(r.start) && prev) {
      updateRegion(r, { start: prev.start });
      ret.newStart = prev.start;
      prev.remove();
      setCurrentRegion(r);
      onRegion(numRegions(), true);
      return ret;
    }
    //find next region
    const next = findNextRegion(r, false);
    if (next) {
      updateRegion(r, { end: next.end });
      ret.newEnd = next.end;
      next.remove();
      setCurrentRegion(r);
    } else if (numRegions() === 1) {
      r.remove();
    }
    onRegion(numRegions(), true);
    return ret;
  };

  const getSortedIds = () => {
    const sortedIds: string[] = [];
    if (!wsRef.current || numRegions() === 0) return sortedIds;
    let next = regions()[0];
    //back up to the start
    while ((next as any).attributes?.prevRegion) {
      next = (next as any).attributes?.prevRegion;
    }
    while (next) {
      sortedIds.push(next.id);
      next = (next as any).attributes?.nextRegion;
    }
    return sortedIds;
  };

  const wsAddRegion = () => {
    return wsSplitRegion(findRegion(progress(), true), progress());
  };

  const wsRemoveCurrentRegion = () => {
    const region = currentRegion();
    if (region) {
      region.remove();
      return true;
    }
    return false;
  };

  function wsAutoSegment(loop: boolean = false, params: IRegionParams) {
    if (!wsRef.current) return 0;
    const regions = mergeVerses(extractRegions(params));
    paramsRef.current = params;
    loadRegions({ params: params, regions: regions }, loop, true);
    if (regions.length) goto(regions[0].start);
    return regions.length;
  }

  const peaksForParams = (params: IRegionParams) => {
    const minSeconds = params.timeThreshold || 0.05;
    const numPeaks = segmentPeakCount(duration(), minSeconds);
    return getPeaks(numPeaks);
  };

  function wsFindClauseSplitPoint(
    clause: IRegion,
    params: IRegionParams
  ): number | undefined {
    const peaks = peaksForParams(params);
    if (!peaks) return undefined;
    return findClauseSplitPoint(peaks, duration(), clause, params);
  }
  const wsPrevRegion = () => {
    if (lockSegmentSelectionRef.current) return false;
    const r = findPrevRegion(currentRegion() as Region);
    if (r) {
      onStartRegion && onStartRegion(r.start);
      // const target: IRegion = {
      //   start: r.start,
      //   end: r.end,
      //   label: r.content?.textContent || '',
      // };
      wsPlayRegion(r);
      return true;
    } else {
      goto(0);
      setPlaying(false);
      return false;
    }
  };
  const wsNextRegion = () => {
    if (lockSegmentSelectionRef.current) return false;
    //TT-2825 changing selfIfAtStart to false
    //but I coded that in there for this call, so
    //wonder what case I was handling then????
    const r = findNextRegion(currentRegion() as Region, false);
    if (r) {
      onStartRegion && onStartRegion(r.start);
      // const target: IRegion = {
      //   start: r.start,
      //   end: r.end,
      //   label: r.content?.textContent || '',
      // };
      wsPlayRegion(r);
      return true;
    } else {
      goto(duration());
      setPlaying(false);
      return false;
    }
  };

  const wsGetRegions = () => {
    if (!wsRef.current || !Regions()) return '{}';

    const sortedRegions = getSortedIds().map(function (id) {
      const r = region(id);
      if (r)
        return {
          start: roundToFiveDecimals(r.start),
          end: roundToFiveDecimals(r.end),
          label: r.content?.textContent || '',
        };
      else {
        console.log('wsGetRegions', id, 'not found');
        return {};
      }
    });
    return JSON.stringify({
      params: paramsRef.current,
      regions: sortedRegions,
    });
  };
  const wsGetMarkers = () => {
    return markers();
  };
  const hoverEffects = (region: Region, hover: boolean) => {
    // Force the scale effect via JavaScript as backup
    region.element!.style.transform = `translateX(-50%) scale(${
      hover ? 1.2 : 1
    })`;
    region.element!.style.border = hover
      ? `2px solid ${theme.palette.primary.main}`
      : `1px solid ${theme.palette.secondary.light}`;
  };
  const wsAddMarker = (m: IMarker, index: number) => {
    if (!wsRef.current || !Regions()) return;

    const region = Regions()?.addRegion({
      id: 'marker' + index.toString(),
      start: m.time,
      end: m.time,
      color: m.color ?? 'blue',
      resize: false,
      drag: false,
      contentEditable: false,
      content: m.label ?? m.time.toString(),
      // Make markers interactive for hover and click
      interact: true,
      // Add hover effects
      className: 'marker-region',
    } as RegionParams);

    // Add event listeners for hover effects (CSS handles most of the styling)
    if (region) {
      // Wait for the element to be available, then add hover effects
      const addHoverEffects = () => {
        if (region.element) {
          region.element.addEventListener('mouseenter', () => {
            hoverEffects(region, true);
          });
          region.element.addEventListener('mouseleave', () => {
            hoverEffects(region, false);
          });
        } else {
          // If element not available yet, try again after a short delay
          setTimeout(addHoverEffects, 10);
        }
      };
      addHoverEffects();
    }
  };

  const wsClearMarkers = () => {
    if (!wsRef.current || !Regions()) return;
    const markers = wsGetMarkers();

    markers.forEach((m) => {
      m.remove();
    });
  };

  const regLoopRegion = (loop: boolean) => {
    loopingRef.current = loop;
    return loop;
  };
  const roundToFiveDecimals = (n: number) => Math.round(n * 100000) / 100000;
  function roundToTenths(n: number) {
    return Math.round(n * 10) / 10;
  }
  function resetPlayingRegion() {
    playRegionRef.current = undefined;
  }
  function isPlayRegionLocked() {
    return playRegionRef.current !== undefined;
  }
  function justPlayRegion(progress: number) {
    if (
      currentRegion() &&
      !loopingRef.current &&
      roundToTenths(currentRegion()?.start ?? 0) <= roundToTenths(progress) && //account for discussion topic rounding
      (currentRegion()?.end ?? 0) > progress + 0.01
    ) {
      playRegion(currentRegion() as Region);
      return true;
    }
    resetPlayingRegion();
    return false;
  }

  const applyRegionAtPosition = (position: number, targetRegion?: IRegion) => {
    programmaticSeekRef.current = true;
    if (targetRegion) {
      const reg = findRegionByIRegion(targetRegion);
      if (reg) setCurrentRegion(reg);
    } else {
      setCurrentRegion(findRegion(position, true));
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        programmaticSeekRef.current = false;
      });
    });
  };

  function onRegionGoTo(position: number) {
    applyRegionAtPosition(position);
  }

  // Function to clear click processing states (useful for debugging or reset)
  const clearClickProcessingStates = () => {
    lastClickTimeRef.current = 0;
    lastClickedRegionRef.current = '';
    lastDoubleClickTimeRef.current = 0;
  };
  const prepareForDestroy = () => {
    destroyingRef.current = true;
  };

  return {
    setupRegions,
    wsAutoSegment,
    wsFindClauseSplitPoint,
    wsRemoveSplitRegion,
    wsAddRegion,
    wsPrevRegion,
    wsNextRegion,
    wsGetRegions,
    wsGetMarkers,
    wsAddMarkers,
    wsAddMarker,
    wsClearMarkers,
    wsPlayRegion,
    regLoopRegion,
    clearRegions,
    loadRegions,
    justPlayRegion,
    resetPlayingRegion,
    isPlayRegionLocked,
    onRegionGoTo,
    applyRegionAtPosition,
    applyRegionColors: applyStatusRegionColors,
    currentRegion,
    wsSetRegionColor,
    wsRemoveCurrentRegion,
    prepareForDestroy,
  };
}
