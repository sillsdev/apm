import React from 'react';
import { useSelector } from 'react-redux';
import { IconButton, IconButtonProps, styled } from '@mui/material';
import DownloadIcon from '@mui/icons-material/GetAppOutlined';
import { IAudioDownloadStrings } from '../model';
import { audioDownloadSelector } from '../selector';
import { useAudioDownload, type AudioDownloadApi } from './useAudioDownload';

const StyledIcon = styled(IconButton)<IconButtonProps>(({ theme }) => ({
  color: theme.palette.primary.light,
}));

interface IProps {
  title?: string;
  mediaId: string;
  menuItem?: boolean;
}

export type { AudioDownloadApi };

export function AudioDownloadView(
  props: IProps & AudioDownloadApi
): React.ReactElement {
  const { title, menuItem, startDownload, isDisabled, hiddenAnchor } = props;
  const t: IAudioDownloadStrings = useSelector(audioDownloadSelector);

  if (menuItem) {
    return (
      <>
        <StyledIcon
          id="audDownload"
          title={title || t.downloadMedia}
          disabled={isDisabled}
          onClick={startDownload}
          sx={{ p: 0, flexShrink: 0 }}
        >
          <DownloadIcon fontSize="small" />
        </StyledIcon>
        {hiddenAnchor}
      </>
    );
  }

  return (
    <div>
      <StyledIcon
        id="audDownload"
        title={title || t.downloadMedia}
        disabled={isDisabled}
        onClick={startDownload}
      >
        <DownloadIcon />
      </StyledIcon>
      {hiddenAnchor}
    </div>
  );
}

export const AudioDownload = (props: IProps): React.ReactElement => {
  const api = useAudioDownload(props.mediaId);
  return <AudioDownloadView {...props} {...api} />;
};

AudioDownload.displayName = 'AudioDownload';

export default AudioDownload;
