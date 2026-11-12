import { ButtonGroup, ButtonGroupProps, styled } from '@mui/material';
import AddIcon from '@mui/icons-material/LibraryAddOutlined';
import VersionsIcon from '@mui/icons-material/List';
import { Button, AudacityLogo } from '../../control';
import { shallowEqual, useSelector } from 'react-redux';
import { sharedSelector } from '../../selector';
import { ISharedStrings } from '../../model';

const StyledButtonGroup = styled(ButtonGroup)<ButtonGroupProps>(() => ({
  '& button': {
    margin: 0,
  },
}));

interface IProps {
  onVersions?: () => void;
  onUpload?: () => void;
  onAudacity?: () => void;
  /** When false, hide the version history button (e.g. mobile passage record). */
  showVersions?: boolean;
  /** When false, hide the upload button (e.g. upload is inline with speaker on mobile). */
  showUpload?: boolean;
}

export const RecordButtons = ({
  onVersions,
  onUpload,
  onAudacity,
  showVersions = true,
  showUpload = true,
}: IProps) => {
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);

  const IconSize = { width: '14px', height: '14px' };

  return (
    <StyledButtonGroup sx={{ my: 1 }}>
      {showVersions && onVersions && (
        <Button
          id="pdRecordVersions"
          title={ts.versionHistory}
          startIcon={<VersionsIcon sx={IconSize} />}
          onClick={onVersions}
        >
          {ts.versionHistory}
        </Button>
      )}
      {showUpload && (
        <Button
          id="pdRecordUpload"
          title={ts.uploadMediaSingular}
          startIcon={<AddIcon sx={IconSize} />}
          disabled={!onUpload}
          onClick={onUpload}
        >
          {ts.uploadMediaSingular}
        </Button>
      )}
      {onAudacity && (
        <Button
          id="pdAudacity"
          title={ts.launchAudacity}
          startIcon={<AudacityLogo sx={IconSize} />}
          onClick={onAudacity}
        >
          {ts.launchAudacity}
        </Button>
      )}
    </StyledButtonGroup>
  );
};
