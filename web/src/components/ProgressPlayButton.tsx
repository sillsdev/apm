import Box, { type BoxProps } from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Fab from '@mui/material/Fab';
import { FaPlay, FaPause, FaStop } from 'react-icons/fa';
import { styled, SxProps, Tooltip, useTheme } from '@mui/material';
import { PLAY_BUTTON_BG } from '../theme';

// see: https://mui.com/material-ui/customization/how-to-customize/
interface StyledBoxProps extends BoxProps {
  size?: number;
}
const StyledBox = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'size' && prop !== 'bgColor',
})<StyledBoxProps>(({ size }) => ({
  '& .MuiFab-root': {
    width: size ? `${size}px!important` : '30px',
    height: size ? `${size}px!important` : '30px',
    minHeight: size ? `${size}px!important` : '30px',
  },
}));

export interface ProgressPlayButtonProps {
  playing: boolean;
  /** Percent played, 0–100; the ring is hidden at 0. */
  progress: number;
  onClick: () => void;
  title: string;
  ariaLabel: string;
  /** What the button does while playing: pause, or stop and start over. */
  playingIcon?: 'pause' | 'stop';
  size?: number;
  bgColor?: string;
  sx?: SxProps;
}

/** A round play button ringed by how much has played. */
export default function ProgressPlayButton({
  playing,
  progress,
  onClick,
  title,
  ariaLabel,
  playingIcon = 'pause',
  size = 20,
  bgColor = PLAY_BUTTON_BG,
  sx,
}: Readonly<ProgressPlayButtonProps>) {
  const theme = useTheme();
  const color = theme.palette.getContrastText(bgColor);
  const PlayingIcon = playingIcon === 'stop' ? FaStop : FaPause;

  return (
    <StyledBox sx={{ m: 1, position: 'relative', ...sx }} size={size}>
      <Tooltip title={title}>
        <Fab
          aria-label={ariaLabel}
          sx={{ backgroundColor: bgColor, color: color }}
          onClick={onClick}
        >
          {playing ? (
            <PlayingIcon size={size / 2} />
          ) : (
            <FaPlay size={size / 2} />
          )}
        </Fab>
      </Tooltip>
      {Math.round(progress) !== 0 && (
        <CircularProgress
          variant="determinate"
          value={progress}
          size={size + 8}
          sx={{
            color: 'primary.main',
            position: 'absolute',
            top: -2,
            left: -4,
            zIndex: 1,
          }}
        />
      )}
    </StyledBox>
  );
}
