import { describe, it, expect } from '@jest/globals';
import { ISheet, IwsKind, SheetLevel, IMediaShare } from '../model';
import { BookSeq, AltBkSeq } from '../model/section';
import { PassageTypeEnum } from '../model/passageType';
import { PublishDestinationEnum } from '../crud/usePublishDestination';
import { ISTFilterState } from '../components/Sheet/filterMenu';
import { isPassageFiltered } from '../components/Sheet/getSheet';
import { refilterSheet } from '../components/Sheet/refilterSheet';

const currentUser = 'u-me';
const otherUser = 'u-other';
const scheme = { type: 'organizationscheme', id: 'scheme-1' };

const assignedToMeFilter: ISTFilterState = {
  minStep: '',
  maxStep: '',
  minSection: -1,
  maxSection: 99999,
  assignedToMe: true,
  hideDone: false,
  disabled: false,
  canHideDone: false,
};

const baseRow = (): Pick<
  ISheet,
  | 'deleted'
  | 'filtered'
  | 'discussionCount'
  | 'published'
  | 'mediaShared'
  | 'scheme'
> => ({
  deleted: false,
  filtered: false,
  discussionCount: 0,
  published: [] as PublishDestinationEnum[],
  mediaShared: IMediaShare.NotPublic,
  scheme,
});

const flatRow = (
  sectionSeq: number,
  assign?: { type: string; id: string }
): ISheet => ({
  ...baseRow(),
  level: SheetLevel.Section,
  kind: IwsKind.SectionPassage,
  sectionSeq,
  passageSeq: 1,
  title: `Section ${sectionSeq}`,
  assign,
  passageType: PassageTypeEnum.PASSAGE,
  reference: `${sectionSeq}:1`,
});

const sectionRow = (
  sectionSeq: number,
  overrides: Partial<ISheet> = {}
): ISheet => ({
  ...baseRow(),
  level: SheetLevel.Section,
  kind: IwsKind.Section,
  sectionSeq,
  passageSeq: 0,
  title: `Section ${sectionSeq}`,
  passageType: PassageTypeEnum.PASSAGE,
  reference: '',
  ...overrides,
});

const passageRow = (
  sectionSeq: number,
  passageSeq: number,
  assign?: { type: string; id: string }
): ISheet => ({
  ...baseRow(),
  level: SheetLevel.Passage,
  kind: IwsKind.Passage,
  sectionSeq,
  passageSeq,
  title: `Passage ${sectionSeq}.${passageSeq}`,
  assign,
  passageType: PassageTypeEnum.PASSAGE,
  reference: `${sectionSeq}:${passageSeq}`,
});

const bookRow = (): ISheet =>
  sectionRow(BookSeq, {
    level: SheetLevel.Book,
    title: 'Luke',
    passageType: PassageTypeEnum.BOOK,
    reference: PassageTypeEnum.BOOK,
  });

const altBookRow = (): ISheet =>
  sectionRow(AltBkSeq, {
    level: SheetLevel.Book,
    title: 'Alternate title',
    passageType: PassageTypeEnum.ALTBOOK,
    reference: PassageTypeEnum.ALTBOOK,
  });

/** TT-7048 scenario: flat sheet — unassigned, other user, current user (last). */
const tt7048FlatSheet = (): ISheet[] => [
  flatRow(1), // unassigned
  flatRow(2, { type: 'user', id: otherUser }),
  flatRow(13, { type: 'user', id: currentUser }),
];

const refilter = (sheet: ISheet[], flat = false) =>
  refilterSheet({
    sheet,
    filterState: assignedToMeFilter,
    minSection: -1,
    hidePublishing: false,
    orgSteps: [],
    doneStepId: 'done-1',
    flat,
    user: currentUser,
    myGroups: [],
  });

