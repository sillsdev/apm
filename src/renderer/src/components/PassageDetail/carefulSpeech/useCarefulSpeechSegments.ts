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
import { hasClauseRegions, regionsJsonFromList } from './carefulSpeechBoundary';
import { MediaFileD } from '../../../model';
import { useProjectSegmentSave } from '../Internalization/useProjectSegmentSave';

export function useCarefulSpeechSegments(
  mediafile: MediaFileD | undefined,
  controlsRef: React.RefObject<WSAudioPlayerControls | null>
) {
  const projectSegmentSave = useProjectSegmentSave();
  const [clauseSegString, setClauseSegString] = useState('{}');
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
    const clauseJson = getSegments(NamedRegions.Clause, allSegs);
    if (hasClauseRegions(clauseJson)) setClauseSegString(clauseJson);
  }, [mediafile]);

  const resetForMediafile = useCallback(
    (mediafileId: string | undefined) => {
      if (mediafileIdRef.current === mediafileId) return;
      mediafileIdRef.current = mediafileId;
      bootstrapInProgress.current = false;
      setBootstrapped(false);
      setClauseSegString('{}');
      if (mediafileId) hydrateFromMediafile();
    },
    [hydrateFromMediafile]
  );

  const loadClauseOnPlayer = useCallback(
    (clauseJson: string) => {
      controlsRef.current?.loadRegionsJson?.(clauseJson);
      controlsRef.current?.applyRegionColors?.();
    },
    [controlsRef]
  );

  /** Returns true when clause regions exist on the player (created or loaded from storage). */
  const ensureSegments = useCallback(async (): Promise<boolean> => {
    const ctrl = controlsRef.current;
    if (!ctrl?.isReady() || !mediafile || bootstrapInProgress.current) {
      return false;
    }
    if (bootstrapped && hasClauseRegions(clauseSegString)) {
      if (ctrl?.isReady()) {
        loadClauseOnPlayer(clauseSegString);
      }
      return true;
    }

    bootstrapInProgress.current = true;
    try {
      let allSegs = mediafile.attributes?.segments ?? '[]';
      let clauseJson = getSegments(NamedRegions.Clause, allSegs);

      if (!hasClauseRegions(clauseJson)) {
        const count = await ctrl.runAutoSegment?.(
          boldDefaultSegParams as IRegionParams
        );
        clauseJson = ctrl.getRegionsJson?.() ?? '{}';
        if (!hasClauseRegions(clauseJson) && (count ?? 0) <= 0) {
          return false;
        }
        const toSave = regionsJsonFromList(
          parseRegions(clauseJson).regions,
          boldDefaultSegParams
        );
        allSegs =
          (await persistSegmentBucket(NamedRegions.Clause, toSave, allSegs)) ??
          allSegs;
        clauseJson = toSave;
        loadClauseOnPlayer(clauseJson);
      } else {
        loadClauseOnPlayer(clauseJson);
      }

      if (!hasClauseRegions(clauseJson)) return false;

      setClauseSegString(clauseJson);
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
    clauseSegString,
    persistSegmentBucket,
    loadClauseOnPlayer,
  ]);

  const resegmentWithParams = useCallback(
    async (params: IRegionParams): Promise<string | false> => {
      const ctrl = controlsRef.current;
      if (!ctrl?.isReady() || !mediafile) return false;
      const count = await ctrl.runAutoSegment?.(params);
      let clauseJson = ctrl.getRegionsJson?.() ?? '{}';
      if (!hasClauseRegions(clauseJson) && (count ?? 0) <= 0) {
        return false;
      }
      try {
        const parsed = JSON.parse(clauseJson) as { regions?: IRegion[] };
        clauseJson = regionsJsonFromList(parsed.regions ?? [], params);
      } catch {
        return false;
      }
      await persistSegmentBucket(NamedRegions.Clause, clauseJson);
      setClauseSegString(clauseJson);
      loadClauseOnPlayer(clauseJson);
      setBootstrapped(true);
      return clauseJson;
    },
    [controlsRef, mediafile, persistSegmentBucket, loadClauseOnPlayer]
  );

  const resetToDefaultSegments = useCallback(
    (): Promise<string | false> =>
      resegmentWithParams(boldDefaultSegParams as IRegionParams),
    [resegmentWithParams]
  );

  return {
    clauseSegString,
    setClauseSegString,
    bootstrapped,
    ensureSegments,
    resetForMediafile,
    resegmentWithParams,
    resetToDefaultSegments,
    persistClauseSegments: (regionJson: string) =>
      persistSegmentBucket(NamedRegions.Clause, regionJson),
  };
}
