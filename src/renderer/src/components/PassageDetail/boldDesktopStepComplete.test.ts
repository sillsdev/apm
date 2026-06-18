import { ToolSlug } from '../../crud/toolSlug';
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
    ]);
  });

  it('returns true only for BOLD desktop step-complete tools', () => {
    expect(showsBoldDesktopStepComplete(ToolSlug.Prompt)).toBe(true);
    expect(showsBoldDesktopStepComplete(ToolSlug.Record)).toBe(true);
    expect(showsBoldDesktopStepComplete(ToolSlug.CarefulSpeech)).toBe(true);
    expect(showsBoldDesktopStepComplete(ToolSlug.Verses)).toBe(false);
  });
});
