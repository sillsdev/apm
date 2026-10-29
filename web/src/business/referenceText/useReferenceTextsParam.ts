import { useCallback } from 'react';
import { projDefReferenceTexts } from '../../crud/useProjectDefaults';
import { useJsonParams } from '../../utils/useJsonParams';
import { ReferenceText } from './referenceText';

/** Puts the chosen Reference Texts in a project's defaultParams, or removes them when there are none (ADR 0014). */
export const useReferenceTextsParam = () => {
  const { setParam } = useJsonParams();

  return useCallback(
    (referenceTexts: ReferenceText[], params: string | undefined) =>
      setParam(
        projDefReferenceTexts,
        referenceTexts.length > 0 ? referenceTexts : undefined,
        params
      ),
    [setParam]
  );
};
