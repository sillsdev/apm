import type { MediaFileD } from '@model/mediafile';
import getMediaExt from './getMediaExt';

describe('getMediaExt', () => {
  it('uses basename only so path-like suffixes are not treated as extension', () => {
    const media = {
      attributes: {
        originalFile: 'prefix.is\\bible\\engesv\\luk\\1',
        contentType: 'text/plain',
      },
    } as MediaFileD;
    expect(getMediaExt(media)).toBe('txt');
  });

  it('returns real extension from basename', () => {
    const media = {
      attributes: {
        originalFile: 'https://example.com/foo/bar.mp3',
        contentType: 'audio/mpeg',
      },
    } as MediaFileD;
    expect(getMediaExt(media)).toBe('mp3');
  });
});
