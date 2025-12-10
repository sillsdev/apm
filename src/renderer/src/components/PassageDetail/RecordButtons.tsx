import { ButtonGroup, ButtonGroupProps, styled } from '@mui/material';
import AddIcon from '@mui/icons-material/LibraryAddOutlined';
import VersionsIcon from '@mui/icons-material/List';
import { AltButton, AudacityLogo } from '../../control';
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
}

export const RecordButtons = ({ onVersions, onUpload, onAudacity }: IProps) => {
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);

  const IconSize = { width: '14px', height: '14px' };

  return (
    <StyledButtonGroup size="small" sx={{ my: 1 }}>
      {onVersions && (
        <AltButton
          id="pdRecordVersions"
          onClick={onVersions}
          title={ts.versionHistory}
          startIcon={<VersionsIcon sx={IconSize} />}
        >
          {ts.versionHistory}
        </AltButton>
      )}
      <AltButton
        id="pdRecordUpload"
        onClick={onUpload}
        title={ts.uploadMediaSingular}
        startIcon={<AddIcon sx={IconSize} />}
        disabled={!onUpload}
      >
        {ts.uploadMediaSingular}
      </AltButton>
      {onAudacity && (
        <AltButton
          id="pdAudacity"
          onClick={onAudacity}
          title={ts.launchAudacity}
          startIcon={<AudacityLogo sx={IconSize} />}
        >
          {ts.launchAudacity}
        </AltButton>
      )}
    </StyledButtonGroup>
  );
};
