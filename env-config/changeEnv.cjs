// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');

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
fs.copyFile(
  `env-config/.env.${argEnv}.local`,
  'src/renderer/.env.local',
  (err) => {
    if (err) throw err;
    console.log(`env-config/.env.${argEnv}.local was copied to .env.local`);
  }
);

// destination.txt will be created or overwritten by default.
fs.copyFile(
  `env-config/.env.${argEnv}.development.local`,
  'src/renderer/.env.development.local',
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
  `src/main/auth0-variables.json`,
  (err) => {
    if (err) throw err;
    console.log(
      `env-config/.auth0-variables.${argEnv}.json was copied to src/auth/auth0-variables.json`
    );
  }
);
fs.copyFile(
  `env-config/.auth0-variables.${argEnv}.json`,
  `src/renderer/src/auth/auth0-variables.json`,
  (err) => {
    if (err) throw err;
    console.log(
      `env-config/.auth0-variables.${argEnv}.json was copied to src/auth/auth0-variables.json`
    );
  }
);
