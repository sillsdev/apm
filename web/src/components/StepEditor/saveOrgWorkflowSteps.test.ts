import { rowSignature } from './stepRow';
import { saveOrgWorkflowSteps } from './saveOrgWorkflowSteps';
import type { IStepRow } from './stepRow';

const row = (
  partial: Partial<IStepRow> & Pick<IStepRow, 'id' | 'name'>
): IStepRow => ({
  seq: 0,
  pos: 0,
  tool: 'discuss',
  settings: '',
  rIdx: 0,
  ...partial,
});

describe('saveOrgWorkflowSteps', () => {
  it('skips Orbit writes when the row signature still matches baseline', async () => {
    const existing = row({
      id: 'step-1',
      name: 'Discuss',
      seq: 1,
      tool: 'discuss',
      settings: '',
    });
    const update = jest.fn();
    const memory = {
      cache: {
        query: () => ({
          id: existing.id,
          type: 'orgworkflowstep',
          attributes: {
            name: existing.name,
            sequencenum: existing.seq,
            tool: JSON.stringify({
              tool: existing.tool,
              settings: existing.settings,
            }),
          },
        }),
      },
      update,
    };
    const baseline = new Map([[existing.id, rowSignature(existing)]]);

    const count = await saveOrgWorkflowSteps({
      rows: [existing],
      org: 'org-1',
      memory: memory as never,
      user: 'user-1',
      baseline,
      mangleName: (name) => name,
      getOrgNames: () => [existing.name],
    });

    expect(count).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });
});
