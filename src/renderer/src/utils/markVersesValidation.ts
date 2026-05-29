import { refMatch } from './refMatch';

export interface MarkVersesValidationStrings {
  badReferences: string;
  noSegments: string;
  missingReferences: string;
  outsideReferences: string;
  noReferences: string;
  btNotUpdated: string;
}

export interface MarkVersesValidationRow {
  limits: string;
  ref: string;
}

export interface MarkVersesValidationInput {
  rows: MarkVersesValidationRow[];
  /** Verse references expanded from table cells (see Mark Verses collectRefs). */
  expandedRefs: string[];
  passageRefs: string[];
  hasBtRecordings: boolean;
  strings: MarkVersesValidationStrings;
}

/** Hard errors that must block persisting segment markup. */
export const getMarkVersesAutosaveBlockers = (
  input: MarkVersesValidationInput
): string[] => {
  const { rows, expandedRefs: refs, passageRefs, strings: t } = input;

  const passageRefSet = new Set(passageRefs);
  const noSegRefs = rows
    .filter((row) => row.ref && !row.limits && !passageRefSet.has(row.ref))
    .map((row) => row.ref);

  const matchAll = refs.every((r) => refMatch(r));
  const refSet = new Set(passageRefs);
  const outsideRefs = new Set<string>();
  refs.forEach((r) => {
    if (refSet.has(r)) refSet.delete(r);
    else if (refMatch(r)) outsideRefs.add(r);
  });

  const blockers: string[] = [];
  if (!matchAll) blockers.push(t.badReferences);
  if (noSegRefs.length > 0) {
    blockers.push(t.noSegments.replace('{0}', noSegRefs.join(', ')));
  }
  if (outsideRefs.size > 0) {
    blockers.push(
      t.outsideReferences.replace('{0}', Array.from(outsideRefs).join(', '))
    );
  }
  return blockers;
};

/** Full markup review list (warnings + errors) for the issues dialog. */
export const getMarkVersesValidationIssues = (
  input: MarkVersesValidationInput
): string[] => {
  const {
    rows,
    expandedRefs: refs,
    passageRefs,
    hasBtRecordings,
    strings: t,
  } = input;

  const passageRefSet = new Set(passageRefs);
  const noSegRefs = rows
    .filter((row) => row.ref && !row.limits && !passageRefSet.has(row.ref))
    .map((row) => row.ref);

  const noRefSegs = rows.some((row) => !row.ref && row.limits);

  const matchAll = refs.every((r) => refMatch(r));
  const refSet = new Set(passageRefs);
  const outsideRefs = new Set<string>();
  refs.forEach((r) => {
    if (refSet.has(r)) refSet.delete(r);
    else if (refMatch(r)) outsideRefs.add(r);
  });

  const issues: string[] = [];
  if (!matchAll) issues.push(t.badReferences);
  if (noSegRefs.length > 0) {
    issues.push(t.noSegments.replace('{0}', noSegRefs.join(', ')));
  }
  if (refSet.size > 0) {
    issues.push(
      t.missingReferences.replace('{0}', Array.from(refSet).sort().join(', '))
    );
  }
  if (outsideRefs.size > 0) {
    issues.push(
      t.outsideReferences.replace('{0}', Array.from(outsideRefs).join(', '))
    );
  }
  if (noRefSegs) issues.push(t.noReferences);
  if (hasBtRecordings) issues.push(t.btNotUpdated);
  return issues;
};
