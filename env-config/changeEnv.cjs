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

// get variables
var variables = [];
function replaceVariables(name, data) {
  console.log(`processing ${name}`);
  var pat1 = new RegExp(`^${name}=`, 'g');
  var matching = variables.find((v) => pat1.test(v));
  var value = matching.slice(name.length + 1);
  console.log(`found ${value}`);
  var pattern = new RegExp(`%${name}%`, 'g');
  return data.replace(pattern, value);
}
fs.readFile(
  `env-config/.env.${argEnv}.development.local`,
  'utf8',
  (err, data) => {
    if (err) throw err;
    variables = data.split('\n');
    fs.readFile(`env-config/index.html`, 'utf8', (err, data) => {
      if (err) throw err;
      data = replaceVariables('VITE_SITE_TITLE', data);
      if (argEnv !== 'prod') {
        data = replaceVariables('VITE_CALLBACK', data);
      } else {
        data = data.replace(/%VITE_CALLBACK% /g, '');
      }
      data = replaceVariables('VITE_HOST', data);
      data = data.replace(/%CHANNEL%/g, argEnv);
      fs.writeFile(`src/renderer/index.html`, data, (err) => {
        if (err) throw err;
        console.log(
          `template env-config/index.html was written to src/renderer/index.html`
        );
      });
    });
  }
);
