jest.mock('../../utils/axios', () => ({
  axiosGet: jest.fn(),
}));

import { axiosGet } from '../../utils/axios';
import {
  asrLanguageFilter,
  cachedNeedsSisterLanguage,
  clearAsrLanguageValidityCache,
  getMethodsForAsr,
  isValidAsrLanguage,
  loadAsrLanguages,
  resolveAsrBcp47,
  specificAsrMethods,
} from './asrLanguages';
import {
  asrRequestMethod,
  explicitAsrMethod,
  listedAsrMethod,
} from './asrMethod';

const mockAxiosGet = axiosGet as jest.Mock;

describe('isValidAsrLanguage', () => {
  beforeEach(() => {
    mockAxiosGet.mockReset();
    clearAsrLanguageValidityCache();
  });

  it('does not call aero when the iso is unset', async () => {
    await expect(isValidAsrLanguage('und', 'token')).resolves.toBe(false);
    expect(mockAxiosGet).not.toHaveBeenCalled();
  });

  it('asks aero whether the iso is an ASR language', async () => {
    mockAxiosGet.mockResolvedValue(['whisper']);
    await expect(isValidAsrLanguage('eng', 'token')).resolves.toBe(true);
    expect(mockAxiosGet).toHaveBeenCalledWith(
      'aero/transcription/asrlanguages/eng',
      undefined,
      'token'
    );
  });

  it('returns false when aero has no such language', async () => {
    mockAxiosGet.mockRejectedValue({ response: { status: 404 } });
    await expect(isValidAsrLanguage('tlh', 'token')).resolves.toBe(false);
  });

  it('does not call aero or reject the language when there is no token', async () => {
    await expect(isValidAsrLanguage('eng', null)).resolves.toBe(true);
    await expect(isValidAsrLanguage('eng', '')).resolves.toBe(true);
    expect(mockAxiosGet).not.toHaveBeenCalled();
  });
});

describe('cachedNeedsSisterLanguage', () => {
  beforeEach(() => {
    mockAxiosGet.mockReset();
    clearAsrLanguageValidityCache();
  });

  it('is unknown before the language has been checked', () => {
    expect(cachedNeedsSisterLanguage('en')).toBeUndefined();
    expect(mockAxiosGet).not.toHaveBeenCalled();
  });

  it('gives the answer once the language has been checked', async () => {
    mockAxiosGet.mockResolvedValue(['whisper']);
    await isValidAsrLanguage('eng', 'token');
    expect(cachedNeedsSisterLanguage('en')).toBe(false);
  });

  it('needs a sister for a language the service has no methods for', async () => {
    mockAxiosGet.mockRejectedValue({ response: { status: 404 } });
    await isValidAsrLanguage('eng', 'token');
    expect(cachedNeedsSisterLanguage('en')).toBe(true);
  });

  it('never needs a sister for an unset language', () => {
    expect(cachedNeedsSisterLanguage('und')).toBe(false);
  });
});

describe('getMethodsForAsr', () => {
  beforeEach(() => {
    mockAxiosGet.mockReset();
    clearAsrLanguageValidityCache();
  });

  it('returns the method names aero lists for the iso', async () => {
    mockAxiosGet.mockResolvedValue(['omnilingual', 'mms']);
    await expect(getMethodsForAsr('eng', 'token')).resolves.toEqual([
      'omnilingual',
      'mms',
    ]);
    expect(mockAxiosGet).toHaveBeenCalledWith(
      'aero/transcription/asrlanguages/eng',
      undefined,
      'token'
    );
  });

  it('does not call aero without a token, and still asks once a token arrives', async () => {
    await expect(getMethodsForAsr('eng', null)).resolves.toEqual([]);
    expect(mockAxiosGet).not.toHaveBeenCalled();
    mockAxiosGet.mockResolvedValue(['whisper']);
    await expect(getMethodsForAsr('eng', 'token')).resolves.toEqual([
      'whisper',
    ]);
    expect(mockAxiosGet).toHaveBeenCalledTimes(1);
  });
});

