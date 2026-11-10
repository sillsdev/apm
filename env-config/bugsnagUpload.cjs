#!/usr/bin/env node
/**
 * Upload the web build's source maps (web/dist) to BugSnag.
 *
 * Works on Linux (CI) and Windows. Runs the @bugsnag/cli native binary
 * directly instead of `npx bugsnag-cli`, because:
 *   - on Windows the package's `bin` entry is a placeholder that always throws
 *     (the real binary is bin/bugsnag-cli.exe), and
 *   - the package's postinstall download can fail silently, leaving only the
 *     placeholder. If the binary is missing we re-run that download here.
 *
 * Settings (first one set wins; environment variables override web/.env.local):
 *   API key:  BUGSNAG_API_KEY, SNAG_ID, then VITE_SNAGID from web/.env.local.
 *             If none is set the upload is skipped, since the app does not
 *             start BugSnag without a key either.
 *   Base URL: BUGSNAG_BASE_URL, APP, then VITE_ENDPOINT from web/.env.local.
 *             This is the URL the contents of web/dist are served from (the
 *             app, e.g. https://app-dev.audioprojectmanager.org), not the API
 *             (VITE_HOST).
 *
 * Usage (from web/):  npm run bugsnag:upload [-- options]
 *   --remove-maps   delete the .map files from web/dist after a successful
 *                   upload, so they are not deployed
 *   any other args  passed through to `bugsnag-cli upload js` (e.g. --dry-run)
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const webDir = path.resolve(__dirname, '..', 'web');
const distDir = path.join(webDir, 'dist');
const cliDir = path.join(webDir, 'node_modules', '@bugsnag', 'cli');
const binary = path.join(
  cliDir,
  'bin',
  process.platform === 'win32' ? 'bugsnag-cli.exe' : 'bugsnag-cli'
);
// The placeholder script is ~100 bytes; the real binary is several MB.
const MIN_BINARY_BYTES = 1024 * 1024;

const fail = (msg) => {
  console.error(`bugsnagUpload: ${msg}`);
  process.exit(1);
};

const binaryInstalled = () =>
  fs.existsSync(binary) && fs.statSync(binary).size > MIN_BINARY_BYTES;

const ensureBinary = () => {
  if (binaryInstalled()) return;
  if (!fs.existsSync(path.join(cliDir, 'postinstall.js'))) {
    fail(`@bugsnag/cli is not installed in ${webDir}. Run npm ci in web/.`);
  }
  console.log('bugsnagUpload: downloading the bugsnag-cli binary...');
  // postinstall.js writes to ./bin relative to its cwd.
  spawnSync(process.execPath, ['postinstall.js'], {
    cwd: cliDir,
    stdio: 'inherit',
  });
  if (!binaryInstalled()) fail(`could not download ${binary}`);
  if (process.platform !== 'win32') fs.chmodSync(binary, 0o755);
};

const findMaps = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return findMaps(full);
    return entry.name.endsWith('.map') ? [full] : [];
  });

const args = process.argv.slice(2);
const removeMaps = args.includes('--remove-maps');
const passThrough = args.filter((a) => a !== '--remove-maps');

// Minimal .env reader: KEY=VALUE lines, # comments, optional quotes.
const readEnvFile = (file) => {
  if (!fs.existsSync(file)) return {};
  const vars = {};
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    const eq = line.indexOf('=');
    if (line.startsWith('#') || eq < 1) continue;
    let value = line.slice(eq + 1).trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
      value = value.slice(1, -1);
    }
    vars[line.slice(0, eq).trim()] = value;
  }
  return vars;
};
const envLocal = readEnvFile(path.join(webDir, '.env.local'));

const apiKey =
  process.env.BUGSNAG_API_KEY || process.env.SNAG_ID || envLocal.VITE_SNAGID;
if (!apiKey) {
  console.warn(
    'bugsnagUpload: no BUGSNAG_API_KEY, SNAG_ID or VITE_SNAGID (web/.env.local) set; skipping upload.'
  );
  process.exit(0);
}

const baseUrlEnv =
  process.env.BUGSNAG_BASE_URL || process.env.APP || envLocal.VITE_ENDPOINT;
if (!baseUrlEnv) {
  fail(
    'set BUGSNAG_BASE_URL, APP or VITE_ENDPOINT (web/.env.local) to the app URL.'
  );
}
const baseUrl = baseUrlEnv.endsWith('/') ? baseUrlEnv : `${baseUrlEnv}/`;

if (!fs.existsSync(distDir)) fail(`${distDir} not found. Build first.`);
const maps = findMaps(distDir);
if (maps.length === 0) {
  fail(`no .map files in ${distDir}. Is build.sourcemap set in vite.config?`);
}

// Must match appVersion passed to Bugsnag.start (web/package.json version).
const { version } = require(path.join(webDir, 'package.json'));

ensureBinary();

console.log(
  `bugsnagUpload: uploading ${maps.length} source maps for ${version} at ${baseUrl}`
);
const result = spawnSync(
  binary,
  [
    'upload',
    'js',
    `--api-key=${apiKey}`,
    `--base-url=${baseUrl}`,
    `--version-name=${version}`,
    '--overwrite',
    ...passThrough,
    distDir,
  ],
  { stdio: 'inherit' }
);
if (result.error) fail(result.error.message);
if (result.status !== 0) process.exit(result.status ?? 1);

if (removeMaps && !passThrough.includes('--dry-run')) {
  maps.forEach((map) => fs.unlinkSync(map));
  console.log(`bugsnagUpload: removed ${maps.length} .map files from dist.`);
}
