import {
  findDeviceVoice,
  voiceLanguage,
  type VoiceRanking,
} from './voiceRanking';

// The browser never says the voice list is finished. Windows can publish one
// wave with a language tag still blank, then a later `voiceschanged` that
// fills it or adds voices (Chrome does this when Google voices arrive before
// the Microsoft ones). The first load waits until every listed voice has a
// language and the list has been still, and a playback waits further until
// its own language is present. The wait is capped. Once the list has settled,
// later reads take the current list at once.
const VOICES_WAIT_MS = 2000;
const VOICES_QUIET_MS = 200;

const languagesReady = (voices: SpeechSynthesisVoice[]) =>
  voices.length > 0 && voices.every((v) => v.lang);

const speaksLanguage = (voices: SpeechSynthesisVoice[], language: string) => {
  const want = voiceLanguage(language);
  return voices.some((v) => v.lang && voiceLanguage(v.lang) === want);
};

type Waiter = {
  language?: string;
  resolve: (voices: SpeechSynthesisVoice[]) => void;
};

type Load = {
  waiters: Waiter[];
  quietElapsed: boolean;
  quietTimer?: ReturnType<typeof setTimeout>;
  capTimer: ReturnType<typeof setTimeout>;
  onChange: () => void;
};

const loads = new WeakMap<SpeechSynthesis, Load>();
const settled = new WeakSet<SpeechSynthesis>();

const clearLoad = (synth: SpeechSynthesis, load: Load) => {
  clearTimeout(load.quietTimer);
  clearTimeout(load.capTimer);
  synth.removeEventListener('voiceschanged', load.onChange);
  loads.delete(synth);
};

const release = (synth: SpeechSynthesis, timedOut: boolean) => {
  const load = loads.get(synth);
  if (!load) return;
  const voices = synth.getVoices();
  const ready = languagesReady(voices);
  const stay: Waiter[] = [];
  for (const waiter of load.waiters) {
    const languageOk =
      !waiter.language || speaksLanguage(voices, waiter.language);
    if (timedOut || (ready && load.quietElapsed && languageOk))
      waiter.resolve(voices);
    else stay.push(waiter);
  }
  load.waiters = stay;
  // A playback whose language is still missing keeps the cap running.
  if (!timedOut && stay.length > 0) return;
  settled.add(synth);
  clearLoad(synth, load);
};

const scheduleQuiet = (synth: SpeechSynthesis) => {
  const load = loads.get(synth);
  if (!load) return;
  clearTimeout(load.quietTimer);
  load.quietElapsed = false;
  if (!languagesReady(synth.getVoices())) return;
  load.quietTimer = setTimeout(() => {
    const current = loads.get(synth);
    if (!current) return;
    current.quietElapsed = true;
    release(synth, false);
  }, VOICES_QUIET_MS);
};

const begin = (synth: SpeechSynthesis): Load => {
  const onChange = () => scheduleQuiet(synth);
  const load: Load = {
    waiters: [],
    quietElapsed: false,
    onChange,
    capTimer: setTimeout(() => release(synth, true), VOICES_WAIT_MS),
  };
  loads.set(synth, load);
  synth.addEventListener('voiceschanged', onChange);
  scheduleQuiet(synth);
  return load;
};

/**
 * The text-to-speech voices on this device. Today that is the browser's
 * `speechSynthesis`, which on desktop also reaches the OS voices; another
 * backend (an IPC or a cloud service) would be added here.
 *
 * Pass `language` (a BCP 47 tag or ISO 639-3 code) while speaking, so this
 * does not return a list that cannot say that language until the wait is up.
 */
export const deviceVoices = (
  language?: string
): Promise<SpeechSynthesisVoice[]> => {
  const synth = globalThis.speechSynthesis;
  if (!synth) return Promise.resolve([]);
  if (settled.has(synth)) return Promise.resolve(synth.getVoices());
  return new Promise((resolve) => {
    const load = loads.get(synth) ?? begin(synth);
    load.waiters.push({ language, resolve });
    release(synth, false);
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
