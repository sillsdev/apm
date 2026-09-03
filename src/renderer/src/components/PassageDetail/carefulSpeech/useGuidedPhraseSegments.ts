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
  /** Named-region bucket key (may be `BT:en`, not only NamedRegions enum). */
  namedRegion: string;
  /** When empty, try this bucket (e.g. legacy `BT`). */
  fallbackNamedRegion?: string;
  singleSegmentMode?: boolean;
  /** When false (Retell), never read/write vernacular named regions. */
  persistSegments?: boolean;
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
    fallbackNamedRegion,
    singleSegmentMode = false,
    persistSegments = true,
    constrainAutoSegmentWithVerses = false,
    shouldReseedFromVerses = false,
  } = options;
  const projectSegmentSave = useProjectSegmentSave();
  const [phraseSegString, setPhraseSegString] = useState('{}');
  const [bootstrapped, setBootstrapped] = useState(false);
  const bootstrapInProgress = useRef(false);
  const scopeRef = useRef<string | undefined>(undefined);

  const persistSegmentBucket = useCallback(
    async (
      name: string,
      regionJson: string,
      baseSegments?: string
    ): Promise<string | undefined> => {
      if (!persistSegments || !mediafile) return undefined;
      const prev = baseSegments ?? mediafile.attributes?.segments ?? '[]';
      const segments = updateSegments(name, prev, regionJson);
      await projectSegmentSave({ media: mediafile, segments });
      return segments;
    },
    [mediafile, projectSegmentSave, persistSegments]
  );

  const readRegionJson = useCallback(
    (allSegs: string): string => {
      const primary = getSegments(namedRegion, allSegs);
      if (hasPhraseRegions(primary)) return primary;
      if (fallbackNamedRegion) {
        const fallback = getSegments(fallbackNamedRegion, allSegs);
        if (hasPhraseRegions(fallback)) return fallback;
      }
      return primary;
    },
    [namedRegion, fallbackNamedRegion]
  );

  const hydrateFromMediafile = useCallback(() => {
    if (!mediafile) return;
    if (!persistSegments && singleSegmentMode) return;
    const allSegs = mediafile.attributes?.segments ?? '[]';
    const regionJson = readRegionJson(allSegs);
    if (hasPhraseRegions(regionJson)) setPhraseSegString(regionJson);
  }, [mediafile, persistSegments, singleSegmentMode, readRegionJson]);

  /**
   * Re-read boundaries for the scope now showing, unless it is the one already
   * loaded.
   *
   * The bucket is part of that scope, not just the audio: a team can configure
   * a Phrase BT step per language, and each reads its own `BT:<bcp47>`
   * boundaries off the same vernacular. Keyed on the mediafile alone, a step
   * change was rejected as a no-op and the next language opened on the previous
   * language's phrase boundaries (TT-7643).
   */
  const resetForScope = useCallback(
    (mediafileId: string | undefined) => {
      const scope = `${mediafileId ?? ''}|${namedRegion}`;
      if (scopeRef.current === scope) return;
      scopeRef.current = scope;
      bootstrapInProgress.current = false;
      setBootstrapped(false);
      setPhraseSegString('{}');
      if (mediafileId) hydrateFromMediafile();
    },
    [hydrateFromMediafile, namedRegion]
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
      if (!persistSegments && singleSegmentMode) {
        const single = createSingleSegmentJson();
        if (!single) return false;
        loadRegionsOnPlayer(single);
        setPhraseSegString(single);
        setBootstrapped(true);
        ctrl.applyRegionColors?.();
        return true;
      }

      let allSegs = mediafile.attributes?.segments ?? '[]';
      let regionJson = readRegionJson(allSegs);
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
            // Claude's suggestion for possible future implementation: auto-segment can legitimately yield nothing (e.g. audio
            // the silence math can't split), and returning false leaves the
            // 250ms bootstrap poll in PassageDetailGuidedPhraseRecord spinning
            // forever. Consider falling back to createSingleSegmentJson() here
            // when getDuration() > 0, and returning false only while the player
            // has no audio loaded yet.
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
    persistSegments,
    persistSegmentBucket,
    loadRegionsOnPlayer,
    createSingleSegmentJson,
    needsVerseReseed,
    readRegionJson,
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
      if (!persistSegments) {
        setPhraseSegString(single);
        loadRegionsOnPlayer(single);
        setBootstrapped(true);
        return Promise.resolve(single);
      }
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
    persistSegments,
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
    resetForScope,
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
