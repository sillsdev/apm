import { canonicalLanguage } from './referenceText';

// Some browsers list voices only after `voiceschanged`; others never fire it.
const VOICES_WAIT_MS = 2000;

const primarySubtag = (tag: string) =>
  canonicalLanguage(tag.replaceAll('_', '-')).split('-')[0].toLowerCase();

/**
 * The text-to-speech voices on this device. Today that is the browser's
 * `speechSynthesis`, which on desktop also reaches the OS voices; another
 * backend (an IPC or a cloud service) would be added here.
 */
export const deviceVoices = (): Promise<SpeechSynthesisVoice[]> => {
  const synth = globalThis.speechSynthesis;
  if (!synth) return Promise.resolve([]);
  const listed = synth.getVoices();
  if (listed.length) return Promise.resolve(listed);
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      synth.removeEventListener('voiceschanged', done);
      resolve(synth.getVoices());
    };
    const timer = setTimeout(done, VOICES_WAIT_MS);
    synth.addEventListener('voiceschanged', done);
  });
};

/**
 * The voice to speak an ISO 639-3 language: one whose language matches,
 * preferring the default voice, then a local one over a network one.
 */
export const pickVoice = (
  voices: SpeechSynthesisVoice[],
  iso639_3: string
): SpeechSynthesisVoice | undefined => {
  const want = primarySubtag(iso639_3);
  const matches = voices.filter((v) => primarySubtag(v.lang) === want);
  return (
    matches.find((v) => v.default) ??
    matches.find((v) => v.localService) ??
    matches[0]
  );
};
