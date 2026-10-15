import { useEffect, useRef } from 'react';
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
interface PlayerLogicProps {
  allowSegment?: string | undefined;
  suggestedSegments?: string | undefined;
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

  /** Media id the current `suggestedSegments` belong to. A suggestion that
   * changes in the same render as the media id belongs to the incoming media;
   * one left unchanged across a media change belongs to the outgoing media.
   * `undefined` means not yet tied to a media (adopted by the next load). */
  const suggestionMediaIdRef = useRef<string | undefined>(undefined);

  const loadSegments = () => {
    const segs = mediafileRef.current?.attributes?.segments || '{}';
    const mediaId = mediafileRef.current?.id;
    if (allowSegment) {
      const suggestionFits =
        suggestionMediaIdRef.current === undefined ||
        suggestionMediaIdRef.current === mediaId;
      segmentsRef.current =
        suggestionFits && suggestedSegments && suggestedSegments.length > 0
          ? suggestedSegments
          : getSegments(allowSegment, segs);
      if (suggestionFits) suggestionMediaIdRef.current = mediaId;
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
    // Runs after the effect above, so mediafileRef holds the incoming media.
    suggestionMediaIdRef.current = mediafileRef.current?.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedSegments]);

  useEffect(() => {
    if (allowSegment)
      if (suggestedSegments && segmentsRef.current !== suggestedSegments) {
        segmentsRef.current = suggestedSegments;
        setDefaultSegments(segmentsRef.current);
        onSegment && onSegment(segmentsRef.current, true);
      } else setSegmentToWhole();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowSegment, suggestedSegments]);

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
