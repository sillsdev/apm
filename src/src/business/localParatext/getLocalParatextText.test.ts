import { Passage } from '../../model';
import { DOMParser } from '@xmldom/xmldom';

const parser = new DOMParser();

// Mock all dependencies before importing getLocalParatextText
jest.mock('./paratextPaths', () => ({
  paratextPaths: jest.fn(),
}));

jest.mock('./readChapter', () => ({
  readChapter: jest.fn(),
}));

jest.mock('./usxNodeContent', () => ({
  getPassageVerses: jest.fn(),
}));

// Import the mocked functions and the function under test
import { getLocalParatextText } from './getLocalParatextText';
import { paratextPaths } from './paratextPaths';
import { readChapter } from './readChapter';
import { getPassageVerses } from './usxNodeContent';

describe('getLocalParatextText', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('should return the text of a passage from a local Paratext project', async () => {
    // Arrange
    const pass = {
      attributes: {
        book: 'MAT',
        reference: '1:1-2',
      },
    } as Passage;
    const ptProjName = 'MyParatextProject';
    const mockReachChapterSpy = jest.mocked(readChapter);
    const mockParatextPathsSpy = jest.mocked(paratextPaths);
    const mockGetPassageVersesSpy = jest
      .mocked(getPassageVerses)
      .mockImplementation(() => 'My transcription');
    // Act
    const result = await getLocalParatextText(pass, ptProjName);
    // Assert
    expect(mockReachChapterSpy).toHaveBeenCalledTimes(1);
    expect(mockParatextPathsSpy).toHaveBeenCalledTimes(1);
    expect(mockGetPassageVersesSpy).toHaveBeenCalledTimes(1);
    expect(result).toBe('My transcription');
  });

  it('should return verse content for each chapter for 1:67-2:5', async () => {
    // Arrange
    const pass = {
      attributes: {
        book: 'LUK',
        reference: '1:67-2:5',
      },
    } as Passage;
    const ptProjName = 'MyParatextProject';
    const mockParatextPathsSpy = jest
      .mocked(paratextPaths)
      .mockImplementation((arg) => {
        if (arg === 'LUK-1') {
          return Promise.resolve({
            chapterFile: 'LUK-1.usx',
            book: 'LUK',
            chapter: '1',
            program: jest.fn().mockResolvedValue({ stdout: '' }),
          });
        } else {
          return Promise.resolve({
            chapterFile: 'LUK-2.usx',
            book: 'LUK',
            chapter: '2',
            program: jest.fn().mockResolvedValue({ stdout: '' }),
          });
        }
      });
    const mockReachChapterSpy = jest
      .mocked(readChapter)
      .mockImplementation((paths) => {
        if ((paths as any).chapterFile === 'LUK-1.usx') {
          return Promise.resolve(
            parser.parseFromString(
              `<usx><verse number="67-80" style="v"/>V67-80</usx>`
            ) as Document
          );
        } else {
          return Promise.resolve(
            parser.parseFromString(
              `<usx><verse number="1-5" style="v"/>V1-5</usx>`
            ) as Document
          );
        }
      });
    const mockGetPassageVersesSpy = jest
      .mocked(getPassageVerses)
      .mockImplementation((doc) => {
        const verses = (doc as any).getElementsByTagName('verse') as Element[];
        const verseTexts = Array.from(verses).map(
          (v) => v.nextSibling?.textContent
        );
        return verseTexts.join(' ');
      });
    // Act
    const result = await getLocalParatextText(pass, ptProjName);
    // Assert
    expect(mockReachChapterSpy).toHaveBeenCalledTimes(2);
    expect(mockParatextPathsSpy).toHaveBeenCalledTimes(2);
    expect(mockGetPassageVersesSpy).toHaveBeenCalledTimes(2);
    expect(result).toBe('V67-80\\c 2 V1-5');
  });
});
