import { useGetGlobal, useGlobal } from '../context/useGlobal';
import related from './related';

import { passageTypeFromRef } from '../control/passageTypeFromRef';
import { PassageTypeEnum } from '../model/passageType';
import { findRecords } from './tryFindRecord';

export const useCanBeFlat = () => {
  const [memory] = useGlobal('memory');
  const getGlobal = useGetGlobal();

  return () => {
    const plans = findRecords(memory, 'plan');
    const plan = plans.find(
      (p) => related(p, 'project') === getGlobal('project')
    );
    const sectionIds = findRecords(memory, 'section')
      .filter((s) => related(s, 'plan') === plan?.id)
      .map((s) => s.id);
    const passages = findRecords(memory, 'passage').filter((p) =>
      sectionIds.includes(related(p, 'section'))
    );
    const canPublish = passages.reduce(
      (p, c) =>
        p ||
        passageTypeFromRef(c.attributes.reference) !== PassageTypeEnum.PASSAGE,
      false
    );
    return !canPublish;
  };
};
