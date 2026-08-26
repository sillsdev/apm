import {
  retryProgressLabel,
  retryUploadingLabel,
  shouldShowRetryAll,
} from './pendingUploadsDialogHelpers';

describe('pendingUploadsDialogHelpers', () => {
  it('hides Retry all when there is one pending file (TT-7344)', () => {
    expect(shouldShowRetryAll(0)).toBe(false);
    expect(shouldShowRetryAll(1)).toBe(false);
  });

  it('shows Retry all when there is more than one pending file (TT-7344)', () => {
    expect(shouldShowRetryAll(2)).toBe(true);
    expect(shouldShowRetryAll(5)).toBe(true);
  });

  it('formats uploadComplete as retry progress (TT-7364)', () => {
    expect(
      retryProgressLabel('{0} of {1} files uploaded successfully.', 1, 1)
    ).toBe('1 of 1 files uploaded successfully.');
    expect(
      retryProgressLabel('{0} of {1} files uploaded successfully.', 1, 2)
    ).toBe('1 of 2 files uploaded successfully.');
  });

  it('names the file in the single-retry status text (TT-7364)', () => {
    expect(retryUploadingLabel('Uploading {0}…', 'audio.mp3')).toBe(
      'Uploading audio.mp3…'
    );
  });
});
