import { canonicalLanguage, ReferenceText } from './referenceText';
import { speechChunks } from './speechChunks';
import { deviceVoices, pickVoice } from './voices';
import type { VoiceRanking } from './voiceRanking';

/** How speaking a passage finished. */
export type SpeakOutcome = 'ended' | 'stopped' | 'noVoice' | 'error';

export interface Speaking {
  /** Settles once speaking is over; never rejects. */
  done: Promise<SpeakOutcome>;
  /** Ends speaking; it cannot be resumed, only started again. */
  stop: () => void;
}

// Only one text speaks at a time on the device.
let current: Speaking | undefined;

export interface SpeakTextOptions {
  text: string;
  /** BCP 47 language of the text, for splitting it into sentences. */
  lang: string;
  /** The voice to speak with, from this device's voices; none means `noVoice`. */
  chooseVoice: (
    voices: SpeechSynthesisVoice[]
  ) => SpeechSynthesisVoice | undefined;
  /** Gets the percent of the text spoken so far. */
  onProgress?: (percent: number) => void;
}

/**
 * Speaks text with a voice from this device. Starting another text stops
 * this one, so a voice sample and a passage never talk over each other.
 */
export const speakText = (options: SpeakTextOptions): Speaking => {
  const { text, lang, chooseVoice, onProgress } = options;
  current?.stop();

  let finish: (outcome: SpeakOutcome) => void = () => undefined;
  let finished = false;
  const done = new Promise<SpeakOutcome>((resolve) => {
    finish = (outcome) => {
      if (finished) return;
      finished = true;
      if (current === speaking) current = undefined;
      resolve(outcome);
    };
  });

  const stop = () => {
    if (finished) return;
    finish('stopped');
    globalThis.speechSynthesis?.cancel();
  };
  const speaking: Speaking = { done, stop };
  current = speaking;

  void deviceVoices().then((voices) => {
    if (finished) return;
    const voice = chooseVoice(voices);
    if (!voice) return finish('noVoice');
    const chunks = speechChunks(text, lang);
    let offset = 0;
    const report = (spoken: number) =>
      onProgress?.(Math.floor((spoken / text.length) * 100));

    const speak = (index: number) => {
      if (finished) return;
      if (index >= chunks.length) return finish('ended');
      const chunk = chunks[index];
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.onboundary = (e) => {
        if (!finished) report(offset + e.charIndex);
      };
      utterance.onend = () => {
        if (finished) return;
        offset += chunk.length;
        report(offset);
        speak(index + 1);
      };
      utterance.onerror = () => finish('error');
      globalThis.speechSynthesis.speak(utterance);
    };
    speak(0);
  });

  return speaking;
};

/**
 * Speaks a Reference Text passage with a voice for the Bible's language,
 * the team's highest ranked one this device has when there is one.
 */
export const speakReferenceText = (
  referenceText: ReferenceText,
  text: string,
  onProgress?: (percent: number) => void,
  ranking?: VoiceRanking
): Speaking =>
  speakText({
    text,
    lang: canonicalLanguage(referenceText.language),
    chooseVoice: (voices) => pickVoice(voices, referenceText.language, ranking),
    onProgress,
  });
