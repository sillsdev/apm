import {
  findDeviceVoice,
  sameVoice,
  voiceLanguage,
  type RankedVoice,
  type VoiceRanking,
} from './voiceRanking';

/** One voice in a language group: ranked (with its 1-based rank) or not, on this device or not. */
export interface VoiceRow<T extends RankedVoice = SpeechSynthesisVoice> {
  voice: RankedVoice;
  /** The matching voice on this device; absent for a ranked voice the device lacks. */
  device?: T;
  rank?: number;
}

/** Where a language is listed: ranked when the dialog opened, used by the team's Reference Texts, or neither. */
export type VoiceGroupTier = 'ranked' | 'used' | 'other';

export interface VoiceGroup<T extends RankedVoice = SpeechSynthesisVoice> {
  language: string;
  label: string;
  tier: VoiceGroupTier;
  rows: VoiceRow<T>[];
}

export interface VoiceGroupsOptions<T extends RankedVoice> {
  deviceVoices: readonly T[];
  /** The ranking being edited. */
  ranking: VoiceRanking;
  /**
   * The ranking as saved; it orders the groups, so a language does not jump
   * to the top as soon as its first voice is ranked.
   */
  savedRanking: VoiceRanking;
  /** Languages (primary subtags) of Reference Texts the team uses. */
  usedLanguages: ReadonlySet<string>;
  /** Unranked online voices are listed only when this is on. */
  showOnline: boolean;
  search: string;
  languageLabel: (language: string) => string;
  collator: Intl.Collator;
}

const tierOrder: Record<VoiceGroupTier, number> = {
  ranked: 0,
  used: 1,
  other: 2,
};

/** The voice dialog's language groups, ranked voices first within each. */
export const voiceGroups = <T extends RankedVoice>(
  options: VoiceGroupsOptions<T>
): VoiceGroup<T>[] => {
  const {
    deviceVoices,
    ranking,
    savedRanking,
    usedLanguages,
    showOnline,
    search,
    languageLabel,
    collator,
  } = options;
  const byLanguage = new Map<string, T[]>();
  deviceVoices.forEach((v) => {
    const lang = voiceLanguage(v.lang);
    byLanguage.set(lang, [...(byLanguage.get(lang) ?? []), v]);
  });
  const languages = new Set([...byLanguage.keys(), ...Object.keys(ranking)]);
  const needle = search.trim().toLocaleLowerCase();

  const groups: VoiceGroup<T>[] = [];
  languages.forEach((language) => {
    const device = byLanguage.get(language) ?? [];
    const ranked = ranking[language] ?? [];
    const rows: VoiceRow<T>[] = ranked.map((voice, i) => ({
      voice,
      device: findDeviceVoice(device, voice),
      rank: i + 1,
    }));
    device
      .filter((v) => showOnline || v.localService)
      .filter((v) => !rows.some((r) => r.device && sameVoice(r.device, v)))
      .sort((a, b) => collator.compare(a.name, b.name))
      .forEach((v) => rows.push({ voice: v, device: v }));
    if (!rows.length) return;

    const label = languageLabel(language);
    if (
      needle &&
      ![label, language, ...rows.map((r) => r.voice.name)].some((s) =>
        s.toLocaleLowerCase().includes(needle)
      )
    )
      return;

    let tier: VoiceGroupTier = 'other';
    if (savedRanking[language]?.length) tier = 'ranked';
    else if (usedLanguages.has(language)) tier = 'used';
    groups.push({ language, label, tier, rows });
  });

  return groups.sort(
    (a, b) =>
      tierOrder[a.tier] - tierOrder[b.tier] ||
      collator.compare(a.label, b.label)
  );
};

/** The company behind an online voice, from its name; voices do not report it. */
export const voiceProvider = (voice: Pick<RankedVoice, 'name'>) => {
  if (/google/i.test(voice.name)) return 'Google';
  if (/microsoft/i.test(voice.name)) return 'Microsoft';
  return undefined;
};
