/* eslint-disable @typescript-eslint/no-require-imports */

// Regression guard for TT-7689: after a mediafile record is hard-deleted
// (as Phrase Back Translate does on re-record / clear), the locally cached
// audio must be evicted so playback cannot serve the stale clip from the
// basename-keyed media cache.

describe('evictMediaCache', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('home', 'C:\\\\home');
  });

  function load(
    apiOverrides?: {
      existsImpl?: (p: string) => Promise<boolean>;
      deleteImpl?: (p: string) => Promise<void>;
    },
    isElectron = true
  ) {
    const api = {
      exists: jest.fn(apiOverrides?.existsImpl ?? (async () => false)),
      delete: jest.fn(apiOverrides?.deleteImpl ?? (async () => undefined)),
    };
    (window as unknown as { api?: typeof api }).api = api;

    jest.doMock('../../api-variable', () => ({
      isElectron,
      API_CONFIG: { offlineData: 'offline' },
    }));

    return {
      api,
      mod: require('./evictMediaCache') as typeof import('./evictMediaCache'),
    };
  }

  it('deletes the cached local file when it exists', async () => {
    const { mod, api } = load({ existsImpl: async () => true });
    const url = 'https://host/media/clip.mp3?AWSAccessKeyId=xxx&Signature=yyy';

    await mod.evictMediaCache(url);

    expect(api.delete).toHaveBeenCalledWith(
      'C:\\\\home/offline/media/clip.mp3'
    );
  });

  it('does not delete when the cached file does not exist', async () => {
    const { mod, api } = load({ existsImpl: async () => false });
    const url = 'https://host/media/clip.mp3?AWSAccessKeyId=xxx&Signature=yyy';

    await mod.evictMediaCache(url);

    expect(api.delete).not.toHaveBeenCalled();
  });

  it('does nothing when not running under Electron', async () => {
    const { mod, api } = load({ existsImpl: async () => true }, false);
    const url = 'https://host/media/clip.mp3?AWSAccessKeyId=xxx&Signature=yyy';

    await mod.evictMediaCache(url);

    expect(api.exists).not.toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('does nothing when the url is empty', async () => {
    const { mod, api } = load({ existsImpl: async () => true });

    await mod.evictMediaCache('');

    expect(api.delete).not.toHaveBeenCalled();
  });

  it('lets delete errors bubble instead of failing silently', async () => {
    const { mod, api } = load({
      existsImpl: async () => true,
      deleteImpl: async () => {
        throw new Error('EBUSY');
      },
    });
    const url = 'https://host/media/clip.mp3?AWSAccessKeyId=xxx&Signature=yyy';

    await expect(mod.evictMediaCache(url)).rejects.toThrow('EBUSY');
    expect(api.delete).toHaveBeenCalled();
  });

  it('never deletes outside the media cache dir (encoded traversal)', async () => {
    // %2F decodes to "/" only after the basename is taken, so dataPath resolves
    // this above the media folder. Eviction must refuse to unlink it.
    const { mod, api } = load({ existsImpl: async () => true });
    const url =
      'https://host/media/..%2F..%2Fsecret.mp3?AWSAccessKeyId=xxx&Signature=yyy';

    await mod.evictMediaCache(url);

    expect(api.delete).not.toHaveBeenCalled();
  });
});
