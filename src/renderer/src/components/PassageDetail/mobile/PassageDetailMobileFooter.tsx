import { Box, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import MobileStepComplete from './MobileStepComplete';
import { usePassageNavigate } from '../usePassageNavigate';
import { useGlobal } from '../../../context/useGlobal';
import { rememberCurrentPassage } from '../../../utils';
import { nextPasId } from '../../../crud/nextPasId';
import { prevPasId } from '../../../crud/prevPasId';
import { useParams } from 'react-router-dom';
import { shallowEqual, useSelector } from 'react-redux';
import { mobileSelector } from '../../../selector';
import { IMobileStrings } from '../../../model';

export default function PassageDetailMobileFooter() {
  const { section, passage, setCurrentStep } = usePassageDetailContext();
  const t: IMobileStrings = useSelector(mobileSelector, shallowEqual);
  const [memory] = useGlobal('memory');
  const { prjId } = useParams();
  const passageNavigate = usePassageNavigate(() => {}, setCurrentStep);

  const nextId = nextPasId(section, passage.id, memory);
  const prevId = prevPasId(section, passage.id, memory);

  const handleNavigate = (forward: boolean) => {
    const targetId = forward ? nextId : prevId;
    if (targetId && targetId !== passage?.keys?.remoteId) {
      rememberCurrentPassage(memory, targetId);
      passageNavigate(`/detail/${prjId}/${targetId}`);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        width: '100%',
      }}
    >
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => handleNavigate(false)}
        disabled={!prevId}
      >
        {t?.previous ?? 'Previous'}
      </Button>
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <MobileStepComplete />
      </Box>
      <Button
        endIcon={<ArrowForwardIcon />}
        onClick={() => handleNavigate(true)}
        disabled={!nextId}
      >
        {t?.next ?? 'Next'}
      </Button>
    </Box>
  );
}
