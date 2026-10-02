import { compressedImageDisplayUrl } from './compressedImageDisplayUrl';

describe('compressedImageDisplayUrl', () => {
  it('does not wrap https CDN URLs as data:base64 (TT-7725)', () => {
    const url = 'https://d12do9t5rj179j.cloudfront.net/orig/1357.png';
    expect(
      compressedImageDisplayUrl({
        content: url,
        type: 'image/png',
        name: '1357-40.png',
      })
    ).toBe(url);
  });

  it('keeps data: URLs from custom upload compression', () => {
    const data = 'data:image/png;base64,abc';
    expect(
      compressedImageDisplayUrl({ content: data, type: 'image/png' })
    ).toBe(data);
  });

  it('wraps legacy raw base64 with a data URI', () => {
    expect(
      compressedImageDisplayUrl({
        content: 'iVBORw0KGgo=',
        type: 'image/png',
      })
    ).toBe('data:image/png;base64,iVBORw0KGgo=');
  });
});
