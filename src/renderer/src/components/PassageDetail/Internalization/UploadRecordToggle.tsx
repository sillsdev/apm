import { alpha, Box, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { IPassageDetailArtifactsStrings } from '../../../model';
import { resourceSelector } from '../../../selector';

export type AudioAddMode = 'upload' | 'record';

interface IProps {
  mode: AudioAddMode;
  onMode: (mode: AudioAddMode) => void;
  disableUpload?: boolean | undefined;
}

// Upload | Record toggle shown at the top of the "Add Audio Resource" dialog.
// PassageRecordDlg owns the selected mode and swaps the dialog body.
export function UploadRecordToggle({
  mode,
  onMode,
  disableUpload = false,
}: IProps) {
  const t: IPassageDetailArtifactsStrings = useSelector(
    resourceSelector,
    shallowEqual
  );
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        flexShrink: 0,
        px: 3,
        py: 1,
      }}
    >
      <ToggleButtonGroup
        exclusive
        size="small"
        value={mode}
        onChange={(_e, val) => {
          if (val) onMode(val as AudioAddMode);
        }}
        aria-label="upload or record"
        sx={(theme) => ({
          '& .MuiToggleButton-root': {
            px: 4,
            textTransform: 'none',
            color: theme.palette.text.primary,
          },
          '& .MuiToggleButton-root.Mui-selected': {
            color: theme.palette.text.primary,
            backgroundColor: alpha(theme.palette.primary.main, 0.22),
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.3),
            },
          },
        })}
      >
        <ToggleButton id="tab-upload" value="upload" disabled={disableUpload}>
          {t.uploadTab}
        </ToggleButton>
        <ToggleButton id="tab-record" value="record">
          {t.recordResource}
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}

export default UploadRecordToggle;