describe('specificAsrMethods', () => {
  it('hides the choice when fewer than two methods are available', () => {
    expect(specificAsrMethods(['mms'])).toBeUndefined();
    expect(specificAsrMethods([])).toBeUndefined();
  });

  it('offers the first listed method as the preferred one', () => {
    expect(specificAsrMethods(['omnilingual', 'mms', 'whisper'])).toEqual({
      preferred: 'omnilingual',
      others: ['mms', 'whisper'],
    });
  });

  it('treats default and empty as no explicit method', () => {
    expect(explicitAsrMethod(undefined)).toBeUndefined();
    expect(explicitAsrMethod('default')).toBeUndefined();
    expect(explicitAsrMethod('whisper')).toBe('whisper');
  });

  it('sends no method for phonetic, even when one was chosen', () => {
    expect(asrRequestMethod('mms', true)).toBeUndefined();
    expect(asrRequestMethod('mms', false)).toBe('mms');
    expect(asrRequestMethod('default', false)).toBeUndefined();
  });

  it('leaves off a method the cached list no longer offers', () => {
    expect(asrRequestMethod('mms', false, ['whisper', 'w2v-bert'])).toBe(
      undefined
    );
    expect(asrRequestMethod('mms', false, ['whisper', 'mms'])).toBe('mms');
  });
});

describe('loadAsrLanguages', () => {
  beforeEach(() => {
    mockAxiosGet.mockReset();
    clearAsrLanguageValidityCache();
  });

  it('loads the picker list from aero once per session', async () => {
    mockAxiosGet.mockResolvedValue(['aae', 'eng']);
    await expect(loadAsrLanguages('token')).resolves.toEqual(
      new Set(['aae', 'eng'])
    );
    await loadAsrLanguages('other-token');
    expect(mockAxiosGet).toHaveBeenCalledTimes(1);
    expect(mockAxiosGet).toHaveBeenCalledWith(
      'aero/transcription/languages',
      undefined,
      'token'
    );
  });

  it('does not ask aero without a token, and still asks once a token arrives', async () => {
    await expect(loadAsrLanguages(null)).resolves.toEqual(new Set());
    expect(mockAxiosGet).not.toHaveBeenCalled();
    mockAxiosGet.mockResolvedValue(['eng']);
    await expect(loadAsrLanguages('token')).resolves.toEqual(new Set(['eng']));
    expect(mockAxiosGet).toHaveBeenCalledTimes(1);
  });

  it('uses the configured sister language when it cannot ask aero', async () => {
    await expect(resolveAsrBcp47('tlh', 'en', null)).resolves.toBe('en');
    expect(mockAxiosGet).not.toHaveBeenCalled();
  });

  it('keeps the primary language without a token when no sister is set', async () => {
    await expect(resolveAsrBcp47('tlh', undefined, null)).resolves.toBe('tlh');
    expect(mockAxiosGet).not.toHaveBeenCalled();
  });

  it('filters the language picker with that list', async () => {
    mockAxiosGet.mockResolvedValue(['eng']);
    expect(asrLanguageFilter('en')).toBe(false);
    await loadAsrLanguages('token');
    expect(asrLanguageFilter('en')).toBe(true);
    expect(asrLanguageFilter('fr')).toBe(false);
  });
});

describe('listedAsrMethod', () => {
  it('keeps a listed method other than the first', () => {
    expect(listedAsrMethod('mms', ['whisper', 'mms'])).toBe('mms');
  });

  it('drops a method that is no longer listed, or now listed first', () => {
    expect(listedAsrMethod('w2v-bert', ['whisper', 'mms'])).toBeUndefined();
    expect(listedAsrMethod('whisper', ['whisper', 'mms'])).toBeUndefined();
  });

  it('has no method for a language with no methods, and leaves no choice alone', () => {
    expect(listedAsrMethod('mms', [])).toBeUndefined();
    expect(listedAsrMethod(undefined, ['whisper'])).toBeUndefined();
  });
});
