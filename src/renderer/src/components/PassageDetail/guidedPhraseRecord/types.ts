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
  /** Shown when Phrase BT step has no language configured. */
  noStepLanguage?: string;
  /** Phrase BT Reset confirm when recordings exist. */
  resetConfirmRecordings?: string;
  /** Phrase BT Reset confirm when only boundaries changed. */
  resetConfirmBoundaries?: string;
}

/** What distinguishes one guided-phrase take from another. */
export interface GuidedPhraseFilenameParts {
  /** 0-based segment/clause index. */
  unitIndex: number;
  /** Version of the vernacular being recorded against. */
  sourceVersion: number;
  /** Step language, for steps that can have a sibling step in another one. */
  languageBcp47?: string;
  /**
   * When this attempt was made, distinguishing it from the ones it replaces.
   * Clearing a take deletes its mediafile but not the audio cached under its
   * name, so without this the next attempt at the same segment reads back the
   * discarded one.
   */
  takeToken?: string;
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
  /** Merge Mark Verses into auto-segment (initial seed and More/Less). */
  constrainAutoSegmentWithVerses: boolean;
  /** Show player +/− under the reference waveform. */
  showPlayerSegmentControls: boolean;
  /** Show Reset under the waveform during the recording pass only. */
  showSegmentResetInRecordingPass: boolean;
  /** Multi-level segment undo under the waveform (vs one-level Split/Combine undo). */
  multiLevelSegmentUndo: boolean;
  /** Prev/next segment arrows flanking Record instead of first-incomplete Next. */
  sequentialUnitNavAroundRecord: boolean;
  /** Persist segment map on vernacular named regions (false for Retell). */
  persistSegments: boolean;
  /**
   * Filename postfix for one take.
   *
   * The result has to be unique per take, not just pretty: the uploaded name
   * becomes the media object's name, and `dataPath` resolves a mediafile's
   * audioUrl to `<offlineData>/media/<basename>`. Two takes uploaded under one
   * name therefore share a single cached file, and whichever was cached first
   * is what plays for both (TT-7643).
   */
  buildFilenamePostfix: (opts: GuidedPhraseFilenameParts) => string;
}

const carefulSpeechBoundaryDefaults = {
  constrainAutoSegmentWithVerses: false,
  showPlayerSegmentControls: false,
  showSegmentResetInRecordingPass: false,
  multiLevelSegmentUndo: false,
  sequentialUnitNavAroundRecord: false,
  persistSegments: true,
} as const;

export const CAREFUL_SPEECH_CONFIG: GuidedPhraseRecordConfig = {
  namedRegion: NamedRegions.Clause,
  defaultArtifactSlug: ArtifactTypeSlug.CarefulSpeech,
  mediaRecordToolId: 'CarefulSpeechTool',
  singleSegmentMode: false,
  showBoundaryTools: true,
  speakerLocalKey: LocalKey.carefulSpeaker,
  containerId: 'careful-speech',
  requireBoldWorkflow: true,
  ...carefulSpeechBoundaryDefaults,
  buildFilenamePostfix: ({ unitIndex, sourceVersion, takeToken }) =>
    `carefulspeech${unitIndex + 1}_v${sourceVersion}${
      takeToken ? `_t${takeToken}` : ''
    }`,
};

export function phraseBackTranslateConfig(
  artifactSlug: ArtifactTypeSlug,
  namedRegion: NamedRegions
): GuidedPhraseRecordConfig {
  const singleSegmentMode = artifactSlug === ArtifactTypeSlug.Retell;
  const phraseBoundaryTools = !singleSegmentMode;
  return {
    namedRegion,
    defaultArtifactSlug: artifactSlug,
    mediaRecordToolId: 'PhraseBackTranslateTool',
    singleSegmentMode,
    showBoundaryTools: phraseBoundaryTools,
    speakerLocalKey: LocalKey.phraseBackSpeaker,
    containerId: 'phrase-back-translate',
    requireBoldWorkflow: false,
    constrainAutoSegmentWithVerses: phraseBoundaryTools,
    showPlayerSegmentControls: phraseBoundaryTools,
    showSegmentResetInRecordingPass: phraseBoundaryTools,
    multiLevelSegmentUndo: phraseBoundaryTools,
    sequentialUnitNavAroundRecord: phraseBoundaryTools,
    persistSegments: phraseBoundaryTools,
    buildFilenamePostfix: ({
      unitIndex,
      sourceVersion,
      languageBcp47,
      takeToken,
    }) => {
      const base = `${artifactSlug}${unitIndex + 1}_v${sourceVersion}`;
      const unit = unitIndex > 0 ? `${base}s${unitIndex}` : base;
      // A Phrase BT step per language records the same segment of the same
      // vernacular, so without the language every one of them uploads under
      // the same name. Takes made before this stay on their old names.
      const lang = languageBcp47 ? `${unit}_${languageBcp47}` : unit;
      return `${lang}${takeToken ? `_t${takeToken}` : ''}`;
    },
  };
}
