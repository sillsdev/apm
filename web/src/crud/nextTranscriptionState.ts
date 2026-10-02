import { ActivityStates } from '../model/activityStates';
import { ArtifactTypeSlug } from './artifactTypeSlug';

const nextByState: { [key: string]: string } = {
  [ActivityStates.Incomplete]: ActivityStates.Transcribed,
  [ActivityStates.Transcribing]: ActivityStates.Transcribed,
  [ActivityStates.Reviewing]: ActivityStates.Approved,
  [ActivityStates.TranscribeReady]: ActivityStates.Transcribed,
  [ActivityStates.Transcribed]: ActivityStates.Approved,
  [ActivityStates.NeedsNewTranscription]: ActivityStates.Transcribed,
};

/** Prefer the project record type when the global is empty or stale. */
export function resolvedProjectType(
  globalProjType?: string,
  recordProjType?: string
): string {
  const record = (recordProjType ?? '').trim();
  if (record) return record;
  return globalProjType ?? '';
}

export function isNoParatextWorkflow(
  projType?: string,
  artifactTypeSlug?: string
): boolean {
  return (
    [ArtifactTypeSlug.Retell, ArtifactTypeSlug.QandA].includes(
      (artifactTypeSlug || '') as ArtifactTypeSlug
    ) || (projType || '').toLowerCase() !== 'scripture'
  );
}

export function nextTranscriptionState(opts: {
  state: string;
  hasChecking: boolean;
  noParatext: boolean;
}): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(nextByState, opts.state)) {
    return undefined;
  }
  let nextState = nextByState[opts.state];
  if (nextState === ActivityStates.Transcribed && !opts.hasChecking) {
    nextState = ActivityStates.Approved;
  }
  if (nextState === ActivityStates.Approved && opts.noParatext) {
    nextState = ActivityStates.Done;
  }
  return nextState;
}
