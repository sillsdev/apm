/** Non-http success path for web Local Media Blob downloads (ADR 0017). */
export const localMediaPath = (mediafileId: string): string =>
  `local-media:${mediafileId}`;

export const isLocalMediaPath = (path: string | undefined | null): boolean =>
  typeof path === 'string' && path.startsWith('local-media:');
