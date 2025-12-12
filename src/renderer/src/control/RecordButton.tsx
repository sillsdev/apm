import { Box } from '@mui/material';
import { LightTooltip } from './LightTooltip';
import PauseIcon from '@mui/icons-material/Pause';
import { FaSquare, FaCircle } from 'react-icons/fa';
import type { IconBaseProps } from 'react-icons/lib';

const RecordSquare = FaSquare as unknown as React.FC<IconBaseProps>;
const WhiteCircle = FaCircle as unknown as React.FC<IconBaseProps>;

interface IRecordButtonProps {
  recording: boolean;
  oneTryOnly?: boolean;
  onClick: () => void;
  disabled: boolean;
  tooltipTitle: string;
  isSmall?: boolean;
}

export const RecordButton = ({
  recording,
  oneTryOnly,
  onClick,
  disabled,
  tooltipTitle,
  isSmall = false,
}: IRecordButtonProps) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!disabled) {
        onClick();
      }
    }
  };
  const redColor = '#d32f2f';

  return (
    <LightTooltip id="wsAudioRecordTip" title={tooltipTitle}>
      <Box
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{
          backgroundColor: redColor,
        }}
        sx={(theme) => {
          return {
            px: isSmall ? 1 : undefined,
            py: isSmall ? 1 : undefined,
            minWidth: isSmall ? 48 : 80,
            height: isSmall ? 48 : 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: redColor,
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
              fontSize: isSmall ? '1.5rem' : '2rem',
              color: 'white',
            },
          };
        }}
      >
        {recording ? (
          oneTryOnly ? (
            <RecordSquare />
          ) : (
            <PauseIcon />
          )
        ) : (
          <WhiteCircle />
        )}
      </Box>
    </LightTooltip>
  );
};
