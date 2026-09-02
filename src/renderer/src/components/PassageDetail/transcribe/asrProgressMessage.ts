import {
  countPassageVerses,
  formatPassageEndingForProgress,
  formatTaskVerseLabelForProgress,
  passageVersePosition,
  PassageVerseSpanInput,
} from './passageVerseSpan';

/**
 * Build progress text: Transcribing {0} (verse {1}) of {2} (ending at verse {3})
 */
export function formatAsrProgressMessage(
  template: string,
  passage: PassageVerseSpanInput,
  taskVerseLabel: string
): string {
  const position = passageVersePosition(passage, taskVerseLabel);
  const total = countPassageVerses(passage);
  const label = formatTaskVerseLabelForProgress(passage, taskVerseLabel);
  const ending = formatPassageEndingForProgress(passage);

  return template
    .replace(/\{0\}/g, String(position))
    .replace(/\{1\}/g, label)
    .replace(/\{2\}/g, String(total))
    .replace(/\{3\}/g, ending);
}
