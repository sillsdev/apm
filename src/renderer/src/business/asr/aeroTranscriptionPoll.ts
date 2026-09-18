/** Poll envelope from Aero batch_transcription_status. */

export interface AeroProgress {
  completed: number;
  total: number;
}

export interface AeroPollSegment {
  start: number;
  end: number;
  transcription?: unknown;
}

export interface AeroPollClip {
  clip: string;
  state: string;
  progress?: AeroProgress;
  error?: unknown;
  segments: AeroPollSegment[];
}

export interface AeroVerseTiming {
  start: number;
  verse: string;
}

export interface ParsedAeroTranscriptionPoll {
  clip?: AeroPollClip;
  terminal: boolean;
  failed: boolean;
  progress?: AeroProgress;
}

export function normalizeAeroState(state: unknown): string {
  return typeof state === 'string' ? state.trim().toUpperCase() : '';
}

export function isSettledClipState(state: string | undefined): boolean {
  const s = normalizeAeroState(state);
  return s === 'SUCCESS' || s === 'FAILURE';
}

export function parseAeroProgress(value: unknown): AeroProgress | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const completed = Number(raw.completed);
  const total = Number(raw.total);
  if (!Number.isFinite(completed) || !Number.isFinite(total)) return undefined;
  return { completed, total };
}

export function aeroProgressPercent(progress?: AeroProgress): number {
  if (!progress || progress.total <= 0) return 0;
  return Math.min(
    100,
    Math.max(0, (progress.completed / progress.total) * 100)
  );
}

const firstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string') return value;
  }
  return undefined;
};

/** Text from a segment/result transcription object. `undefined` means not ready. */
export function transcriptionText(
  transcription: unknown,
  phonetic: boolean
): string | undefined {
  if (transcription == null) return undefined;
  if (typeof transcription === 'string') return transcription;
  if (typeof transcription !== 'object') return undefined;
  const raw = transcription as Record<string, unknown>;
  return phonetic
    ? firstString(
        raw.phonetic_transcription,
        raw.phonetic,
        raw.sister_transcription,
        raw.transcription,
        raw.text
      )
    : firstString(
        raw.sister_transcription,
        raw.transcription,
        raw.text,
        raw.phonetic_transcription,
        raw.phonetic
      );
}

export function verseFromLabel(label?: string): string {
  if (!label) return '';
  const parts = label.split(':');
  return parts.length > 1 ? (parts[1] ?? '') : label;
}

export function verseForSegment(
  start: number,
  index: number,
  verses: AeroVerseTiming[]
): string {
  if (!verses.length) return '';
  const matched = verses.find((v) => Math.abs(v.start - start) <= 0.25);
  if (matched) return matched.verse;
  return verses[index]?.verse ?? '';
}

export function formatSegmentTranscription(
  text: string,
  verse: string
): string {
  if (!verse) return text;
  return ` \\v ${verse} ${text}`;
}

const parseSegment = (value: unknown): AeroPollSegment | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const start = Number(raw.start);
  const end = Number(raw.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;
  return {
    start,
    end,
    transcription: raw.transcription,
  };
};

const parseClip = (value: unknown): AeroPollClip | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const segments = Array.isArray(raw.segments)
    ? raw.segments
        .map(parseSegment)
        .filter((s): s is AeroPollSegment => s !== undefined)
    : [];
  return {
    clip: typeof raw.clip === 'string' ? raw.clip : '',
    state: normalizeAeroState(raw.state) || 'PENDING',
    progress: parseAeroProgress(raw.progress),
    error: raw.error,
    segments,
  };
};

const firstClipFromResult = (result: unknown): AeroPollClip | undefined => {
  if (!result || typeof result !== 'object') return undefined;
  const raw = result as Record<string, unknown>;
  if (!Array.isArray(raw.items) || raw.items.length === 0) return undefined;
  // ponytail: we only submit one clip; use items[0] until batch submit exists
  return parseClip(raw.items[0]);
};

export function parseAeroTranscriptionPoll(
  response: unknown
): ParsedAeroTranscriptionPoll {
  if (response == null || typeof response !== 'object') {
    return { terminal: false, failed: false };
  }
  const body = response as Record<string, unknown>;
  const clip = firstClipFromResult(body.result);
  const clipState = clip?.state;
  return {
    clip,
    terminal: isSettledClipState(clipState),
    failed: normalizeAeroState(clipState) === 'FAILURE',
    progress: clip?.progress,
  };
}
