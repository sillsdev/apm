import { useState } from 'react';
import {
  ReferenceTextPassage,
  ReferenceTextRank,
} from '../../../business/referenceText/useReferenceTextPassage';
import { byRank } from '../../../business/referenceText/referenceText';
import { ReferenceTextNotice } from './ReferenceTextDialog';
import { useReferenceTextSpeech } from './useReferenceTextSpeech';

interface Viewing {
  rank: ReferenceTextRank;
  notice?: ReferenceTextNotice;
}

/**
 * Play and View for the passage's Reference Texts, Primary then Secondary.
 * Play speaks the text, and shows it with a notice when it can't be spoken.
 */
export const useReferenceTextPlayback = (
  passages: readonly ReferenceTextPassage[]
) => {
  const speech = useReferenceTextSpeech();
  const [viewing, setViewing] = useState<Viewing>();
  const viewed = byRank(viewing?.rank ?? 'primary', passages);

  const handlePlay = async (rank: ReferenceTextRank) => {
    const value = byRank(rank, passages);
    if (value.status !== 'ready') return;
    const outcome = await speech.toggle(rank, value.referenceText, value.text);
    if (outcome === 'noVoice' || outcome === 'noVoiceOffline')
      setViewing({ rank, notice: outcome });
    else if (outcome === 'error') setViewing({ rank, notice: 'speakFailed' });
  };
  const handleView = (rank: ReferenceTextRank) => setViewing({ rank });
  const itemProps = (rank: ReferenceTextRank) => ({
    speaking: speech.speaking === rank,
    progress: speech.speaking === rank ? speech.progress : 0,
    // speech.toggle never rejects
    onPlay: (r: ReferenceTextRank) => void handlePlay(r),
    onView: handleView,
  });

  return {
    itemProps,
    /** The Reference Text whose passage is shown, ready for ReferenceTextDialog. */
    viewing:
      viewing && viewed.status === 'ready'
        ? {
            ...viewing,
            referenceText: viewed.referenceText,
            text: viewed.text,
          }
        : undefined,
    closeView: () => setViewing(undefined),
  };
};
