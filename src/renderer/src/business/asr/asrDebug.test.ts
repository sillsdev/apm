import {
  ASR_DEBUG_KEY,
  asrDebug,
  asrDebugPreview,
  isAsrDebugEnabled,
} from './asrDebug';

describe('asrDebug', () => {
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

  beforeEach(() => {
    logSpy.mockClear();
    infoSpy.mockClear();
    localStorage.removeItem(ASR_DEBUG_KEY);
  });

  afterAll(() => {
    logSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it('is disabled by default', () => {
    expect(isAsrDebugEnabled()).toBe(false);
    asrDebug('test');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('logs when localStorage flag is set', () => {
    localStorage.setItem(ASR_DEBUG_KEY, '1');
    expect(isAsrDebugEnabled()).toBe(true);
    asrDebug('poll', { taskId: 'abc' });
    expect(infoSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      '[ASR]',
      'poll',
      expect.objectContaining({ taskId: 'abc', t: expect.any(String) })
    );
  });

  it('truncates long preview strings', () => {
    expect(asrDebugPreview('short')).toBe('short');
    const long = 'x'.repeat(150);
    expect(asrDebugPreview(long, 10)).toBe('xxxxxxxxxx… (150 chars)');
  });
});
