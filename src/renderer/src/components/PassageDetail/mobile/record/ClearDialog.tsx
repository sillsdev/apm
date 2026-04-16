import { Button, Dialog, Stack, Typography } from '@mui/material';
import {
  IMediaActionsStrings,
  ISharedStrings,
} from '../../../../store/localization/model';
import { shallowEqual, useSelector } from 'react-redux';
import {
  sharedSelector,
  mediaActionsSelector,
} from '../../../../selector/selectors';

interface IProps {
  handleCancel: () => void;
  handleDelete: () => void;
}

export const ClearDialog = (props: IProps) => {
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const tsm: IMediaActionsStrings = useSelector(
    mediaActionsSelector,
    shallowEqual
  );
  return (
    <Dialog open={true} onClose={props.handleCancel} data-cy="delete-dialog">
      <Stack direction="column" sx={{ p: 2, gap: 2 }}>
        <Stack
          direction="column"
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 'bold', fontSize: '20px' }}
          >
            {ts.resetRecording}
          </Typography>
          <Typography variant="body1">{ts.discardRecording}</Typography>
        </Stack>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            px: 1,
            flex: 1,
            minWidth: 0,
          }}
        >
          <Button
            onClick={props.handleCancel}
            data-cy="delete-dialog-cancel"
            sx={(theme) => ({
              backgroundColor: 'white',
              border: '1px solid gray',
              borderRadius: '4px',
              padding: '4px',
              boxShadow: theme.shadows[2],
              color: 'black',
            })}
          >
            {ts.cancel}
          </Button>
          <Button
            onClick={props.handleDelete}
            data-cy="delete-dialog-delete"
            sx={(theme) => ({
              backgroundColor: 'white',
              borderRadius: '4px',
              border: '1px solid gray',
              padding: '4px',
              boxShadow: theme.shadows[2],
              color: 'black',
            })}
          >
            {tsm.delete}
          </Button>
        </Stack>
      </Stack>
    </Dialog>
  );
};

export default ClearDialog;
