import { type GridRenderCellParams } from '@mui/x-data-grid';
import { IconButton, Box, SxProps } from '@mui/material';
import PlayIcon from '@mui/icons-material/PlayArrowOutlined';
import { FaPaperclip, FaUnlink } from 'react-icons/fa';
import type { IconBaseProps } from 'react-icons/lib';
import PauseIcon from '@mui/icons-material/Pause';
import { shallowEqual, useSelector } from 'react-redux';
import { IMediaActionsStrings } from '../../model';
import { IRow } from '.';
import { isElectron } from '../../../api-variable';
import { mediaActionsSelector } from '../../selector';

const Paperclip = FaPaperclip as unknown as React.FC<IconBaseProps>;
const Unlink = FaUnlink as unknown as React.FC<IconBaseProps>;

const actionProps = { color: 'primary.light' } as SxProps;

interface IProps {
  canCreate: boolean;
  onAttach?: (checks: number[], attach: boolean) => void;
  readonly: boolean;
  handleSelect: (id: string) => void;
  playItem: string;
  mediaPlaying: boolean;
}

export default function PlayCell(params: GridRenderCellParams<IRow> & IProps) {
  const {
    canCreate,
    onAttach,
    readonly: readonlyParams,
    handleSelect: onPlayStatus,
    playItem,
    mediaPlaying,
  } = params;
  const readonly = onAttach ? readonlyParams : true;
  const attached = Boolean(params.row.passId);
  const isPlaying = playItem === params.row.id && mediaPlaying;
  const t: IMediaActionsStrings = useSelector(
    mediaActionsSelector,
    shallowEqual
  );

  const handlePlayStatus = () => {
    onPlayStatus(params.row.id);
  };

  const handleAttach = () => {
    onAttach && onAttach([params.row.index], !attached);
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      {!readonly && (
        <IconButton
          id="audActAttach"
          sx={actionProps}
          title={!attached ? t.attach : t.detach}
          onClick={handleAttach}
        >
          {!attached ? (
            <Paperclip fontSize="16px" />
          ) : (
            <Unlink fontSize="16px" />
          )}
        </IconButton>
      )}
      {(isElectron || canCreate) && (
        <IconButton
          id="audActPlayStop"
          sx={actionProps}
          title={isPlaying ? t.pause : t.play}
          disabled={(params.row.id || '') === ''}
          onClick={handlePlayStatus}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </IconButton>
      )}
    </Box>
  );
}
