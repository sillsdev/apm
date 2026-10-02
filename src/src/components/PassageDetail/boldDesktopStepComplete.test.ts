import { ToolSlug } from '../../crud/toolSlug';
import { ArtifactTypeSlug } from '../../crud/artifactTypeSlug';
import {
  boldDesktopStepCompleteTools,
  showsBoldDesktopStepComplete,
} from './boldDesktopStepComplete';

describe('boldDesktopStepComplete', () => {
  it('includes Prompt, Record, and Careful Speech', () => {
    expect(boldDesktopStepCompleteTools).toEqual([
      ToolSlug.Prompt,
      ToolSlug.Record,
      ToolSlug.CarefulSpeech,
      ToolSlug.PhraseBackTranslate,
    ]);
  });

  it('returns true only for BOLD desktop step-complete tools', () => {
    expect(showsBoldDesktopStepComplete(ToolSlug.Prompt)).toBe(true);
    expect(showsBoldDesktopStepComplete(ToolSlug.Record)).toBe(true);
    expect(showsBoldDesktopStepComplete(ToolSlug.CarefulSpeech)).toBe(true);
    expect(showsBoldDesktopStepComplete(ToolSlug.Verses)).toBe(false);
  });

  it('returns true for BOLD LWC Transcription', () => {
    expect(
      showsBoldDesktopStepComplete(
        ToolSlug.Transcribe,
        true,
        ArtifactTypeSlug.PhraseBackTranslation
      )
    ).toBe(true);
  });

  it('returns true for BOLD Careful Transcription', () => {
    expect(
      showsBoldDesktopStepComplete(
        ToolSlug.Transcribe,
        true,
        ArtifactTypeSlug.CarefulSpeech
      )
    ).toBe(true);
  });

  it('returns false for non-BOLD transcribe', () => {
    expect(
      showsBoldDesktopStepComplete(
        ToolSlug.Transcribe,
        false,
        ArtifactTypeSlug.PhraseBackTranslation
      )
    ).toBe(false);
  });
});
