/* eslint-disable @typescript-eslint/no-require-imports */
//
// Keeps the --spec list in src/renderer's `cy:run-ct-smoke` script in sync with
// the specs that actually carry an @smoke tag.
//
// Why a --spec list at all, rather than just --env grepTags=@smoke: in Cypress
// 15 component mode the runner resolves the spec list before setupNodeEvents
// runs, so @cypress/grep's `grepFilterSpecs` cannot drop non-matching files.
// Every spec that loads costs ~9s of fixed browser+bundle overhead whether or
// not any of its tests run, so the file list has to be narrowed on the command
// line. grepTags still does the filtering *within* each listed file, which is
// what keeps partially-tagged specs (e.g. the PBT ones) down to their @smoke
// describes.
//
//   node env-config/smokeSpecs.cjs           check package.json is current (exit 1 if not)
//   node env-config/smokeSpecs.cjs --write   rewrite the script with the current list
//
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const RENDERER = path.join(REPO, 'src', 'renderer');
const SPEC_ROOT = path.join(RENDERER, 'src');
const PKG = path.join(RENDERER, 'package.json');
const SCRIPT = 'cy:run-ct-smoke';
const TAG = '@smoke';

// The same parser @cypress/grep uses, so this script and the runner always
// agree on which files carry the tag. It lives under the renderer's tree.
const findTestNames = path.join(RENDERER, 'node_modules', 'find-test-names');
let getTestNames;
try {
  ({ getTestNames } = require(findTestNames));
} catch {
  console.error(
    `Cannot load find-test-names from ${findTestNames}.\n` +
      `Run "npm ci" in src/renderer first.`
  );
  process.exit(1);
}

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.cy\.(js|jsx|ts|tsx)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

// Tags can sit on a suite or an individual test, and nest, so collect the whole
// tree rather than just the top level.
function hasTag(node) {
  if ((node.tags || []).includes(TAG)) return true;
  return [...(node.suites || []), ...(node.tests || [])].some(hasTag);
}

function taggedSpecs() {
  const found = [];
  for (const file of walk(SPEC_ROOT)) {
    const rel = path.relative(RENDERER, file).split(path.sep).join('/');
    let parsed;
    try {
      parsed = getTestNames(fs.readFileSync(file, 'utf8'), true);
    } catch (err) {
      // Never silently drop a spec we failed to read — a parse error here
      // would otherwise look identical to "this spec has no @smoke tests".
      console.error(`Could not parse ${rel}: ${err.message.split('\n')[0]}`);
      process.exit(1);
    }
    if ((parsed.structure || []).some(hasTag)) found.push(rel);
  }
  return found.sort();
}

function buildScript(specs) {
  return (
    'cypress run --component --browser chrome ' +
    '--config-file cypress/config/local.config.ts ' +
    `--spec "${specs.join(',')}" ` +
    `--env grepTags=${TAG},grepOmitFiltered=true`
  );
}

const specs = taggedSpecs();
if (specs.length === 0) {
  console.error(
    `No spec carries a ${TAG} tag. Refusing to write an empty --spec list ` +
      `(Cypress would fall back to running everything).`
  );
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8'));
const current = pkg.scripts[SCRIPT];
const wanted = buildScript(specs);

if (current === wanted) {
  console.log(`${SCRIPT} is up to date (${specs.length} specs).`);
  process.exit(0);
}

if (!process.argv.includes('--write')) {
  console.error(`${SCRIPT} is out of date. Tagged ${TAG} specs are now:`);
  specs.forEach((s) => console.error(`  ${s}`));
  console.error(`\nRun: node env-config/smokeSpecs.cjs --write`);
  process.exit(1);
}

pkg.scripts[SCRIPT] = wanted;
fs.writeFileSync(PKG, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Updated ${SCRIPT} with ${specs.length} specs:`);
specs.forEach((s) => console.log(`  ${s}`));
