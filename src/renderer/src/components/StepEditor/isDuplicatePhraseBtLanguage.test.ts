import { OrgWorkflowStepD } from '../../model';

jest.mock('../../crud/useStepTool', () => ({
  getTool: (jsonTool?: string) => {
    if (!jsonTool) return '';
    return JSON.parse(jsonTool).tool || '';
  },
  getToolSettings: (jsonTool?: string) => {
    if (!jsonTool) return '';
    const settings = JSON.parse(jsonTool).settings;
    if (settings == null || settings === '') return '';
    return typeof settings === 'string' ? settings : JSON.stringify(settings);
  },
}));

jest.mock('../../crud/remoteId', () => ({
  remoteIdGuid: (_t: string, id: string) => id,
}));

jest.mock('../../crud/related', () => ({
  related: (
    rec: {
      relationships?: { organization?: { data?: { id?: string } } };
    },
    rel: string
  ) =>
    rel === 'organization'
      ? rec.relationships?.organization?.data?.id
      : undefined,
}));

jest.mock('../../crud/transcribeStepAsrSettings', () => ({
  parseStepLanguageField: (value: unknown) => {
    if (value == null || value === '') return { languageName: '', bcp47: 'und' };
    const str = String(value);
    const pipe = str.indexOf('|');
    if (pipe === -1) return { languageName: '', bcp47: str || 'und' };
    return {
      languageName: str.slice(0, pipe),
      bcp47: str.slice(pipe + 1) || 'und',
    };
  },
}));

import { isDuplicatePhraseBtLanguage } from './isDuplicatePhraseBtLanguage';

function pbtStep(
  id: string,
  orgId: string,
  language: string,
  artifactTypeId = 'art-pbt'
): OrgWorkflowStepD {
  return {
    type: 'orgworkflowstep',
    id,
    attributes: {
      tool: JSON.stringify({
        tool: 'phraseBackTranslate',
        settings: JSON.stringify({ artifactTypeId, language }),
      }),
    },
    relationships: {
      organization: { data: { type: 'organization', id: orgId } },
    },
  } as OrgWorkflowStepD;
}

describe('isDuplicatePhraseBtLanguage', () => {
  it('ignores Phrase BT steps that belong to another organization', () => {
    const steps = [
      pbtStep('mine', 'org-a', 'English|en'),
      pbtStep('other-team', 'org-b', 'English|en'),
    ];

    expect(
      isDuplicatePhraseBtLanguage(steps, {
        stepId: 'mine',
        artifactTypeId: 'art-pbt',
        languageBcp47: 'en',
        organizationId: 'org-a',
      })
    ).toBe(false);
  });

  it('detects a duplicate on another Phrase BT step in the same organization', () => {
    const steps = [
      pbtStep('mine', 'org-a', 'English|en'),
      pbtStep('sibling', 'org-a', 'English|en'),
    ];

    expect(
      isDuplicatePhraseBtLanguage(steps, {
        stepId: 'mine',
        artifactTypeId: 'art-pbt',
        languageBcp47: 'en',
        organizationId: 'org-a',
      })
    ).toBe(true);
  });
});
