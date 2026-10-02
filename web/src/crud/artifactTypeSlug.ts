export enum ArtifactTypeSlug {
  Vernacular = 'vernacular',
  WholeBackTranslation = 'wholebacktranslation',
  PhraseBackTranslation = 'backtranslation',
  CarefulSpeech = 'carefulspeech',
  Retell = 'retell',
  QandA = 'qanda',
  Comment = 'comment',
  Activity = 'activity',
  Resource = 'resource',
  SharedResource = 'sharedresource',
  ProjectResource = 'projectresource',
  IntellectualProperty = 'intellectualproperty',
  KeyTerm = 'keyterm',
  Title = 'title',
  Graphic = 'graphic',
  AIResource = 'airesource',
}

/** Vernacular phrase steps that use segmented regions on the passage waveform. */
export const isPhraseSegmentArtifact = (slug: ArtifactTypeSlug): boolean =>
  slug === ArtifactTypeSlug.PhraseBackTranslation ||
  slug === ArtifactTypeSlug.CarefulSpeech;

/**
 * Artifacts whose takes are stamped with the step's `languagebcp47`, and so are
 * the only ones a Transcribe step may scope by step language.
 *
 * Deliberately narrower than {@link isPhraseSegmentArtifact}: Careful Speech is
 * a phrase-segment artifact, but `CAREFUL_SPEECH_CONFIG.requireBoldWorkflow`
 * makes `stepLanguageField` resolve to `undefined`, so its takes are recorded
 * untagged and BOLD keeps shared `clause` boundaries instead of per-language
 * ones. Scoping a Careful Speech step by a step language would drop every one of
 * its own recordings — reachable because the Transcribe step editor keeps
 * `language` when the artifact type changes.
 */
export const artifactStampsStepLanguage = (slug: ArtifactTypeSlug): boolean =>
  slug === ArtifactTypeSlug.PhraseBackTranslation;
