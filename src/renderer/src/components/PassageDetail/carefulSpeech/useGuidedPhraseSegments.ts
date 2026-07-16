import { useCallback, useRef, useState } from 'react';
import {
  IRegion,
  IRegionParams,
  parseRegions,
} from '../../../crud/useWavesurferRegions';
import { WSAudioPlayerControls } from '../../WSAudioPlayer';
import {
  getSegments,
  NamedRegions,
  updateSegments,
} from '../../../utils/namedSegments';
import { boldDefaultSegParams } from './boldCarefulSpeechSegParams';
import {
  hasPhraseRegions,
  regionBoundariesEqual,
  regionsJsonFromList,
} from './carefulSpeechBoundary';
import { MediaFileD } from '../../../model';
import { useProjectSegmentSave } from '../Internalization/useProjectSegmentSave';

export interface GuidedPhraseSegmentsOptions {
  namedRegion: NamedRegions;
  singleSegmentMode?: boolean;
  /** Merge Mark Verses into auto-segment when reseeding. */
  constrainAutoSegmentWithVerses?: boolean;
  /** When true with constrain, re-auto-segment empty or verse-identical BT. */
  shouldReseedFromVerses?: boolean;
}

export function useGuidedPhraseSegments(
  mediafile: MediaFileD | undefined,
  controlsRef: React.RefObject<WSAudioPlayerControls | null>,
  options: GuidedPhraseSegmentsOptions
) {
  const {
    namedRegion,
    singleSegmentMode = false,
    constrainAutoSegmentWithVerses = false,
    shouldReseedFromVerses = false,
  } = options;
  const projectSegmentSave = useProjectSegmentSave();
  const [phraseSegString, setPhraseSegString] = useState('{}');
  const [bootstrapped, setBootstrapped] = useState(false);
  const bootstrapInProgress = useRef(false);
  const mediafileIdRef = useRef<string | undefined>(undefined);

  const persistSegmentBucket = useCallback(
    async (
      name: NamedRegions,
      regionJson: string,
      baseSegments?: string
    ): Promise<string | undefined> => {
      if (!mediafile) return undefined;
      const prev = baseSegments ?? mediafile.attributes?.segments ?? '[]';
      const segments = updateSegments(name, prev, regionJson);
      await projectSegmentSave({ media: mediafile, segments });
      return segments;
    },
    [mediafile, projectSegmentSave]
  );

  const hydrateFromMediafile = useCallback(() => {
    if (!mediafile) return;
    const allSegs = mediafile.attributes?.segments ?? '[]';
    const regionJson = getSegments(namedRegion, allSegs);
    if (hasPhraseRegions(regionJson)) setPhraseSegString(regionJson);
  }, [mediafile, namedRegion]);

  const resetForMediafile = useCallback(
    (mediafileId: string | undefined) => {
      if (mediafileIdRef.current === mediafileId) return;
      mediafileIdRef.current = mediafileId;
      bootstrapInProgress.current = false;
      setBootstrapped(false);
      setPhraseSegString('{}');
      if (mediafileId) hydrateFromMediafile();
    },
    [hydrateFromMediafile]
  );

  const loadRegionsOnPlayer = useCallback(
    (regionJson: string) => {
      controlsRef.current?.loadRegionsJson?.(regionJson);
      controlsRef.current?.applyRegionColors?.();
    },
    [controlsRef]
  );

  const createSingleSegmentJson = useCallback((): string | false => {
    const ctrl = controlsRef.current;
    if (!ctrl?.isReady()) return false;
    const duration = ctrl.getDuration?.() ?? 0;
    if (duration <= 0) return false;
    const region: IRegion = { start: 0, end: duration, label: '' };
    return regionsJsonFromList([region], boldDefaultSegParams);
  }, [controlsRef]);

  const needsVerseReseed = useCallback(
    (regionJson: string, allSegs: string): boolean => {
      if (!constrainAutoSegmentWithVerses || !shouldReseedFromVerses) {
        return false;
      }
      if (!hasPhraseRegions(regionJson)) return true;
      const verseJson = getSegments(NamedRegions.Verse, allSegs);
      if (!hasPhraseRegions(verseJson)) return false;
      return regionBoundariesEqual(regionJson, verseJson);
    },
    [constrainAutoSegmentWithVerses, shouldReseedFromVerses]
  );

  /** Returns true when phrase regions exist on the player (created or loaded from storage). */
  const ensureSegments = useCallback(async (): Promise<boolean> => {
    const ctrl = controlsRef.current;
    if (!ctrl?.isReady() || !mediafile || bootstrapInProgress.current) {
      return false;
    }
    if (bootstrapped && hasPhraseRegions(phraseSegString)) {
      if (ctrl?.isReady()) {
        loadRegionsOnPlayer(phraseSegString);
      }
      return true;
    }

    bootstrapInProgress.current = true;
    try {
      let allSegs = mediafile.attributes?.segments ?? '[]';
      let regionJson = getSegments(namedRegion, allSegs);
      const reseed = needsVerseReseed(regionJson, allSegs);

      if (!hasPhraseRegions(regionJson) || reseed) {
        if (singleSegmentMode) {
          const single = createSingleSegmentJson();
          if (!single) return false;
          regionJson = single;
        } else {
          const count = await ctrl.runAutoSegment?.(
            boldDefaultSegParams as IRegionParams
          );
          regionJson = ctrl.getRegionsJson?.() ?? '{}';
          if (!hasPhraseRegions(regionJson) && (count ?? 0) <= 0) {
            return false;
          }
          const toSave = regionsJsonFromList(
            parseRegions(regionJson).regions,
            boldDefaultSegParams
          );
          regionJson = toSave;
        }
        allSegs =
          (await persistSegmentBucket(namedRegion, regionJson, allSegs)) ??
          allSegs;
        loadRegionsOnPlayer(regionJson);
      } else {
        loadRegionsOnPlayer(regionJson);
      }

      if (!hasPhraseRegions(regionJson)) return false;

      setPhraseSegString(regionJson);
      setBootstrapped(true);
      ctrl.applyRegionColors?.();
      return true;
    } finally {
      bootstrapInProgress.current = false;
    }
  }, [
    controlsRef,
    mediafile,
    bootstrapped,
    phraseSegString,
    namedRegion,
    singleSegmentMode,
    persistSegmentBucket,
    loadRegionsOnPlayer,
    createSingleSegmentJson,
    needsVerseReseed,
  ]);

  const resegmentWithParams = useCallback(
    async (params: IRegionParams): Promise<string | false> => {
      if (singleSegmentMode) return false;
      const ctrl = controlsRef.current;
      if (!ctrl?.isReady() || !mediafile) return false;
      const count = await ctrl.runAutoSegment?.(params);
      let regionJson = ctrl.getRegionsJson?.() ?? '{}';
      if (!hasPhraseRegions(regionJson) && (count ?? 0) <= 0) {
        return false;
      }
      try {
        const parsed = JSON.parse(regionJson) as { regions?: IRegion[] };
        regionJson = regionsJsonFromList(parsed.regions ?? [], params);
      } catch {
        return false;
      }
      await persistSegmentBucket(namedRegion, regionJson);
      setPhraseSegString(regionJson);
      loadRegionsOnPlayer(regionJson);
      setBootstrapped(true);
      return regionJson;
    },
    [
      controlsRef,
      mediafile,
      namedRegion,
      singleSegmentMode,
      persistSegmentBucket,
      loadRegionsOnPlayer,
    ]
  );

  const resetToDefaultSegments = useCallback((): Promise<string | false> => {
    if (singleSegmentMode) {
      const single = createSingleSegmentJson();
      if (!single || !mediafile) return Promise.resolve(false);
      return persistSegmentBucket(namedRegion, single).then((saved) => {
        if (!saved) return false;
        setPhraseSegString(single);
        loadRegionsOnPlayer(single);
        setBootstrapped(true);
        return single;
      });
    }
    return resegmentWithParams(boldDefaultSegParams as IRegionParams);
  }, [
    singleSegmentMode,
    createSingleSegmentJson,
    mediafile,
    persistSegmentBucket,
    namedRegion,
    loadRegionsOnPlayer,
    resegmentWithParams,
  ]);

  return {
    phraseSegString,
    setPhraseSegString,
    bootstrapped,
    ensureSegments,
    resetForMediafile,
    resegmentWithParams,
    resetToDefaultSegments,
    persistPhraseSegments: (regionJson: string) =>
      persistSegmentBucket(namedRegion, regionJson),
  };
}

/** BOLD Careful Speech — clause regions on vernacular. */
export function useCarefulSpeechSegments(
  mediafile: MediaFileD | undefined,
  controlsRef: React.RefObject<WSAudioPlayerControls | null>
) {
  return useGuidedPhraseSegments(mediafile, controlsRef, {
    namedRegion: NamedRegions.Clause,
  });
}
