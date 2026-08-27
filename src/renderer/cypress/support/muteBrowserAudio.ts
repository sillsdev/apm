/**
 * Keeps test runs silent.
 *
 * The recording/playback specs drive real audio: wavesurfer plays the source
 * WAV and the recording mocks feed an oscillator through an AudioContext. In a
 * headed OR headless Chrome launched by Cypress that audio goes to the machine's
 * speakers, which is unpleasant at best and unusable if anyone is in a meeting.
 * `--mute-audio` silences output without affecting decoding, timing, or the
 * `MediaStream` the recorder captures, so the tests behave identically.
 */
export default function muteBrowserAudio(on: Cypress.PluginEvents) {
  on('before:browser:launch', (browser, launchOptions) => {
    if (browser.family === 'chromium') {
      launchOptions.args.push('--mute-audio');
      // Chrome needs no gesture to start audio in tests; harmless when muted,
      // and keeps the AudioContext from being left suspended.
      launchOptions.args.push('--autoplay-policy=no-user-gesture-required');
    }
    if (browser.family === 'firefox') {
      launchOptions.preferences['media.volume_scale'] = '0.0';
    }
    return launchOptions;
  });
}
