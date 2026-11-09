import Memory from '@orbit/memory';
import { StepComplete, Passage } from '../model';
import { findRecord } from './tryFindRecord';

/** Parse passage.stepComplete; malformed or missing data yields []. */
export const getStepComplete = (p: Passage | undefined): StepComplete[] => {
  const raw = p?.attributes?.stepComplete;
  if (!raw || raw === '{}') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.completed)
      ? (parsed.completed as StepComplete[])
      : [];
  } catch {
    return [];
  }
};

/**
 * Prefer the memory-cache passage over a `useOrbitData` snapshot.
 * A liveQuery callback can call `read()` before a stepComplete write, then
 * React may apply that stale `passages` array after the write — which would
 * briefly uncheck Complete on Submit. Cache is already current after update.
 */
export function passageRecordForStepComplete(
  memory: Memory | undefined,
  passageId: string,
  passages: Passage[]
): Passage | undefined {
  if (passageId && memory) {
    const fromMemory = findRecord(memory, 'passage', passageId) as
      Passage | undefined;
    if (fromMemory) return fromMemory;
  }
  return passages.find((p) => p.id === passageId);
}
