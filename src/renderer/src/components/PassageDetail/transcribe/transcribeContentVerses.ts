/** Escape a verse label for use inside a RegExp character class or pattern. */
function escapeVerseLabel(label: string): string {
  return label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Derive which verse labels already have transcription content in the editor.
 * Mirrors legacy Transcriber contentVerses tracking.
 */
export function deriveContentVerses(
  transcription: string,
  verseLabels: string[]
): string[] {
  if (!transcription) return [];
  const newContentVerses: string[] = [];
  verseLabels.forEach((label) => {
    const pat = new RegExp(`\\\\v\\s+${escapeVerseLabel(label)}\\s+[^\\\\]`);
    if (pat.test(transcription)) {
      newContentVerses.push(label);
    }
  });
  if (newContentVerses.length === 0) {
    if (!/\\v/.test(transcription)) {
      newContentVerses.push('no-verses');
    }
  }
  return newContentVerses;
}

/**
 * Extract verse labels from Mark Verses region labels (e.g. "1:11" -> "11").
 */
export function verseLabelsFromMarkVersesRegions(
  regionLabels: string[]
): string[] {
  const labels: string[] = [];
  regionLabels.forEach((label) => {
    const vnum = label?.split(':')[1];
    if (vnum) labels.push(vnum);
  });
  return labels;
}
