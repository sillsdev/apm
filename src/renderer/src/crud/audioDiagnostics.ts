type UnknownRecord = Record<string, unknown>;

function browserInfo(): UnknownRecord {
  if (typeof navigator === 'undefined') return {};

  const nav = navigator as Navigator & {
    userAgentData?: {
      mobile?: boolean;
      platform?: string;
      brands?: Array<{ brand: string; version: string }>;
    };
    deviceMemory?: number;
  };

  return {
    userAgent: nav.userAgent,
    platform: nav.userAgentData?.platform ?? nav.platform,
    userAgentDataMobile: nav.userAgentData?.mobile,
    userAgentDataBrands: nav.userAgentData?.brands,
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    maxTouchPoints: nav.maxTouchPoints,
  };
}

export function getAudioDiagnosticsContext(): UnknownRecord {
  const userAgent =
    typeof navigator === 'undefined' ? '' : navigator.userAgent || '';
  const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(
    userAgent
  );
  const touchCapable =
    typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 1;
  const isElectron =
    typeof window !== 'undefined' &&
    Boolean((window as Window & { api?: unknown }).api);

  return {
    surface: isElectron ? 'desktop-electron' : 'web-browser',
    inferredDeviceClass: mobileUserAgent || touchCapable ? 'mobile' : 'desktop',
    isElectron,
    viewport:
      typeof window === 'undefined'
        ? undefined
        : {
            width: window.innerWidth,
            height: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio,
          },
    browser: browserInfo(),
  };
}

export function getAudioTrackDiagnostics(
  stream: Partial<MediaStream>
): UnknownRecord[] {
  if (typeof stream.getAudioTracks !== 'function') return [];

  return stream.getAudioTracks().map((track) => ({
    id: track.id,
    kind: track.kind,
    label: track.label,
    enabled: track.enabled,
    muted: track.muted,
    readyState: track.readyState,
    settings: track.getSettings(),
    constraints: track.getConstraints(),
    capabilities: track.getCapabilities?.(),
  }));
}

export function getBlobDiagnostics(
  blob: Blob,
  durationSeconds?: number
): UnknownRecord {
  const bitRate =
    durationSeconds && durationSeconds > 0
      ? Math.round((blob.size * 8) / durationSeconds)
      : undefined;

  return {
    sizeBytes: blob.size,
    mimeType: blob.type,
    durationSeconds,
    estimatedBitRateBps: bitRate,
  };
}

export function logAudioDiagnostic(
  event: string,
  details: UnknownRecord = {}
): void {
  console.info('[APM audio diagnostics]', {
    event,
    timestamp: new Date().toISOString(),
    ...getAudioDiagnosticsContext(),
    ...details,
  });
}
