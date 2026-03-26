import { Box, Button, SxProps, useTheme } from '@mui/material';
import { LightTooltip } from './LightTooltip';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import { Typography } from '@mui/material';
import { FaSquare, FaCircle } from 'react-icons/fa';
import type { IconBaseProps } from 'react-icons/lib';
import { shallowEqual, useSelector } from 'react-redux';
import { IRecordButtonStrings } from '@model/index';
import { recordButtonSelector } from '../selector';

const RecordSquare = FaSquare as unknown as React.FC<IconBaseProps>;
const WhiteCircle = FaCircle as unknown as React.FC<IconBaseProps>;

interface IRecordButtonProps {
  recording: boolean;
  oneTryOnly?: boolean;
  onClick: () => void;
  disabled: boolean;
  tooltipTitle?: string;
  isSmall?: boolean;
  showText?: boolean;
  hasRecording?: boolean;
  fullWidth?: boolean;
  sx?: SxProps;
  isStopLogic?: boolean;
  active?: boolean;
  isMobileView?: boolean;
}

export const RecordButton = ({
  recording,
  oneTryOnly,
  onClick,
  disabled,
  tooltipTitle,
  isSmall = false,
  showText = false,
  hasRecording = false,
  fullWidth = false,
  isStopLogic = false,
  active = true,
  sx,
  isMobileView,
}: IRecordButtonProps) => {
  const theme = useTheme();
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!disabled) onClick();
      return;
    }
    if (e.key === ' ') {
      // Avoid triggering record while the user is using shortcuts like Ctrl+Space.
      // This button may be keyboard-focused, so we must ignore modified Space.
      if (e.ctrlKey || e.altKey || e.shiftKey) return;
      e.preventDefault();
      if (!disabled) onClick();
    }
  };
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) {
      onClick();
    }
  };
  const redColor = '#d32f2f';
  const disabledColor = theme.palette.grey[300];
  const t: IRecordButtonStrings = useSelector(
    recordButtonSelector,
    shallowEqual
  );

  if (isMobileView){
    return(
      <>
        <Box
          onClick={handleClick}
          role="button"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          sx={{
            display: 'flex',
            cursor: 'pointer',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'black',
            borderRadius: '4px',
            padding: '4px',
            boxShadow: theme.shadows[2],
          }}
        >
          {recording ? (
            <>
              <StopIcon style={{ color: 'white', fontSize: isSmall ? '1.4em' : '1.4rem' }} />
              <Typography variant="caption" sx={{ mt: 0.5, textAlign: 'center', color: 'white', ml: 1 }}>
                {'STOP'}
              </Typography>
            </>
          ) : (
            <>
              <WhiteCircle style={{ color: redColor, fontSize: isSmall ? '1.2rem' : '1.4rem' }} />
              <Typography variant="caption" sx={{ mt: 0.5, textAlign: 'center', color: 'white', ml: 1 }}>
                {t.record}
              </Typography>
            </>
          )}
        </Box>
      </>
    )
  };

  if (showText) {
    if (recording) {
      return (
        <Box
          onClick={handleClick}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-label={disabled ? 'Disabled' : isStopLogic ? 'Stop' : 'Pause'}
          onKeyDown={handleKeyDown}
          sx={{
            width: fullWidth ? '100%' : undefined,
            height: isSmall ? 35 : 44,
            border: '1px solid',
            borderColor: theme.palette.grey[400],
            borderRadius: theme.shape.borderRadius,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'background.paper',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            ...sx,
          }}
        >
          <RecordSquare
            style={{
              color: redColor,
              fill: redColor,
              fontSize: isSmall ? '1rem' : '1.2rem',
            }}
          />
        </Box>
      );
    }
    return (
      <Button
        variant="outlined"
        color={recording ? 'error' : 'primary'}
        onClick={handleClick}
        disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        fullWidth={fullWidth}
        sx={{
          fontWeight: 700,
          color: !active
            ? theme.palette.grey[400]
            : hasRecording
              ? 'error.main'
              : 'text.primary',
          borderColor: theme.palette.grey[400],
          ...sx,
        }}
      >
        {hasRecording && isStopLogic
          ? t.rerecord
          : hasRecording
            ? t.resume
            : t.record}
      </Button>
    );
  }

  return (
    <LightTooltip id="wsAudioRecordTip" title={tooltipTitle ?? ''}>
      <Box
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{ backgroundColor: disabled ? disabledColor : redColor }}
        sx={(theme) => {
          return {
            px: isSmall ? 1 : undefined,
            py: isSmall ? 1 : undefined,
            minWidth: isSmall ? 48 : 60,
            height: isSmall ? 35 : 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${disabled ? disabledColor : redColor} !important`,
            color: 'white',
            border: 'none',
            borderRadius: isSmall ? theme.shape.borderRadius : '50%',
            cursor: disabled ? 'not-allowed' : 'pointer',
            boxShadow: theme.shadows[2],
            fontFamily: 'inherit',
            fontSize: 'inherit',
            outline: 'none',
            opacity: disabled ? 0.7 : 1,
            '& svg': {
              fontSize: isSmall ? '1.5rem' : '1.75rem',
              color: 'white',
              fill: 'white',
            },
            '&.MuiBox-root': {
              backgroundColor: `${active ? redColor : disabledColor} !important`,
            },
          };
        }}
      >
        {recording ? (
          oneTryOnly ? (
            <RecordSquare />
          ) : isStopLogic ? (
            <StopIcon />
          ) : (
            <PauseIcon />
          )
        ) : (
          <WhiteCircle style={{ fontSize: isSmall ? '1.2rem' : '1.4rem' }} />
        )}
      </Box>
    </LightTooltip>
  );
};