describe('isPassageFiltered assignedToMe (Hide rows assigned to others)', () => {
  it('hides a passage assigned to another user', () => {
    const w = flatRow(2, { type: 'user', id: otherUser });
    expect(
      isPassageFiltered(
        w,
        assignedToMeFilter,
        -1,
        false,
        [],
        'done-1',
        scheme,
        w.assign,
        currentUser,
        []
      )
    ).toBe(true);
  });

  it('keeps a passage assigned to the current user', () => {
    const w = flatRow(13, { type: 'user', id: currentUser });
    expect(
      isPassageFiltered(
        w,
        assignedToMeFilter,
        -1,
        false,
        [],
        'done-1',
        scheme,
        w.assign,
        currentUser,
        []
      )
    ).toBe(false);
  });

  it('keeps an unassigned passage when the section has no scheme', () => {
    const w = { ...flatRow(1), scheme: undefined, assign: undefined };
    expect(
      isPassageFiltered(
        w,
        assignedToMeFilter,
        -1,
        false,
        [],
        'done-1',
        undefined,
        undefined,
        currentUser,
        []
      )
    ).toBe(false);
  });

  it('keeps an unassigned passage when the section has a scheme', () => {
    // "Hide rows assigned to others" — unassigned is available to anyone.
    const w = { ...flatRow(1), assign: undefined };
    expect(
      isPassageFiltered(
        w,
        assignedToMeFilter,
        -1,
        false,
        [],
        'done-1',
        scheme,
        undefined,
        currentUser,
        []
      )
    ).toBe(false);
  });
});

describe('refilterSheet assignedToMe flat layout (TT-7048)', () => {
  it('hides rows assigned to others but keeps unassigned and current-user rows', () => {
    const { sheet } = refilter(tt7048FlatSheet(), true);

    const bySeq = (n: number) => sheet.find((r) => r.sectionSeq === n)!;

    // Unassigned → not assigned to someone else → must stay visible
    expect(bySeq(1).filtered).toBe(false);
    // Assigned to someone else → hidden
    expect(bySeq(2).filtered).toBe(true);
    // Assigned to me (last row) → must stay visible (was incorrectly hidden)
    expect(bySeq(13).filtered).toBe(false);
  });

  it('does not hide the last flat row solely because it is SectionPassage', () => {
    // Single row assigned to current user — discriminating case for hasOnePassage
    // counting only IwsKind.Passage (never true for flat SectionPassage rows).
    const { sheet } = refilter(
      [flatRow(13, { type: 'user', id: currentUser })],
      true
    );

    expect(sheet[0].filtered).toBe(false);
  });
});

describe('refilterSheet assignedToMe hierarchical empty sections', () => {
  it('hides a section when all of its passages are assigned to others', () => {
    const { sheet } = refilter([
      sectionRow(1),
      passageRow(1, 1, { type: 'user', id: otherUser }),
      passageRow(1, 2, { type: 'user', id: otherUser }),
      sectionRow(2),
      passageRow(2, 1, { type: 'user', id: currentUser }),
    ]);

    expect(sheet[0].filtered).toBe(true); // empty section header
    expect(sheet[1].filtered).toBe(true);
    expect(sheet[2].filtered).toBe(true);
    expect(sheet[3].filtered).toBe(false); // section with my passage
    expect(sheet[4].filtered).toBe(false);
  });

  it('keeps a section that still has an unassigned passage', () => {
    const { sheet } = refilter([
      sectionRow(1),
      passageRow(1, 1), // unassigned
      passageRow(1, 2, { type: 'user', id: otherUser }),
    ]);

    expect(sheet[0].filtered).toBe(false);
    expect(sheet[1].filtered).toBe(false); // unassigned stays
    expect(sheet[2].filtered).toBe(true);
  });

  it('keeps Book and AltBook header rows even though they have no passages', () => {
    const { sheet } = refilter([
      bookRow(),
      altBookRow(),
      sectionRow(1),
      passageRow(1, 1, { type: 'user', id: otherUser }),
      sectionRow(2),
      passageRow(2, 1, { type: 'user', id: currentUser }),
    ]);

    expect(sheet[0].filtered).toBe(false); // BOOK
    expect(sheet[1].filtered).toBe(false); // ALTBOOK
    expect(sheet[2].filtered).toBe(true); // section with only others
    expect(sheet[3].filtered).toBe(true);
    expect(sheet[4].filtered).toBe(false);
    expect(sheet[5].filtered).toBe(false);
  });
});
