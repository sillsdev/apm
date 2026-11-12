import { libraryGraphicToCompressedImages } from './libraryGraphicToCompressedImages';

const ORIG = 'https://cdn.example.com/orig/key.png';
const LARGE = 'https://cdn.example.com/thumb/640/key.png';
const SMALL = 'https://cdn.example.com/thumb/320/key.png';

describe('libraryGraphicToCompressedImages', () => {
  it('maps 1024/512/40 to orig, large thumb, and small thumb', () => {
    const images = libraryGraphicToCompressedImages(
      { url: ORIG, thumbnailUrl: LARGE, thumbnailUrlSmall: SMALL },
      [1024, 512, 40]
    );
    expect(images).toEqual([
      {
        name: 'key-1024.png',
        content: ORIG,
        type: 'image/png',
        dimension: 1024,
      },
      {
        name: 'key-512.png',
        content: LARGE,
        type: 'image/png',
        dimension: 512,
      },
      {
        name: 'key-40.png',
        content: SMALL,
        type: 'image/png',
        dimension: 40,
      },
    ]);
  });

  it('falls back when small or large thumbs are missing', () => {
    expect(
      libraryGraphicToCompressedImages(
        { url: ORIG, thumbnailUrl: LARGE },
        [40, 512]
      )
    ).toEqual([
      expect.objectContaining({ content: LARGE, dimension: 40 }),
      expect.objectContaining({ content: LARGE, dimension: 512 }),
    ]);

    expect(
      libraryGraphicToCompressedImages({ url: ORIG }, [1024, 512, 40])
    ).toEqual([
      expect.objectContaining({ content: ORIG, dimension: 1024 }),
      expect.objectContaining({ content: ORIG, dimension: 512 }),
      expect.objectContaining({ content: ORIG, dimension: 40 }),
    ]);
  });

  it('returns empty when orig url is missing', () => {
    expect(
      libraryGraphicToCompressedImages({ thumbnailUrl: LARGE }, [1024, 512, 40])
    ).toEqual([]);
  });
});
