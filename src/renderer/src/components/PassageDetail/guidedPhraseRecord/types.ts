import { ArtifactTypeSlug } from '../../../crud/artifactTypeSlug';
import { NamedRegions } from '../../../utils/namedSegments';
import { LocalKey } from '../../../utils/localUserKey';

/** User-facing copy for listen/record controls (Clause or Segment labels). */
export interface IGuidedPhraseRecordControlStrings {
  allComplete: string;
  unitLabel: string;
  clearRecording: string;
  combineWithNext: string;
  fewerUnits: string;
  moreUnits: string;
  nextUnit: string;
  splitUnit: string;
  speaker: string;
  startRecording: string;
  undo: string;
}

export interface GuidedPhraseRecordConfig {
  namedRegion: NamedRegions;
  defaultArtifactSlug: ArtifactTypeSlug;
  mediaRecordToolId: string;
  singleSegmentMode: boolean;
  showBoundaryTools: boolean;
  speakerLocalKey: LocalKey;
  containerId: string;
  /** When true, show boldOnly-style gate instead of the step UI. */
  requireBoldWorkflow: boolean;
  /** Filename postfix for a unit at `unitIndex` (0-based) on `sourceVersion`. */
  buildFilenamePostfix: (unitIndex: number, sourceVersion: number) => string;
}

export const CAREFUL_SPEECH_CONFIG: GuidedPhraseRecordConfig = {
  namedRegion: NamedRegions.Clause,
  defaultArtifactSlug: ArtifactTypeSlug.CarefulSpeech,
  mediaRecordToolId: 'CarefulSpeechTool',
  singleSegmentMode: false,
  showBoundaryTools: true,
  speakerLocalKey: LocalKey.carefulSpeaker,
  containerId: 'careful-speech',
  requireBoldWorkflow: true,
  buildFilenamePostfix: (unitIndex, sourceVersion) =>
    `carefulspeech${unitIndex + 1}_v${sourceVersion}`,
};

export function phraseBackTranslateConfig(
  artifactSlug: ArtifactTypeSlug,
  namedRegion: NamedRegions
): GuidedPhraseRecordConfig {
  const singleSegmentMode = artifactSlug === ArtifactTypeSlug.Retell;
  return {
    namedRegion,
    defaultArtifactSlug: artifactSlug,
    mediaRecordToolId: 'PhraseBackTranslateTool',
    singleSegmentMode,
    showBoundaryTools: !singleSegmentMode,
    speakerLocalKey: LocalKey.phraseBackSpeaker,
    containerId: 'phrase-back-translate',
    requireBoldWorkflow: false,
    buildFilenamePostfix: (unitIndex, sourceVersion) => {
      const base = `${artifactSlug}${unitIndex + 1}_v${sourceVersion}`;
      if (unitIndex > 0) return `${base}s${unitIndex}`;
      return base;
    },
  };
}
