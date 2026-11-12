jest.mock('../utils/logErrorService', () => ({
  Severity: { info: 0, error: 1, retry: 2 },
  logError: jest.fn(),
}));
jest.mock('../auth/bugsnagClient', () => ({ __esModule: true, default: {} }));

import { getTool, getToolSettings, resolveToolSlug } from './useStepTool';
import { ToolSlug } from './toolSlug';
import { BOLD_WORKFLOW_PROCESS } from './useTeamWorkflowProcess';

describe('getToolSettings', () => {
  it('stringifies nested object settings (offline WorkAlone)', () => {
    expect(
      getToolSettings('{"tool":"transcribe","settings":{"spellCheck":false}}')
    ).toBe('{"spellCheck":false}');
  });

  it('returns string settings unchanged', () => {
    expect(
      getToolSettings(
        '{"tool":"transcribe","settings":"{\\"spellCheck\\":false}"}'
      )
    ).toBe('{"spellCheck":false}');
  });

  it('returns empty for missing settings', () => {
    expect(getToolSettings('{"tool":"transcribe"}')).toBe('');
    expect(getToolSettings('')).toBe('');
    expect(getToolSettings(undefined)).toBe('');
  });

  it('reads an unreadable tool attribute as empty instead of throwing', () => {
    expect(getToolSettings('{bad tool')).toBe('');
  });
});

describe('getTool', () => {
  it('reads the tool slug', () => {
    expect(getTool('{"tool":"discuss","settings":""}')).toBe('discuss');
    expect(getTool(undefined)).toBe('');
  });

  it('reads an unreadable tool attribute as empty instead of throwing', () => {
    expect(getTool('{bad tool')).toBe('');
  });
});

describe('resolveToolSlug', () => {
  it('maps BOLD Prompt step with resource tool to prompt', () => {
    expect(
      resolveToolSlug(ToolSlug.Resource, 'Prompt', BOLD_WORKFLOW_PROCESS)
    ).toBe(ToolSlug.Prompt);
  });

  it('leaves Internalize resource tool unchanged for non-Prompt steps', () => {
    expect(resolveToolSlug(ToolSlug.Resource, 'Internalize', 'OBT')).toBe(
      ToolSlug.Resource
    );
  });

  it('passes through prompt tool unchanged', () => {
    expect(
      resolveToolSlug(ToolSlug.Prompt, 'Prompt', BOLD_WORKFLOW_PROCESS)
    ).toBe(ToolSlug.Prompt);
  });
});
