import { safeFileBasename } from './safeFileBasename';

describe('safeFileBasename', () => {
  it('returns the name unchanged when there is no directory prefix', () => {
    expect(safeFileBasename('recording.mp3')).toBe('recording.mp3');
  });

  it('strips a posix directory prefix', () => {
    expect(safeFileBasename('/home/user/media/recording.mp3')).toBe(
      'recording.mp3'
    );
  });

  it('strips a windows directory prefix', () => {
    expect(safeFileBasename('C:\\Users\\me\\media\\recording.mp3')).toBe(
      'recording.mp3'
    );
  });

  it('keeps the extension and any dots in the name', () => {
    expect(safeFileBasename('/a/b/my.take.2.wav')).toBe('my.take.2.wav');
  });

  it('drops a query string from a URL-shaped value', () => {
    expect(
      safeFileBasename('https://s3.example.com/media/clip.mp3?token=abc&x=1')
    ).toBe('clip.mp3');
  });

  it('returns an empty string for undefined, null, or empty input', () => {
    expect(safeFileBasename(undefined)).toBe('');
    expect(safeFileBasename(null)).toBe('');
    expect(safeFileBasename('')).toBe('');
  });
});
