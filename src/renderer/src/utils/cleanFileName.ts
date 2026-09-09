export const cleanFileName = (str: string): string =>
  str
    .replace(/["<>|:*?\\/]+/g, '_')
    .replace(/__+/g, '_')
    .replace(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, 'file');
export default cleanFileName;

// Mirrors C# SIL.Transcriber.Utility.FileName.CleanFileName
// eslint-disable-next-line no-control-regex -- matches Path.GetInvalidFileNameChars()
const illegalFileChars = /[\u0000-\u001f'()*?&/<>[\]\\,"| :#]+/g;
const reservedFileName = /^(?:CON|PRN|AUX|CLOCK\$|NUL|COM\d|LPT\d)(\.|$)/i;

export const cleanExportFileName = (str: string): string =>
  str
    .replace(illegalFileChars, '_')
    .replace(/_+/g, '_')
    .replace(reservedFileName, '_reservedWord_$1');
