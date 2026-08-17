import Memory from '@orbit/memory';
import { RecordIdentity } from '@orbit/records';
import { prevPasId } from './prevPasId';
import { related } from './related';
import { findRecord } from './tryFindRecord';
import { isPublishingTitle } from '../control/passageTypeFromRef';
import { PassageD, Section } from '../model';

jest.mock('./related', () => ({
  related: jest.fn(),
}));
jest.mock('./tryFindRecord', () => ({
  findRecord: jest.fn(),
}));
jest.mock('../control/passageTypeFromRef', () => ({
  isPublishingTitle: jest.fn(),
}));

const mockRelated = related as jest.MockedFunction<typeof related>;
const mockFindRecord = findRecord as jest.MockedFunction<typeof findRecord>;
const mockIsPublishingTitle = isPublishingTitle as jest.MockedFunction<
  typeof isPublishingTitle
>;

const memory = {} as Memory;
const section = {} as Section;

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
  mockRelated.mockReturnValue(
    passages.map(
      (p) =>
        ({
          id: p.id,
          type: 'passage',
        }) as RecordIdentity
    )
  );
  const byId = new Map(passages.map((p) => [p.id, p]));
  mockFindRecord.mockImplementation((_mem, _type, id) => byId.get(id));
};

describe('prevPasId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsPublishingTitle.mockReturnValue(false);
  });

  test('returns empty string when related passages are missing', () => {
    mockRelated.mockReturnValue(undefined as unknown as RecordIdentity[]);
    expect(prevPasId(section, 'p1', memory)).toBe('');
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
});
