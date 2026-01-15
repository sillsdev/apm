import { useContext, useMemo } from 'react';
import { ISheet, SectionD } from '../../model';
import { useGlobal } from '../../context/useGlobal';
import { findRecord, sectionDescription } from '../../crud';
import { PlanContext } from '../../context/PlanContext';

export const useSectionIdDescription = () => {
  const [memory] = useGlobal('memory');
  const ctx = useContext(PlanContext);
  const { sectionArr } = ctx.state;
  const sectionMap = useMemo(() => new Map(sectionArr), [sectionArr]);

  const getSectionRec = (id: string) =>
    findRecord(memory, 'section', id) as SectionD | undefined;

  return (row: ISheet) => {
    return sectionDescription(
      getSectionRec(row.sectionId?.id || '') as SectionD,
      sectionMap
    );
  };
};
