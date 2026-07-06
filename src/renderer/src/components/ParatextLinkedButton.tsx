import React, { useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { Box, Button, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { IState, IProfileStrings } from '../model';
import { profileSelector } from '../selector';
import { useHasParatext } from '../utils';
import { useGlobal } from '../context/useGlobal';
import { addPt } from '../utils/addPt';
import Confirm from './AlertDialog';

const captionSx = {
  textAlign: 'center',
  color: 'white',
  opacity: 0.65,
} as const;

interface IProps {
  setView: React.Dispatch<React.SetStateAction<string>>;
}

function ParatextLinkedButton({ setView }: IProps) {
  const [isOffline] = useGlobal('offline'); // Verified this is not used in a function 2/18/25
  const { hasParatext, ptPath } = useHasParatext();
  const t: IProfileStrings = useSelector(profileSelector, shallowEqual);
  const status = useSelector((state: IState) => state.paratext.usernameStatus); // Online Paratext username check
  const [howToLink, setHowToLink] = useState(false);

  // Status message from the online Paratext username check
  const statusMsg = status?.statusMsg ?? '';
  // Error status from the online Paratext username check, if any
  const errStatus = status?.errStatus;
  // Whether the online Paratext username check completed successfully
  const complete = Boolean(status?.complete);

  const handleHowTo = () => {
    setHowToLink(true);
  };

  const handleLogout = () => {
    setView('Logout');
  };

  const handleNoLinkSetup = () => {
    setHowToLink(false);
  };

  // Whether the online username check reported an error (always false when offline)
  const hasError = Boolean(errStatus);

  // Whether the user still needs to set up Paratext linking (either because the
  // online username check failed or because there is no local Paratext path)
  const needsSetup = hasError || (isOffline && !ptPath);

  // Whether the user is linked and verified by the online check (always false when offline)
  const isVerified = hasParatext && complete;

  // Whether the user appears to be linked at all (either verified by the online
  // check or has a local Paratext path)
  const isLinked = isVerified || Boolean(ptPath);

  return (
    <>
      <Box
        sx={{
          mt: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {needsSetup ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Typography sx={captionSx}>{addPt(t.notLinked)}</Typography>
            <Button onClick={handleHowTo}>{addPt(t.paratextNotLinked)}</Button>
          </Box>
        ) : isLinked ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={captionSx}>{addPt(t.paratextLinked)}</Typography>
            <CheckCircleIcon sx={captionSx} />
          </Box>
        ) : (
          <Typography sx={captionSx}>
            {statusMsg || addPt(t.checkingParatext)}
          </Typography>
        )}
      </Box>

      {howToLink && (
        <Confirm
          title={addPt(t.paratextLinking)}
          text={
            isOffline ? addPt(t.installParatext) : addPt(t.linkingExplained)
          }
          yes={isOffline ? '' : t.logout}
          no={isOffline ? t.close : t.cancel}
          yesResponse={handleLogout}
          noResponse={handleNoLinkSetup}
        />
      )}
    </>
  );
}

export default ParatextLinkedButton;
