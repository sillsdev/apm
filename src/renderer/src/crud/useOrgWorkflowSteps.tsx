import { useRef } from 'react';
import { useGlobal, useGetGlobal } from '../context/useGlobal';
import { related } from '.';
import {
  IWorkflowStepsStrings,
  OrgWorkflowStep,
  OrgWorkflowStepD,
  WorkflowStepD,
} from '../model';
import { AddRecord, ReplaceRelatedRecord } from '../model/baseModel';
import { toCamel, useWaitForRemoteQueue, waitForIt } from '../utils';
import JSONAPISource from '@orbit/jsonapi';
import { shallowEqual, useSelector } from 'react-redux';
import { workflowStepsSelector } from '../selector';
import {
  InitializedRecord,
  RecordOperation,
  RecordTransformBuilder,
} from '@orbit/records';
import { addPt } from '../utils/addPt';
import { useOrbitData } from '../hoc/useOrbitData';
import { useNewTime } from '../utils/useNewTime';

export const defaultWorkflow = 'draft';

export const filterAndSortOrgWorkflowSteps = (
  orgworkflowsteps: OrgWorkflowStepD[],
  process: string,
  org: string,
  offlineOnly: boolean
) =>
  orgworkflowsteps
    .filter(
      (s) =>
        (process === 'ANY' || s.attributes.process === process) &&
        related(s, 'organization') === org &&
        Boolean(s.keys?.remoteId) !== offlineOnly
    )
    .sort((i, j) => i.attributes.sequencenum - j.attributes.sequencenum);

interface ISwitches {
  [key: string]: any;
}
export const useOrgWorkflowSteps = () => {
  const t: IWorkflowStepsStrings = useSelector(
    workflowStepsSelector,
    shallowEqual
  );

  const [memory] = useGlobal('memory');
  const workflowsteps = useOrbitData<WorkflowStepD[]>('workflowstep');
  const [coordinator] = useGlobal('coordinator');
  const remote = coordinator?.getSource('remote') as JSONAPISource;
  const [user] = useGlobal('user');
  const waitForRemoteQueue = useWaitForRemoteQueue();
  const getGlobal = useGetGlobal();
  const creatingRef = useRef(false);
  const [newTime, setTime] = useNewTime();

  const localizedWorkStep = (val: string) => {
    return addPt((t as ISwitches)[toCamel(val)] ?? '') || val;
  };
  const localizedWorkStepFromId = (id: string) => {
    try {
      const step = memory.cache.query((q) =>
        q.findRecord({ type: 'orgworkflowstep', id: id })
      ) as OrgWorkflowStep;
      return localizedWorkStep(step.attributes.name);
    } catch {
      return '';
    }
  };

  const AddOrgWFToOps = (
    tb: RecordTransformBuilder,
    wf: WorkflowStepD,
    org: string,
    ops: RecordOperation[]
  ) => {
    // NB: The remoteId was not updated even though this always gets created online
    // let myOrgRemoteId = remoteId('organization', myOrgId, memory?.keyMap as RecordKeyMap);
    // if (!offline && !myOrgRemoteId) {
    //   console.error(`no org remoteId for ${myOrgId}`);
    //   return; // offline users won't have an org remoteId
    // }
    const wfs = {
      type: 'orgworkflowstep',
      attributes: {
        ...wf.attributes,
      },
    } as OrgWorkflowStep;
    ops.push(...AddRecord(tb, wfs, user, memory, newTime()));
    ops.push(
      ...ReplaceRelatedRecord(
        tb,
        wfs as InitializedRecord,
        'organization',
        'organization',
        org
      )
    );
  };
  const QueryOrgWorkflowSteps = async (process: string, org: string) => {
    /* wait for new workflow steps remote id to fill in */
    await waitForRemoteQueue('waiting for workflow update');

    let orgworkflowsteps = memory.cache.query((q) =>
      q.findRecords('orgworkflowstep')
    ) as OrgWorkflowStepD[];
    if (orgworkflowsteps.length === 0 && remote) {
      //check remote
      orgworkflowsteps = (await remote.query((q) =>
        q.findRecords('orgworkflowstep')
      )) as OrgWorkflowStepD[];
    }
    return filterAndSortOrgWorkflowSteps(
      orgworkflowsteps,
      process,
      org,
      getGlobal('offlineOnly')
    );
  };

  const CreateOrgWorkflowSteps = (
    tb: RecordTransformBuilder,
    process: string,
    org: string,
    opArray: RecordOperation[]
  ) => {
    const offlineOnly = getGlobal('offlineOnly');
    const processSteps = workflowsteps
      .filter(
        (s) =>
          s.attributes.process === process &&
          Boolean(s?.keys?.remoteId) !== offlineOnly
      )
      .sort((a, b) => a.attributes.sequencenum - b.attributes.sequencenum);
    setTime();
    for (let stepIndex = 0; stepIndex < processSteps.length; stepIndex++)
      AddOrgWFToOps(tb, processSteps[stepIndex] as WorkflowStepD, org, opArray);
  };

  interface IGetSteps {
    process: string;
    org: string;
    showAll?: boolean;
  }

  const GetOrgWorkflowSteps = async ({ process, org, showAll }: IGetSteps) => {
    if (
      creatingRef.current &&
      (!getGlobal('offline') || getGlobal('offlineOnly'))
    )
      await waitForIt(
        'creating org workflow',
        () => !creatingRef.current,
        () => false,
        100
      );
    if (!org) {
      //hopefully we'll be back...
      return [];
    }
    //try to avoid creating orgworkflowsteps when we're switching modes
    let retry = 0;
    let orgsteps: OrgWorkflowStepD[] = [];
    do {
      if (retry > 0) await new Promise((resolve) => setTimeout(resolve, 1000));
      orgsteps = await QueryOrgWorkflowSteps(process, org);
      retry++;
    } while (orgsteps.length === 0 && retry < 3);

    // if (orgsteps.length === 0) {
    //   orgsteps = await CreateOrgWorkflowSteps(
    //     process === 'ANY' ? defaultWorkflow : process,
    //     org
    //   );
    // }
    return orgsteps.filter((s) => showAll || s.attributes.sequencenum >= 0);
  };

  return {
    GetOrgWorkflowSteps,
    CreateOrgWorkflowSteps,
    localizedWorkStepFromId,
    localizedWorkStep,
  };
};
