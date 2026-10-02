import { Chip, IconButton, Tooltip } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { keyTermsSelector } from '../../../selector';
import { IKeyTermsStrings } from '../../../model';
import PlayIcon from '@mui/icons-material/PlayArrow';

interface IProps {
  label: string;
  Player?: React.ReactElement;
  onPlay?: () => void;
  onClick?: () => void;
  onDelete?: () => void;
}
export const KeyTermChip = ({
  label,
  Player,
  onPlay,
  onClick,
  onDelete,
}: IProps) => {
  const t: IKeyTermsStrings = useSelector(keyTermsSelector, shallowEqual);

  return (
    <Chip
      icon={
        <Tooltip title={t.play}>
          {!onPlay ? (
            <></>
          ) : !Player ? (
            <IconButton onClick={onPlay}>
              <PlayIcon fontSize="small" />
            </IconButton>
          ) : (
            Player
          )}
        </Tooltip>
      }
      label={label}
      onClick={onClick}
      onDelete={onDelete}
      size="small"
      sx={{ mr: 1, mb: 1, width: 'fit-content' }}
    />
  );
};

export default KeyTermChip;
