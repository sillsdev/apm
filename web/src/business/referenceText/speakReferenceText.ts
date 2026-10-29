import { canonicalLanguage, ReferenceText } from './referenceText';
import { speechChunks } from './speechChunks';
import { deviceVoices, pickVoice } from './voices';

/** How speaking a passage finished. */
export type SpeakOutcome = 'ended' | 'stopped' | 'noVoice' | 'error';

export interface Speaking {
  /** Settles once speaking is over; never rejects. */
  done: Promise<SpeakOutcome>;
  /** Ends speaking; it cannot be resumed, only started again. */
  stop: () => void;
}

// Only one passage speaks at a time on the device.
let current: Speaking | undefined;

/**
 * Speaks a Reference Text passage with a voice for the Bible's language.
 * `onProgress` gets the percent of the text spoken so far. Starting another
 * passage stops this one.
 */
export const speakReferenceText = (
  referenceText: ReferenceText,
  text: string,
  onProgress?: (percent: number) => void
): Speaking => {
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

  const lang = canonicalLanguage(referenceText.language);
  void deviceVoices().then((voices) => {
    if (finished) return;
    const voice = pickVoice(voices, referenceText.language);
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
