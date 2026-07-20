import {
  isSuccessfulMediaFetch,
  shouldCloseMissingFilesDialog,
} from './missingDownloadCompletion';

describe('missingDownloadCompletion', () => {
  const expired = 'Token expired';

  describe('isSuccessfulMediaFetch', () => {
    it('rejects empty, expired, and remote http(s) paths', () => {
      expect(isSuccessfulMediaFetch('', expired)).toBe(false);
      expect(isSuccessfulMediaFetch(null, expired)).toBe(false);
      expect(isSuccessfulMediaFetch(undefined, expired)).toBe(false);
      expect(isSuccessfulMediaFetch(expired, expired)).toBe(false);
      expect(
        isSuccessfulMediaFetch('https://cdn.example/a.mp3', expired)
      ).toBe(false);
      expect(isSuccessfulMediaFetch('http://cdn.example/a.mp3', expired)).toBe(
        false
      );
    });

    it('accepts local filesystem paths', () => {
      expect(
        isSuccessfulMediaFetch('C:\\\\home/offline/media/a.mp3', expired)
      ).toBe(true);
      expect(isSuccessfulMediaFetch('/home/offline/media/a.mp3', expired)).toBe(
        true
      );
    });
  });

  describe('shouldCloseMissingFilesDialog', () => {
    it('closes only when remaining missing count is zero', () => {
      expect(shouldCloseMissingFilesDialog(0)).toBe(true);
      expect(shouldCloseMissingFilesDialog(1)).toBe(false);
      expect(shouldCloseMissingFilesDialog(118)).toBe(false);
    });
  });
});
