/* eslint-disable @typescript-eslint/no-require-imports */
//
// Keeps cypress/config/ct-optimize-deps.json in sync with the dependencies
// Vite actually pre-bundles for component tests.
//
// Why this exists: if a dep is missing from optimizeDeps.include, Vite does not
// discover it until the spec that imports it loads, then re-optimizes and
// reloads the AUT mid-run. The reload leaves two copies of React in the page,
// so the spec fails with "Cannot read properties of null (reading 'useMemo')"
// rather than merely running slow. Listing every dep up front is what makes a
// separate whole-suite warm-up run unnecessary.
//
// The source of truth is the dep cache Vite writes during a real run, so
// regenerate after a FULL run (npm run cy:run-ct), not a smoke run — a smoke
// run only exercises 10 specs and would shrink the list.
//
//   node env-config/ctOptimizeDeps.cjs           compare cache to the checked-in list
//   node env-config/ctOptimizeDeps.cjs --write   rewrite the list from the cache
//
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const RENDERER = path.join(REPO, 'src', 'renderer');
const META = path.join(
  RENDERER,
  'node_modules',
  '.vite-ct',
  'deps',
  '_metadata.json'
);
const LIST = path.join(RENDERER, 'cypress', 'config', 'ct-optimize-deps.json');

// Cypress injects its own mount entry; it is not an app dependency and is not
// resolvable from the config, so listing it would break the dev server.
const EXCLUDE = new Set(['cypress/react']);

if (!fs.existsSync(META)) {
  console.error(
    `No Vite CT dep cache at ${META}.\n` +
      `Run a full component test run first (cd src/renderer && npm run cy:run-ct).`
  );
  process.exit(1);
}

const meta = JSON.parse(fs.readFileSync(META, 'utf-8'));
const cached = Object.keys(meta.optimized || {})
  .filter((d) => !EXCLUDE.has(d))
  .sort();

if (cached.length === 0) {
  console.error(
    `${META} lists no optimized deps. Refusing to write an empty list.`
  );
  process.exit(1);
}

const current = fs.existsSync(LIST)
  ? JSON.parse(fs.readFileSync(LIST, 'utf-8'))
  : [];

const missing = cached.filter((d) => !current.includes(d));
const extra = current.filter((d) => !cached.includes(d));

if (missing.length === 0 && extra.length === 0) {
  console.log(`ct-optimize-deps.json is up to date (${cached.length} deps).`);
  process.exit(0);
}

// `extra` is reported but is not a failure on its own: a smoke run, or a run
// that skipped specs, legitimately optimizes fewer deps than the full suite.
// Only `missing` means a spec would trigger a mid-run reload.
if (missing.length) {
  console.error(`ct-optimize-deps.json is missing ${missing.length} dep(s):`);
  missing.forEach((d) => console.error(`  + ${d}`));
}
if (extra.length) {
  console.log(
    `\n${extra.length} dep(s) in the list were not optimized by this run ` +
      `(expected if it was not a full run):`
  );
  extra.forEach((d) => console.log(`  - ${d}`));
}

if (!process.argv.includes('--write')) {
  if (missing.length) {
    console.error(
      `\nRun a full suite, then: node env-config/ctOptimizeDeps.cjs --write`
    );
    process.exit(1);
  }
  process.exit(0);
}

fs.writeFileSync(LIST, JSON.stringify(cached, null, 2) + '\n');
console.log(
  `\nWrote ${cached.length} deps to cypress/config/ct-optimize-deps.json`
);
