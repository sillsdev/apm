import { useOrbitData } from '../../hoc/useOrbitData';
import { IDiscussStrings, OrgWorkflowStepD } from '../../model';
import { Box } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { discussSelector } from '../../selector';
import { MarkDownView } from '../../control/MarkDownView';
import { getTool, stepToolMarkDown, ToolSlug } from '../../crud';

interface IProps {
  currentStep?: string;
}

export const PassageDetailDiscuss = ({ currentStep }: IProps) => {
  const orgSteps = useOrbitData<OrgWorkflowStepD[]>('orgworkflowstep');
  const t = useSelector(discussSelector, shallowEqual) as IDiscussStrings;
  const step = orgSteps?.find((s) => s.id === currentStep);
  const markDown = stepToolMarkDown(step?.attributes?.tool);
  const tool = getTool(step?.attributes?.tool);
  // Discuss keeps the localized “how to change” hint when empty; Done stays blank.
  const value =
    markDown || (tool === ToolSlug.Discuss ? t.howToChange : undefined);

  if (!value) return null;

  return (
    <Box sx={{ maxWidth: '100%', whiteSpace: 'normal', overflow: 'auto' }}>
      <MarkDownView value={value} />
    </Box>
  );
};
