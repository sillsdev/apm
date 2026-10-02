/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const { getVariables } = require('./indexTemplate.cjs');

var argEnv = process.argv.length > 2 ? process.argv[2] : 'dev';

// destination.txt will be created or overwritten by default.
fs.copyFile(`env-config/.env.${argEnv}.local`, '.env.local', (err) => {
  if (err) throw err;
  console.log(`env-config/.env.${argEnv}.local was copied to .env.local`);
});

// destination.txt will be created or overwritten by default.
fs.copyFile(
  `env-config/.env.${argEnv}.development.local`,
  '.env.development.local',
  (err) => {
    if (err) throw err;
    console.log(
      `env-config/.env.${argEnv}.development.local was copied to .env.development.local`
    );
  }
);

// destination.txt will be created or overwritten by default.
fs.copyFile(`env-config/.env.${argEnv}.local`, 'web/.env.local', (err) => {
  if (err) throw err;
  console.log(`env-config/.env.${argEnv}.local was copied to .env.local`);
});

// destination.txt will be created or overwritten by default.
fs.copyFile(
  `env-config/.env.${argEnv}.development.local`,
  'web/.env.development.local',
  (err) => {
    if (err) throw err;
    console.log(
      `env-config/.env.${argEnv}.development.local was copied to .env.development.local`
    );
  }
);

// destination.txt will be created or overwritten by default.
fs.copyFile(
  `env-config/.auth0-variables.${argEnv}.json`,
  `electron/main/auth0-variables.json`,
  (err) => {
    if (err) throw err;
    console.log(
      `env-config/.auth0-variables.${argEnv}.json was copied to electron/main/auth0-variables.json`
    );
  }
);
fs.copyFile(
  `env-config/.auth0-variables.${argEnv}.json`,
  `web/src/auth/auth0-variables.json`,
  (err) => {
    if (err) throw err;
    console.log(
      `env-config/.auth0-variables.${argEnv}.json was copied to web/src/auth/auth0-variables.json`
    );
  }
);

getVariables(argEnv, `env-config/.env.${argEnv}.development.local`);
