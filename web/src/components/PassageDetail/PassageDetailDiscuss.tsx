import { useEffect, useState } from 'react';
import { useOrbitData } from '../../hoc/useOrbitData';
import { IDiscussStrings, OrgWorkflowStepD } from '../../model';
import { Box } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { discussSelector } from '../../selector';
import { MarkDownView } from '../../control/MarkDownView';

interface IProps {
  currentStep?: string;
}

export const PassageDetailDiscuss = ({ currentStep }: IProps) => {
  const [value, setValue] = useState<string>('');
  const orgSteps = useOrbitData<OrgWorkflowStepD[]>('orgworkflowstep');
  const t = useSelector(discussSelector, shallowEqual) as IDiscussStrings;

  useEffect(() => {
    const step = orgSteps?.find((s) => s.id === currentStep);
    if (step) {
      const json = JSON.parse(step?.attributes?.tool || '{}');
      setValue(JSON.parse(json?.settings || '{}')?.markDown ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSteps]);

  return (
    <Box sx={{ maxWidth: '100%', whiteSpace: 'normal', overflow: 'auto' }}>
      <MarkDownView value={value || t.howToChange} />
    </Box>
  );
};
