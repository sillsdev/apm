import { downloadMediaFileName } from './downloadMediaFileName';
import { MediaFileD } from '../model';

describe('downloadMediaFileName', () => {
  test('uses originalFile stem and contentType when s3file has no extension', () => {
    const media = {
      id: 'm1',
      type: 'mediafile',
      attributes: {
        s3file: 'deadbeef',
        originalFile: 'prompt-section1.ogg',
        contentType: 'audio/ogg;codecs=opus',
        versionNumber: 2,
      },
    } as MediaFileD;
    expect(downloadMediaFileName(media, 'm1')).toBe('prompt-section1-ver2.ogg');
  });

  test('falls back to contentType when originalFile lacks a safe extension', () => {
    const media = {
      id: 'm2',
      type: 'mediafile',
      attributes: {
        s3file: 'org/plan/key',
        originalFile: 'org/plan/key',
        contentType: 'audio/wav',
        versionNumber: 1,
      },
    } as MediaFileD;
    expect(downloadMediaFileName(media, 'm2')).toBe('key-ver1.wav');
  });
});
