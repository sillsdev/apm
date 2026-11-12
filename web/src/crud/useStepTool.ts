import { useMemo } from 'react';
import { useGlobal } from '../context/useGlobal';
import { OrgWorkflowStep } from '../model';
import { findRecord } from './tryFindRecord';
import { BOLD_WORKFLOW_PROCESS } from './useTeamWorkflowProcess';
import { ToolSlug } from './toolSlug';

export const getTool = (jsonTool?: string) => {
  if (jsonTool) {
    const tool = JSON.parse(jsonTool);
    return tool.tool || '';
  }
  return '';
};

/** Offline WorkAlone embeds settings as a nested object; online often as a string. */
export const getToolSettings = (jsonTool?: string) => {
  if (!jsonTool) return '';
  const settings = JSON.parse(jsonTool).settings;
  if (settings == null || settings === '') return '';
  return typeof settings === 'string' ? settings : JSON.stringify(settings);
};

/** Maps legacy BOLD Prompt steps that still use Internalize (`resource`) to `prompt`. */
export const resolveToolSlug = (
  rawTool: string,
  stepName?: string,
  process?: string
): string => {
  if (
    rawTool === ToolSlug.Resource &&
    stepName === 'Prompt' &&
    process === BOLD_WORKFLOW_PROCESS
  ) {
    return ToolSlug.Prompt;
  }
  return rawTool;
};

export const useStepTool = (stepId: string) => {
  const [memory] = useGlobal('memory');

  return useMemo(() => {
    if (!stepId) return { tool: '', settings: '' };
    const workflowstep = findRecord(
      memory,
      'orgworkflowstep',
      stepId
    ) as OrgWorkflowStep;
    const rawTool = getTool(workflowstep?.attributes?.tool);
    return {
      tool: resolveToolSlug(
        rawTool,
        workflowstep?.attributes?.name,
        workflowstep?.attributes?.process
      ),
      settings: getToolSettings(workflowstep?.attributes?.tool),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId, memory?.cache]);
};
