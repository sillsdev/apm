import { shallowEqual, useSelector } from 'react-redux';
import { useMemo } from 'react';
import { ArtifactTypeSlug, useArtifactType, useStepTool } from '../../crud';
import usePassageDetailContext from '../../context/usePassageDetailContext';
import { useRenderProfiler } from '../../utils/perf';
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
    noStepLanguage: strings.noStepLanguage,
    resetConfirmRecordings: strings.resetConfirmRecordings,
    resetConfirmBoundaries: strings.resetConfirmBoundaries,
  };
}

interface IProps {
  width: number;
}

export function PassageDetailPhraseBackTranslate({ width }: IProps) {
  useRenderProfiler('PassageDetailPhraseBackTranslate');
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
      // slugFromId accepts a slug (current format) or a remote/local id (legacy).
      const slug = slugFromId(id) as ArtifactTypeSlug;
      if (slug && slug !== ArtifactTypeSlug.Vernacular) return slug;
    }
    return ArtifactTypeSlug.PhraseBackTranslation;
  }, [stepSettingsParsed, slugFromId]);

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
