import { useMemo } from 'react';
import { IRow } from '../../../context/PassageDetailContext';
import { related } from '../../../crud/related';
import { SectionD, SectionResourceD } from '../../../model';

export function findPromptRow(
  rowData: IRow[] | undefined,
  section: SectionD,
  currentstep: string
): IRow | undefined {
  const candidates = (rowData ?? []).filter(
    (r) =>
      r.isResource &&
      !r.isText &&
      r.passageId === '' &&
      r.resource &&
      related(r.resource, 'section') === section.id
  );
  const forStep = candidates.filter(
    (r) =>
      related(r.resource as SectionResourceD, 'orgWorkflowStep') === currentstep
  );
  if (forStep.length > 0) {
    return [...forStep].sort((a, b) => a.sequenceNum - b.sequenceNum)[0];
  }
  if (candidates.length === 1) {
    return candidates[0];
  }
  return undefined;
}

export function usePromptSectionResource(
  rowData: IRow[],
  section: SectionD,
  currentstep: string
) {
  const promptRow = useMemo(
    () => findPromptRow(rowData, section, currentstep),
    [rowData, section, currentstep]
  );

  return {
    promptRow,
    promptMediaId: promptRow?.id,
    sectionResource: promptRow?.resource ?? null,
    hasPrompt: Boolean(promptRow?.id),
  };
}
