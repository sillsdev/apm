import { isAudioLoadAbort } from './isAudioLoadAbort';

describe('isAudioLoadAbort', () => {
  it('matches AbortError', () => {
    expect(isAudioLoadAbort(new DOMException('aborted', 'AbortError'))).toBe(
      true
    );
    expect(
      isAudioLoadAbort(Object.assign(new Error('x'), { name: 'AbortError' }))
    ).toBe(true);
  });

  it('matches MEDIA_ERR_ABORTED', () => {
    expect(isAudioLoadAbort({ name: 'MediaError', code: 1 })).toBe(true);
  });

  it('does not match a missing/bad-file error', () => {
    expect(isAudioLoadAbort(new Error('Media is missing'))).toBe(false);
    expect(isAudioLoadAbort({ name: 'MediaError', code: 4 })).toBe(false);
    expect(isAudioLoadAbort(undefined)).toBe(false);
  });
});
