function stringsToCvs(json) {
  const data = JSON.parse(json);

  // Get all language codes from the first section
  const firstSection = Object.keys(data)[0];
  const languages = Object.keys(data[firstSection]);

  // Create CSV header: tag, followed by language codes
  let csv = 'tag\t' + languages.join('\t') + '\n';

  // Iterate through each section
  for (const section in data) {
    const sectionData = data[section];

    // Get all keys from the first language
    const firstLang = languages[0];
    const keys = Object.keys(sectionData[firstLang]);

    // For each key, create a row
    for (const key of keys) {
      const tag = `${section}.${key}`;
      const values = languages.map((lang) => sectionData[lang][key] || '');
      const line = tag + '\t' + values.join('\t') + '\n';
      if (
        values[0].split(' ').length > 3 ||
        line.indexOf('{') > -1 ||
        line.indexOf('$') > -1
      )
        continue;
      csv += line;
    }
  }

  return csv;
}

// Example usage:
// Input Json:
// {
//   "access": {
//     "en": {
//       "availableUsers": "Other Users",
//       "back": "Back",
//     },
//     "fr": {
//       "availableUsers": "Autres utilisateurs",
//       "back": "Précédent",
//     },
//     "pt": {
//       "availableUsers": "Outros usuários",
//       "back": "Voltar",
//     }
//   },

// "wsAudioPlayerZoom": {
//   "en": {
//     "fitToWidth": "Fit to Width",
//     "zoomIn": "Zoom In [{0}]",
//     "zoomOut": "Zoom Out [{0}]"
//   },
//   "fr": {
//     "fitToWidth": "Ajuster à la largeur",
//     "zoomIn": "Zoom avant [{0}]",
//     "zoomOut": "Zoom arrière [{0}]"
//   },
//   "pt": {
//     "fitToWidth": "Ajustar à Largura",
//     "zoomIn": "Aumentar o Zoom [{0}]",
//     "zoomOut": "Diminuir o Zoom [{0}]"
//   }
// }
// }
// Oputput CSV:
// tag,en,fr,pt
// access.availableUsers, Other Users, Autres utilisateurs, Outros usuários
// access.back, Back, Précédent, Voltar
// wsAudioPlayerZoom.fitToWidth, Fit to Width, Ajuster à la largeur, Ajustar à Largura
// wsAudioPlayerZoom.zoomIn, Zoom In [{0}], Zoom avant [{0}], Aumentar o Zoom [{0}]
// wsAudioPlayerZoom.zoomOut, Zoom Out [{0}], Zoom arrière [{0}], Diminuir o Zoom [{0}]

const readFileSync = require('fs').readFileSync;
const writeFile = require('write');

var argName = process.argv.length > 2 ? process.argv[2] : 'book-es';

const data = readFileSync(
  __dirname + `/../src/renderer/public/localization/${argName}.json`,
  'utf8'
).replace(/^\uFEFF/, '');

const csv = stringsToCvs(data);

writeFile.sync(
  __dirname + `/../src/renderer/public/localization/${argName}.csv`,
  csv
);
