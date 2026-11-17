import { useCallback } from 'react';
import { ActivityStates } from '../../../model';
import { ToolSlug } from '../../../crud/toolSlug';
import { trySetStepComplete } from '../../../context/completeStepAfterSave';
import type {
  TranscribeRole,
  TranscribeWorkflowStep,
} from './useTranscribeStepRole';

/**
 * Uncomplete this (and checking) step on reopen/reject, and navigate editors
 * back. One owner for PassageDetailTranscribe and mobile.
 */
export function useTranscribeStepNav({
  currentstep,
  parsedSteps,
  hasChecking,
  nextStep,
  prevStep,
  curRole,
  setStepComplete,
  setCurrentStep,
}: {
  currentstep: string;
  parsedSteps: TranscribeWorkflowStep[];
  hasChecking: boolean;
  nextStep: string | null;
  prevStep: string | null;
  curRole: TranscribeRole | undefined;
  setStepComplete: (stepId: string, complete: boolean) => Promise<void>;
  setCurrentStep: (stepId: string) => void;
}) {
  const uncompletedSteps = useCallback(async () => {
    if (!(await trySetStepComplete(setStepComplete, currentstep, false)))
      return false;
    if (
      hasChecking &&
      nextStep &&
      !(await trySetStepComplete(setStepComplete, nextStep, false))
    )
      return false;
    if (curRole === 'editor' && prevStep) setCurrentStep(prevStep || '');
    return true;
  }, [
    setStepComplete,
    currentstep,
    hasChecking,
    nextStep,
    curRole,
    prevStep,
    setCurrentStep,
  ]);

  const handleReopen = useCallback(() => {
    // Never rejects: step-write failures are shown by setStepComplete.
    void uncompletedSteps();
  }, [uncompletedSteps]);

  const handleReject = useCallback(
    async (reason: string) => {
      if (!(await uncompletedSteps())) return;
      if (reason === ActivityStates.NeedsNewRecording) {
        const curStep = parsedSteps.find((s) => s.id === currentstep);
        if (curStep?.settings === '{}') {
          // only for vernacular
          const recordStep = parsedSteps.find(
            (s) => s.tool === ToolSlug.Record
          );
          if (recordStep) {
            if (await trySetStepComplete(setStepComplete, recordStep.id, false))
              setCurrentStep(recordStep.id);
            return;
          }
        }
      }
      if (
        curRole === 'editor' &&
        prevStep &&
        (await trySetStepComplete(setStepComplete, prevStep, false))
      )
        setCurrentStep(prevStep);
    },
    [
      uncompletedSteps,
      parsedSteps,
      currentstep,
      curRole,
      prevStep,
      setStepComplete,
      setCurrentStep,
    ]
  );

  return { uncompletedSteps, handleReopen, handleReject };
}
