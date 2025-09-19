/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect } from 'react';
import { useGlobal } from '../context/useGlobal';
import {
  Snackbar as MuiSnackbar,
  IconButton,
  styled,
  BoxProps,
  Box,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MuiAlert, { AlertProps } from '@mui/material/Alert';
import { useMounted } from '../utils/useMounted';
import { useSnackBar } from './useSnackBar';
export { useSnackBar, AlertSeverity } from './useSnackBar';

const Alert = (props: AlertProps) => {
  return <MuiAlert elevation={6} {...props} />;
};

// moved to ./useSnackBar

interface IProps {
  children: JSX.Element;
}
const BarBox = styled(Box)<BoxProps>(() => ({
  '& .MuiPaper-root': {
    alignItems: 'center',
  },
}));

interface ISBProps {
  message: JSX.Element;
}

function SimpleSnackbar(props: ISBProps) {
  const isMounted = useMounted('snackbar');
  const { message } = props;
  const { messageReset } = useSnackBar();
  const [alert] = useGlobal('snackAlert'); //verified this is not used in a function 2/18/25
  const [open, setOpen] = useState(false);

  const handleClose = () => {
    messageReset();
  };

  useEffect(() => {
    if ((message?.type === 'span') !== open) {
      setOpen(!open);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  const CloseButton = () => (
    <IconButton
      id="msgClose"
      key="close"
      aria-label="Close"
      color="inherit"
      sx={{ p: 0.5 }}
      onClick={handleClose}
      component="span"
    >
      <CloseIcon />
    </IconButton>
  );

  return isMounted() && open ? (
    !alert ? (
      <MuiSnackbar
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        open={open}
        autoHideDuration={6000}
        onClose={handleClose}
        ContentProps={{
          'aria-describedby': 'message-id',
        }}
        message={<span id="message-id">{message}</span>}
        action={CloseButton()}
      />
    ) : (
      <MuiSnackbar open={open} onClose={handleClose} autoHideDuration={30000}>
        <BarBox>
          <Alert severity={alert} action={CloseButton()}>
            {message}
          </Alert>
        </BarBox>
      </MuiSnackbar>
    )
  ) : (
    <></>
  );
}

export default function SnackBarProvider(props: IProps) {
  const { children } = props;
  const [message] = useGlobal('snackMessage');

  return (
    <>
      {children}
      <SimpleSnackbar message={message} />
    </>
  );
}
