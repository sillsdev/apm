import { ReactElement } from 'react';
import { useGetGlobal, useGlobal } from '../context/useGlobal';
import { ISharedStrings } from '../model';
import { useSelector, shallowEqual } from 'react-redux';
import { sharedSelector } from '../selector';
import {
  Dialog,
  DialogProps,
  DialogContent,
  DialogActions,
  DialogTitle,
  IconButton,
  Box,
  Typography,
  TypographyProps,
  styled,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { PriButton, AltButton, GrowingSpacer } from '../control';
import { useSnackBar } from './SnackBar';
import { BigDialogBp } from './BigDialogBp';

// moved to ./BigDialogBp

// see: https://mui.com/material-ui/customization/how-to-customize/
export interface StyledDialogProps extends DialogProps {
  bp?: BigDialogBp;
  paperOutlineColor?: string;
  mobileThickScrollbar?: boolean;
  mobileNoHorizontalScroll?: boolean;
}
// eslint-disable-block TS2783
export const StyledDialog = styled(Dialog, {
  shouldForwardProp: (prop) =>
    prop !== 'bp' &&
    prop !== 'paperOutlineColor' &&
    prop !== 'mobileThickScrollbar' &&
    prop !== 'mobileNoHorizontalScroll',
})<StyledDialogProps>(({ bp, paperOutlineColor, mobileThickScrollbar, mobileNoHorizontalScroll, theme }) => ({
  '& .MuiTable-root': {
    tableLayout: 'auto',
    paddingRight: theme.spacing(1),
  },
  '& .MuiDialogTitle-root': {
    paddingBottom: 0,
  },
  '& #bigClose': { alignSelf: 'flex-start' },
  ...(bp === BigDialogBp.mobile
    ? {
        '& .MuiDialog-paper': {
          maxWidth: '90%',
          minWidth: '300px',
          minHeight: '50%',
        },
      }
    : bp === BigDialogBp.sm
      ? {
          '& .MuiDialog-paper': {
            maxWidth: '90%',
            minWidth: '600px',
            minHeight: '50%',
          },
        }
      : bp === BigDialogBp.md
        ? {
            '& .MuiDialog-paper': {
              maxWidth: '90%',
              minHeight: '80%',
              minWidth: '960px',
            },
          }
        : bp === BigDialogBp.lg
          ? {
              '& .MuiDialog-paper': {
                maxWidth: '90%',
                minHeight: '80%',
                minWidth: '1280px',
              },
            }
          : bp === BigDialogBp.xl
            ? {
                '& .MuiDialog-paper': {
                  maxWidth: '90%',
                  minHeight: '80%',
                  minWidth: '1920px',
                },
              }
            : {
                '& .MuiDialog-paper': {
                  maxWidth: '90%',
                  minWidth: '600px',
                  minHeight: '80%',
                },
              }),
  ...(paperOutlineColor
    ? {
        '& .MuiDialog-paper': {
          border: '1px solid',
          borderColor: paperOutlineColor,
        },
      }
    : {}),
  ...(bp === BigDialogBp.mobile && mobileThickScrollbar
    ? {
        '& .MuiDialogContent-root': {
          scrollbarColor: '#666 #d0d0d0',
          scrollbarWidth: 'auto',
          '&::-webkit-scrollbar': {
            width: '14px',
            height: '14px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#666',
            borderRadius: '8px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: '#d0d0d0',
          },
        },
      }
    : {}),
  ...(bp === BigDialogBp.mobile && mobileNoHorizontalScroll
    ? {
        '& .MuiDialogContent-root': {
          overflowX: 'hidden',
        },
      }
    : {}),
}));
// eslint-enable-block

interface IProps {
  title: string;
  description?: ReactElement | undefined;
  titleStartAdornment?: ReactElement;
  titleVariant?: TypographyProps['variant'];
  showTopCloseButton?: boolean;
  showBottomCloseButton?: boolean;
  bottomCloseLabel?: string;
  paperOutlineColor?: string;
  mobileThickScrollbar?: boolean;
  mobileNoHorizontalScroll?: boolean;
  children: React.JSX.Element;
  isOpen: boolean;
  onOpen: (isOpen: boolean) => void;
  onCancel?: (() => void) | undefined;
  onSave?: (() => void) | undefined;
  bp?: BigDialogBp | undefined;
  setCloseRequested?: ((close: boolean) => void) | undefined;
}

export function BigDialog({
  title,
  description,
  titleStartAdornment,
  titleVariant,
  showTopCloseButton = true,
  showBottomCloseButton = false,
  bottomCloseLabel,
  paperOutlineColor,
  mobileThickScrollbar = false,
  mobileNoHorizontalScroll = false,
  children,
  isOpen,
  onOpen,
  onCancel,
  onSave,
  bp,
  setCloseRequested,
}: IProps) {
  const [isExportBusy] = useGlobal('importexportBusy'); //verified this is not used in a function 2/18/25
  const [enableOffsite, setEnableOffsite] = useGlobal('enableOffsite');
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const { showMessage } = useSnackBar();
  const getGlobal = useGetGlobal();
  const handleClose = () => {
    if (getGlobal('importexportBusy')) {
      showMessage(ts.wait);
      return;
    }
    setCloseRequested && setCloseRequested(true);
    if (enableOffsite) setEnableOffsite(false);
    onOpen && onOpen(false);
    onCancel && onCancel();
  };

  return (
    <StyledDialog
      open={isOpen}
      onClose={handleClose}
      aria-labelledby="bigDlg"
      bp={bp ?? BigDialogBp.sm}
      paperOutlineColor={paperOutlineColor}
      mobileThickScrollbar={mobileThickScrollbar}
      mobileNoHorizontalScroll={mobileNoHorizontalScroll}
      disableEnforceFocus
    >
      <DialogTitle id="bigDlg">
        <Box sx={{ display: 'flex' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {titleStartAdornment}
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant={titleVariant}>{title}</Typography>
              {description}
            </Box>
          </Box>
          <GrowingSpacer />
          {showTopCloseButton && !isExportBusy ? (
            <IconButton id="bigClose" onClick={handleClose}>
              <CloseIcon />
            </IconButton>
          ) : (
            <div />
          )}
        </Box>
      </DialogTitle>
      <DialogContent>{children}</DialogContent>
      {(showBottomCloseButton || onCancel || onSave) && (
        <DialogActions sx={{ justifyContent: 'center'}}>
          {showBottomCloseButton && (
            <AltButton id="bigCloseBottom" dark elevated onClick={handleClose}
             sx={{ backgroundColor: 'black', color: 'white' }}>
              {bottomCloseLabel || ts.close}
            </AltButton>
          )}
          {onCancel && (
            <AltButton id="bigCancel" onClick={onCancel} sx={{ color: 'grey' }}>
              {ts.cancel}
            </AltButton>
          )}
          {onSave && <PriButton onClick={onSave}>{ts.save}</PriButton>}
        </DialogActions>
      )}
    </StyledDialog>
  );
}

export default BigDialog;
