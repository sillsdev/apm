import { loadBlobAsync } from './loadBlob';

describe('loadBlobAsync', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('does not retry when S3 returns NoSuchKey', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () =>
        '<Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message></Error>',
    });
    global.fetch = fetchMock as typeof fetch;

    await expect(
      loadBlobAsync('https://bucket.s3.amazonaws.com/AI/missing.wav')
    ).rejects.toThrow('NoSuchKey');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns empty HTTP downloads without retrying', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob([], { type: 'audio/wav' }),
    });
    global.fetch = fetchMock as typeof fetch;

    const blob = await loadBlobAsync(
      'https://bucket.s3.amazonaws.com/empty.wav'
    );

    expect(blob?.size).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries transient server errors', async () => {
    jest.useFakeTimers();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['ok'], { type: 'audio/wav' }),
      });
    global.fetch = fetchMock as typeof fetch;

    const promise = loadBlobAsync('https://bucket.s3.amazonaws.com/ok.wav');
    await jest.runAllTimersAsync();
    const blob = await promise;

    expect(blob).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});
