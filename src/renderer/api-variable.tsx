export const isElectron = (window as any)?.electron;
const help =
  isElectron && import.meta.env.VITE_DESKTOP_HELP
    ? (import.meta.env.VITE_DESKTOP_HELP ?? '')
    : (import.meta.env.VITE_HELP ?? '');

export const OrbitNetworkErrorRetries = 5;

export const API_CONFIG = {
  host: import.meta.env.VITE_HOST ?? '',
  snagId: import.meta.env.VITE_SNAGID ?? '',
  offline:
    import.meta.env.VITE_OFFLINE === 'true' ||
    import.meta.env.NODE_ENV === 'test',
  help,
  chmHelp: import.meta.env.VITE_CHM_HELP ?? '',
  community: import.meta.env.VITE_COMMUNITY ?? '',
  openNotes: import.meta.env.VITE_OPENNOTES ?? '',
  resources: import.meta.env.VITE_RESOURCES ?? '',
  openContent: import.meta.env.VITE_OPENCONTENT ?? '',
  course: import.meta.env.VITE_COURSE ?? '',
  videoTraining: import.meta.env.VITE_VIDEO_TRAINING ?? '',
  walkThru: import.meta.env.VITE_WALK_THRU ?? '',
  akuo: import.meta.env.VITE_AKUO ?? '',
  endpoint: import.meta.env.VITE_ENDPOINT ?? '',
  productName:
    (import.meta.env.VITE_SITE_TITLE ?? 'Audio Project Manager') +
    (isElectron ? ' Desktop' : ''),
  flatSample: import.meta.env.VITE_FLAT ?? '',
  hierarchicalSample: import.meta.env.VITE_HIERARCHICAL ?? '',
  genFlatSample: import.meta.env.VITE_GEN_FLAT ?? '',
  genHierarchicalSample: import.meta.env.VITE_GEN_HIERARCHICAL ?? '',
  googleSamples: import.meta.env.VITE_GOOGLE_SAMPLES ?? '',
  sizeLimit: import.meta.env.VITE_SIZELIMIT ?? '20',
  sessions: import.meta.env.VITE_SESSIONS ?? 'https://sessions.bugsnag.com',
  notify: import.meta.env.VITE_NOTIFY ?? 'https://notify.bugsnag.com',
};
