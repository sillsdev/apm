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

export const PassageDetailDiscuss = ({ width, currentStep }: IProps) => {
  const orgSteps = useOrbitData<OrgWorkflowStepD[]>('orgworkflowstep');
  const t = useSelector(discussSelector, shallowEqual) as IDiscussStrings;
  const step = orgSteps?.find((s) => s.id === currentStep);
  const tool = JSONParse(step?.attributes?.tool) as {
    settings?: string;
  } | null;
  const settings = JSONParse(tool?.settings) as { markDown?: string } | null;
  const value = settings?.markDown || t.howToChange;

  return (
    <Box sx={{ maxWidth: width, whiteSpace: 'normal', overflow: 'auto' }}>
      <MarkDownView value={value} />
    </Box>
  );
};
