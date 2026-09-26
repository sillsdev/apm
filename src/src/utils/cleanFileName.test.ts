import { cleanExportFileName, cleanFileName } from './cleanFileName';

describe('cleanExportFileName', () => {
  it('replaces C# CleanFileName illegal characters including ] , | and space', () => {
    expect(cleanExportFileName(`a'()*?&/<>[]\\,"| :#b`)).toBe('a_b');
    expect(cleanExportFileName('My[Project]Name')).toBe('My_Project_Name');
    expect(cleanExportFileName('file|name')).toBe('file_name');
  });

  it('prefixes reserved device names and keeps the extension', () => {
    expect(cleanExportFileName('CON')).toBe('_reservedCON_');
    expect(cleanExportFileName('CON.txt')).toBe('_reservedCON_.txt');
    expect(cleanFileName('CON')).toBe('file');
    expect(cleanFileName('CON.txt')).toBe('CON.txt');
  });
});
