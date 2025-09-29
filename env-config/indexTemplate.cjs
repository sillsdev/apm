// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');

var argEnv = process.argv.length > 2 ? process.argv[2] : 'dev';
var varName = process.argv.length > 3 ? process.argv[3] : '';

// get variables
var variables = [];
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function replaceVariables(name, data) {
  console.log(`processing ${name}`);
  var pat1 = new RegExp(`^${name}=`, 'g');
  var matching = variables.find((v) => pat1.test(v));
  var value = matching?.slice(name.length + 1) ?? '';
  console.log(`found ${value}`);
  var pattern = new RegExp(`%${name}%`, 'g');
  return data.replace(pattern, value);
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function indexTemplate(argEnv) {
  fs.readFile(`env-config/index.html`, 'utf8', (err, data) => {
    if (err) throw err;
    data = replaceVariables('VITE_SITE_TITLE', data);
    if (argEnv !== 'prod') {
      data = replaceVariables('VITE_CALLBACK', data);
    } else {
      data = data.replace(/%VITE_CALLBACK% /g, '');
    }
    data = replaceVariables('VITE_HOST', data);
    data = replaceVariables('VITE_BUGSNAG', data);
    data = data.replace(/%CHANNEL%/g, argEnv);
    fs.writeFile(`src/renderer/index.html`, data, (err) => {
      if (err) throw err;
      console.log(
        `template env-config/index.html was written to src/renderer/index.html`
      );
    });
  });
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function getVariables(argEnv, name) {
  console.log(`getting ${argEnv} variables from ${name}`);
  fs.readFile(name, 'utf8', (err, data) => {
    if (err) throw err;
    variables = data.split('\n');
    indexTemplate(argEnv);
  });
}

var hasFile = fs.existsSync(`env-config/.env.${argEnv}.development.local`);
if (hasFile) {
  getVariables(argEnv, `env-config/.env.${argEnv}.development.local`);
} else {
  hasFile = fs.existsSync(varName);
  if (hasFile) {
    getVariables(argEnv, varName);
  } else {
    console.log(`file for ${argEnv} not found`);
  }
}

module.exports = { getVariables };
