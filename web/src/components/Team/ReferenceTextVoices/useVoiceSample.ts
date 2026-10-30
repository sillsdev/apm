import { useEffect, useRef, useState } from 'react';
import {
  Speaking,
  speakText,
} from '../../../business/referenceText/speakReferenceText';

/** Reads sample text with one voice at a time; reading stops when the dialog closes. */
export const useVoiceSample = () => {
  const [reading, setReading] = useState<string>();
  const current = useRef<Speaking>(undefined);

  useEffect(() => () => current.current?.stop(), []);

  /** Reads the text with the voice, or stops it when that voice is already reading. */
  const toggle = async (voice: SpeechSynthesisVoice, text: string) => {
    if (reading === voice.voiceURI) {
      current.current?.stop();
      return;
    }
    const started = speakText({
      text,
      // Some platforms report `fr_FR`, which Intl.Segmenter rejects.
      lang: voice.lang.replaceAll('_', '-'),
      chooseVoice: () => voice,
    });
    current.current = started;
    setReading(voice.voiceURI);
    await started.done;
    if (current.current === started) {
      current.current = undefined;
      setReading(undefined);
    }
  };

  /** voiceURI of the voice reading now. */
  return { reading, toggle };
};
