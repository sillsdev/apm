const mockLogError = jest.fn();

jest.mock('../utils/logErrorService', () => ({
  Severity: { info: 0, error: 1, retry: 2 },
  logError: (...args: unknown[]) => mockLogError(...args),
}));
jest.mock('../auth/bugsnagClient', () => ({ __esModule: true, default: {} }));

import {
  parseStepTool,
  parseTranscribeStepSettings,
  reportReplacedStepSettings,
} from './transcribeStepSettings';
import { Severity } from '../utils/logErrorService';

beforeEach(() => mockLogError.mockClear());

describe('parseTranscribeStepSettings', () => {
  const full = {
    artifactTypeId: 'art-1',
    language: 'French|fr',
    sisterlanguage: 'English|en',
    font: 'Charis SIL',
    fontSize: 'large',
    rtl: true,
    spellCheck: false,
    namedRegion: 'clause',
  };

  test('parses a JSON string', () => {
    expect(parseTranscribeStepSettings(JSON.stringify(full))).toEqual(full);
  });

  test('accepts an already parsed object (offline Work Alone steps)', () => {
    expect(parseTranscribeStepSettings(full)).toEqual(full);
  });

  test('keeps a language stored as an object', () => {
    const language = { languageName: 'French', bcp47: 'fr' };
    expect(
      parseTranscribeStepSettings(JSON.stringify({ language })).language
    ).toEqual(language);
  });

  test('keeps keys it does not know about', () => {
    expect(
      parseTranscribeStepSettings(JSON.stringify({ asr: { target: 'x' } }))
    ).toEqual({ asr: { target: 'x' } });
  });

  test('reads legacy boolean strings as booleans', () => {
    expect(
      parseTranscribeStepSettings(
        JSON.stringify({ rtl: 'true', spellCheck: 'false' })
      )
    ).toEqual({ rtl: true, spellCheck: false });
  });

  test('drops known fields with the wrong type', () => {
    expect(
      parseTranscribeStepSettings(
        JSON.stringify({
          artifactTypeId: 7,
          language: 3,
          sisterlanguage: null,
          font: false,
          fontSize: 12,
          rtl: 'yes',
          spellCheck: 0,
          namedRegion: [],
        })
      )
    ).toEqual({});
  });

  test('returns empty settings for missing, invalid or non-object input', () => {
    expect(parseTranscribeStepSettings(undefined)).toEqual({});
    expect(parseTranscribeStepSettings(null)).toEqual({});
    expect(parseTranscribeStepSettings('')).toEqual({});
    expect(parseTranscribeStepSettings('{not json')).toEqual({});
    expect(parseTranscribeStepSettings('null')).toEqual({});
    expect(parseTranscribeStepSettings('"text"')).toEqual({});
    expect(parseTranscribeStepSettings('[1]')).toEqual({});
    expect(parseTranscribeStepSettings(42)).toEqual({});
  });
});

describe('settings problem logging', () => {
  // Problems are logged once per distinct message for the whole module, so
  // each test uses its own input.
  const loggedMessages = () =>
    mockLogError.mock.calls.map((call) => call[2] as string);

  test('logs malformed and non-object settings with a copy of the input', () => {
    parseTranscribeStepSettings('{bad json one');
    parseTranscribeStepSettings('[2]');
    expect(mockLogError).toHaveBeenCalledWith(
      Severity.error,
      {},
      'Unreadable transcribe step settings: {bad json one'
    );
    expect(loggedMessages()).toEqual([
      'Unreadable transcribe step settings: {bad json one',
      'Unreadable transcribe step settings: [2]',
    ]);
  });

  test('truncates long input in the log', () => {
    parseTranscribeStepSettings(`{${'x'.repeat(300)}`);
    expect(loggedMessages()[0]).toHaveLength(
      'Unreadable transcribe step settings: '.length + 201
    );
  });

  test('does not log missing settings', () => {
    parseTranscribeStepSettings(undefined);
    parseTranscribeStepSettings(null);
    parseTranscribeStepSettings('');
    expect(mockLogError).not.toHaveBeenCalled();
  });

  test('logs a known field with the wrong type, but not null or legacy strings', () => {
    parseTranscribeStepSettings(
      JSON.stringify({ fontSize: true, font: null, rtl: 'true' })
    );
    expect(loggedMessages()).toEqual([
      'Transcribe step setting fontSize has type boolean',
    ]);
  });

  test('logs each distinct problem only once', () => {
    parseTranscribeStepSettings('{bad json repeat');
    parseTranscribeStepSettings('{bad json repeat');
    parseTranscribeStepSettings(JSON.stringify({ namedRegion: 1 }));
    parseTranscribeStepSettings(JSON.stringify({ namedRegion: 2 }));
    expect(loggedMessages()).toEqual([
      'Unreadable transcribe step settings: {bad json repeat',
      'Transcribe step setting namedRegion has type number',
    ]);
  });

  test('logs where unreadable settings are, not their content, before a save replaces them', () => {
    reportReplacedStepSettings('{secret unreadable', '42', 3);
    reportReplacedStepSettings('{offline unreadable', undefined, 1);
    reportReplacedStepSettings('{"rtl":true}', '42', 4);
    reportReplacedStepSettings('', '42', 5);
    expect(loggedMessages()).toEqual([
      'Replacing unreadable transcribe step settings: organization 42, step sequence 3',
      'Replacing unreadable transcribe step settings: organization not synced, step sequence 1',
    ]);
  });
});

describe('parseStepTool', () => {
  test('parses a tool string', () => {
    expect(parseStepTool('{"tool":"transcribe"}')).toEqual({
      tool: 'transcribe',
    });
    expect(parseStepTool(undefined)).toEqual({});
    expect(mockLogError).not.toHaveBeenCalled();
  });

  test('reads an unreadable tool as empty and logs it', () => {
    expect(parseStepTool('{bad tool')).toEqual({});
    expect(mockLogError).toHaveBeenCalledWith(
      Severity.error,
      {},
      'Unreadable workflow step tool: {bad tool'
    );
  });
});
