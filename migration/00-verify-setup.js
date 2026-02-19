/**
 * Setup Verification Script
 *
 * Verifies that your environment is ready for the migration.
 * Run this before starting the migration process.
 *
 * Usage: node 00-verify-setup.js
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const CHECKS = {
  'Node.js version': checkNodeVersion,
  'npm installed': checkNpm,
  'Puppeteer can launch': checkPuppeteer,
  'Write permissions': checkWritePermissions,
  'Internet connectivity': checkInternet,
  'Disk space': checkDiskSpace
};

async function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);

  if (major >= 18) {
    return { ok: true, message: `${version} ✓` };
  } else {
    return {
      ok: false,
      message: `${version} - Need v18 or higher`,
      fix: 'Update Node.js: https://nodejs.org/'
    };
  }
}

async function checkNpm() {
  try {
    const version = execSync('npm --version', { encoding: 'utf-8' }).trim();
    return { ok: true, message: `v${version} ✓` };
  } catch (err) {
    return {
      ok: false,
      message: 'npm not found',
      fix: 'Install npm: https://www.npmjs.com/get-npm'
    };
  }
}

async function checkPuppeteer() {
  try {
    // Try to require puppeteer
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: 'new' });
    await browser.close();
    return { ok: true, message: 'Browser launches successfully ✓' };
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      return {
        ok: false,
        message: 'Puppeteer not installed',
        fix: 'Run: npm install'
      };
    }
    return {
      ok: false,
      message: `Cannot launch browser: ${err.message}`,
      fix: 'Puppeteer dependencies may be missing. On Linux, try: sudo apt-get install chromium-browser'
    };
  }
}

async function checkWritePermissions() {
  const testDir = path.join(__dirname, 'migration-data');
  const testFile = path.join(testDir, '.test-write');

  try {
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(testFile, 'test');
    await fs.unlink(testFile);
    return { ok: true, message: 'Can write to migration-data/ ✓' };
  } catch (err) {
    return {
      ok: false,
      message: `Cannot write to ${testDir}: ${err.message}`,
      fix: 'Check folder permissions'
    };
  }
}

async function checkInternet() {
  const https = require('https');

  return new Promise((resolve) => {
    const req = https.get('https://www.onestory-media.org/', (res) => {
      if (res.statusCode === 200) {
        resolve({ ok: true, message: 'Can reach OneStory website ✓' });
      } else {
        resolve({
          ok: false,
          message: `OneStory returned status ${res.statusCode}`,
          fix: 'Check if website is accessible'
        });
      }
      req.destroy();
    });

    req.on('error', (err) => {
      resolve({
        ok: false,
        message: `Cannot reach OneStory: ${err.message}`,
        fix: 'Check internet connection and firewall settings'
      });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve({
        ok: false,
        message: 'Connection timeout',
        fix: 'Check internet connection'
      });
    });
  });
}

async function checkDiskSpace() {
  try {
    const stats = await fs.statfs(__dirname);
    const availableGB = (stats.bavail * stats.bsize) / (1024 ** 3);

    if (availableGB > 5) {
      return { ok: true, message: `${availableGB.toFixed(1)} GB available ✓` };
    } else if (availableGB > 1) {
      return {
        ok: true,
        message: `${availableGB.toFixed(1)} GB available (might be tight)`,
        fix: 'Consider freeing up disk space'
      };
    } else {
      return {
        ok: false,
        message: `Only ${availableGB.toFixed(1)} GB available`,
        fix: 'Free up at least 5GB for audio downloads'
      };
    }
  } catch (err) {
    // statfs not available on all platforms
    return { ok: true, message: 'Cannot check (skipped)' };
  }
}

async function runChecks() {
  console.log('=================================');
  console.log('  Migration Setup Verification');
  console.log('=================================\n');

  const results = [];

  for (const [name, checkFn] of Object.entries(CHECKS)) {
    process.stdout.write(`Checking ${name}... `);

    try {
      const result = await checkFn();
      results.push({ name, ...result });

      if (result.ok) {
        console.log(`✅ ${result.message}`);
      } else {
        console.log(`❌ ${result.message}`);
        if (result.fix) {
          console.log(`   Fix: ${result.fix}`);
        }
      }
    } catch (err) {
      results.push({
        name,
        ok: false,
        message: err.message
      });
      console.log(`❌ Error: ${err.message}`);
    }
  }

  console.log('\n=================================');

  const allPassed = results.every(r => r.ok);
  const failedChecks = results.filter(r => !r.ok);

  if (allPassed) {
    console.log('✅ All checks passed!');
    console.log('\nYou\'re ready to start the migration:');
    console.log('  npm run migrate');
    console.log('\nOr run steps individually:');
    console.log('  npm run scrape');
    console.log('  npm run download');
    console.log('  npm run transform');
  } else {
    console.log(`❌ ${failedChecks.length} check(s) failed`);
    console.log('\nPlease fix the issues above before continuing.');
    console.log('\nFailed checks:');
    failedChecks.forEach(check => {
      console.log(`  - ${check.name}: ${check.message}`);
      if (check.fix) {
        console.log(`    Fix: ${check.fix}`);
      }
    });
    process.exit(1);
  }

  console.log('=================================\n');
}

// Run checks
runChecks().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});

