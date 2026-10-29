import Memory from '@orbit/memory';
import JSONAPISource from '@orbit/jsonapi';
import { remoteIdNum } from '.';
import { RecordKeyMap } from '@orbit/records';
import { pullRemoteToMemory } from './syncToMemory';

export const pullPlanMedia = async (
  plan: string,
  memory: Memory,
  remote: JSONAPISource
) => {
  // `plan` is the local Orbit plan id; the media filter needs the remote id.
  const getRemotePlanId = () =>
    remoteIdNum('plan', plan, memory?.keyMap as RecordKeyMap) || plan;

  const remotePlanId = getRemotePlanId();
  if (remotePlanId !== undefined) {
    const filter = [{ attribute: 'plan-id', value: remotePlanId }];
    await pullRemoteToMemory({ table: 'mediafile', memory, remote, filter });
  }
};
