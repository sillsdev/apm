import Memory from '@orbit/memory';
import { PassageD } from '../../model';
import { DOMParser } from '@xmldom/xmldom';

const domParser = new DOMParser();
const mockChapDom = domParser.parseFromString('<usx></usx>');
const mockMemory = { update: jest.fn() } as unknown as Memory;

// Mock all dependencies before importing doChapter
jest.mock('./paratextPaths', () => ({
  paratextPaths: jest.fn(),
}));

jest.mock('./readChapter', () => ({
  readChapter: jest.fn(),
}));

jest.mock('./postPass', () => ({
  postPass: jest.fn(),
}));

jest.mock('./writeChapter', () => ({
  writeChapter: jest.fn(),
}));

jest.mock('@orbit/memory', () => ({
  __esModule: true,
  default: mockMemory,
  RecordTransformBuilder: jest.fn(),
}));

jest.mock('../../crud/updatePassageState', () => {
  return {
    UpdateMediaStateOps: jest.fn(),
  };
});

// Import the mocked functions
import { doChapter } from './doChapter';
import { paratextPaths } from './paratextPaths';
import { readChapter } from './readChapter';
import { postPass } from './postPass';
import { writeChapter } from './writeChapter';

describe('doChapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('should post the passage for each chapter referenced', async () => {
    const params = {
      chap: 'MAT-1',
      passInfo: [
        {
          passage: {
            attributes: {
              lastComment: 'My transcription',
              startChapter: 1,
              startVerse: 1,
              endChapter: 1,
              endVerse: 1,
            },
            id: 'p1',
          } as PassageD,
          mediaId: 'm1',
          transcription: 'My transcription',
        },
      ],
      ptProjName: 'ptProjName',
      memory: mockMemory,
      userId: 'u1',
      exportNumbers: true,
      sectionArr: undefined,
    };

    const mockParatextPathsSpy = jest.mocked(paratextPaths).mockResolvedValue({
      chapterFile: 'chapterFile',
      book: 'MAT',
      chapter: '1',
      program: jest.fn().mockResolvedValue({ stdout: '' }),
    });
    const readChapterSpy = jest
      .mocked(readChapter)
      .mockResolvedValue(mockChapDom);
    const postPassSpy = jest.mocked(postPass);
    const writeChapterSpy = jest
      .mocked(writeChapter)
      .mockResolvedValue({ stdout: '' });

    await doChapter(params);

    expect(mockParatextPathsSpy).toHaveBeenCalledTimes(1);
    expect(readChapterSpy).toHaveBeenCalledTimes(1);

    expect(postPassSpy).toHaveBeenCalledTimes(1);
    const postPassParams = postPassSpy.mock.calls[0][0] as any;
    expect(postPassParams.doc).toEqual(mockChapDom);
    expect(postPassParams.chap).toEqual('1');
    expect(postPassParams.currentPI).toEqual(params.passInfo[0]);
    expect(postPassParams.exportNumbers).toEqual(true);
    expect(postPassParams.sectionArr).toBeUndefined();
    expect(postPassParams.memory).toEqual(mockMemory);

    expect(writeChapterSpy).toHaveBeenCalledTimes(1);
    expect(mockMemory.update).toHaveBeenCalledTimes(1);
  });
});
