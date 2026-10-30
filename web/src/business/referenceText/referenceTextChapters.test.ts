import jhn3 from './__fixtures__/BSB_JHN_3.simple.json';
import jhn4 from './__fixtures__/BSB_JHN_4.simple.json';

const mockElectron = { value: false };
jest.mock('../../../api-variable', () => ({
  get isElectron() {
    return mockElectron.value;
  },
  API_CONFIG: { offlineData: 'test-transcriber' },
}));
jest.mock('../../utils/logErrorService', () => ({
  logError: jest.fn(),
  Severity: { info: 0, error: 1, retry: 2 },
}));

import {
  clearChapterCache,
  getChapter,
  getChapters,
  HELLOAO_API,
} from './referenceTextChapters';
import { logError } from '../../utils/logErrorService';

const ok = (json: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(json),
  } as Response);

const notFound = () =>
  Promise.resolve({
    ok: false,
    status: 404,
    statusText: 'Not Found',
    json: () => Promise.reject(new Error('no body')),
  } as Response);

const mockFetch = jest.fn<Promise<Response>, [string]>();

beforeEach(() => {
  clearChapterCache();
  mockElectron.value = false;
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});

describe('getChapter on web', () => {
  it('fetches the simple chapter JSON for the translation, book and chapter', async () => {
    mockFetch.mockReturnValueOnce(ok(jhn3));
    const body = await getChapter('BSB', 'JHN', 3);
    expect(body.number).toBe(3);
    expect(mockFetch).toHaveBeenCalledWith(
      `${HELLOAO_API}/BSB/JHN/3.simple.json`
    );
  });

  it('shares one request between callers', async () => {
    mockFetch.mockReturnValue(ok(jhn3));
    await Promise.all([
      getChapter('BSB', 'JHN', 3),
      getChapter('BSB', 'JHN', 3),
    ]);
    await getChapter('BSB', 'JHN', 3);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('rejects on an HTTP error and retries on the next request', async () => {
    mockFetch.mockReturnValueOnce(notFound()).mockReturnValueOnce(ok(jhn3));
    await expect(getChapter('BSB', 'JHN', 3)).rejects.toThrow('404');
    await expect(getChapter('BSB', 'JHN', 3)).resolves.toMatchObject({
      number: 3,
    });
  });

  it('rejects a response that is not a chapter', async () => {
    mockFetch.mockReturnValueOnce(ok({ error: 'nope' }));
    await expect(getChapter('BSB', 'JHN', 3)).rejects.toThrow('not a chapter');
  });
});

describe('getChapters', () => {
  it('returns the chapters in order', async () => {
    mockFetch.mockImplementation((url: string) =>
      ok(url.endsWith('/3.simple.json') ? jhn3 : jhn4)
    );
    const bodies = await getChapters('BSB', 'JHN', [3, 4]);
    expect(bodies.map((b) => b.number)).toEqual([3, 4]);
  });

  it('rejects when any chapter fails', async () => {
    mockFetch.mockImplementation((url: string) =>
      url.endsWith('/3.simple.json') ? ok(jhn3) : notFound()
    );
    await expect(getChapters('BSB', 'JHN', [3, 4])).rejects.toThrow('404');
  });
});

describe('getChapter on desktop', () => {
  const files = new Map<string, string>();
  const api = {
    exists: jest.fn((name: string) => Promise.resolve(files.has(name))),
    read: jest.fn((name: string) => Promise.resolve(files.get(name) ?? '')),
    write: jest.fn((name: string, data: string) => {
      files.set(name, data);
      return Promise.resolve();
    }),
    createFolder: jest.fn(() => Promise.resolve()),
  };
  const localPath = (file: string) =>
    expect.stringMatching(
      new RegExp(`test-transcriber[\\\\/]referencetext[\\\\/]${file}$`)
    );

  beforeEach(() => {
    mockElectron.value = true;
    files.clear();
    Object.values(api).forEach((fn) => fn.mockClear());
    (window as unknown as { api: typeof api }).api = api;
  });

  it('saves a fetched chapter in the offline data folder', async () => {
    mockFetch.mockReturnValueOnce(ok(jhn3));
    await getChapter('BSB', 'JHN', 3);
    expect(api.write).toHaveBeenCalledWith(
      localPath('BSB/JHN/3.simple.json'),
      JSON.stringify(jhn3)
    );
  });

  it('reads a saved chapter without fetching', async () => {
    mockFetch.mockReturnValueOnce(ok(jhn3));
    await getChapter('BSB', 'JHN', 3);
    clearChapterCache(); // as after a restart
    const body = await getChapter('BSB', 'JHN', 3);
    expect(body.number).toBe(3);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('fetches again when the saved file is damaged', async () => {
    mockFetch.mockReturnValue(ok(jhn3));
    await getChapter('BSB', 'JHN', 3);
    files.forEach((_, name) => files.set(name, '{not json'));
    clearChapterCache();
    await expect(getChapter('BSB', 'JHN', 3)).resolves.toMatchObject({
      number: 3,
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('still returns the chapter when saving fails', async () => {
    mockFetch.mockReturnValueOnce(ok(jhn3));
    api.write.mockImplementationOnce(() =>
      Promise.reject(new Error('disk full'))
    );
    await expect(getChapter('BSB', 'JHN', 3)).resolves.toMatchObject({
      number: 3,
    });
    expect(logError).toHaveBeenCalled();
  });
});
