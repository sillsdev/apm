import { FormControlLabel, TextField, SxProps, Theme } from '@mui/material';
import BigDialog from '../../hoc/BigDialog';
import { BigDialogBp } from '../../hoc/BigDialogBp';

interface IProps {
  isOpen: boolean;
  onOpen: () => void;
  onSave: (() => void) | undefined;
  onCancel: () => void;
  title: string;
  creatorEmail: string;
  bp: BigDialogBp;
  email: string;
  onEmailChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  validEmail: boolean;
  contentStatus: string;
  textFieldSx?: SxProps<Theme>;
}

export const SharedContentCreatorDialog = ({
  isOpen,
  onOpen,
  onSave,
  onCancel,
  title,
  creatorEmail,
  bp,
  email,
  onEmailChange,
  contentStatus,
  textFieldSx,
}: IProps) => (
  <BigDialog
    isOpen={isOpen}
    onOpen={onOpen}
    onSave={onSave}
    onCancel={onCancel}
    title={title}
    bp={bp}
  >
    <FormControlLabel
      control={
        <TextField
          id="email"
          label={creatorEmail}
          value={email}
          onChange={onEmailChange}
          margin="normal"
          required
          variant="filled"
          sx={textFieldSx}
          fullWidth
        />
      }
      label={contentStatus}
      labelPlacement="bottom"
    />
  </BigDialog>
);
