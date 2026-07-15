import { shallowEqual, useSelector } from 'react-redux';
import { useMemo } from 'react';
import { RecordKeyMap } from '@orbit/records';
import {
  ArtifactTypeSlug,
  remoteIdGuid,
  useArtifactType,
  useStepTool,
} from '../../crud';
import { useGlobal } from '../../context/useGlobal';
import usePassageDetailContext from '../../context/usePassageDetailContext';
import { NamedRegions } from '../../utils/namedSegments';
import PassageDetailGuidedPhraseRecord from './PassageDetailGuidedPhraseRecord';
import {
  phraseBackTranslateConfig,
  type IGuidedPhraseRecordControlStrings,
} from './guidedPhraseRecord/types';
import { phraseBackTranslationGuidedSelector } from '../../selector';
import { IPhraseBackTranslationGuidedStrings } from '../../model';

function phraseBackNamedRegionFromSettings(
  parsed: Record<string, unknown> | null
): NamedRegions {
  if (!parsed) return NamedRegions.BackTranslation;
  const nr = parsed.namedRegion;
  if (
    typeof nr === 'string' &&
    Object.values(NamedRegions).includes(nr as NamedRegions)
  ) {
    return nr as NamedRegions;
  }
  return NamedRegions.BackTranslation;
}

function mapPhraseBackGuidedStrings(
  strings: IPhraseBackTranslationGuidedStrings
): IGuidedPhraseRecordControlStrings {
  return {
    allComplete: strings.allComplete,
    unitLabel: strings.segment,
    clearRecording: strings.clearRecording,
    combineWithNext: strings.combineWithNextSegment,
    fewerUnits: strings.fewerSegments,
    moreUnits: strings.moreSegments,
    nextUnit: strings.nextSegment,
    splitUnit: strings.splitSegment,
    speaker: strings.speaker,
    startRecording: strings.startRecording,
    undo: strings.undo,
  };
}

interface IProps {
  width: number;
}

export function PassageDetailPhraseBackTranslate({ width }: IProps) {
  const [memory] = useGlobal('memory');
  const { currentstep } = usePassageDetailContext();
  const { settings } = useStepTool(currentstep);
  const { slugFromId } = useArtifactType();
  const guidedStrings = useSelector(
    phraseBackTranslationGuidedSelector,
    shallowEqual
  );

  const stepSettingsParsed = useMemo(() => {
    if (typeof settings === 'string') {
      try {
        return JSON.parse(settings || '{}') as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return (settings as Record<string, unknown>) ?? null;
  }, [settings]);

  const artifactSlug = useMemo((): ArtifactTypeSlug => {
    const id = stepSettingsParsed?.artifactTypeId as string | undefined;
    if (id) {
      const resolved =
        remoteIdGuid('artifacttype', id, memory?.keyMap as RecordKeyMap) ?? id;
      const slug = slugFromId(resolved) as ArtifactTypeSlug;
      if (slug && slug !== ArtifactTypeSlug.Vernacular) return slug;
    }
    return ArtifactTypeSlug.PhraseBackTranslation;
  }, [stepSettingsParsed, memory?.keyMap, slugFromId]);

  const namedRegion = useMemo(
    () => phraseBackNamedRegionFromSettings(stepSettingsParsed),
    [stepSettingsParsed]
  );

  const config = useMemo(
    () => phraseBackTranslateConfig(artifactSlug, namedRegion),
    [artifactSlug, namedRegion]
  );

  const controlStrings = useMemo(
    () => mapPhraseBackGuidedStrings(guidedStrings),
    [guidedStrings]
  );

  return (
    <PassageDetailGuidedPhraseRecord
      width={width}
      config={config}
      controlStrings={controlStrings}
    />
  );
}

export default PassageDetailPhraseBackTranslate;
