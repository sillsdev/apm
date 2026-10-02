import { IRow } from '../../../context/PassageDetailContext';
import {
  firstIncompleteClauseIndex,
  getRecordingForClause,
} from '../carefulSpeech/carefulSpeechCompletion';
import {
  getTranscribedClauseIndices,
  isClauseTranscribed,
} from './lwcTranscriptionCompletion';

jest.mock('../carefulSpeech/carefulSpeechCompletion', () => ({
  getRecordingForClause: jest.fn(),
  firstIncompleteClauseIndex: jest.requireActual(
    '../carefulSpeech/carefulSpeechCompletion'
  ).firstIncompleteClauseIndex,
}));

const mockGetRecordingForClause = getRecordingForClause as jest.Mock;

function rowWithTranscription(text: string | undefined): IRow {
  return {
    mediafile: {
      id: 'mf1',
      type: 'mediafile',
      attributes: { transcription: text },
    },
  } as IRow;
}

describe('isClauseTranscribed', () => {
  it('returns false when row is undefined', () => {
    expect(isClauseTranscribed(undefined)).toBe(false);
  });

  it('returns false for empty or whitespace transcription', () => {
    expect(isClauseTranscribed(rowWithTranscription(''))).toBe(false);
    expect(isClauseTranscribed(rowWithTranscription('   '))).toBe(false);
    expect(isClauseTranscribed(rowWithTranscription(undefined))).toBe(false);
  });

  it('returns true for non-empty transcription', () => {
    expect(isClauseTranscribed(rowWithTranscription('hello'))).toBe(true);
  });
});

describe('getTranscribedClauseIndices', () => {
  const regions = [
    { start: 0, end: 1, label: '' },
    { start: 1, end: 2, label: '' },
  ];

  beforeEach(() => {
    mockGetRecordingForClause.mockReset();
  });

  it('marks clauses with non-empty transcription', () => {
    mockGetRecordingForClause
      .mockReturnValueOnce(rowWithTranscription('clause one'))
      .mockReturnValueOnce(rowWithTranscription(''));

    const result = getTranscribedClauseIndices(
      regions,
      [],
      'pbt-id',
      1,
      'vernacular-id'
    );

    expect(result).toEqual(new Set([0]));
  });
});

describe('firstIncompleteClauseIndex', () => {
  it('returns first missing index', () => {
    expect(
      firstIncompleteClauseIndex(
        [{ start: 0, end: 1, label: '' }],
        new Set([0])
      )
    ).toBe(1);
  });
});
