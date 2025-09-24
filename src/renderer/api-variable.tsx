export const isElectron = (window as any)?.electron;
const help =
  isElectron && import.meta.env.VITE_DESKTOP_HELP
    ? (import.meta.env.VITE_DESKTOP_HELP ?? '')
    : (import.meta.env.VITE_HELP ?? '');

export const OrbitNetworkErrorRetries = 5;

export const API_CONFIG = {
  akuo: import.meta.env.VITE_AKUO ?? '',
  chmHelp: import.meta.env.VITE_CHM_HELP ?? '',
  community: import.meta.env.VITE_COMMUNITY ?? '',
  course: import.meta.env.VITE_COURSE ?? '',
  endpoint: import.meta.env.VITE_ENDPOINT ?? '',
  flatSample: import.meta.env.VITE_FLAT ?? '',
  genFlatSample: import.meta.env.VITE_GEN_FLAT ?? '',
  genHierarchicalSample: import.meta.env.VITE_GEN_HIERARCHICAL ?? '',
  googleSamples: import.meta.env.VITE_GOOGLE_SAMPLES ?? '',
  hierarchicalSample: import.meta.env.VITE_HIERARCHICAL ?? '',
  help,
  host: import.meta.env.VITE_HOST ?? '',
  notify: import.meta.env.VITE_NOTIFY ?? 'https://notify.bugsnag.com',
  offline:
    import.meta.env.VITE_OFFLINE === 'true' ||
    import.meta.env.NODE_ENV === 'test',
  offlineData: import.meta.env.VITE_OFFLINE_DATA ?? 'transcriber',
  openContent: import.meta.env.VITE_OPENCONTENT ?? '',
  openNotes: import.meta.env.VITE_OPENNOTES ?? '',
  productName:
    (import.meta.env.VITE_SITE_TITLE ?? 'Audio Project Manager') +
    (isElectron ? ' Desktop' : ''),
  resources: import.meta.env.VITE_RESOURCES ?? '',
  schemaVersion: import.meta.env.VITE_SCHEMAVERSION ?? '100',
  sessions: import.meta.env.VITE_SESSIONS ?? 'https://sessions.bugsnag.com',
  sizeLimit: import.meta.env.VITE_SIZELIMIT ?? '20',
  snagId: import.meta.env.VITE_SNAGID ?? '',
  videoTraining: import.meta.env.VITE_VIDEO_TRAINING ?? '',
  walkThru: import.meta.env.VITE_WALK_THRU ?? '',
};
