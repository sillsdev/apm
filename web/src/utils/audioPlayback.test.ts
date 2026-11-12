import {
  canPlayNativeAudio,
  guessMimeFromUrl,
  isIOSSafari,
  shouldUseWaveSurferPlayback,
} from './audioPlayback';

const originalCanPlayType = HTMLMediaElement.prototype.canPlayType;

describe('audioPlayback', () => {
  afterEach(() => {
    HTMLMediaElement.prototype.canPlayType = originalCanPlayType;
    jest.restoreAllMocks();
  });

  describe('isIOSSafari', () => {
    it('returns true for iPhone Safari user agent', () => {
      jest
        .spyOn(window.navigator, 'userAgent', 'get')
        .mockReturnValue(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        );
      expect(isIOSSafari()).toBe(true);
    });

    it('returns true for iPadOS desktop Safari user agent', () => {
      jest
        .spyOn(window.navigator, 'userAgent', 'get')
        .mockReturnValue(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
        );
      Object.defineProperty(window.navigator, 'maxTouchPoints', {
        value: 5,
        configurable: true,
      });
      expect(isIOSSafari()).toBe(true);
    });

    it('returns false for Chrome on iOS', () => {
      jest
        .spyOn(window.navigator, 'userAgent', 'get')
        .mockReturnValue(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1'
        );
      expect(isIOSSafari()).toBe(false);
    });

    it('returns false for desktop Chrome', () => {
      jest
        .spyOn(window.navigator, 'userAgent', 'get')
        .mockReturnValue(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
      expect(isIOSSafari()).toBe(false);
    });
  });

  describe('guessMimeFromUrl', () => {
    it('maps ogg extension to audio/ogg', () => {
      expect(guessMimeFromUrl('https://example.com/file.ogg')).toBe(
        'audio/ogg'
      );
    });

    it('maps mp3 extension to audio/mpeg', () => {
      expect(guessMimeFromUrl('https://example.com/file.mp3')).toBe(
        'audio/mpeg'
      );
    });
  });

  describe('canPlayNativeAudio', () => {
    it('returns false when canPlayType is empty', () => {
      HTMLMediaElement.prototype.canPlayType = jest.fn(() => '');
      expect(canPlayNativeAudio('audio/ogg;codecs=opus')).toBe(false);
    });

    it('returns true when canPlayType is probably', () => {
      HTMLMediaElement.prototype.canPlayType = jest.fn(() => 'probably');
      expect(canPlayNativeAudio('audio/mpeg')).toBe(true);
    });

    it('returns true for empty mime', () => {
      expect(canPlayNativeAudio('')).toBe(true);
    });
  });

  describe('shouldUseWaveSurferPlayback', () => {
    it('uses WaveSurfer on iOS Safari for ogg content', () => {
      jest
        .spyOn(window.navigator, 'userAgent', 'get')
        .mockReturnValue(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        );
      HTMLMediaElement.prototype.canPlayType = jest.fn(() => 'probably');
      expect(
        shouldUseWaveSurferPlayback({
          url: 'https://example.com/recording.ogg',
          contentType: 'audio/ogg;codecs=opus',
        })
      ).toBe(true);
    });

    it('uses native playback on desktop when ogg is supported', () => {
      jest
        .spyOn(window.navigator, 'userAgent', 'get')
        .mockReturnValue(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
      HTMLMediaElement.prototype.canPlayType = jest.fn(() => 'probably');
      expect(
        shouldUseWaveSurferPlayback({
          url: 'https://example.com/recording.ogg',
          contentType: 'audio/ogg;codecs=opus',
        })
      ).toBe(false);
    });

    it('uses WaveSurfer when native playback is unsupported', () => {
      jest
        .spyOn(window.navigator, 'userAgent', 'get')
        .mockReturnValue(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
      HTMLMediaElement.prototype.canPlayType = jest.fn(() => '');
      expect(
        shouldUseWaveSurferPlayback({
          url: 'https://example.com/recording.webm',
          contentType: 'audio/webm;codecs=opus',
        })
      ).toBe(true);
    });
  });
});
