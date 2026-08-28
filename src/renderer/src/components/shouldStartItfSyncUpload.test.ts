import { shouldStartItfSyncUpload } from './shouldStartItfSyncUpload';

describe('shouldStartItfSyncUpload', () => {
  it('starts once for a buffer and skips a Strict Mode remount of the same buffer', () => {
    const buffer = Buffer.from('itf');
    expect(shouldStartItfSyncUpload(buffer, undefined)).toBe(true);
    expect(shouldStartItfSyncUpload(buffer, buffer)).toBe(false);
  });

  it('starts again for a new export buffer', () => {
    const first = Buffer.from('a');
    const second = Buffer.from('b');
    expect(shouldStartItfSyncUpload(second, first)).toBe(true);
  });

  it('does not start without a buffer', () => {
    expect(shouldStartItfSyncUpload(undefined, undefined)).toBe(false);
  });
});
