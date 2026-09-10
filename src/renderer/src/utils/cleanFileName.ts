const reservedNames = 'CON|PRN|AUX|CLOCK\\$|NUL|COM\\d|LPT\\d';
const reservedFileName = new RegExp(`^(${reservedNames})(\\.|$)`, 'i');
const reservedWholeName = new RegExp(`^(?:${reservedNames})$`, 'i');

export const cleanFileName = (str: string): string =>
  str
    .replace(/["<>|:*?\\/]+/g, '_')
    .replace(/__+/g, '_')
    .replace(reservedWholeName, 'file');
export default cleanFileName;

// Mirrors C# SIL.Transcriber.Utility.FileName.CleanFileName
// eslint-disable-next-line no-control-regex -- matches Path.GetInvalidFileNameChars()
const illegalFileChars = /[\u0000-\u001f'()*?&/<>[\]\\,"| :#]+/g;

export const cleanExportFileName = (str: string): string =>
  str
    .replace(illegalFileChars, '_')
    .replace(/_+/g, '_')
    .replace(reservedFileName, '_reserved$1_$2');
