/**
 * `loading` from the first play request until the media has been fetched,
 * `playing` while the audio element plays, otherwise `idle`.
 *
 * In its own module so tests that mock useMiniAudio can still use it.
 */
export enum MiniAudioPlayerStatus {
  Idle = 'idle',
  Loading = 'loading',
  Playing = 'playing',
}
