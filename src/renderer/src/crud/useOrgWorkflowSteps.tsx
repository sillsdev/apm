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

export const defaultWorkflow = 'draft';

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

  /** Same template list as {@link CreateOrgWorkflowSteps} (remote, then offline fallback). */
  const getProcessTemplateSteps = (process: string): WorkflowStepD[] => {
    const offlineOnly = getGlobal('offlineOnly');
    const bySeq = (a: WorkflowStepD, b: WorkflowStepD) =>
      a.attributes.sequencenum - b.attributes.sequencenum;
    let processSteps = workflowsteps
      .filter(
        (s) =>
          s.attributes.process === process &&
          Boolean(s?.keys?.remoteId) !== offlineOnly
      )
      .sort(bySeq);
    if (processSteps.length === 0 && !offlineOnly) {
      processSteps = workflowsteps
        .filter((s) => s.attributes.process === process && !s?.keys?.remoteId)
        .sort(bySeq);
    }
    return processSteps;
  };

  /**
   * Row label, tool JSON, and optional corrected `sequencenum` for Edit Workflow.
   *
   * - **Index alignment**: when `indexAlign` is passed and template count matches
   *   org count, use the Nth template row (fixes API data where every org step
   *   reused the same `sequencenum`, so lookup by sequence always hit "Record").
   * - **Duplicate-name repair**: when raw `name` repeats in the batch, align
   *   by `sequencenum` when that still distinguishes rows.
   */
  const resolveOrgWorkflowStepPresentation = (
    orgStep: OrgWorkflowStepD,
    processFilter: string,
    duplicateRawNameInBatch: boolean,
    indexAlign?: { index: number; orgCount: number }
  ): { name: string; toolAttr: string | undefined; sequencenum?: number } => {
    const orgName = orgStep.attributes?.name ?? '';
    const orgTool = orgStep.attributes?.tool;
    if (!processFilter || processFilter === 'ANY') {
      return {
        name: localizedWorkStep(orgName),
        toolAttr: orgTool,
      };
    }
    const templates = getProcessTemplateSteps(processFilter);
    if (
      indexAlign &&
      templates.length === indexAlign.orgCount &&
      templates[indexAlign.index]
    ) {
      const tmpl = templates[indexAlign.index];
      const sn = tmpl.attributes.sequencenum;
      const sequencenum =
        typeof sn === 'number' && sn < 0 ? sn : indexAlign.index + 1;
      return {
        name: localizedWorkStep(tmpl.attributes.name),
        toolAttr: tmpl.attributes.tool ?? orgTool,
        sequencenum,
      };
    }
    if (!duplicateRawNameInBatch) {
      return {
        name: localizedWorkStep(orgName),
        toolAttr: orgTool,
      };
    }
    const tmpl = templates.find(
      (w) => w.attributes.sequencenum === orgStep.attributes.sequencenum
    );
    if (tmpl?.attributes?.name && orgName !== tmpl.attributes.name) {
      return {
        name: localizedWorkStep(tmpl.attributes.name),
        toolAttr: tmpl.attributes.tool ?? orgTool,
        sequencenum: tmpl.attributes.sequencenum,
      };
    }
    return {
      name: localizedWorkStep(orgName),
      toolAttr: orgTool,
    };
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
      attributes: { ...wf.attributes },
    } as OrgWorkflowStepD;
    ops.push(...AddRecord(tb, wfs, user, memory));
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
    return orgworkflowsteps
      .filter(
        (s) =>
          (process === 'ANY' || s.attributes.process === process) &&
          related(s, 'organization') === org &&
          Boolean(s.keys?.remoteId) !== getGlobal('offlineOnly')
      )
      .sort((i, j) => {
        const d = i.attributes.sequencenum - j.attributes.sequencenum;
        if (d !== 0) return d;
        return String(i.id).localeCompare(String(j.id));
      });
  };

  const CreateOrgWorkflowSteps = (
    tb: RecordTransformBuilder,
    process: string,
    org: string
  ) => {
    const processSteps = getProcessTemplateSteps(process);
    const opArray: RecordOperation[] = [];
    let visibleOrdinal = 0;
    for (let stepIndex = 0; stepIndex < processSteps.length; stepIndex++) {
      const wf = processSteps[stepIndex] as WorkflowStepD;
      const sn = wf.attributes.sequencenum;
      const sequencenum =
        typeof sn === 'number' && sn < 0 ? sn : ++visibleOrdinal;
      const normalized = {
        ...wf,
        attributes: {
          ...wf.attributes,
          sequencenum,
        },
      } as WorkflowStepD;
      AddOrgWFToOps(tb, normalized, org, opArray);
    }
    return opArray;
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
    getProcessTemplateSteps,
    localizedWorkStepFromId,
    localizedWorkStep,
    resolveOrgWorkflowStepPresentation,
  };
};
