import { VProjectD } from '../../model';
import { personalWorkflowOrg } from './personalWorkflowOrg';

describe('personalWorkflowOrg', () => {
  it('uses the personal project organization when it differs from personalTeam (TT-7397)', () => {
    const project = {
      id: 'plan-1',
      type: 'plan',
      relationships: {
        organization: {
          data: { type: 'organization', id: 'org-with-workflow' },
        },
      },
    } as VProjectD;
    expect(personalWorkflowOrg('orphan-personal-team', [project])).toBe(
      'org-with-workflow'
    );
  });

  it('falls back to personalTeam when there are no personal projects', () => {
    expect(personalWorkflowOrg('personal-team', [])).toBe('personal-team');
  });
});
