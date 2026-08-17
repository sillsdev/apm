import { useState } from 'react';
import { IAlertStrings } from '../model';
import {
  Button,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  useTheme,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import DialogActions, { DialogActionsProps } from '@mui/material/DialogActions';
import { shallowEqual, useSelector } from 'react-redux';
import { alertSelector } from '../selector';
import { useMobile } from '../utils/useMobile';

// see: https://mui.com/material-ui/customization/how-to-customize/
interface StyledActionsProps extends DialogActionsProps {
  noOnLeft?: boolean;
}
const StyledDialogActions = styled(DialogActions, {
  shouldForwardProp: (prop) => prop !== 'noOnLeft',
})<StyledActionsProps>(({ noOnLeft }) => ({
  ...(noOnLeft && {
    display: 'flex',
    justifyContent: 'space-between',
  }),
}));

interface IProps {
  title?: string;
  text: string;
  jsx?: React.JSX.Element;
  no?: string;
  yes?: string;
  noResponse: () => void;
  yesResponse: () => void;
  noOnLeft?: boolean;
  isDelete?: boolean;
}

function AlertDialog(props: IProps) {
  const {
    title,
    text,
    jsx,
    no,
    yes,
    yesResponse,
    noResponse,
    noOnLeft,
    isDelete,
  } = props;
  const t: IAlertStrings = useSelector(alertSelector, shallowEqual);
  const [open, setOpen] = useState(true);
  const { isMobile } = useMobile();
  const theme = useTheme();

  const handleClose = () => {
    if (noResponse !== null) {
      noResponse();
    }
    setOpen(false);
  };
  const handleNo = () => {
    if (noResponse !== null) {
      noResponse();
    }
    setOpen(false);
  };
  const handleYes = () => {
    if (yesResponse !== null) {
      yesResponse();
    }
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="alertDlg"
      aria-describedby="alertDesc"
      disableEnforceFocus
      sx={
        isMobile
          ? {
              '& .MuiDialog-paper': {
                maxWidth: `calc(100vw - ${theme.spacing(4)})`,
                width: '100%',
                minWidth: 0,
                maxHeight: `calc(100dvh - ${theme.spacing(4)})`,
                boxSizing: 'border-box',
              },
            }
          : undefined
      }
    >
      <DialogTitle id="alertDlg">
        {title || (isDelete ? t.delete : t.confirmation)}
      </DialogTitle>
      <DialogContent>
        {jsx && <DialogContent id="alertJsx">{jsx}</DialogContent>}
        <DialogContentText id="alertDesc">
          {text || t.areYouSure}
        </DialogContentText>
      </DialogContent>
      <StyledDialogActions noOnLeft={noOnLeft}>
        <Button
          id="alertNo"
          onClick={handleNo}
          color="primary"
          variant="contained"
          sx={{ textTransform: 'capitalize' }}
          autoFocus
        >
          {no || t.no}
        </Button>
        {yes !== '' && (
          <Button
            id="alertYes"
            onClick={handleYes}
            color="primary"
            sx={{
              textTransform: 'capitalize',
              border: '0.5px solid',
              borderColor: 'primary',
            }}
          >
            {yes || t.yes}
          </Button>
        )}
      </StyledDialogActions>
    </Dialog>
  );
}

export default AlertDialog;
