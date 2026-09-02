import { IRegion } from '../../../crud/useWavesurferRegions';
import { refMatch } from '../../../utils/refMatch';
import { insertAtCursor } from '../../../utils/insertAtCursor';

/** Build `\v` marker for initial seed (no leading space / chapter). */
export function seedVerseMarkerText(regionLabel: string): string | undefined {
  const m = refMatch(regionLabel);
  if (!m) return undefined;
  const vNum = regionLabel.substring((m[1] as string).length + 1);
  if (!vNum) return undefined;
  return `\\v ${vNum} `;
}

/** Build marker text when navigating to a region (may include `\c` on ch 1 v 1). */
export function verseMarkerTextFromRegionLabel(
  regionLabel: string
): string | undefined {
  const m = refMatch(regionLabel);
  if (!m) return undefined;
  const vNum = regionLabel.substring((m[1] as string).length + 1);
  if (!vNum) return undefined;
  let refText = `\\v ${vNum} `;
  refText = ' ' + refText;
  if (parseInt(m[2] as string, 10) === 1) {
    refText = ` \\c ${m[1]} ` + refText;
  }
  return refText;
}

export function transcriptionHasVerseMarker(
  transcription: string,
  verseLabel: string
): boolean {
  return (
    transcription.indexOf(`\\v ${verseLabel} `) >= 0 ||
    transcription.indexOf(`\\v${verseLabel} `) >= 0
  );
}

/** String-based: insert verse marker if not already present. */
export function applyVerseMarkerToText(
  transcription: string,
  regionLabel: string
): string {
  const m = refMatch(regionLabel);
  if (!m) return transcription;
  const vNum = regionLabel.substring((m[1] as string).length + 1);
  if (!vNum) return transcription;
  if (transcriptionHasVerseMarker(transcription, vNum)) return transcription;
  const marker = verseMarkerTextFromRegionLabel(regionLabel);
  if (!marker) return transcription;
  return transcription + marker;
}

/** Seed first verse marker when transcription is empty (string path). */
export function seedFirstVerseMarker(
  transcription: string,
  sortedVerseRegions: IRegion[]
): string {
  if (transcription && transcription !== 'undefined') return transcription;
  const first = sortedVerseRegions.find((s) => s?.label && refMatch(s.label));
  if (!first?.label) return transcription === 'undefined' ? '' : transcription;
  const marker = seedVerseMarkerText(first.label);
  if (!marker) return '';
  return marker;
}

/** Insert marker for the region at `position` into a string. */
export function applyVerseMarkerForRegionPosition(
  transcription: string,
  sortedVerseRegions: IRegion[],
  position: number
): string {
  const ref = sortedVerseRegions.find((s) => s.start === position)?.label;
  if (!ref) return transcription;
  return applyVerseMarkerToText(transcription, ref);
}

/** Textarea path: insert marker at cursor when navigating to a region. */
export function insertVerseMarkerAtRegionPosition(
  textArea: HTMLTextAreaElement,
  sortedVerseRegions: IRegion[],
  position: number
): void {
  const ref = sortedVerseRegions.find((s) => s.start === position)?.label;
  const m = refMatch(ref || '');
  if (!ref || !m) return;
  const vNum = ref.substring((m[1] as string).length + 1);
  let refText = `\\v ${vNum} `;
  const refPos = textArea.value.indexOf(refText);
  const refPos2 = textArea.value.indexOf(`\\v${vNum} `);
  if (refPos === -1 && refPos2 === -1) {
    refText = vNum ? ' ' + refText : '';
    if (parseInt(m[2] as string, 10) === 1) {
      refText = ` \\c ${m[1]} ` + refText;
    }
    insertAtCursor(textArea, refText);
  }
}
