import { ToolSlug } from '../../crud/toolSlug';

export const boldDesktopStepCompleteTools = [
  ToolSlug.Prompt,
  ToolSlug.Record,
  ToolSlug.CarefulSpeech,
  ToolSlug.PhraseBackTranslate,
];

export const showsBoldDesktopStepComplete = (tool: string) =>
  boldDesktopStepCompleteTools.includes(tool as ToolSlug);
