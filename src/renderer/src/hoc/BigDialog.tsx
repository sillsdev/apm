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
  SxProps,
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
  /** When `bp` is mobile, CSS value for both paper `maxWidth` and `width` (e.g. min(356px, calc(100vw - 4px))). */
  mobilePaperWidth?: string;
}
// eslint-disable-block TS2783
export const StyledDialog = styled(Dialog, {
  shouldForwardProp: (prop) =>
    prop !== 'bp' &&
    prop !== 'paperOutlineColor' &&
    prop !== 'mobileThickScrollbar' &&
    prop !== 'mobileNoHorizontalScroll' &&
    prop !== 'mobilePaperWidth',
})<StyledDialogProps>(
  ({
    bp,
    paperOutlineColor,
    mobileThickScrollbar,
    mobileNoHorizontalScroll,
    mobilePaperWidth,
    theme,
  }) => ({
    '& .MuiTable-root': {
      tableLayout: 'auto',
      paddingRight: theme.spacing(1),
    },
    '& .MuiDialogTitle-root': {
      paddingBottom: 0,
      ...(mobilePaperWidth && bp === BigDialogBp.mobile
        ? { flexShrink: 0 }
        : {}),
    },
    '& #bigClose': { alignSelf: 'flex-start' },
    ...(bp === BigDialogBp.mobile
      ? {
          '& .MuiDialog-paper': {
            ...(mobilePaperWidth
              ? {
                  maxWidth: mobilePaperWidth,
                  width: mobilePaperWidth,
                  // MUI paper defaults to 32px horizontal margin, which caps width at
                  // 100vw - 64px (e.g. 296px on a 360px viewport) regardless of maxWidth.
                  margin: `${theme.spacing(2)} 2px`,
                  display: 'flex',
                  flexDirection: 'column',
                  // Account for vertical margin so paper never exceeds viewport height.
                  maxHeight: `calc(100dvh - ${theme.spacing(4)})`,
                }
              : {
                  maxWidth: `calc(100vw - ${theme.spacing(4)})`,
                  width: '100%',
                }),
            minWidth: 0,
            minHeight: mobilePaperWidth
              ? 'min(92dvh, calc(100dvh - 24px))'
              : '50%',
            boxSizing: 'border-box',
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
  })
);
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
  mobilePaperWidth?: string;
  dialogContentSx?: SxProps;
  children: React.JSX.Element;
  isOpen: boolean;
  onOpen: (isOpen: boolean) => void;
  onCancel?: (() => void) | undefined;
  onSave?: (() => void) | undefined;
  bp?: BigDialogBp | undefined;
  setCloseRequested?: ((close: boolean) => void) | undefined;
  /** When true, clicking the backdrop does not close the dialog. */
  disableBackdropClose?: boolean | undefined;
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
  mobilePaperWidth,
  dialogContentSx,
  children,
  isOpen,
  onOpen,
  onCancel,
  onSave,
  bp,
  setCloseRequested,
  disableBackdropClose,
}: IProps) {
  const [isExportBusy] = useGlobal('importexportBusy'); //verified this is not used in a function 2/18/25
  const [enableOffsite, setEnableOffsite] = useGlobal('enableOffsite');
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const { showMessage } = useSnackBar();
  const getGlobal = useGetGlobal();
  const handleClose = (
    _event?: object,
    reason?: 'backdropClick' | 'escapeKeyDown'
  ) => {
    if (disableBackdropClose && reason === 'backdropClick') {
      return;
    }
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
      mobilePaperWidth={mobilePaperWidth}
      disableEnforceFocus
    >
      <DialogTitle id="bigDlg">
        <Box sx={{ display: 'flex', minWidth: 0 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              minWidth: 0,
              flex: 1,
            }}
          >
            {titleStartAdornment}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                flex: 1,
              }}
            >
              <Typography
                variant={titleVariant ?? 'h6'}
                title={title}
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {title}
              </Typography>
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
      <DialogContent sx={dialogContentSx}>{children}</DialogContent>
      {(showBottomCloseButton || onCancel || onSave) && (
        <DialogActions sx={{ justifyContent: 'center' }}>
          {showBottomCloseButton && (
            <AltButton id="bigCloseBottom" onClick={handleClose}>
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
