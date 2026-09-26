// Mock the dependency before importing paratextPaths
jest.mock('../../utils/paratextPath', () => ({
  getReadWriteProg: jest.fn(),
}));

// Import the mocked function and the function under test
import { paratextPaths } from './paratextPaths';
import { getReadWriteProg } from '../../utils/paratextPath';

describe('ParatextPaths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return the correct path for the book and chapter', async () => {
    // Arrange
    const mockGetReadWriteProgSpy = jest
      .mocked(getReadWriteProg)
      .mockResolvedValue(
        jest.fn().mockResolvedValue({ stdout: '', stderr: '', code: 0 })
      );
    // Act
    const result = await paratextPaths('MAT-1');
    // Assert
    expect(mockGetReadWriteProgSpy).toHaveBeenCalledTimes(1);
    expect(mockGetReadWriteProgSpy).toHaveBeenCalledWith();
    expect(result).toEqual({
      chapterFile: '/tmp/MAT-1.usx',
      book: 'MAT',
      chapter: '1',
      program: expect.any(Function),
    });
  });
});
