#!/usr/bin/env node
/**
 * Upload a build's source maps to BugSnag: the web build (web/dist) by
 * default, or the desktop (Electron) renderer build (<repo>/dist) with
 * --desktop.
 *
 * Works on Linux, macOS and Windows. Runs the @bugsnag/cli native binary
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
 *   Base URL: where the files in the dist folder are loaded from.
 *             Web:     BUGSNAG_BASE_URL, APP, then VITE_ENDPOINT from
 *                      web/.env.local (the app, e.g.
 *                      https://app-dev.audioprojectmanager.org, not the API
 *                      in VITE_HOST).
 *             Desktop: BUGSNAG_BASE_URL, else file://*\/app.asar/dist/ .
 *                      Electron loads dist/index.html from inside app.asar,
 *                      whose install folder differs by OS and user, so the
 *                      wildcard covers every install location.
 *
 * Usage:
 *   web:      npm run bugsnag:upload [-- options]   (from web/)
 *   desktop:  npm run bugsnag:upload [-- options]   (from the repo root)
 * Options:
 *   --desktop       upload the Electron renderer build in <repo>/dist
 *   --dist <dir>    upload this folder instead (relative to the repo root)
 *   --remove-maps   delete the .map files from the dist folder after a
 *                   successful upload, so they are not deployed
 *   any other args  passed through to `bugsnag-cli upload js` (e.g. --dry-run)
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoDir = path.resolve(__dirname, '..');
const webDir = path.join(repoDir, 'web');
const DESKTOP_BASE_URL = 'file://*/app.asar/dist/';
// The placeholder script is ~100 bytes; the real binary is several MB.
const MIN_BINARY_BYTES = 1024 * 1024;

const fail = (msg) => {
  console.error(`bugsnagUpload: ${msg}`);
  process.exit(1);
};

// --- options -----------------------------------------------------------
const passThrough = [];
let desktop = false;
let removeMaps = false;
let distArg;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === '--desktop') desktop = true;
  else if (arg === '--remove-maps') removeMaps = true;
  else if (arg === '--dist') distArg = argv[++i];
  else if (arg.startsWith('--dist=')) distArg = arg.slice('--dist='.length);
  else passThrough.push(arg);
}
if (argv.includes('--dist') && !distArg) fail('--dist needs a folder.');

const distDir = path.resolve(
  repoDir,
  distArg ?? (desktop ? 'dist' : path.join('web', 'dist'))
);

// --- bugsnag-cli binary ------------------------------------------------
// The CLI is a devDependency of both the root and web packages; use whichever
// is installed (desktop build machines may only have run npm ci at the root).
const binaryName =
  process.platform === 'win32' ? 'bugsnag-cli.exe' : 'bugsnag-cli';
const cliDirs = [webDir, repoDir]
  .map((dir) => path.join(dir, 'node_modules', '@bugsnag', 'cli'))
  .filter((dir) => fs.existsSync(path.join(dir, 'postinstall.js')));
if (cliDirs.length === 0) {
  fail('@bugsnag/cli is not installed. Run npm ci (root or web/).');
}

const binaryIn = (cliDir) => path.join(cliDir, 'bin', binaryName);
const binaryInstalled = (cliDir) => {
  const binary = binaryIn(cliDir);
  return fs.existsSync(binary) && fs.statSync(binary).size > MIN_BINARY_BYTES;
};

const ensureBinary = () => {
  const installed = cliDirs.find(binaryInstalled);
  if (installed) return binaryIn(installed);
  const cliDir = cliDirs[0];
  console.log('bugsnagUpload: downloading the bugsnag-cli binary...');
  // postinstall.js writes to ./bin relative to its cwd.
  spawnSync(process.execPath, ['postinstall.js'], {
    cwd: cliDir,
    stdio: 'inherit',
  });
  if (!binaryInstalled(cliDir)) fail(`could not download ${binaryIn(cliDir)}`);
  if (process.platform !== 'win32') fs.chmodSync(binaryIn(cliDir), 0o755);
  return binaryIn(cliDir);
};

// --- settings ----------------------------------------------------------
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
// Both the web and desktop builds read their VITE_* settings from web/.
const envLocal = readEnvFile(path.join(webDir, '.env.local'));

const apiKey =
  process.env.BUGSNAG_API_KEY || process.env.SNAG_ID || envLocal.VITE_SNAGID;
if (!apiKey) {
  console.warn(
    'bugsnagUpload: no BUGSNAG_API_KEY, SNAG_ID or VITE_SNAGID (web/.env.local) set; skipping upload.'
  );
  process.exit(0);
}

const baseUrlSetting = desktop
  ? process.env.BUGSNAG_BASE_URL || DESKTOP_BASE_URL
  : process.env.BUGSNAG_BASE_URL || process.env.APP || envLocal.VITE_ENDPOINT;
if (!baseUrlSetting) {
  fail(
    'set BUGSNAG_BASE_URL, APP or VITE_ENDPOINT (web/.env.local) to the app URL.'
  );
}
const baseUrl = baseUrlSetting.endsWith('/')
  ? baseUrlSetting
  : `${baseUrlSetting}/`;

// --- source maps -------------------------------------------------------
const findMaps = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return findMaps(full);
    return entry.name.endsWith('.map') ? [full] : [];
  });

if (!fs.existsSync(distDir)) fail(`${distDir} not found. Build first.`);
const maps = findMaps(distDir);
if (maps.length === 0) {
  fail(`no .map files in ${distDir}. Is build.sourcemap set in vite.config?`);
}

// Must match appVersion passed to Bugsnag.start (web/package.json version),
// which both the web and desktop builds compile in.
const { version } = require(path.join(webDir, 'package.json'));

// --- upload ------------------------------------------------------------
// Upload one bundle at a time with an explicit --bundle-url instead of
// pointing the CLI at the folder with --base-url: in folder mode the CLI
// (3.10.7) builds the URL with OS path separators, so on Windows it uploads
// for "…/dist/\assets\x.js", which never matches a stack trace.
const binary = ensureBinary();

console.log(
  `bugsnagUpload: uploading ${maps.length} ${desktop ? 'desktop' : 'web'} source maps from ${distDir} for ${version} at ${baseUrl}`
);
let failed = 0;
for (const map of maps) {
  const bundle = map.slice(0, -'.map'.length);
  if (!fs.existsSync(bundle)) {
    console.warn(`bugsnagUpload: no bundle for ${map}; skipping.`);
    continue;
  }
  const relative = path.relative(distDir, bundle).split(path.sep).join('/');
  const result = spawnSync(
    binary,
    [
      'upload',
      'js',
      `--api-key=${apiKey}`,
      `--bundle=${bundle}`,
      `--source-map=${map}`,
      `--bundle-url=${baseUrl}${relative}`,
      `--version-name=${version}`,
      `--project-root=${repoDir}`,
      '--overwrite',
      ...passThrough,
    ],
    { stdio: 'inherit' }
  );
  if (result.error) fail(result.error.message);
  if (result.status !== 0) failed++;
}
if (failed) fail(`${failed} of ${maps.length} uploads failed.`);

if (removeMaps && !passThrough.includes('--dry-run')) {
  maps.forEach((map) => fs.unlinkSync(map));
  console.log(`bugsnagUpload: removed ${maps.length} .map files from dist.`);
}
