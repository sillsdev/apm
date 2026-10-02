import { shallowEqual, useSelector } from 'react-redux';
import { carefulSpeechSelector } from '../../selector';
import PassageDetailGuidedPhraseRecord from './PassageDetailGuidedPhraseRecord';
import { CAREFUL_SPEECH_CONFIG } from './guidedPhraseRecord/types';
import { mapCarefulSpeechStrings } from './guidedPhraseRecord/controlStrings';
import { ICarefulSpeechStrings } from '../../model';

interface IProps {
  width: number;
}

export function PassageDetailCarefulSpeech({ width }: IProps) {
  const strings: ICarefulSpeechStrings = useSelector(
    carefulSpeechSelector,
    shallowEqual
  );

  return (
    <PassageDetailGuidedPhraseRecord
      width={width}
      config={CAREFUL_SPEECH_CONFIG}
      controlStrings={mapCarefulSpeechStrings(strings)}
      workflowGateMessage={strings.boldOnly}
    />
  );
}

export default PassageDetailCarefulSpeech;
