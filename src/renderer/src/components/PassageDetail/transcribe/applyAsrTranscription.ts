import { asrDebug, asrDebugPreview } from '../../../business/asr/asrDebug';

function escapeVerseLabel(label: string): string {
  return label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Strip optional Aero timestamp prefix from ASR text. */
export function cleanAsrTranscription(trans: string): string {
  return trans.replace(/[0-9]+:[0-9]+.[0-9]+: /g, '').trim();
}

/** Parse `\v label` from the start of an ASR chunk (label may be a range such as 3-4). */
export function parseVerseFromAsrChunk(cleanTrans: string): {
  verseLabel: string | undefined;
  text: string;
} {
  const m = /^\\v\s+([^\s\\]+)\s*(.*)$/s.exec(cleanTrans);
  if (!m) return { verseLabel: undefined, text: cleanTrans };
  return { verseLabel: m[1], text: m[2]?.trim() ?? '' };
}

/** True when the verse marker exists and already has non-whitespace content. */
export function verseHasTranscriptionContent(
  transcription: string,
  verseLabel: string
): boolean {
  const pat = new RegExp(
    `\\\\v\\s+${escapeVerseLabel(verseLabel)}\\s+[^\\\\\\s]`
  );
  return pat.test(transcription);
}

/**
 * Index immediately after an empty verse marker, or null if the marker is missing
 * or already has content.
 */
export function findEmptyVerseMarkerInsertIndex(
  transcription: string,
  verseLabel: string
): number | null {
  const markers = [`\\v ${verseLabel} `, `\\v${verseLabel} `];
  for (const marker of markers) {
    const idx = transcription.indexOf(marker);
    if (idx < 0) continue;
    const after = idx + marker.length;
    const rest = transcription.slice(after);
    const nextV = rest.search(/\\v/);
    const segment = nextV >= 0 ? rest.slice(0, nextV) : rest;
    if (segment.trim() === '') return after;
    return null;
  }
  return null;
}

/**
 * Apply one polled ASR chunk to the transcription text.
 * Never overwrites existing verse content; inserts after empty markers when present.
 */
export function applyAsrTranscription(
  currentText: string,
  asrChunk: string
): string {
  const cleanTrans = cleanAsrTranscription(asrChunk);
  if (!cleanTrans) {
    asrDebug('applyAsrTranscription noop', {
      reason: 'empty chunk after clean',
      chunkPreview: asrDebugPreview(asrChunk),
    });
    return currentText;
  }
  if (currentText.includes(cleanTrans)) {
    asrDebug('applyAsrTranscription noop', {
      reason: 'duplicate chunk in current text',
      chunkPreview: asrDebugPreview(cleanTrans),
    });
    return currentText;
  }

  const { verseLabel, text } = parseVerseFromAsrChunk(cleanTrans);
  const insertText = verseLabel
    ? text
    : cleanTrans.replace(/^\\v\s+[^\s\\]+\s*/, '').trim() || cleanTrans;

  if (verseLabel && verseHasTranscriptionContent(currentText, verseLabel)) {
    asrDebug('applyAsrTranscription noop', {
      reason: 'verse already has content',
      verseLabel,
      currentPreview: asrDebugPreview(currentText),
    });
    return currentText;
  }

  if (verseLabel) {
    const insertAt = findEmptyVerseMarkerInsertIndex(currentText, verseLabel);
    if (insertAt !== null) {
      asrDebug('applyAsrTranscription insert at marker', {
        verseLabel,
        insertAt,
        insertPreview: asrDebugPreview(insertText),
      });
      return (
        currentText.slice(0, insertAt) +
        insertText +
        currentText.slice(insertAt)
      );
    }
    asrDebug('applyAsrTranscription append marker', {
      verseLabel,
      insertPreview: asrDebugPreview(insertText),
    });
    const space =
      currentText && !/\s$/.test(currentText) ? ' ' : '';
    return currentText + space + `\\v ${verseLabel} ` + insertText;
  }

  asrDebug('applyAsrTranscription legacy append', {
    chunkPreview: asrDebugPreview(cleanTrans),
  });
  const legacyMatch = /\\v (\d+)\s?/.exec(cleanTrans);
  const index =
    legacyMatch && currentText.includes(legacyMatch[0])
      ? legacyMatch[0].length
      : 0;
  const space = /\s$/.test(currentText) ? '' : ' ';
  return currentText + space + cleanTrans.substring(index);
}
