import { ISheet, IwsKind, SheetLevel } from '../../model';
import { PassageTypeEnum } from '../../model/passageType';
import { SectionArray } from '../../model/SectionArray';
import {
  findPlanSheetRowFromReferenceQuery,
  looksLikePublishingReferenceQuery,
} from './findPlanSheetRowFromReferenceQuery';

const basePassage = (overrides: Partial<ISheet> = {}): ISheet => ({
  level: SheetLevel.Passage,
  kind: IwsKind.Passage,
  sectionSeq: 1,
  passageSeq: 1,
  book: 'MAT',
  reference: '1:1',
  passageType: PassageTypeEnum.PASSAGE,
  deleted: false,
  filtered: false,
  published: [],
  ...overrides,
});

const baseSection = (overrides: Partial<ISheet> = {}): ISheet => ({
  level: SheetLevel.Section,
  kind: IwsKind.Section,
  sectionSeq: 1,
  passageSeq: 0,
  title: 'Sec',
  passageType: PassageTypeEnum.BOOK,
  deleted: false,
  filtered: false,
  published: [],
  ...overrides,
});

const lookupMat = (book: string) =>
  book.trim().toUpperCase() === 'MAT' ? 'MAT' : '';

describe('looksLikePublishingReferenceQuery', () => {
  it('detects M S labels with flexible spacing', () => {
    expect(looksLikePublishingReferenceQuery('M1 S2')).toBe(true);
    expect(looksLikePublishingReferenceQuery('m1s2')).toBe(true);
    expect(looksLikePublishingReferenceQuery('S3')).toBe(true);
  });

  it('returns false for scripture-like input', () => {
    expect(looksLikePublishingReferenceQuery('1:1')).toBe(false);
    expect(looksLikePublishingReferenceQuery('MAT 1:1')).toBe(false);
  });
});

describe('findPlanSheetRowFromReferenceQuery', () => {
  const defaultOpts = {
    publishingOn: true,
    hidePublishing: true,
    filtered: false,
    sectionArr: [] as SectionArray,
    inlinePassages: false,
    lookupBook: lookupMat,
  };

  it('matches publishing M/S label to first passage in section', () => {
    const rowInfo: ISheet[] = [
      baseSection({ sectionSeq: 100 }),
      basePassage({ sectionSeq: 100, passageSeq: 1, reference: '1:5' }),
      basePassage({ sectionSeq: 100, passageSeq: 2, reference: '1:6' }),
    ];
    const sectionArr: SectionArray = [[100, 'M2 S3']];
    const r = findPlanSheetRowFromReferenceQuery('M2 S3', rowInfo, {
      ...defaultOpts,
      hidePublishing: false,
      sectionArr,
    });
    expect(r).toEqual({ ok: true, rowIndex: 1 });
  });

  it('returns ms_unavailable_filtered when filtered and query is M/S', () => {
    const rowInfo: ISheet[] = [basePassage()];
    const r = findPlanSheetRowFromReferenceQuery('M1 S1', rowInfo, {
      ...defaultOpts,
      hidePublishing: false,
      filtered: true,
      sectionArr: [[1, 'M1 S1']],
    });
    expect(r).toEqual({ ok: false, error: 'ms_unavailable_filtered' });
  });

  it('matches N.N when publishing rows are hidden', () => {
    const rowInfo: ISheet[] = [
      baseSection({ sectionSeq: 2 }),
      basePassage({ sectionSeq: 2, passageSeq: 3, reference: '2:1' }),
    ];
    const r = findPlanSheetRowFromReferenceQuery('2.3', rowInfo, {
      ...defaultOpts,
      publishingOn: true,
      hidePublishing: true,
    });
    expect(r).toEqual({ ok: true, rowIndex: 1 });
  });

  it('does not use N.N when publishing rows are visible', () => {
    const rowInfo: ISheet[] = [
      basePassage({ sectionSeq: 2, passageSeq: 3, reference: '2:1' }),
    ];
    const r = findPlanSheetRowFromReferenceQuery('2.3', rowInfo, {
      ...defaultOpts,
      publishingOn: true,
      hidePublishing: false,
      sectionArr: [[2, 'M1 S1']],
    });
    expect(r).toEqual({ ok: false, error: 'not_found' });
  });

  it('matches scripture reference without book when unique', () => {
    const rowInfo: ISheet[] = [
      basePassage({ book: 'MAT', reference: '1:1-10' }),
    ];
    const r = findPlanSheetRowFromReferenceQuery('1:1-10', rowInfo, {
      ...defaultOpts,
    });
    expect(r).toEqual({ ok: true, rowIndex: 0 });
  });

  it('matches scripture with explicit book token', () => {
    const rowInfo: ISheet[] = [
      basePassage({ book: 'MAT', reference: '5:3' }),
    ];
    const r = findPlanSheetRowFromReferenceQuery('MAT 5:3', rowInfo, {
      ...defaultOpts,
    });
    expect(r).toEqual({ ok: true, rowIndex: 0 });
  });

  it('matches flat SectionPassage row', () => {
    const rowInfo: ISheet[] = [
      {
        ...basePassage(),
        kind: IwsKind.SectionPassage,
        level: SheetLevel.Passage,
        sectionSeq: 4,
        passageSeq: 1,
        book: 'LUK',
        reference: '2:10',
      },
    ];
    const r = findPlanSheetRowFromReferenceQuery('LUK 2:10', rowInfo, {
      ...defaultOpts,
      inlinePassages: true,
      lookupBook: (b) => (b.toUpperCase() === 'LUK' ? 'LUK' : ''),
    });
    expect(r).toEqual({ ok: true, rowIndex: 0 });
  });

  it('returns not_found when nothing matches', () => {
    const rowInfo: ISheet[] = [basePassage({ reference: '9:9' })];
    const r = findPlanSheetRowFromReferenceQuery('1:1', rowInfo, {
      ...defaultOpts,
    });
    expect(r).toEqual({ ok: false, error: 'not_found' });
  });
});
