import { shallowEqual, useSelector } from 'react-redux';
import { carefulSpeechSelector } from '../../selector';
import PassageDetailGuidedPhraseRecord from './PassageDetailGuidedPhraseRecord';
import { CAREFUL_SPEECH_CONFIG } from './guidedPhraseRecord/types';
import { mapCarefulSpeechStrings } from './guidedPhraseRecord/controlStrings';
import { ICarefulSpeechStrings } from '../../model';

export function PassageDetailCarefulSpeech() {
  const strings: ICarefulSpeechStrings = useSelector(
    carefulSpeechSelector,
    shallowEqual
  );

  return (
    <PassageDetailGuidedPhraseRecord
      config={CAREFUL_SPEECH_CONFIG}
      controlStrings={mapCarefulSpeechStrings(strings)}
      workflowGateMessage={strings.boldOnly}
    />
  );
}

export default PassageDetailCarefulSpeech;
