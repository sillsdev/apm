import { useEffect, useRef } from 'react';
import { waitForIt } from '../utils/waitForIt';
import RegionsPlugin, {
  Region,
  RegionParams,
} from 'wavesurfer.js/dist/plugins/regions';
import WaveSurfer from 'wavesurfer.js';
import { IMarker } from './useWaveSurfer';
import { useTheme } from '@mui/material';

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
export function useWaveSurferRegions(
  singleRegionOnly: boolean,
  defaultRegionIndex: number,
  Regions: RegionsPlugin | undefined,
  ws: WaveSurfer | null,
  onRegion: (count: number, newRegion: boolean) => void,
  duration: () => number,
  isNear: (test: number) => boolean,
  goto: (position: number) => void,
  progress: () => number,
  isPlaying: () => boolean,
  setPlaying: (playing: boolean) => void,
  onCurrentRegion?: (currentRegion: IRegion | undefined) => void,
  onStartRegion?: (start: number) => void,
  onMarkerClick?: (time: number) => void,
  verses?: string
) {
  const theme = useTheme();
  const wsRef = useRef<WaveSurfer | null>(ws);
  const singleRegionRef = useRef(singleRegionOnly);
  const currentRegionRef = useRef<any>();
  const loopingRegionRef = useRef<any>();
  const loopingRef = useRef(false);
  const updatingRef = useRef(false);
  const resizingRef = useRef(false);
  const loadingRef = useRef(false);
  const playRegionRef = useRef<Region | undefined>();
  const paramsRef = useRef<IRegionParams>();
  const peaksRef = useRef<Array<number> | undefined>();
  const lastClickTimeRef = useRef<number>(0);
  const lastClickedRegionRef = useRef<string>(''); //for both clicks and double clicks
  const lastDoubleClickTimeRef = useRef<number>(0);
  const currentRegionOriginalColorRef = useRef<string>(''); // Store the original color of the current region

  const CLICK_DEBOUNCE_MS = 100; // Minimum time between clicks
  const CURRENT_REGION_COLOR = (theme.palette as any).custom.currentRegion; // Green color for current region
  const NEXT_BORDER_COLOR = 'red';

  const regions = () =>
    Regions?.getRegions().filter((r) => r.start !== r.end) ?? ([] as Region[]);
  const region = (id: string) => regions().find((x) => x.id === id);
  const markers = () =>
    Regions?.getRegions().filter((r) => r.start === r.end) ?? ([] as Region[]);
  const numRegions = () => regions().length;
  const currentRegion = () => {
    return currentRegionRef.current;
  };
  const isMarker = (r: any) => r.start === r.end;

  useEffect(() => {
    singleRegionRef.current = singleRegionOnly;
  }, [singleRegionOnly]);

  // handle region clicks with deduplication
  const handleRegionClick = (r: Region) => {
    const currentTime = Date.now();
    const timeSinceLastClick = currentTime - lastClickTimeRef.current;
    const isSameRegion = lastClickedRegionRef.current === r.id;

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
    }
  };

  // handle region double-clicks with deduplication
  const handleRegionDoubleClick = (r: Region) => {
    const currentTime = Date.now();
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
        if (currentRegionOriginalColorRef.current) {
          currentRegionRef.current.setOptions({
            color: currentRegionOriginalColorRef.current,
          });
        }
        if (!singleRegionRef.current)
          setRegionEndBorderColor(currentRegionRef.current, undefined);
      }

      // Set new current region color and remember its current color
      if (r) {
        currentRegionOriginalColorRef.current = r.color || randomColor(0.1);
        r.setOptions({ color: CURRENT_REGION_COLOR });
        if (
          !singleRegionRef.current &&
          (!isAtEnd(r.end) || numRegions() === 1)
        ) {
          setRegionEndBorderColor(r, NEXT_BORDER_COLOR);
        }
      } else {
        currentRegionOriginalColorRef.current = '';
      }
      loopingRegionRef.current = r;
      currentRegionRef.current = r;
      onCurrentRegion &&
        onCurrentRegion(r ? { start: r.start, end: r.end } : undefined);
    }
  };

  const findNextRegion = (r: Region, selfIfAtStart: boolean) => {
    if (!r) return undefined;
    if (selfIfAtStart && (numRegions() === 1 || isNear(r.start))) return r;
    return (r as any).attributes?.nextRegion;
  };
  const playRegion = (r: Region) => {
    playRegionRef.current = r;
    r.play();
  };
  const wsPlayRegion = (r: IRegion) => {
    updatingRef.current = true;
    const reg = findRegion(r.start, true);
    if (!isInRegion(reg, ws?.getCurrentTime() ?? progress())) goto(r.start);
    playRegion(reg);
  };
  useEffect(() => {
    clearClickProcessingStates();
    return () => {
      if (Regions) Regions.unAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    wsRef.current = ws;
  }, [ws]);

  const setupRegions = (ws: WaveSurfer) => {
    if (ws && Regions) {
      wsRef.current = ws;
      if (singleRegionRef.current) {
        Regions.enableDragSelection({
          color: 'rgba(255, 0, 0, 0.1)',
        });
      }
      Regions.on('region-created', function (r: Region) {
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
              setCurrentRegion(
                singleRegionRef.current ? r : findRegion(progress(), true)
              );
              onRegion(numRegions(), true);
            })
            .catch((reason) => console.log(reason));
        }
      });
      Regions.on('region-removed', function (r: Region) {
        const ra = r as any;
        if (ra.attributes?.prevRegion)
          ra.attributes.prevRegion.attributes.nextRegion =
            ra.attributes?.nextRegion;
        if (ra.attributes?.nextRegion)
          ra.attributes.nextRegion.attributes.prevRegion =
            ra.attributes?.prevRegion;

        if (wsRef.current && !loadingRef.current) {
          // wait for it to be removed from this list
          waitForIt(
            'region removed',
            () => region(r.id) === undefined,
            () => false,
            200
          ).then(() => {
            onRegion(numRegions(), true);
            setCurrentRegion(findRegion(progress(), true));
          });
        }
      });
      //was region-updated
      Regions.on('region-update', function (r: Region) {
        resizingRef.current = r.resize;
      });
      //was region-update-end
      Regions.on('region-updated', function (r: Region) {
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
          const next = findNextRegion(r, false);
          const prev = findPrevRegion(r);
          if (prev) {
            if (prev.end !== r.start) {
              updateRegion(prev, { end: r.start });
              goto(r.start);
            }
          } else if (r.start !== 0) {
            updateRegion(r, { start: 0 });
            goto(0);
          }
          if (next) {
            if (next.start !== r.end) {
              updateRegion(next, { start: r.end });
              goto(r.end);
            }
          } else if (r.end !== duration()) {
            updateRegion(r, { end: duration() });
            goto(duration());
          }
        }
        onRegion(numRegions(), true);
      });
      // other potentially useful messages
      // ws.on('region-play', function (r: any) {
      //   console.log('region-play', r.start, r.loop);
      // });
      Regions.on('region-in', function (r: Region) {
        if (isMarker(r)) return;
        //TODO!! need to check for user interaction vs looping
        //this comes before the region-out
        if (!loopingRef.current) setCurrentRegion(r);
      });
      Regions.on('region-out', function (r: Region) {
        if (isMarker(r)) return;
        //help it in case it forgot -- unless the user clicked out
        //here is where we could add a pause possibly
        if (loopingRef.current) {
          if (r === loopingRegionRef.current && isPlaying()) {
            r.play();
          }
        } else if (playRegionRef.current === r) {
          //we just wanted to play this region
          setPlaying(false);
        }
      });
      Regions.on('region-clicked', function (r: Region) {
        handleRegionClick(r);
      });
      Regions.on('region-double-clicked', function (r: Region) {
        handleRegionDoubleClick(r);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  };

  const isInRegion = (r: Region, value: number) => {
    return value <= r.end && value >= r.start;
  };

  const findRegion = (value: number, force: boolean = false) => {
    if (!force && currentRegion() && isInRegion(currentRegion(), value))
      return currentRegion();
    let foundIt: any = undefined;
    regions().forEach(function (r) {
      if (isInRegion(r, value)) {
        foundIt = r;
      }
    });
    return foundIt;
  };

  const findRegionByIRegion = (targetRegion: IRegion) => {
    return regions().find(
      (r) =>
        Math.abs(r.start - targetRegion.start) < 0.001 &&
        Math.abs(r.end - targetRegion.end) < 0.001
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

  const getPeaks = (num: number = 512) => {
    if (!peaksRef.current && wsRef.current) {
      const peaks = wsRef.current.exportPeaks({ maxLength: num });
      if (peaks.length > 0 && Array.isArray(peaks[0])) {
        peaksRef.current = peaks[0];
      }
    }
    return peaksRef.current;
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
    const fromVerses = (position: number) =>
      versesegs.some(
        (v) =>
          roundToFiveDecimals(v.start) === position ||
          roundToFiveDecimals(v.end) === position
      );
    const result: IRegion[] = [];
    let start = sortedBoundaries[0];

    // Create regions between consecutive boundaries
    for (let i = 1; i < sortedBoundaries.length - 1; i++) {
      const end = sortedBoundaries[i];
      const length = end - start;
      // Only add regions that meet the minimum length requirement
      if (length >= minLen) {
        result.push({
          start: start,
          end: end,
        });
        start = end;
      } else {
        if (!fromVerses(start)) {
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
    // Silence params
    const minValue = params.silenceThreshold || 0.002;
    const minSeconds = params.timeThreshold || 0.05;
    const minRegionLenSeconds = params.segLenThreshold || 0.5;

    let numPeaks = Math.floor(duration() / minSeconds);
    numPeaks = Math.min(Math.max(numPeaks, 512), 512 * 16);
    const peaks = getPeaks(numPeaks);
    if (!peaks) return [];

    const length = peaks.length;
    const coef = duration() / length;
    const minLenSilence = Math.ceil(minSeconds / coef);

    // Gather silence indeces
    const silences: number[] = [];

    peaks.forEach((val, index) => {
      if (Math.abs(val) < minValue) {
        silences.push(index);
      }
    });

    // Cluster silence values
    const clusters: number[][] = [];
    silences.forEach(function (val, index) {
      if (clusters.length && val === silences[index - 1] + 1) {
        clusters[clusters.length - 1].push(val);
      } else {
        clusters.push([val]);
      }
    });

    // Filter silence clusters by minimum length
    const fClusters = clusters.filter(function (cluster) {
      return cluster.length >= minLenSilence;
    });

    // Create regions on the edges of silences
    const regions = fClusters.map(function (cluster, index) {
      const next = fClusters[index + 1];
      return {
        start: cluster[cluster.length - 1] + 1,
        end: next ? next[0] - 1 : length,
      };
    });

    // Return time-based regions
    const tRegions = regions.map(function (reg) {
      return {
        start: roundToFiveDecimals(reg.start * coef),
        end: roundToFiveDecimals(reg.end * coef),
      };
    });

    if (tRegions.length > 0) {
      //add a region at zero if not there
      const firstRegion = tRegions[0];
      if (firstRegion.start !== 0) {
        tRegions.unshift({
          start: 0,
          end: firstRegion.start,
        });
      }
    }
    // Combine the regions so the silence is included at the end of the region
    const sRegions = tRegions.map(function (reg, index) {
      const next = tRegions[index + 1];
      return {
        start: reg.start,
        end: next ? next.start : duration(),
      };
    });
    let ix = 0;
    // combine regions shorter than minimum length
    while (ix < sRegions.length - 1) {
      if (sRegions[ix].end - sRegions[ix].start < minRegionLenSeconds) {
        sRegions[ix].end = sRegions[ix + 1].end;
        sRegions.splice(ix + 1, 1);
      } else {
        ix += 1;
      }
    }
    if (sRegions.length > 0) {
      if (
        sRegions[sRegions.length - 1].end -
          sRegions[sRegions.length - 1].start <
        minRegionLenSeconds
      )
        sRegions.splice(-1, 1); //remove the last region if it's too short
      sRegions[sRegions.length - 1].end = duration();
    }

    return sRegions;
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
    sortedIds.forEach(function (id) {
      const r = region(id);
      if (r && prev) {
        setAttribute(prev, 'nextRegion', r);
        setAttribute(r, 'prevRegion', prev);
      }
      prev = r;
    });
  };

  function clearRegions(recreateMarkers: boolean = true) {
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
    Regions?.clearRegions();
    if (recreateMarkers) {
      savedMarkers.forEach((m, i) => {
        wsAddMarker(m, i);
      });
    }
    currentRegionRef.current = undefined;
    loopingRegionRef.current = undefined;
    loadingRef.current = false;
    onRegion(0, true);
    return savedMarkers;
  }
  function loadRegions(
    regions: IRegions | undefined,
    loop: boolean,
    newRegions: boolean = false
  ) {
    if (!newRegions) peaksRef.current = undefined; //because I know this is a new wave
    if (!wsRef.current) return false;
    const savedMarkers = clearRegions(false);
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

    regarray.forEach(function (region: any) {
      region.start = roundToFiveDecimals(region.start);
      region.end = roundToFiveDecimals(region.end);
      region.color = randomColor(0.1);
      region.drag = false;
      region.loop = loop;
      region.content = region.label;
      const r = Regions?.addRegion(region);
      region.id = r?.id;
    });
    console.log('loadRegions', regarray.length, numRegions());
    waitForIt(
      'wait for last region',
      () => numRegions() === regarray.length,
      () => false,
      100
    ).finally(() => {
      setPrevNext(regarray.map((r: any) => r.id));
      onRegion(regarray.length, newRegions);
      onRegionGoTo(regarray[defaultRegionIndex]?.start ?? 0);
      loadingRef.current = false;

      if (savedMarkers) wsAddMarkers(savedMarkers);
    });
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
      color: randomColor(0.1),
      loop: r?.loop ?? false,
    };
    const sortedIds: string[] = getSortedIds(); //need to get sorted ids before adding the new region
    const newRegion = Regions?.addRegion(region);
    let newSorted: string[] = [];
    if (r) {
      const curIndex = sortedIds.findIndex((s) => s === r.id);
      updateRegion(r, { end: split });
      newSorted = sortedIds
        .slice(0, curIndex + 1)
        .concat(newRegion?.id ?? 'newid')
        .concat(sortedIds.slice(curIndex + 1));
    } else {
      region = {
        start: 0,
        end: split,
        drag: false,
        color: randomColor(0.1),
        loop: false,
      };
      const firstRegion = Regions?.addRegion(region);
      newSorted.push(firstRegion?.id ?? 'fr');
      newSorted.push(newRegion?.id ?? 'nr');
    }
    setPrevNext(newSorted);

    if (r && r.loop && ret.newEnd < ret.end)
      //&& playing
      goto(ret.start + 0.01);
    onRegion(numRegions(), true);
    return ret;
  };

  const wsRemoveSplitRegion = (forceNext?: boolean) => {
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
    if (forceNext !== true) {
      const prev = findPrevRegion(r);
      if (isNear(r.start) && prev) {
        updateRegion(r, { start: prev.start });
        ret.newStart = prev.start;
        prev.remove();
        onRegion(numRegions(), true);
        return;
      }
    }
    //find next region
    const next = findNextRegion(r, false);
    if (next) {
      updateRegion(r, { end: next.end });
      ret.newEnd = next.end;
      next.remove();
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
    return wsSplitRegion(currentRegion(), progress());
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
  const wsPrevRegion = () => {
    const r = findPrevRegion(currentRegion());
    let newPlay = true;
    if (r) {
      onStartRegion && onStartRegion(r.start);
      goto(r.start);
      setCurrentRegion(r);
    } else {
      goto(0);
      newPlay = false;
    }
    setPlaying(newPlay);
    return newPlay;
  };
  const wsNextRegion = () => {
    //TT-2825 changing selfIfAtStart to false
    //but I coded that in there for this call, so
    //wonder what case I was handling then????
    const r = findNextRegion(currentRegion(), false);
    let newPlay = true;
    if (r) {
      goto(r.start);
      onStartRegion && onStartRegion(r.start);
      setCurrentRegion(r);
    } else {
      goto(duration());
      newPlay = false;
    }
    setPlaying(newPlay);
    return newPlay;
  };

  const wsGetRegions = () => {
    if (!wsRef.current || !Regions) return '{}';

    const sortedRegions = getSortedIds().map(function (id) {
      const r = region(id);
      if (r)
        return {
          start: roundToFiveDecimals(r.start),
          end: roundToFiveDecimals(r.end),
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
    if (!wsRef.current || !Regions) return;
    const region = Regions.addRegion({
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
    if (!wsRef.current || !Regions) return;
    const markers = wsGetMarkers();

    markers.forEach((m) => {
      m.remove();
    });
  };

  const wsLoopRegion = (loop: boolean) => {
    loopingRef.current = loop;
    return loop;
  };
  /**
   * Random RGBA color.
   */
  function randomColor(seed: number) {
    return (
      'rgba(' +
      [
        ~~(Math.random() * 255),
        ~~(Math.random() * 255),
        ~~(Math.random() * 255),
        seed || 1,
      ] +
      ')'
    );
  }

  const roundToFiveDecimals = (n: number) => Math.round(n * 100000) / 100000;
  function roundToTenths(n: number) {
    return Math.round(n * 10) / 10;
  }
  function resetPlayingRegion() {
    playRegionRef.current = undefined;
  }
  function justPlayRegion(progress: number) {
    if (
      currentRegion() &&
      !currentRegion().loop &&
      roundToTenths(currentRegion().start) <= roundToTenths(progress) && //account for discussion topic rounding
      currentRegion().end > progress + 0.01
    ) {
      playRegion(currentRegion());
      return true;
    }
    resetPlayingRegion();
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  function onRegionProgress() {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  function onRegionSeek() {}

  function onRegionGoTo(position: number) {
    setCurrentRegion(findRegion(position, true));
  }

  // Function to clear click processing states (useful for debugging or reset)
  const clearClickProcessingStates = () => {
    lastClickTimeRef.current = 0;
    lastClickedRegionRef.current = '';
    lastDoubleClickTimeRef.current = 0;
  };
  return {
    setupRegions,
    wsAutoSegment,
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
    wsLoopRegion,
    clearRegions,
    loadRegions,
    justPlayRegion,
    resetPlayingRegion,
    onRegionSeek,
    onRegionProgress,
    onRegionGoTo,
    currentRegion,
    wsSetRegionColor,
    wsRemoveCurrentRegion,
  };
}
