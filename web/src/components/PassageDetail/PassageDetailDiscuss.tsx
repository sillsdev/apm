import { useEffect, useState } from 'react';
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
  const [value, setValue] = useState<string>('');
  const orgSteps = useOrbitData<OrgWorkflowStepD[]>('orgworkflowstep');
  const t = useSelector(discussSelector, shallowEqual) as IDiscussStrings;

  useEffect(() => {
    const step = orgSteps?.find((s) => s.id === currentStep);
    if (step) {
      const settings = parseJsonObject(
        parseStepTool(step.attributes?.tool).settings
      );
      setValue(typeof settings?.markDown === 'string' ? settings.markDown : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSteps]);

  return (
    <Box sx={{ maxWidth: width, whiteSpace: 'normal', overflow: 'auto' }}>
      <MarkDownView value={value || t.howToChange} />
    </Box>
  );
};
