import { useOrbitData } from '../../hoc/useOrbitData';
import { IDiscussStrings, OrgWorkflowStepD } from '../../model';
import { Box } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { discussSelector } from '../../selector';
import { MarkDownView } from '../../control/MarkDownView';
import { JSONParse } from '../../utils';

interface IProps {
  width: number;
  currentStep?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Persisted step tool.settings.markDown, or undefined if missing/invalid. */
function stepMarkDown(toolJson: string | undefined): string | undefined {
  const tool = JSONParse(toolJson);
  if (!isPlainObject(tool)) return undefined;
  const rawSettings = tool.settings;
  const settings =
    typeof rawSettings === 'string' ? JSONParse(rawSettings) : rawSettings;
  if (!isPlainObject(settings)) return undefined;
  return typeof settings.markDown === 'string' ? settings.markDown : undefined;
}

export const PassageDetailDiscuss = ({ width, currentStep }: IProps) => {
  const orgSteps = useOrbitData<OrgWorkflowStepD[]>('orgworkflowstep');
  const t = useSelector(discussSelector, shallowEqual) as IDiscussStrings;
  const step = orgSteps?.find((s) => s.id === currentStep);
  const value = stepMarkDown(step?.attributes?.tool) || t.howToChange;

  return (
    <Box sx={{ maxWidth: width, whiteSpace: 'normal', overflow: 'auto' }}>
      <MarkDownView value={value} />
    </Box>
  );
};
