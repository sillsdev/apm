import { Stack, SxProps } from '@mui/material';
import { ReferenceTextPlayButton } from './ReferenceTextPlayButton';
import { ViewButton } from './ViewButton';
import { ReferenceTextItemProps } from './referenceTextItem';

type IProps = Pick<
  ReferenceTextItemProps,
  'rank' | 'speaking' | 'progress' | 'onPlay' | 'onView'
> & { sx?: SxProps };

/** The Play and View buttons of a Reference Text, in the desktop row and the mobile card. */
export function ReferenceTextActions({
  rank,
  speaking,
  progress,
  onPlay,
  onView,
  sx,
}: Readonly<IProps>) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', ...sx }}>
      <ReferenceTextPlayButton
        speaking={speaking}
        progress={progress}
        onClick={() => onPlay(rank)}
      />
      <ViewButton id={rank} cb={() => onView(rank)} />
    </Stack>
  );
}

export default ReferenceTextActions;
