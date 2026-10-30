import { canonicalLanguage } from './referenceText';

/** The language a voice or Bible is matched on: its canonical primary subtag (`eng` → `en`, `fr_FR` → `fr`). */
export const voiceLanguage = (tag: string) =>
  canonicalLanguage(tag.replaceAll('_', '-')).split('-')[0].toLowerCase();

/**
 * Snapshot of a device voice kept in the team's Voice Ranking (ADR 0015).
 * Voices differ per device, so the snapshot keeps enough to list a ranked
 * voice on a device that lacks it, and to find it again on one that has it.
 */
export type RankedVoice = Pick<
  SpeechSynthesisVoice,
  'name' | 'voiceURI' | 'lang' | 'localService'
>;

/** Ranked voices per language (primary subtag, e.g. `en`), best first. */
export type VoiceRanking = Record<string, RankedVoice[]>;

export const toRankedVoice = (voice: RankedVoice): RankedVoice => ({
  name: voice.name,
  voiceURI: voice.voiceURI,
  lang: voice.lang,
  localService: voice.localService,
});

export const sameVoice = (a: RankedVoice, b: RankedVoice) =>
  a.voiceURI === b.voiceURI;

/** The device voice a ranked voice stands for: same voiceURI, else same name. */
export const findDeviceVoice = <T extends RankedVoice>(
  voices: readonly T[],
  ranked: RankedVoice
): T | undefined =>
  voices.find((v) => v.voiceURI === ranked.voiceURI) ??
  voices.find((v) => v.name === ranked.name);

const isRankedVoice = (v: unknown): v is RankedVoice => {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.name === 'string' &&
    typeof r.voiceURI === 'string' &&
    typeof r.lang === 'string' &&
    typeof r.localService === 'boolean'
  );
};

/** A Voice Ranking read back from org defaults, dropping malformed entries and empty languages. */
export const parseVoiceRanking = (value: unknown): VoiceRanking => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const ranking: VoiceRanking = {};
  Object.entries(value as Record<string, unknown>).forEach(([lang, list]) => {
    const voices = Array.isArray(list) ? list.filter(isRankedVoice) : [];
    if (voices.length) ranking[lang] = voices.map(toRankedVoice);
  });
  return ranking;
};

/** Languages with at least one ranked voice. */
export const rankedLanguages = (ranking: VoiceRanking) =>
  new Set(Object.keys(ranking).filter((lang) => ranking[lang].length > 0));

/** Adds the voice at the end of its language's ranking. */
export const rankVoice = (
  ranking: VoiceRanking,
  voice: RankedVoice
): VoiceRanking => {
  const lang = voiceLanguage(voice.lang);
  const list = ranking[lang] ?? [];
  if (list.some((v) => sameVoice(v, voice))) return ranking;
  return { ...ranking, [lang]: [...list, toRankedVoice(voice)] };
};

/** Removes the voice from its language's ranking, dropping the language when it empties. */
export const unrankVoice = (
  ranking: VoiceRanking,
  voice: RankedVoice
): VoiceRanking => {
  const lang = voiceLanguage(voice.lang);
  const list = (ranking[lang] ?? []).filter((v) => !sameVoice(v, voice));
  const { [lang]: _removed, ...rest } = ranking;
  return list.length ? { ...rest, [lang]: list } : rest;
};

/** Moves the voice one place up (-1) or down (1) within its language. */
export const moveRankedVoice = (
  ranking: VoiceRanking,
  voice: RankedVoice,
  delta: -1 | 1
): VoiceRanking => {
  const lang = voiceLanguage(voice.lang);
  const list = ranking[lang] ?? [];
  const from = list.findIndex((v) => sameVoice(v, voice));
  const to = from + delta;
  if (from < 0 || to < 0 || to >= list.length) return ranking;
  const moved = [...list];
  [moved[from], moved[to]] = [moved[to], moved[from]];
  return { ...ranking, [lang]: moved };
};
