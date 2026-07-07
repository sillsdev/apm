import { useEffect, useMemo, useState } from 'react';
import { MediaFileD } from '../../../model';
import {
  getSegments,
  getSortedRegions,
  NamedRegions,
} from '../../../utils/namedSegments';
import { hasClauseRegions } from '../carefulSpeech/carefulSpeechBoundary';

export function useLwcTranslationClauses(mediafile: MediaFileD | undefined) {
  const [clauseSegString, setClauseSegString] = useState('{}');
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    if (!mediafile) {
      setClauseSegString('{}');
      setBootstrapped(false);
      return;
    }
    const allSegs = mediafile.attributes?.segments ?? '[]';
    const clauseJson = getSegments(NamedRegions.Clause, allSegs);
    setClauseSegString(clauseJson);
    setBootstrapped(hasClauseRegions(clauseJson));
  }, [mediafile]);

  const clauseRegions = useMemo(
    () => getSortedRegions(clauseSegString),
    [clauseSegString]
  );

  return { clauseRegions, bootstrapped, hasClauses: clauseRegions.length > 0 };
}
