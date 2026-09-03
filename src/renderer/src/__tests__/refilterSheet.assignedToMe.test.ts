import { ISheet, IwsKind, SheetLevel, IMediaShare } from '../model';
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

const flatRow = (
  sectionSeq: number,
  assign?: { type: string; id: string }
): ISheet => ({
  level: SheetLevel.Section,
  kind: IwsKind.SectionPassage,
  sectionSeq,
  passageSeq: 1,
  title: `Section ${sectionSeq}`,
  scheme,
  assign,
  passageType: PassageTypeEnum.PASSAGE,
  deleted: false,
  filtered: false,
  discussionCount: 0,
  published: [] as PublishDestinationEnum[],
  mediaShared: IMediaShare.NotPublic,
  reference: `${sectionSeq}:1`,
});

/** TT-7048 scenario: flat sheet — other user, unassigned, current user (last). */
const tt7048FlatSheet = (): ISheet[] => [
  flatRow(1), // unassigned
  flatRow(2, { type: 'user', id: otherUser }),
  flatRow(13, { type: 'user', id: currentUser }),
];

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
});

describe('refilterSheet assignedToMe flat layout (TT-7048)', () => {
  it('hides rows assigned to others but keeps the current user row even when it is last', () => {
    const { sheet } = refilterSheet({
      sheet: tt7048FlatSheet(),
      filterState: assignedToMeFilter,
      minSection: -1,
      hidePublishing: false,
      orgSteps: [],
      doneStepId: 'done-1',
      flat: true,
      user: currentUser,
      myGroups: [],
    });

    const bySeq = (n: number) => sheet.find((r) => r.sectionSeq === n)!;

    // Assigned to someone else → hidden
    expect(bySeq(2).filtered).toBe(true);
    // Assigned to me (last row) → must stay visible (was incorrectly hidden)
    expect(bySeq(13).filtered).toBe(false);
  });

  it('does not hide the last flat row solely because it is SectionPassage', () => {
    // Single row assigned to current user — discriminating case for hasOnePassage
    // counting only IwsKind.Passage (never true for flat SectionPassage rows).
    const { sheet } = refilterSheet({
      sheet: [flatRow(13, { type: 'user', id: currentUser })],
      filterState: assignedToMeFilter,
      minSection: -1,
      hidePublishing: false,
      orgSteps: [],
      doneStepId: 'done-1',
      flat: true,
      user: currentUser,
      myGroups: [],
    });

    expect(sheet[0].filtered).toBe(false);
  });
});
