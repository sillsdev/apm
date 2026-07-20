/* eslint-disable @typescript-eslint/no-require-imports */

describe('tryDownload', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('home', 'C:\\\\home');
  });

  function load(apiOverrides?: {
    existsImpl?: (p: string) => Promise<boolean>;
    downloadFileImpl?: (url: string, dest: string) => Promise<void>;
  }) {
    const api = {
      createFolder: jest.fn(),
      downloadFile: jest.fn(
        apiOverrides?.downloadFileImpl ?? (async () => undefined)
      ),
      exists: jest.fn(apiOverrides?.existsImpl ?? (async () => false)),
    };
    (window as unknown as { api?: typeof api }).api = api;

    jest.doMock('../../api-variable', () => ({
      isElectron: true,
      API_CONFIG: { offlineData: 'offline' },
    }));

    return {
      api,
      mod: require('./tryDownload') as typeof import('./tryDownload'),
    };
  }

  it('returns ok with local path when file already exists', async () => {
    const { mod, api } = load({
      existsImpl: async () => true,
    });
    const url =
      'https://host/media/Hello%20World.mp3?AWSAccessKeyId=xxx&Signature=yyy';

    const result = await mod.tryDownload(url);

    expect(result.ok).toBe(true);
    expect(result.path).toBe('C:\\\\home/offline/media/Hello World.mp3');
    expect(api.downloadFile).not.toHaveBeenCalled();
  });

  it('returns ok after successful download when exists becomes true', async () => {
    let exists = false;
    const { mod, api } = load({
      existsImpl: async () => exists,
      downloadFileImpl: async () => {
        exists = true;
      },
    });
    const url =
      'https://host/media/clip.mp3?AWSAccessKeyId=xxx&Signature=yyy';

    const result = await mod.tryDownload(url);

    expect(result.ok).toBe(true);
    expect(result.path).toBe('C:\\\\home/offline/media/clip.mp3');
    expect(api.downloadFile).toHaveBeenCalled();
    expect(api.createFolder).toHaveBeenCalled();
  });

  it('returns not ok when download throws', async () => {
    const { mod, api } = load({
      existsImpl: async () => false,
      downloadFileImpl: async () => {
        throw new Error('network');
      },
    });
    const url =
      'https://host/media/fail.mp3?AWSAccessKeyId=xxx&Signature=yyy';

    const result = await mod.tryDownload(url);

    expect(result.ok).toBe(false);
    expect(result.path).toBe(url);
    expect(api.downloadFile).toHaveBeenCalled();
  });

  it('returns not ok when download finishes but file is still missing', async () => {
    const { mod } = load({
      existsImpl: async () => false,
      downloadFileImpl: async () => undefined,
    });
    const url =
      'https://host/media/ghost.mp3?AWSAccessKeyId=xxx&Signature=yyy';

    const result = await mod.tryDownload(url);

    expect(result.ok).toBe(false);
    expect(result.path).toBe(url);
  });
});
