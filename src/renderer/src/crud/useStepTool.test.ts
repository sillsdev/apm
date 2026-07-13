import { getToolSettings, resolveToolSlug } from './useStepTool';
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
