import {
  GroupD,
  ISheet,
  IwsKind,
  OrgWorkflowStep,
  SheetLevel,
} from '../../model';
import { RecordIdentity } from '@orbit/records';
import { isPublishingTitle } from '../../control/passageTypeFromRef';
import { ISTFilterState } from './filterMenu';
import { isPassageFiltered, isSectionFiltered } from './getSheet';
import { isPassageRow, isSectionRow } from './isSectionPassage';

export interface RefilterSheetProps {
  sheet: ISheet[];
  filterState: ISTFilterState;
  minSection: number;
  hidePublishing: boolean;
  orgSteps: OrgWorkflowStep[];
  doneStepId: string;
  flat: boolean;
  user: string;
  myGroups: GroupD[];
}

/**
 * Re-apply sheet filters (steps, section range, assigned-to-me) to existing rows.
 * Used when filter state changes without rebuilding the sheet from Orbit records.
 */
export const refilterSheet = ({
  sheet,
  filterState,
  minSection,
  hidePublishing,
  orgSteps,
  doneStepId,
  flat,
  user,
  myGroups,
}: RefilterSheetProps): { sheet: ISheet[]; changed: boolean } => {
  const newWork: ISheet[] = [];
  let changed = false;
  let sectionfiltered = false;
  let filtered = false;
  let sectionIndex = -1;
  let sectionScheme: RecordIdentity | undefined;
  let hasOnePassage = false;

  sheet.forEach((s, index) => {
    if (isSectionRow(s)) {
      if (sectionIndex >= 0) {
        if (!hasOnePassage && filterState.assignedToMe && !flat) {
          if (!(sheet[sectionIndex] as ISheet).filtered) changed = true;
          (newWork[sectionIndex] as ISheet).filtered = true;
        }
      }
      sectionIndex = index;
      sectionScheme = s.scheme;
      hasOnePassage = false;
      sectionfiltered = isSectionFiltered(
        filterState,
        minSection,
        s.sectionSeq,
        hidePublishing,
        s.reference || ''
      );
      if (
        !sectionfiltered &&
        hidePublishing &&
        s.kind === IwsKind.Section &&
        s.level !== SheetLevel.Section
      ) {
        let allMyPassagesArePublishing = true;
        for (
          let ix = index + 1;
          ix < sheet.length &&
          isPassageRow(sheet[ix] as ISheet) &&
          allMyPassagesArePublishing;
          ix++
        ) {
          if (!isPublishingTitle((sheet[ix] as ISheet).reference, flat)) {
            allMyPassagesArePublishing = false;
          }
        }
        sectionfiltered = allMyPassagesArePublishing;
      }
    }
    if (isPassageRow(s)) {
      filtered =
        sectionfiltered ||
        isPassageFiltered(
          s,
          filterState,
          minSection,
          hidePublishing,
          orgSteps,
          doneStepId,
          sectionScheme,
          s.assign,
          user,
          myGroups
        );
    } else filtered = sectionfiltered;
    hasOnePassage ||= isPassageRow(s) && filtered === false;
    if (filtered !== s.filtered) changed = true;
    newWork.push({
      ...s,
      filtered,
    });
  });
  if (sectionIndex >= 0) {
    if (!hasOnePassage && filterState.assignedToMe && !flat) {
      (newWork[sectionIndex] as ISheet).filtered = true;
      if (!(sheet[sectionIndex] as ISheet).filtered) changed = true;
    }
  }

  return { sheet: newWork, changed };
};
