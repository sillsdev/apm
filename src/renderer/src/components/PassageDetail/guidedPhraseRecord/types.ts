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
   * Filename postfix for a unit at `unitIndex` (0-based) on `sourceVersion`.
   * `languageBcp47` (the step LWC) disambiguates per-language recordings so
   * two languages of the same passage/version/segment do not collide on the
   * same S3 key. Ignored by single-language configs (e.g. Careful Speech).
   */
  buildFilenamePostfix: (
    unitIndex: number,
    sourceVersion: number,
    languageBcp47?: string
  ) => string;
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
  buildFilenamePostfix: (unitIndex, sourceVersion) =>
    `carefulspeech${unitIndex + 1}_v${sourceVersion}`,
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
    buildFilenamePostfix: (unitIndex, sourceVersion, languageBcp47) => {
      const base = `${artifactSlug}${unitIndex + 1}_v${sourceVersion}`;
      const seg = unitIndex > 0 ? `${base}s${unitIndex}` : base;
      // TT-7557: Phrase BT / Retell are recorded once per language against the
      // same vernacular source. Without the language in the S3 key, English and
      // French of the same passage/version/segment produce identical filenames,
      // so whichever uploads last overwrites the other's audio (English rows
      // then play the French audio). Append the step LWC to keep keys distinct.
      // Single-language projects (no active language filter) keep legacy names.
      return languageBcp47 && languageBcp47 !== 'und'
        ? `${seg}_${languageBcp47}`
        : seg;
    },
  };
}
