export const isElectron = (window as any)?.electron;
const help =
  isElectron && process.env.VITE_DESKTOP_HELP
    ? (process.env.VITE_DESKTOP_HELP ?? '')
    : (process.env.VITE_HELP ?? '');

export const OrbitNetworkErrorRetries = 5;

export const API_CONFIG = {
  host: process.env.VITE_HOST ?? '',
  snagId: process.env.VITE_SNAGID ?? '',
  offline:
    process.env.VITE_OFFLINE === 'true' || process.env.NODE_ENV === 'test',
  help,
  chmHelp: process.env.VITE_CHM_HELP ?? '',
  community: process.env.VITE_COMMUNITY ?? '',
  openNotes: process.env.VITE_OPENNOTES ?? '',
  resources: process.env.VITE_RESOURCES ?? '',
  openContent: process.env.VITE_OPENCONTENT ?? '',
  course: process.env.VITE_COURSE ?? '',
  videoTraining: process.env.VITE_VIDEO_TRAINING ?? '',
  walkThru: process.env.VITE_WALK_THRU ?? '',
  akuo: process.env.VITE_AKUO ?? '',
  endpoint: process.env.VITE_ENDPOINT ?? '',
  productName:
    (process.env.VITE_SITE_TITLE ?? 'Audio Project Manager') +
    (isElectron ? ' Desktop' : ''),
  flatSample: process.env.VITE_FLAT ?? '',
  hierarchicalSample: process.env.VITE_HIERARCHICAL ?? '',
  genFlatSample: process.env.VITE_GEN_FLAT ?? '',
  genHierarchicalSample: process.env.VITE_GEN_HIERARCHICAL ?? '',
  googleSamples: process.env.VITE_GOOGLE_SAMPLES ?? '',
  sizeLimit: process.env.VITE_SIZELIMIT ?? '20',
  sessions: process.env.VITE_SESSIONS ?? 'https://sessions.bugsnag.com',
  notify: process.env.VITE_NOTIFY ?? 'https://notify.bugsnag.com',
};
