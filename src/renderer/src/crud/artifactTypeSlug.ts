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

/**
 * Every artifact-type slug (the `typename` values). This is the single source of
 * truth — derive lists/lookups from here rather than hardcoding slug literals.
 */
export const artifactTypeSlugs: ArtifactTypeSlug[] =
  Object.values(ArtifactTypeSlug);

const artifactTypeSlugSet: ReadonlySet<string> = new Set<string>(
  artifactTypeSlugs
);

/** Type guard: true when a value is a known {@link ArtifactTypeSlug}. */
export const isArtifactTypeSlug = (value: unknown): value is ArtifactTypeSlug =>
  typeof value === 'string' && artifactTypeSlugSet.has(value);

/** Vernacular phrase steps that use segmented regions on the passage waveform. */
export const isPhraseSegmentArtifact = (slug: ArtifactTypeSlug): boolean =>
  slug === ArtifactTypeSlug.PhraseBackTranslation ||
  slug === ArtifactTypeSlug.CarefulSpeech;
