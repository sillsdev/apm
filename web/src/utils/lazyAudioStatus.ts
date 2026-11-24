/**
 * `loading` from the first play request until the media has been fetched,
 * `playing` while the audio element plays, otherwise `idle`.
 *
 * In its own module so tests that mock useLazyAudio can still use it.
 */
export enum LazyAudioStatus {
  Idle = 'idle',
  Loading = 'loading',
  Playing = 'playing',
}
