import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  useTheme,
} from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { IPassageDetailArtifactsStrings, ISharedStrings } from '../../../model';
import {
  passageDetailArtifactsSelector,
  sharedSelector,
} from '../../../selector';
import { useMobile } from '../../../utils/useMobile';
import { Button } from '../../../control/Button';

interface IProps {
  /** File name of the general resource's source media. */
  fileName: string;
  /** How many passage/section resources it was split into. */
  count: number;
  onCancel: () => void;
  onDeleteAll: () => void;
  onDeleteOne: () => void;
}

/**
 * Asks whether deleting a general-resource row should remove the whole general
 * resource (source media and every derived copy) or just this one copy.
 */
export function GeneralResourceDeleteDialog(props: IProps) {
  const { fileName, count, onCancel, onDeleteAll, onDeleteOne } = props;
  const t: IPassageDetailArtifactsStrings = useSelector(
    passageDetailArtifactsSelector,
    shallowEqual
  );
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const { isMobile } = useMobile();
  const theme = useTheme();

  return (
    <Dialog
      open
      onClose={onCancel}
      aria-labelledby="generalResDeleteTitle"
      aria-describedby="generalResDeleteDesc"
      disableEnforceFocus
      sx={
        isMobile
          ? {
              '& .MuiDialog-paper': {
                maxWidth: `calc(100vw - ${theme.spacing(4)})`,
                width: '100%',
                minWidth: 0,
                boxSizing: 'border-box',
              },
            }
          : undefined
      }
    >
      <DialogTitle id="generalResDeleteTitle">
        {t.confirmDeleteTitle}
      </DialogTitle>
      <DialogContent>
        <DialogContentText
          id="generalResDeleteDesc"
          sx={{ color: 'text.primary' }}
        >
          {t.deleteGeneralResource}
        </DialogContentText>
        <DialogContentText sx={{ fontStyle: 'italic', mt: 1 }}>
          {t.generalResourceSplit
            .replace('{0}', fileName)
            .replace('{1}', count.toString())}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', rowGap: 1 }}>
        <Button
          id="generalResDeleteCancel"
          variant="contained"
          color="primary"
          onClick={onCancel}
        >
          {ts.cancel}
        </Button>
        <Button
          id="generalResDeleteAll"
          variant="outlined"
          onClick={onDeleteAll}
        >
          {t.deleteAll.replace('{0}', count.toString())}
        </Button>
        <Button
          id="generalResDeleteOne"
          variant="outlined"
          onClick={onDeleteOne}
        >
          {t.deleteJustThisOne}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default GeneralResourceDeleteDialog;
