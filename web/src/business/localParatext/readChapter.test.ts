import { DOMParser } from '@xmldom/xmldom';
import { readChapter } from './readChapter';

const domParser = new DOMParser();

describe('readChapter', () => {
  const originalApi = window.api;

  afterEach(() => {
    window.api = originalApi;
  });

  it('should read a chapter', async () => {
    // Arrange
    const paths = {
      chapterFile: 'path/to/chapterFile',
      book: 'book',
      chapter: 'chapter',
      program: jest.fn().mockResolvedValue({ stdout: '' }),
    };
    const ptProjName = 'ptProjName';

    const mockElectron = {
      temp: jest.fn().mockResolvedValue('temp'),
      read: jest.fn().mockResolvedValue('usx'),
    };
    window.api = mockElectron as unknown as typeof window.api;

    // Act
    const result = await readChapter(paths, ptProjName);

    // Assert
    expect(result).toEqual(domParser.parseFromString('usx'));
    expect(mockElectron.temp).toHaveBeenCalled();
    expect(paths.program).toHaveBeenCalledWith([
      '-r',
      ptProjName,
      paths.book,
      paths.chapter,
      paths.chapterFile,
      '-x',
    ]);
    expect(mockElectron.read).toHaveBeenCalledWith(paths.chapterFile, 'utf-8');
  });
});
