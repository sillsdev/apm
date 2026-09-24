import { fileNameOnly } from './fileNameOnly';

describe('fileNameOnly', () => {
  it('returns the name unchanged when there is no directory prefix', () => {
    expect(fileNameOnly('recording.mp3')).toBe('recording.mp3');
  });

  it('strips a posix directory prefix', () => {
    expect(fileNameOnly('/home/user/media/recording.mp3')).toBe(
      'recording.mp3'
    );
  });

  it('strips a windows directory prefix', () => {
    expect(fileNameOnly('C:\\Users\\me\\media\\recording.mp3')).toBe(
      'recording.mp3'
    );
  });

  it('keeps the extension and any dots in the name', () => {
    expect(fileNameOnly('/a/b/my.take.2.wav')).toBe('my.take.2.wav');
  });

  it('returns an empty string for undefined, null, or empty input', () => {
    expect(fileNameOnly(undefined)).toBe('');
    expect(fileNameOnly(null)).toBe('');
    expect(fileNameOnly('')).toBe('');
  });
});
