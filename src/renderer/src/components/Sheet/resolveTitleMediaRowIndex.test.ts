import '@testing-library/jest-dom';
import {
  ISheet,
  IwsKind,
  PassageD,
  PassageTypeEnum,
  SheetLevel,
} from '../../model';
import { PublishDestinationEnum } from '../../crud/usePublishDestination';
import { resolveTitleMediaRowIndex } from './resolveTitleMediaRowIndex';

const sectionRow = (
  id: string,
  title: string,
  overrides: Partial<ISheet> = {}
): ISheet => ({
  level: SheetLevel.Section,
  kind: IwsKind.Section,
  sectionSeq: 1,
  title,
  sectionId: { type: 'section', id },
  sectionUpdated: '2021-09-15',
  passageSeq: 0,
  deleted: false,
  passageType: PassageTypeEnum.PASSAGE,
  filtered: false,
  published: [] as PublishDestinationEnum[],
  ...overrides,
});

const passageRow = (id: string, title: string): ISheet => ({
  level: SheetLevel.Passage,
  kind: IwsKind.Passage,
  sectionSeq: 1,
  title,
  passageSeq: 1,
  passage: { type: 'passage', id } as PassageD,
  passageUpdated: '2021-09-15',
  deleted: false,
  passageType: PassageTypeEnum.PASSAGE,
  filtered: false,
  published: [] as PublishDestinationEnum[],
});

describe('resolveTitleMediaRowIndex', () => {
  it('does not retarget an identified update to another row at the same visible index', () => {
    // Section A was at visible index 2 when queued; after refresh only B remains
    // at that index. Falling back to index would attach A's recording to B.
    const sheet = [
      sectionRow('book', 'Book'),
      sectionRow('alt', 'Alt'),
      sectionRow('b', 'Section B'),
    ];

    const i = resolveTitleMediaRowIndex(sheet, {
      index: 2,
      sectionId: 'a',
    });

    expect(i).toBe(-1);
    expect(sheet[2].sectionId?.id).toBe('b');
  });

  it('resolves by section id when the row is still present', () => {
    const sheet = [
      sectionRow('book', 'Book'),
      sectionRow('a', 'Section A'),
      sectionRow('b', 'Section B'),
    ];

    expect(
      resolveTitleMediaRowIndex(sheet, { index: 99, sectionId: 'a' })
    ).toBe(1);
  });

  it('resolves by passage id when the row is still present', () => {
    const sheet = [
      sectionRow('s1', 'Section'),
      passageRow('p1', 'Passage 1'),
      passageRow('p2', 'Passage 2'),
    ];

    expect(
      resolveTitleMediaRowIndex(sheet, { index: 0, passageId: 'p2' })
    ).toBe(2);
  });

  it('returns -1 when a passage id is gone', () => {
    const sheet = [passageRow('p2', 'Passage 2')];

    expect(
      resolveTitleMediaRowIndex(sheet, { index: 0, passageId: 'p1' })
    ).toBe(-1);
  });

  it('falls back to visible index only when no stable id was captured', () => {
    const sheet = [
      sectionRow('book', 'Book'),
      { ...sectionRow('new', 'Unsaved'), sectionId: undefined },
      sectionRow('b', 'Section B'),
    ];

    expect(resolveTitleMediaRowIndex(sheet, { index: 1 })).toBe(1);
  });

  it('skips deleted and filtered rows when using visible index', () => {
    const sheet = [
      sectionRow('gone', 'Gone', { deleted: true }),
      sectionRow('hidden', 'Hidden', { filtered: true }),
      sectionRow('keep', 'Keep'),
    ];

    expect(resolveTitleMediaRowIndex(sheet, { index: 0 })).toBe(2);
  });
});
