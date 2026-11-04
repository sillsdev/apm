import { ToolSlug } from '../../crud/toolSlug';
import { reviewTranscribeName } from './reviewTranscribeName';

const transcribe = 'Transcribe';
const review = 'Review Transcription';

const step = (tool: string, settings: string) => ({ tool, settings });

describe('reviewTranscribeName', () => {
  it('renames an exact Transcribe name when another Transcribe step has no settings', () => {
    expect(
      reviewTranscribeName(
        transcribe,
        transcribe,
        review,
        [step(ToolSlug.Transcribe, ''), step(ToolSlug.Discuss, '')],
        1
      )
    ).toBe(review);
  });

  it('leaves a name that already includes a language or artifact', () => {
    const steps = [step(ToolSlug.Transcribe, '')];
    expect(
      reviewTranscribeName('Transcribe English', transcribe, review, steps, 1)
    ).toBe('Transcribe English');
    expect(
      reviewTranscribeName('Transcribe Phrase BT', transcribe, review, steps, 1)
    ).toBe('Transcribe Phrase BT');
  });

  it('does not treat saved vernacular settings as an unset Transcribe step', () => {
    expect(
      reviewTranscribeName(transcribe, transcribe, review, [
        step(ToolSlug.Transcribe, '{"artifactTypeId":null}'),
      ])
    ).toBe(transcribe);
    expect(
      reviewTranscribeName(transcribe, transcribe, review, [
        step(ToolSlug.Transcribe, '{"spellCheck":false}'),
      ])
    ).toBe(transcribe);
  });

  it('ignores the step being named', () => {
    expect(
      reviewTranscribeName(
        transcribe,
        transcribe,
        review,
        [step(ToolSlug.Transcribe, '')],
        0
      )
    ).toBe(transcribe);
  });
});
