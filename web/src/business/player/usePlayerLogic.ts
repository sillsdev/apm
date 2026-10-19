import { useEffect } from 'react';
import { getSegments } from '../../utils/namedSegments';
import { JSONParse } from '../../utils/jsonParse';
import {
  IRegion,
  IRegions,
  parseRegions,
} from '../../crud/useWavesurferRegions';
import { MediaFile } from '../../model';

export interface RequestPlay {
  play: boolean | undefined;
  regionOnly: boolean;
  request: Date;
}

/** Segments a caller wants shown, tagged with the media they were made for so
 * the player never paints them onto a different recording (TT-7661). */
export interface SuggestedSegments {
  mediaId: string;
  segments: string;
}

interface PlayerLogicProps {
  allowSegment?: string | undefined;
  suggestedSegments?: SuggestedSegments | undefined;
  position?: number | undefined;
  playing?: boolean | undefined;
  setPlaying?: ((playing: boolean) => void) | undefined;
  setCurrentSegment?:
    ((segment: IRegion | undefined, index: number) => void) | undefined;
  setDefaultSegments: (segments: string) => void;
  setRequestPlay: (request: RequestPlay) => void;
  setInitialPosition: (position: number | undefined) => void;
  playerMediafile?: MediaFile | undefined;
  mediafileRef: React.RefObject<MediaFile | undefined>;
  segmentsRef: React.RefObject<string>;
  durationRef: React.RefObject<number>;
  playingRef: React.RefObject<boolean | undefined>;
  onSegment?: ((segments: string, whole: boolean) => void) | undefined;
}

export const usePlayerLogic = (props: PlayerLogicProps) => {
  const {
    allowSegment,
    suggestedSegments,
    position,
    playing,
    setPlaying,
    setCurrentSegment,
    playerMediafile,
    setDefaultSegments,
    setRequestPlay,
    setInitialPosition,
    mediafileRef,
    segmentsRef,
    durationRef,
    playingRef,
    onSegment,
  } = props;

  /** The suggestion's segments, if it was made for `mediaId`. */
  const suggestionFor = (mediaId: string | undefined) =>
    mediaId !== undefined &&
    suggestedSegments?.mediaId === mediaId &&
    suggestedSegments.segments.length > 0
      ? suggestedSegments.segments
      : undefined;

  const loadSegments = () => {
    const segs = mediafileRef.current?.attributes?.segments || '{}';
    if (allowSegment) {
      segmentsRef.current =
        suggestionFor(mediafileRef.current?.id) ??
        getSegments(allowSegment, segs);
      setSegmentToWhole();
    }
    setDefaultSegments(segmentsRef.current);
    onSegment && onSegment(segmentsRef.current, true);
  };

  useEffect(() => {
    //we need a ref for onDuration
    mediafileRef.current = playerMediafile;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerMediafile]);

  useEffect(() => {
    if (!allowSegment) return;
    const suggestion = suggestionFor(playerMediafile?.id);
    if (suggestion && segmentsRef.current !== suggestion) {
      segmentsRef.current = suggestion;
      setDefaultSegments(segmentsRef.current);
      onSegment && onSegment(segmentsRef.current, true);
    } else setSegmentToWhole();
    // Keyed on the suggestion's fields, not its object identity, so callers
    // need not memoize it. Media changes are handled by loadSegments below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowSegment, suggestedSegments?.mediaId, suggestedSegments?.segments]);

  useEffect(() => {
    if (allowSegment) loadSegments();
    else setDefaultSegments('{}');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowSegment, playerMediafile]);

  const setSegmentToWhole = () => {
    if (allowSegment && setCurrentSegment && durationRef.current) {
      const segs = JSONParse(segmentsRef.current) as unknown as
        IRegions | undefined;
      //might be "[]"
      //why was this 3?
      if ((segs?.regions?.length ?? 0) < 2) {
        setCurrentSegment({ start: 0, end: durationRef.current }, -1);
        return true;
      }
    }
    return false;
  };

  const onCurrentSegment = (
    segment: IRegion | undefined,
    sortedIndex?: number
  ) => {
    let index = 0;
    if (segment && typeof sortedIndex === 'number' && sortedIndex >= 0) {
      // The waveform reported the current region's exact sorted position — use
      // it (1-based; 0 means whole/none) rather than re-deriving from times.
      index = sortedIndex + 1;
    } else if (segment && segmentsRef.current) {
      const sorted = parseRegions(segmentsRef.current).regions.sort(
        (a: IRegion, b: IRegion) => a.start - b.start
      );
      const matchTol = 0.6;
      index =
        sorted.findIndex(
          (r: IRegion) =>
            Math.abs(r.start - segment.start) <= matchTol &&
            Math.abs(r.end - segment.end) <= matchTol
        ) + 1;
      if (index <= 0) {
        index =
          sorted.findIndex(
            (r: IRegion, i: number) =>
              segment.start >= r.start - 0.01 &&
              (i === sorted.length - 1
                ? segment.start <= r.end + 0.01
                : segment.start < r.end - 0.01)
          ) + 1;
      }
    } else {
      if (setSegmentToWhole()) return;
    }
    setCurrentSegment && setCurrentSegment(segment, index);
  };

  const onPlayStatus = (newPlaying: boolean) => {
    if (playingRef.current !== newPlaying) {
      setPlaying && setPlaying(newPlaying);
      playingRef.current = newPlaying;
      setRequestPlay({
        play: undefined,
        regionOnly: false,
        request: new Date(),
      });
      setInitialPosition(undefined);
    }
  };

  useEffect(() => {
    //if playing is changed from outside, we need to update the request
    //the setTimeout is to avoid a race condition
    if (playing !== playingRef.current)
      setTimeout(
        () =>
          setRequestPlay({
            play: playing,
            regionOnly: false,
            request: new Date(),
          }),
        100
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  useEffect(() => {
    setInitialPosition(position);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);

  return { onPlayStatus, onCurrentSegment, setSegmentToWhole };
};
