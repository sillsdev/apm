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
