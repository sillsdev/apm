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
   *
   * The result has to be unique per take, not just pretty: the uploaded name
   * becomes the media object's name, and `dataPath` resolves a mediafile's
   * audioUrl to `<offlineData>/media/<basename>`. Two takes uploaded under one
   * name therefore share a single cached file, and whichever was cached first
   * is what plays for both. `languageBcp47` is passed for the steps that can
   * have a sibling step over the same audio in another language (TT-7643), and
   * `takeToken` tells apart the takes of one segment in one step - re-recording
   * a segment, with or without deleting the old take first, matches on every
   * other part of the name (TT-7432). Both are omitted for takes that predate
   * them, which keep the names they were uploaded under.
   */
  buildFilenamePostfix: (
    unitIndex: number,
    sourceVersion: number,
    languageBcp47?: string,
    takeToken?: string
  ) => string;
}

let lastTokenMs = 0;
let tokenSeq = 0;

/**
 * A token for one take, unique and ascending. The clock alone would do, but two
 * calls can land in the same millisecond, so same-millisecond calls get a
 * counter appended rather than the same token.
 */
export function newTakeToken(now: number = Date.now()): string {
  if (now === lastTokenMs) {
    tokenSeq += 1;
  } else {
    lastTokenMs = now;
    tokenSeq = 0;
  }
  const stamp = now.toString(36);
  return tokenSeq === 0 ? stamp : `${stamp}${tokenSeq.toString(36)}`;
}

/** `_`-joined name parts, skipping the ones this take has nothing for. */
const withParts = (base: string, ...parts: (string | undefined)[]): string =>
  [base, ...parts.filter((p) => p)].join('_');

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
  buildFilenamePostfix: (unitIndex, sourceVersion, _languageBcp47, takeToken) =>
    withParts(`carefulspeech${unitIndex + 1}_v${sourceVersion}`, takeToken),
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
    buildFilenamePostfix: (
      unitIndex,
      sourceVersion,
      languageBcp47,
      takeToken
    ) => {
      const base = `${artifactSlug}${unitIndex + 1}_v${sourceVersion}`;
      const unit = unitIndex > 0 ? `${base}s${unitIndex}` : base;
      // A Phrase BT step per language records the same segment of the same
      // vernacular, so without the language every one of them uploads under
      // the same name. Takes made before this stay on their old names.
      return withParts(unit, languageBcp47, takeToken);
    },
  };
}
