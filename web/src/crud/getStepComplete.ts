import { StepComplete, Passage } from '../model';

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
