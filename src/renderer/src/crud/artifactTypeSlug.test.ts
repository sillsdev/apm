import {
  ArtifactTypeSlug,
  artifactStampsStepLanguage,
  isPhraseSegmentArtifact,
} from './artifactTypeSlug';

describe('isPhraseSegmentArtifact', () => {
  it('covers the artifacts recorded against waveform segments', () => {
    expect(
      isPhraseSegmentArtifact(ArtifactTypeSlug.PhraseBackTranslation)
    ).toBe(true);
    expect(isPhraseSegmentArtifact(ArtifactTypeSlug.CarefulSpeech)).toBe(true);
  });

  it('excludes artifacts recorded whole', () => {
    expect(isPhraseSegmentArtifact(ArtifactTypeSlug.WholeBackTranslation)).toBe(
      false
    );
    expect(isPhraseSegmentArtifact(ArtifactTypeSlug.Vernacular)).toBe(false);
    expect(isPhraseSegmentArtifact(ArtifactTypeSlug.Retell)).toBe(false);
    expect(isPhraseSegmentArtifact(ArtifactTypeSlug.QandA)).toBe(false);
  });
});

describe('artifactStampsStepLanguage', () => {
  it('is true only for Phrase BT, whose takes carry languagebcp47', () => {
    expect(
      artifactStampsStepLanguage(ArtifactTypeSlug.PhraseBackTranslation)
    ).toBe(true);
  });

  it('excludes Careful Speech, whose BOLD takes are recorded untagged', () => {
    // CAREFUL_SPEECH_CONFIG sets requireBoldWorkflow, so stepLanguageField is
    // undefined and takes persist languagebcp47 ''. Scoping a Careful Speech
    // Transcribe step by step language would drop all of its own recordings.
    expect(artifactStampsStepLanguage(ArtifactTypeSlug.CarefulSpeech)).toBe(
      false
    );
  });

  it('excludes the types a Transcribe step must never language-scope', () => {
    expect(
      artifactStampsStepLanguage(ArtifactTypeSlug.WholeBackTranslation)
    ).toBe(false);
    expect(artifactStampsStepLanguage(ArtifactTypeSlug.Vernacular)).toBe(false);
    expect(artifactStampsStepLanguage(ArtifactTypeSlug.Retell)).toBe(false);
    expect(artifactStampsStepLanguage(ArtifactTypeSlug.QandA)).toBe(false);
  });
});
