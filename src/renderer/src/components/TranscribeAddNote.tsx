import { useState, useEffect } from 'react';
import {
  PassageD,
  ITranscribeAddNoteStrings,
  PassageStateChangeD,
} from '../model';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { transcribeAddNoteSelector } from '../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { commentProps } from '../control';

interface IProps {
  passageIn?: PassageD | undefined;
  pscIn?: PassageStateChangeD | undefined;
  visible: boolean;
  addMethod?: ((passageRec: PassageD) => void) | undefined;
  editMethod?: ((psc: PassageStateChangeD) => void) | undefined;
  cancelMethod?: (() => void) | undefined;
}

function TranscribeAddNote(props: IProps) {
  const { visible, addMethod, editMethod, cancelMethod, passageIn, pscIn } =
    props;
  const [open, setOpen] = useState(visible);
  const [comment, setComment] = useState('');
  const [inProcess, setInProcess] = useState(false);
  const t: ITranscribeAddNoteStrings = useSelector(
    transcribeAddNoteSelector,
    shallowEqual
  );

  const handleSave = () => {
    doAddOrSave();
  };
  const handleCommentChange = (e: any) => setComment(e.target.value);
  const doAddOrSave = async () => {
    setInProcess(true);

    if (pscIn) {
      // eslint-disable-next-line react-hooks/immutability
      pscIn.attributes.comments = comment;
      if (editMethod) editMethod(pscIn);
    } else if (comment !== '') {
      const passage = {
        ...passageIn,
        attributes: {
          ...passageIn?.attributes,
          lastComment: comment,
        },
      } as PassageD;
      if (addMethod) {
        addMethod(passage);
      }
    }

    setOpen(false);
    setInProcess(false);
  };
  const handleCancel = () => {
    setComment('');
    if (cancelMethod) {
      cancelMethod();
    }
    setOpen(false);
  };

  useEffect(() => {
    setOpen(visible);
    setComment(pscIn?.attributes.comments || '');
  }, [visible, pscIn]);

  return (
    <div>
      <Dialog
        open={open}
        onClose={handleCancel}
        aria-labelledby="transAddDlg"
        disableEnforceFocus
      >
        <DialogTitle id="transAddDlg">{t.addNoteTitle}</DialogTitle>
        <DialogContent>
          <TextField
            id="transcriberNote.text"
            variant="filled"
            multiline
            maxRows={5}
            value={comment}
            onChange={handleCommentChange}
            sx={commentProps}
          />
        </DialogContent>
        <DialogActions>
          <Button
            id="transcriberNote.cancel"
            onClick={handleCancel}
            variant="outlined"
            color="primary"
          >
            {t.cancel}
          </Button>
          <Button
            id="transcriberNote.save"
            onClick={handleSave}
            variant="contained"
            color="primary"
            disabled={comment === '' || inProcess}
          >
            {t.save}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default TranscribeAddNote;
