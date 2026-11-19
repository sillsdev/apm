/**
 * Prefix of the non-http path `fetchUrl` returns on web when the media is
 * stored as a Local Media Blob (ADR 0017). It stays a string because
 * `fetchUrl` shares its `string` result with desktop file paths and cloud urls.
 */
const LOCAL_MEDIA_PATH_PREFIX = 'local-media:';

export const localMediaPath = (mediafileId: string): string =>
  `${LOCAL_MEDIA_PATH_PREFIX}${mediafileId}`;

export const isLocalMediaPath = (path: string | undefined | null): boolean =>
  typeof path === 'string' && path.startsWith(LOCAL_MEDIA_PATH_PREFIX);
