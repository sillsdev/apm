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

  it('uses contentType for webm when basename has no valid extension', () => {
    const media = {
      attributes: {
        originalFile: 'inline-recording',
        contentType: 'audio/webm;codecs=opus',
      },
    } as MediaFileD;
    expect(getMediaExt(media)).toBe('webm');
  });

  it('uses opus extension for audio/opus, not ogg', () => {
    const media = {
      attributes: {
        originalFile: 'clip',
        contentType: 'audio/opus',
      },
    } as MediaFileD;
    expect(getMediaExt(media)).toBe('opus');
  });
});
