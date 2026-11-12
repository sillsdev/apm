import Memory from '@orbit/memory';
import { prevPasId, prevPassageRecord } from './prevPasId';
import { passagesForSection } from './passagesForSection';
import { isPublishingTitle } from '../control/passageTypeFromRef';
import { PassageD, Section } from '../model';

jest.mock('./passagesForSection', () => ({
  passagesForSection: jest.fn(),
}));
jest.mock('../control/passageTypeFromRef', () => ({
  isPublishingTitle: jest.fn(),
}));

const mockPassagesForSection = passagesForSection as jest.MockedFunction<
  typeof passagesForSection
>;
const mockIsPublishingTitle = isPublishingTitle as jest.MockedFunction<
  typeof isPublishingTitle
>;

const memory = {} as Memory;
const section = { id: 'section-1' } as Section;

const makePassage = (
  id: string,
  sequencenum: number,
  reference: string,
  remoteId?: string
) =>
  ({
    id,
    type: 'passage',
    attributes: {
      sequencenum,
      reference,
    },
    keys: remoteId ? { remoteId } : undefined,
  }) as PassageD;

const setPassages = (passages: PassageD[]) => {
  mockPassagesForSection.mockReturnValue(passages);
};

describe('prevPasId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsPublishingTitle.mockReturnValue(false);
  });

  test('returns empty string when the section has no passages', () => {
    setPassages([]);
    expect(prevPasId(section, 'p1', memory)).toBe('');
  });

  test('looks up passages by section id so it works offline', () => {
    setPassages([makePassage('p1', 1, 'ref-1'), makePassage('p2', 2, 'ref-2')]);
    expect(prevPasId(section, 'p2', memory)).toBe('p1');
    expect(mockPassagesForSection).toHaveBeenCalledWith(memory, 'section-1');
  });

  test('returns empty string when current passage not found', () => {
    setPassages([makePassage('p1', 1, 'ref-1')]);
    expect(prevPasId(section, 'missing', memory)).toBe('');
  });

  test('returns previous passage by sequence order', () => {
    setPassages([
      makePassage('p2', 2, 'ref-2'),
      makePassage('p1', 1, 'ref-1'),
      makePassage('p3', 3, 'ref-3'),
    ]);
    expect(prevPasId(section, 'p3', memory)).toBe('p2');
  });

  test('skips publishing titles when searching backwards', () => {
    mockIsPublishingTitle.mockImplementation(
      (reference) => reference === 'PUB'
    );
    setPassages([
      makePassage('p1', 1, 'PUB'),
      makePassage('p2', 2, 'ref-2'),
      makePassage('p3', 3, 'ref-3'),
    ]);
    expect(prevPasId(section, 'p3', memory)).toBe('p2');
  });

  test('wraps to last non-publishing passage and prefers remoteId', () => {
    mockIsPublishingTitle.mockImplementation(
      (reference) => reference === 'PUB'
    );
    setPassages([
      makePassage('p1', 1, 'ref-1'),
      makePassage('p2', 2, 'PUB'),
      makePassage('p3', 3, 'ref-3', 'remote-3'),
    ]);
    expect(prevPasId(section, 'p1', memory)).toBe('remote-3');
  });

  test('does not wrap when wrap is false', () => {
    setPassages([makePassage('p1', 1, 'ref-1'), makePassage('p2', 2, 'ref-2')]);
    expect(prevPassageRecord(section, 'p1', memory, false)).toBeUndefined();
    expect(prevPassageRecord(section, 'p2', memory, false)?.id).toBe('p1');
  });
});
