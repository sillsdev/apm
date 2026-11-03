/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const { execFileSync } = require('child_process');

const argEnv = process.argv[2];
const host = 'https://localhost:7025';

if (!['dev', 'qa', 'prod'].includes(argEnv)) {
  console.error('usage: node env-config/changeEnvLocal.cjs dev|qa|prod');
  process.exit(1);
}

execFileSync(process.execPath, ['env-config/changeEnv.cjs', argEnv], {
  stdio: 'inherit',
});

const source = fs.readFileSync(
  `env-config/.env.${argEnv}.development.local`,
  'utf8'
);
const previous = source
  .split(/\r?\n/)
  .find((line) => line.startsWith('VITE_HOST='))
  .slice('VITE_HOST='.length);

const files = [
  '.env.local',
  'web/.env.local',
  'web/.env.development.local',
  'web/index.html',
];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const next = file.endsWith('index.html')
    ? text.split(previous).join(host)
    : text.replace(/^VITE_HOST=.*$/m, `VITE_HOST=${host}`);
  if (next !== text) {
    fs.writeFileSync(file, next);
    console.log(`VITE_HOST set to ${host} in ${file}`);
  }
}
