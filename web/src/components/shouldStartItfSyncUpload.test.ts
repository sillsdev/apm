import {
  importMountAction,
  shouldStartItfSyncUpload,
} from './shouldStartItfSyncUpload';

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

describe('importMountAction', () => {
  const buffer = Buffer.from('itf');

  it('syncs a new go-online buffer and skips the Strict Mode remount', () => {
    const goingOnline = {
      isElectron: true,
      hasSyncFile: true,
      syncBuffer: buffer,
      offerPtf: false,
    };
    expect(importMountAction({ ...goingOnline, lastStarted: undefined })).toBe(
      'sync'
    );
    expect(importMountAction({ ...goingOnline, lastStarted: buffer })).toBe(
      'skip'
    );
  });

  it('still offers a file when there is nothing to sync', () => {
    expect(
      importMountAction({
        isElectron: true,
        hasSyncFile: false,
        syncBuffer: undefined,
        lastStarted: undefined,
        offerPtf: true,
      })
    ).toBe('choose');
    expect(
      importMountAction({
        isElectron: false,
        hasSyncFile: false,
        syncBuffer: undefined,
        lastStarted: undefined,
        offerPtf: false,
      })
    ).toBe('pick');
  });
});
