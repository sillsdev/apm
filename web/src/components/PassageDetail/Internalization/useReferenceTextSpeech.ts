import { useEffect, useRef, useState } from 'react';
import { ReferenceText } from '../../../business/referenceText/referenceText';
import {
  SpeakOutcome,
  Speaking,
  speakReferenceText,
} from '../../../business/referenceText/speakReferenceText';
import { ReferenceTextRank } from '../../../business/referenceText/useReferenceTextPassage';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import {
  orgDefaultTtsVoices,
  useOrgDefaults,
} from '../../../crud/useOrgDefaults';
import { parseVoiceRanking } from '../../../business/referenceText/voiceRanking';

/**
 * Speaks one Reference Text at a time, sharing the passage's playback: speaking
 * stops other passage audio, and that audio starting stops speaking. Speaking
 * also stops when the rows unmount.
 */
export const useReferenceTextSpeech = () => {
  const {
    playing,
    itemPlaying,
    commentPlaying,
    oldVernacularPlaying,
    setPlaying,
    setItemPlaying,
    setCommentPlaying,
    handleOldVernacularPlayEnd,
  } = usePassageDetailContext();
  const { getOrgDefault } = useOrgDefaults();
  const [speaking, setSpeaking] = useState<ReferenceTextRank>();
  const [progress, setProgress] = useState(0);
  const current = useRef<Speaking>(undefined);
  const otherPlaying =
    playing || itemPlaying || commentPlaying || oldVernacularPlaying;

  useEffect(() => {
    if (otherPlaying) current.current?.stop();
  }, [otherPlaying]);

  useEffect(() => () => current.current?.stop(), []);

  /** Starts speaking the rank, or stops it when it is already speaking. */
  const toggle = async (
    rank: ReferenceTextRank,
    referenceText: ReferenceText,
    text: string
  ): Promise<SpeakOutcome | undefined> => {
    if (speaking === rank) {
      current.current?.stop();
      return undefined;
    }
    setItemPlaying(false);
    setPlaying(false);
    setCommentPlaying(false);
    if (oldVernacularPlaying) handleOldVernacularPlayEnd();
    const started = speakReferenceText(
      referenceText,
      text,
      setProgress,
      parseVoiceRanking(getOrgDefault(orgDefaultTtsVoices))
    );
    current.current = started;
    setSpeaking(rank);
    setProgress(0);
    const outcome = await started.done;
    if (current.current === started) {
      current.current = undefined;
      setSpeaking(undefined);
      setProgress(0);
    }
    return outcome;
  };

  return { speaking, progress, toggle };
};
