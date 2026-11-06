import { ToolSlug } from '../../crud/toolSlug';
import { resolveReviewTranscribeName } from './resolveReviewTranscribeName';

const transcribe = 'Transcribe';
const review = 'Review Transcription';

const step = (tool: string, settings: string) => ({ tool, settings });

describe('resolveReviewTranscribeName', () => {
  it('renames an exact Transcribe name when another Transcribe step has no settings', () => {
    expect(
      resolveReviewTranscribeName({
        name: transcribe,
        transcribeLabel: transcribe,
        reviewLabel: review,
        steps: [step(ToolSlug.Transcribe, ''), step(ToolSlug.Discuss, '')],
        index: 1,
      })
    ).toBe(review);
  });

  it('leaves a name that already includes a language or artifact', () => {
    const steps = [step(ToolSlug.Transcribe, '')];
    expect(
      resolveReviewTranscribeName({
        name: 'Transcribe English',
        transcribeLabel: transcribe,
        reviewLabel: review,
        steps,
        index: 1,
      })
    ).toBe('Transcribe English');
    expect(
      resolveReviewTranscribeName({
        name: 'Transcribe Phrase BT',
        transcribeLabel: transcribe,
        reviewLabel: review,
        steps,
        index: 1,
      })
    ).toBe('Transcribe Phrase BT');
  });

  it('does not treat saved vernacular settings as an unset Transcribe step', () => {
    expect(
      resolveReviewTranscribeName({
        name: transcribe,
        transcribeLabel: transcribe,
        reviewLabel: review,
        steps: [step(ToolSlug.Transcribe, '{"artifactTypeId":null}')],
      })
    ).toBe(transcribe);
    expect(
      resolveReviewTranscribeName({
        name: transcribe,
        transcribeLabel: transcribe,
        reviewLabel: review,
        steps: [step(ToolSlug.Transcribe, '{"spellCheck":false}')],
      })
    ).toBe(transcribe);
  });

  it('ignores the step being named', () => {
    expect(
      resolveReviewTranscribeName({
        name: transcribe,
        transcribeLabel: transcribe,
        reviewLabel: review,
        steps: [step(ToolSlug.Transcribe, '')],
        index: 0,
      })
    ).toBe(transcribe);
  });

  it('does not treat malformed settings as unset', () => {
    expect(
      resolveReviewTranscribeName({
        name: transcribe,
        transcribeLabel: transcribe,
        reviewLabel: review,
        steps: [step(ToolSlug.Transcribe, '{not-json')],
      })
    ).toBe(transcribe);
  });
});
