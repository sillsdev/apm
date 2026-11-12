import { useMemo } from 'react';
import { useOrbitData } from '../../hoc/useOrbitData';
import { IDiscussStrings, OrgWorkflowStepD } from '../../model';
import { Box } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { discussSelector } from '../../selector';
import { MarkDownView } from '../../control/MarkDownView';
import { parseStepTool } from '../../crud/transcribeStepSettings';
import { parseJsonObject } from '../../utils/normalData';

interface IProps {
  width: number;
  currentStep?: string;
}

export const PassageDetailDiscuss = ({ width, currentStep }: IProps) => {
  const orgSteps = useOrbitData<OrgWorkflowStepD[]>('orgworkflowstep');
  const t = useSelector(discussSelector, shallowEqual) as IDiscussStrings;

  const value = useMemo(() => {
    const step = orgSteps?.find((s) => s.id === currentStep);
    const settings = parseJsonObject(
      parseStepTool(step?.attributes?.tool).settings
    );
    return typeof settings?.markDown === 'string' ? settings.markDown : '';
  }, [orgSteps, currentStep]);

  return (
    <Box sx={{ maxWidth: width, whiteSpace: 'normal', overflow: 'auto' }}>
      <MarkDownView value={value || t.howToChange} />
    </Box>
  );
};
