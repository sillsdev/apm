/** The operating system whose voice settings the voice dialog points to. */
export type SpeechPlatform = 'windows' | 'mac' | 'linux' | 'other';

/**
 * The platform from `navigator.userAgentData.platform` (or the older
 * `navigator.platform`) and the user agent. Android and ChromeOS report Linux
 * but install voices differently, so they are `other`.
 */
export const speechPlatform = (
  platform: string,
  userAgent: string
): SpeechPlatform => {
  if (/android|cros|chrome os/i.test(`${platform} ${userAgent}`))
    return 'other';
  if (/^win/i.test(platform)) return 'windows';
  if (/^mac/i.test(platform)) return 'mac';
  if (/linux/i.test(platform)) return 'linux';
  return 'other';
};

/** This device's platform; `userAgentData` is not in TypeScript's DOM types yet. */
export const currentSpeechPlatform = (): SpeechPlatform => {
  const nav = globalThis.navigator as
    (Navigator & { userAgentData?: { platform?: string } }) | undefined;
  if (!nav) return 'other';
  return speechPlatform(
    nav.userAgentData?.platform || nav.platform || '',
    nav.userAgent ?? ''
  );
};
