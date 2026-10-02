import { ArtifactTypeSlug } from '../../crud/artifactTypeSlug';
import { ToolSlug } from '../../crud/toolSlug';
import {
  configForRecordingArtifact,
  isBoldClauseTranscriptionStep,
  isBoldLwcTranscriptionStep,
  upstreamToolForRecordingArtifact,
} from './boldClauseTranscription';

describe('isBoldClauseTranscriptionStep', () => {
  it('is true for BOLD transcribe PBT', () => {
    expect(
      isBoldClauseTranscriptionStep(
        ToolSlug.Transcribe,
        true,
        ArtifactTypeSlug.PhraseBackTranslation
      )
    ).toBe(true);
  });

  it('is true for BOLD transcribe Careful Speech', () => {
    expect(
      isBoldClauseTranscriptionStep(
        ToolSlug.Transcribe,
        true,
        ArtifactTypeSlug.CarefulSpeech
      )
    ).toBe(true);
  });

  it('is false for non-BOLD', () => {
    expect(
      isBoldClauseTranscriptionStep(
        ToolSlug.Transcribe,
        false,
        ArtifactTypeSlug.PhraseBackTranslation
      )
    ).toBe(false);
  });

  it('is false for BOLD transcribe vernacular', () => {
    expect(
      isBoldClauseTranscriptionStep(
        ToolSlug.Transcribe,
        true,
        ArtifactTypeSlug.Vernacular
      )
    ).toBe(false);
  });

  it('is false for BOLD phrase back translate step', () => {
    expect(
      isBoldClauseTranscriptionStep(
        ToolSlug.PhraseBackTranslate,
        true,
        ArtifactTypeSlug.PhraseBackTranslation
      )
    ).toBe(false);
  });
});

describe('isBoldLwcTranscriptionStep', () => {
  it('remains PBT-only', () => {
    expect(
      isBoldLwcTranscriptionStep(
        ToolSlug.Transcribe,
        true,
        ArtifactTypeSlug.CarefulSpeech
      )
    ).toBe(false);
    expect(
      isBoldLwcTranscriptionStep(
        ToolSlug.Transcribe,
        true,
        ArtifactTypeSlug.PhraseBackTranslation
      )
    ).toBe(true);
  });
});

describe('configForRecordingArtifact', () => {
  it('returns LWC config for PBT', () => {
    expect(
      configForRecordingArtifact(ArtifactTypeSlug.PhraseBackTranslation)
    ).toMatchObject({
      stringsLayout: 'lwcTranscription',
      idPrefix: 'lwc-transcription',
    });
  });

  it('returns Careful config for Careful Speech', () => {
    expect(
      configForRecordingArtifact(ArtifactTypeSlug.CarefulSpeech)
    ).toMatchObject({
      stringsLayout: 'carefulTranscription',
      idPrefix: 'careful-transcription',
    });
  });
});

describe('upstreamToolForRecordingArtifact', () => {
  it('maps artifacts to upstream recording tools', () => {
    expect(
      upstreamToolForRecordingArtifact(ArtifactTypeSlug.CarefulSpeech)
    ).toBe(ToolSlug.CarefulSpeech);
    expect(
      upstreamToolForRecordingArtifact(ArtifactTypeSlug.PhraseBackTranslation)
    ).toBe(ToolSlug.PhraseBackTranslate);
  });
});
