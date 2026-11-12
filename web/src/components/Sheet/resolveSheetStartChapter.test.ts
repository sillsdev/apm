import {
  ISheet,
  IwsKind,
  PassageD,
  PassageTypeEnum,
  SheetLevel,
} from '../../model';
import { PublishDestinationEnum } from '../../crud/usePublishDestination';
import { resolveSheetStartChapter } from './resolveSheetStartChapter';
import { withUpdatedReference } from './withUpdatedReference';

const baseRow = (overrides: Partial<ISheet> = {}): ISheet =>
  ({
    level: SheetLevel.Passage,
    kind: IwsKind.Passage,
    sectionSeq: 1,
    passageSeq: 1,
    book: 'LUK',
    reference: '1:1-4',
    deleted: false,
    filtered: false,
    passageType: PassageTypeEnum.PASSAGE,
    published: [] as PublishDestinationEnum[],
    ...overrides,
  }) as ISheet;

const passageWith = (attrs: Partial<PassageD['attributes']> = {}): PassageD =>
  ({
    type: 'passage',
    id: 'p1',
    attributes: {
      sequencenum: 1,
      book: 'LUK',
      reference: '1:1-4',
      state: '',
      hold: false,
      title: '',
      lastComment: '',
      stepComplete: '',
      dateCreated: '',
      dateUpdated: '',
      lastModifiedBy: 0,
      ...attrs,
    },
  }) as PassageD;

describe('resolveSheetStartChapter', () => {
  it('resolves chapter 1 from sheet reference when passage is missing (TT-7704)', () => {
    const row = baseRow({ reference: '1:1-4', passage: undefined });
    expect(resolveSheetStartChapter(row)).toBe(1);
  });

  it('resolves chapter 1 from sheet reference when passage lacks startChapter (TT-7704)', () => {
    const row = baseRow({
      reference: '1:1-4',
      passage: passageWith({ reference: '1:1-4' }),
    });
    expect(resolveSheetStartChapter(row)).toBe(1);
  });

  it('resolves chapter 2 from sheet reference when startChapter is missing (TT-7704)', () => {
    const row = baseRow({
      reference: '2:1-5',
      passage: passageWith({ reference: '2:1-5' }),
    });
    expect(resolveSheetStartChapter(row)).toBe(2);
  });

  it('prefers synced startChapter attributes when present', () => {
    const row = baseRow({
      reference: '1:1-4',
      passage: passageWith({
        reference: '1:1-4',
        startChapter: 3,
        endChapter: 3,
        startVerse: 1,
        endVerse: 4,
      }),
    });
    expect(resolveSheetStartChapter(row)).toBe(3);
  });

  it('returns 0 for an empty reference', () => {
    const row = baseRow({ reference: '', passage: undefined });
    expect(resolveSheetStartChapter(row)).toBe(0);
  });

  it('resolves the new chapter after an edit invalidates the previously synced chapter (TT-7704 follow-up)', () => {
    // Row was published once, so the passage already carries an online-db
    // calculated chapter 1 for the original "1:1-4" reference.
    const publishedPassage = passageWith({
      reference: '1:1-4',
      startChapter: 1,
      endChapter: 1,
      startVerse: 1,
      endVerse: 4,
    });

    // User edits the reference to chapter 3. Update Publishing Rows must see
    // chapter 3, not the stale cached chapter 1, or it will skip adding a new
    // CHAPTERNUMBER row for this section.
    const editedRow = baseRow({
      reference: '3:1-4',
      passage: withUpdatedReference(publishedPassage, '3:1-4'),
    });

    expect(resolveSheetStartChapter(editedRow)).toBe(3);
  });
});
