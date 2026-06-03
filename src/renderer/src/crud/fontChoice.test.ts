jest.mock('../utils', () => ({
  LocalKey: { fontData: 'fontData' },
}));

jest.mock('mui-language-picker', () => ({
  getFamily: jest.fn(() => ({ defaults: {}, files: {} })),
  getRtl: jest.fn(() => false),
}));

jest.mock('./tryFindRecord', () => ({
  findRecord: jest.fn(),
}));

jest.mock('./stepSpellCheck', () => ({
  ...jest.requireActual<typeof import('./stepSpellCheck')>('./stepSpellCheck'),
}));

import {
  getFontData,
  getArtTypeFontData,
  loadFontData,
  saveFontData,
} from './fontChoice';
import { findRecord } from './tryFindRecord';
import { ArtifactTypeSlug } from './artifactTypeSlug';
import Memory from '@orbit/memory';
import { OrgWorkflowStep } from '../model';

const mockFindRecord = findRecord as jest.MockedFunction<typeof findRecord>;
const memory = {} as Memory;
const storageKey = (exportId: string) => `fontData-${exportId}`;

describe('getFontData', () => {
  const exportId = 'font-choice-get';

  beforeEach(() => {
    localStorage.removeItem(storageKey(exportId));
  });

  test('ignores localStorage and project spellCheck', async () => {
    localStorage.setItem(
      storageKey(exportId),
      JSON.stringify({ fontSize: 'medium', spellCheck: true })
    );
    const project = {
      attributes: {
        language: 'en',
        spellCheck: true,
        defaultFont: 'CharisSIL',
        defaultFontSize: 'large',
        rtl: false,
      },
    } as Parameters<typeof getFontData>[0];

    const data = await getFontData(project, exportId);
    expect(data.spellCheck).toBe(false);
  });

  test('still applies fontSize from localStorage', async () => {
    localStorage.setItem(
      storageKey(exportId),
      JSON.stringify({ fontSize: 'medium' })
    );
    const project = {
      attributes: {
        language: 'en',
        defaultFontSize: 'large',
      },
    } as Parameters<typeof getFontData>[0];

    const data = await getFontData(project, exportId);
    expect(data.fontSize).toBe('medium');
  });
});

describe('saveFontData / loadFontData', () => {
  const exportId = 'font-choice-save';

  beforeEach(() => {
    localStorage.removeItem(storageKey(exportId));
  });

  test('persists fontSize only', async () => {
    await saveFontData(
      {
        langTag: 'en',
        spellCheck: true,
        fontFamily: 'CharisSIL',
        fontSize: 'small',
        fontDir: 'ltr',
        url: '',
        fontConfig: { custom: { families: [], urls: [] } },
      },
      exportId
    );
    expect(loadFontData(exportId)).toEqual({ fontSize: 'small' });
  });
});

describe('getArtTypeFontData', () => {
  const exportId = 'art-pbt';
  const remoteArtId = 'remote-pbt-1';

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.removeItem(storageKey(exportId));
    mockFindRecord.mockReturnValue({
      type: 'artifacttype',
      id: exportId,
      attributes: { typename: ArtifactTypeSlug.PhraseBackTranslation },
      keys: { remoteId: remoteArtId },
    } as unknown as ReturnType<typeof findRecord>);
  });

  test('uses explicit spellCheck from matching workflow step settings', () => {
    const orgSteps = [
      {
        attributes: {
          tool: JSON.stringify({
            tool: 'transcribe',
            settings: JSON.stringify({
              artifactTypeId: remoteArtId,
              language: 'English|en',
              spellCheck: false,
            }),
          }),
        },
      },
    ] as OrgWorkflowStep[];

    const data = getArtTypeFontData(memory, exportId, orgSteps);
    expect(data.spellCheck).toBe(false);
    expect(data.langTag).toBe('en');
  });

  test('defaults spellCheck true for back translation when step omits spellCheck', () => {
    const orgSteps = [
      {
        attributes: {
          tool: JSON.stringify({
            tool: 'transcribe',
            settings: JSON.stringify({
              artifactTypeId: remoteArtId,
              language: 'English|de',
            }),
          }),
        },
      },
    ] as OrgWorkflowStep[];

    const data = getArtTypeFontData(memory, exportId, orgSteps);
    expect(data.spellCheck).toBe(true);
  });
});
