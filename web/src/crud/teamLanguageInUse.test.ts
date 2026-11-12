import { describe, expect, it } from '@jest/globals';
import type { ProjectD } from '../model';
import { teamLanguageInUse } from './teamLanguageInUse';

const project = (
  language: string,
  orgId = 'team-1',
  dateArchived?: string
): ProjectD =>
  ({
    id: `p-${language}-${orgId}`,
    type: 'project',
    attributes: { language, dateArchived },
    relationships: {
      organization: { data: { type: 'organization', id: orgId } },
    },
  }) as unknown as ProjectD;

describe('teamLanguageInUse', () => {
  it('is true when a team project uses the team language', () => {
    expect(
      teamLanguageInUse([project('fr'), project('am')], 'team-1', 'am')
    ).toBe(true);
  });

  it('is false when no team project uses it', () => {
    expect(teamLanguageInUse([project('fr')], 'team-1', 'am')).toBe(false);
  });

  it('ignores projects of other teams and archived projects', () => {
    expect(
      teamLanguageInUse(
        [project('am', 'team-2'), project('am', 'team-1', '2026-01-01')],
        'team-1',
        'am'
      )
    ).toBe(false);
  });

  it('is false when the team has no language yet', () => {
    expect(teamLanguageInUse([project('und')], 'team-1', 'und')).toBe(false);
    expect(teamLanguageInUse([project('am')], 'team-1', undefined)).toBe(false);
  });
});
