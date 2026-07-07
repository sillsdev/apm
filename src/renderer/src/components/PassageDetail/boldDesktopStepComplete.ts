import { ToolSlug } from '../../crud/toolSlug';
import { isBoldClauseTranscriptionStep } from './boldClauseTranscription';

export const boldDesktopStepCompleteTools = [
  ToolSlug.Prompt,
  ToolSlug.Record,
  ToolSlug.CarefulSpeech,
  ToolSlug.PhraseBackTranslate,
];

export function showsBoldDesktopStepComplete(
  tool: string,
  isBoldWorkflow?: boolean,
  artifactSlug?: string | null
): boolean {
  if (boldDesktopStepCompleteTools.includes(tool as ToolSlug)) {
    return true;
  }
  if (isBoldWorkflow && artifactSlug !== undefined) {
    return isBoldClauseTranscriptionStep(tool, isBoldWorkflow, artifactSlug);
  }
  return false;
}
