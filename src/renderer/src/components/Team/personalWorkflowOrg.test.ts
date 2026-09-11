import { expect, describe, it } from '@jest/globals';
import { VProjectD } from '../../model';
import { personalWorkflowOrg } from './personalWorkflowOrg';

describe('personalWorkflowOrg', () => {
  // ADR 0012: Edit Workflow always targets the canonical personalTeam.
  it('uses canonical personalTeam even when a project org differs (ADR 0012)', () => {
    const project = {
      id: 'plan-1',
      type: 'plan',
      relationships: {
        organization: {
          data: { type: 'organization', id: 'org-with-workflow' },
        },
      },
    } as VProjectD;
    expect(personalWorkflowOrg('canonical-personal-team', [project])).toBe(
      'canonical-personal-team'
    );
  });

  it('falls back to personalTeam when there are no personal projects', () => {
    expect(personalWorkflowOrg('personal-team', [])).toBe('personal-team');
  });
});
