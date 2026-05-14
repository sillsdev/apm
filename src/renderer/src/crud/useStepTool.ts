import { useGlobal } from '../context/useGlobal';
import { OrgWorkflowStep } from '../model';
import { findRecord } from './tryFindRecord';

export const getTool = (jsonTool?: string) => {
  try {
    if (jsonTool) {
      const tool = JSON.parse(jsonTool);
      return tool.tool || '';
    }
  } catch (error) {
    console.error('[getTool] error', error); // worflowsteps record not well formed
  }
  return '';
};
export const getToolSettings = (jsonTool?: string) => {
  try {
    if (jsonTool) {
      const tool = JSON.parse(jsonTool);
      const settings = tool.settings;
      if (!settings) return '';
      return typeof settings === 'string' ? settings : JSON.stringify(settings);
    }
  } catch (error) {
    console.error('[getToolSettings] error', error); // worflowsteps record not well formed
  }
  return '';
};
export const useStepTool = (stepId: string) => {
  const [memory] = useGlobal('memory');

  if (!stepId) return { tool: '', settings: '' };
  const workflowstep = findRecord(
    memory,
    'orgworkflowstep',
    stepId
  ) as OrgWorkflowStep;
  return {
    tool: getTool(workflowstep?.attributes?.tool),
    settings: getToolSettings(workflowstep?.attributes?.tool),
  };
};
