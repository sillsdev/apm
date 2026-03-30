describe('dataPath', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('home', 'C:\\\\home');
  });

  function load({
    isElectron,
    offlineData,
    existsImpl,
  }: {
    isElectron: boolean;
    offlineData: string;
    existsImpl?: (p: string) => Promise<boolean>;
  }) {
    const api = {
      exists: jest.fn(existsImpl ?? (async () => false)),
    };
    (window as unknown as { api?: any }).api = api;

    jest.doMock('../../api-variable', () => ({
      isElectron,
      API_CONFIG: { offlineData },
    }));

    return {
      api,
      mod: require('./dataPath') as typeof import('./dataPath'),
    };
  }

  it('returns http(s) relPath unchanged when not in electron/offline mode', async () => {
    const { mod } = load({ isElectron: false, offlineData: 'offline' });
    await expect(mod.dataPath('https://example.com/file.mp3', mod.PathType.MEDIA))
      .resolves.toBe('https://example.com/file.mp3');
  });

  it('joins home/offlineData/relPath when offlineData is set and relPath is not http', async () => {
    const { mod } = load({ isElectron: false, offlineData: 'offline' });
    await expect(mod.dataPath('media/file.mp3', mod.PathType.MEDIA)).resolves.toBe(
      // path-browserify uses posix separators
      'C:\\\\home/offline/media/file.mp3'
    );
  });

  it('in electron+offline, MEDIA uses decoded filename from URL and returns it if exists', async () => {
    const { mod, api } = load({
      isElectron: true,
      offlineData: 'offline',
      existsImpl: async () => true,
    });
    const url =
      'https://host/some/Folder/Hello%20World.mp3?AWSAccessKeyId=xxx&Signature=yyy';
    const p = await mod.dataPath(url, mod.PathType.MEDIA);

    expect(p).toBe('C:\\\\home/offline/media/Hello World.mp3');
    expect(api.exists).toHaveBeenCalledWith('C:\\\\home/offline/media/Hello World.mp3');
  });

  it('in electron+offline, ZIP uses basename of relPath and preserves local_out.localname', async () => {
    const { mod } = load({ isElectron: true, offlineData: 'offline' });
    const out = { localname: '' };
    // Use a posix-style path here (path-browserify basename treats `C:` specially).
    const p = await mod.dataPath('/x/y/z/file.zip', mod.PathType.ZIP, out);
    // Returned path falls back to joining offline root + relPath when the local candidate doesn't exist.
    expect(p).toBe('C:\\\\home/offline/x/y/z/file.zip');
    // `local_out` captures the *local candidate* (basename for ZIP).
    expect(out.localname).toBe('C:\\\\home/offline/file.zip');
  });

  it('in electron+offline, BURRITO does not basename (keeps tail path)', async () => {
    const { mod } = load({ isElectron: true, offlineData: 'offline' });
    const p = await mod.dataPath('burrito/TST/text/metadata.json', mod.PathType.BURRITO);
    expect(p).toBe('C:\\\\home/offline/burrito/TST/text/metadata.json');
  });

  it('returns empty string when offlineData is empty and relPath is not http', async () => {
    const { mod } = load({ isElectron: false, offlineData: '' });
    await expect(mod.dataPath('media/file.mp3', mod.PathType.MEDIA)).resolves.toBe('');
  });

  it('s3.amazonaws fallback re-tries filename extraction when first exists fails', async () => {
    const seen: string[] = [];
    const { mod, api } = load({
      isElectron: true,
      offlineData: 'offline',
      existsImpl: async (p: string) => {
        seen.push(p);
        return seen.length === 2; // fail first, succeed second
      },
    });
    const url =
      'https://sil-transcriber-userfiles-dev.s3.amazonaws.com/noorg/Dir%2FWeird%20Name.mp3?AWSAccessKeyId=xxx';
    const p = await mod.dataPath(url, mod.PathType.MEDIA);

    expect(api.exists).toHaveBeenCalledTimes(2);
    // `%2F` decodes to `/`, preserving the subpath under `media/`.
    expect(p).toBe('C:\\\\home/offline/media/Dir/Weird Name.mp3');
  });
});

