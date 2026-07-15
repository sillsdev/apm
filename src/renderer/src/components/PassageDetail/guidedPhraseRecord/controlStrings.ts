import { shallowEqual, useSelector } from 'react-redux';
import { carefulSpeechSelector } from '../../../selector';
import { ICarefulSpeechStrings } from '../../../model';
import type { IGuidedPhraseRecordControlStrings } from '../guidedPhraseRecord/types';

export function mapCarefulSpeechStrings(
  strings: ICarefulSpeechStrings
): IGuidedPhraseRecordControlStrings {
  return {
    allComplete: strings.allComplete,
    unitLabel: strings.clause,
    clearRecording: strings.clearRecording,
    combineWithNext: strings.combineWithNextClause,
    fewerUnits: strings.fewerClauses,
    moreUnits: strings.moreClauses,
    nextUnit: strings.nextClause,
    splitUnit: strings.splitClause,
    speaker: strings.speaker,
    startRecording: strings.startRecording,
    undo: strings.undo,
  };
}

export function useCarefulSpeechControlStrings(): IGuidedPhraseRecordControlStrings {
  const strings: ICarefulSpeechStrings = useSelector(
    carefulSpeechSelector,
    shallowEqual
  );
  return mapCarefulSpeechStrings(strings);
}
