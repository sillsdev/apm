import { ActivityStates } from '../model/activityStates';
import { ArtifactTypeSlug } from './artifactTypeSlug';
import {
  isNoParatextWorkflow,
  nextTranscriptionState,
  resolvedProjectType,
} from './nextTranscriptionState';

describe('nextTranscriptionState', () => {
  it('moves reviewing to approved when Paratext workflow applies', () => {
    expect(
      nextTranscriptionState({
        state: ActivityStates.Reviewing,
        hasChecking: true,
        noParatext: false,
      })
    ).toBe(ActivityStates.Approved);
  });

  it('moves reviewing to done when noParatext', () => {
    expect(
      nextTranscriptionState({
        state: ActivityStates.Reviewing,
        hasChecking: true,
        noParatext: true,
      })
    ).toBe(ActivityStates.Done);
  });

  it('skips transcribed when there is no checking step', () => {
    expect(
      nextTranscriptionState({
        state: ActivityStates.Transcribing,
        hasChecking: false,
        noParatext: false,
      })
    ).toBe(ActivityStates.Approved);
  });
});

describe('resolvedProjectType (TT-5244)', () => {
  it('uses the Scripture project record when the global type is empty', () => {
    expect(resolvedProjectType('', 'Scripture')).toBe('Scripture');
  });

  it('uses the Scripture project record when the global type is stale', () => {
    expect(resolvedProjectType('generic', 'Scripture')).toBe('Scripture');
  });
});

describe('isNoParatextWorkflow', () => {
  it('is false for Scripture', () => {
    expect(isNoParatextWorkflow('Scripture')).toBe(false);
  });

  it('is true for empty type', () => {
    expect(isNoParatextWorkflow('')).toBe(true);
  });

  it('is true for Retell artifacts even in a Scripture project', () => {
    expect(isNoParatextWorkflow('Scripture', ArtifactTypeSlug.Retell)).toBe(
      true
    );
  });
});
