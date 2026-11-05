import {
  findDeviceVoice,
  voiceLanguage,
  type VoiceRanking,
} from './voiceRanking';

// Some browsers list voices only after `voiceschanged`. Windows can list
// Microsoft voices first with an empty `lang`, then fill the tags in on a
// later event. Others never fire it, so a list that already has a language
// is used immediately and the wait is capped.
const VOICES_WAIT_MS = 2000;

const hasLanguage = (voices: SpeechSynthesisVoice[]) =>
  voices.some((v) => v.lang);

/**
 * The text-to-speech voices on this device. Today that is the browser's
 * `speechSynthesis`, which on desktop also reaches the OS voices; another
 * backend (an IPC or a cloud service) would be added here.
 */
export const deviceVoices = (): Promise<SpeechSynthesisVoice[]> => {
  const synth = globalThis.speechSynthesis;
  if (!synth) return Promise.resolve([]);
  const listed = synth.getVoices();
  if (hasLanguage(listed)) return Promise.resolve(listed);
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>;
    const finish = (voices: SpeechSynthesisVoice[]) => {
      clearTimeout(timer);
      synth.removeEventListener('voiceschanged', onChange);
      resolve(voices);
    };
    const onChange = () => {
      const voices = synth.getVoices();
      if (hasLanguage(voices)) finish(voices);
    };
    timer = setTimeout(() => finish(synth.getVoices()), VOICES_WAIT_MS);
    synth.addEventListener('voiceschanged', onChange);
  });
};

const languageVoices = (voices: SpeechSynthesisVoice[], iso639_3: string) => {
  const want = voiceLanguage(iso639_3);
  return voices.filter((v) => voiceLanguage(v.lang) === want);
};

/**
 * The voice to speak an ISO 639-3 language: the first voice in the team's
 * Voice Ranking for the language that this device has; else its first local
 * voice (a device default can sound robotic); else a network voice, the
 * default one first. Offline, network voices are skipped.
 */
export const pickVoice = (
  voices: SpeechSynthesisVoice[],
  iso639_3: string,
  ranking: VoiceRanking = {},
  online = true
): SpeechSynthesisVoice | undefined => {
  const matches = languageVoices(voices, iso639_3).filter(
    (v) => online || v.localService
  );
  for (const ranked of ranking[voiceLanguage(iso639_3)] ?? []) {
    const voice = findDeviceVoice(matches, ranked);
    if (voice) return voice;
  }
  const network = matches.filter((v) => !v.localService);
  return (
    matches.find((v) => v.localService) ??
    network.find((v) => v.default) ??
    network[0]
  );
};

/** Whether only network voices speak the language and the device is offline. */
export const needsInternet = (
  voices: SpeechSynthesisVoice[],
  iso639_3: string,
  online: boolean
): boolean => {
  const matches = languageVoices(voices, iso639_3);
  return !online && matches.length > 0 && !matches.some((v) => v.localService);
};
