import { useRef } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import {
  RecordKeyMap,
  RecordOperation,
  RecordTransformBuilder,
} from '@orbit/records';
import { useGlobal } from './useGlobal';
import {
  IPassageDetailStepCompleteStrings,
  OrgWorkflowStep,
  Passage,
  StepComplete,
} from '../model';
import { UpdateLastModifiedBy } from '../model/baseModel';
import { passageDetailStepCompleteSelector } from '../selector';
import { AddPassageStateChangeToOps } from '../crud/updatePassageState';
import { findRecord } from '../crud/tryFindRecord';
import { getStepComplete } from '../crud/getStepComplete';
import {
  applyStepComplete,
  StepCompleteSource,
  stepsCompleteThrough,
} from '../crud/applyStepComplete';
import { remoteId, remoteIdGuid } from '../crud/remoteId';
import { useOrgWorkflowSteps } from '../crud/useOrgWorkflowSteps';
import { useSnackBar } from '../hoc/SnackBar';
import { infoMsg, logError, Severity } from '../utils';
import { errorMessage } from '../utils/toError';

export interface StepCompleteWriterOptions {
  /** Passage id from the route (remote or local). */
  pasId: string | undefined;
  /** The workflow's org steps, for "complete through this step". */
  orgWorkflowSteps: StepCompleteSource[];
  /**
   * Called once a save lands, with the saved passage's memory id and new
   * list. The caller applies it only if that passage is still displayed:
   * navigation may finish while the save is awaited.
   */
  onSaved: (passageId: string, completed: StepComplete[]) => void;
}

/** What a stepComplete write saves, or undefined to skip it. */
type StepCompleteChange =
  { completed: StepComplete[]; comment: string } | undefined;

/**
 * Writes a passage's `stepComplete` list for the step-complete controls.
 *
 * Writes run one at a time, and each builds on the passage's list in memory
 * when it runs (earlier writes have landed by then). So back-to-back calls,
 * such as the reject flow unmarking two steps, keep each other's changes, and
 * a write queued before navigation still edits its own passage.
 */
export function useStepCompleteWriter({
  pasId,
  orgWorkflowSteps,
  onSaved,
}: StepCompleteWriterOptions) {
  const [memory] = useGlobal('memory');
  const [user] = useGlobal('user');
  const [errorReporter] = useGlobal('errorReporter');
  const { showMessage } = useSnackBar();
  const { localizedWorkStep } = useOrgWorkflowSteps();
  const t: IPassageDetailStepCompleteStrings = useSelector(
    passageDetailStepCompleteSelector,
    shallowEqual
  );
  const tail = useRef(Promise.resolve());

  const persist = async (
    passageId: string,
    completed: StepComplete[],
    comment: string
  ) => {
    const recId = { type: 'passage', id: passageId };
    const curPassage = findRecord(memory, 'passage', recId.id) as Passage;
    let stepCompleteJson: Record<string, unknown> = {};
    try {
      stepCompleteJson = JSON.parse(
        curPassage?.attributes.stepComplete || '{}'
      );
    } catch (err) {
      logError(
        Severity.error,
        errorReporter,
        infoMsg(err as Error, 'Json conversion error')
      );
    }
    const tb = new RecordTransformBuilder();
    const ops = [] as RecordOperation[];
    ops.push(
      tb
        .replaceAttribute(
          recId,
          'stepComplete',
          JSON.stringify({ ...stepCompleteJson, completed })
        )
        .toOperation()
    );
    ops.push(...UpdateLastModifiedBy(tb, recId, user));
    AddPassageStateChangeToOps(tb, ops, recId.id, '', comment, user, memory);
    await memory.update(ops);
  };

  const enqueue = (run: () => Promise<void>) => {
    const next = tail.current.then(run, run);
    tail.current = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  };

  const write = (build: (base: StepComplete[]) => StepCompleteChange) => {
    const passageId =
      remoteIdGuid('passage', pasId ?? '', memory?.keyMap as RecordKeyMap) ||
      pasId ||
      '';
    return enqueue(async () => {
      const passage = findRecord(memory, 'passage', passageId) as
        Passage | undefined;
      const change = build(passage ? getStepComplete(passage) : []);
      if (!change) return;
      try {
        await persist(passageId, change.completed, change.comment);
      } catch (err) {
        logError(
          Severity.error,
          errorReporter,
          infoMsg(err as Error, 'Step complete save failed')
        );
        showMessage(errorMessage(err));
        throw err;
      }
      onSaved(passageId, change.completed);
    });
  };

  const setStepComplete = (stepid: string, complete: boolean) => {
    if (stepid === '') return Promise.resolve();
    const remId =
      remoteId('orgworkflowstep', stepid, memory?.keyMap as RecordKeyMap) ||
      stepid;
    const rec = findRecord(memory, 'orgworkflowstep', stepid) as
      OrgWorkflowStep | undefined;
    const name = rec?.attributes?.name ?? '';
    return write((base) => ({
      completed: applyStepComplete(base, remId, complete, name),
      comment: `${complete ? t.title : t.incomplete} : ${localizedWorkStep(
        name
      )}`,
    }));
  };

  const setStepCompleteTo = (stepid: string) => {
    const steps = orgWorkflowSteps;
    return write(() => {
      const completed = stepsCompleteThrough(
        steps,
        stepid,
        (id) =>
          remoteId('orgworkflowstep', id, memory.keyMap as RecordKeyMap) || id
      );
      if (!completed) return undefined;
      const last = completed[completed.length - 1];
      return {
        completed,
        comment: `${t.title} : ${localizedWorkStep(last?.name ?? '')}`,
      };
    });
  };

  return { setStepComplete, setStepCompleteTo };
}
