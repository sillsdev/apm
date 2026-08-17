import { IMobileStrings } from '@model/index';
import { Box, Typography } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { mobileSelector } from '../../../selector';

interface Props {
  segmentText: string;
}

export default function SegmentStatusMobile({ segmentText }: Props) {
  const t: IMobileStrings = useSelector(mobileSelector, shallowEqual);
  return (
    <Box sx={{ px: 1.5, py: 0.5, display: 'flex', justifyContent: 'center' }}>
      <Typography variant="body2" sx={{ textAlign: 'center' }}>
        {t.segment.replace('{0}', segmentText || '—')}
      </Typography>
    </Box>
  );
}
