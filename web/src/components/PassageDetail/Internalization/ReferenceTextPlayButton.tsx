import { shallowEqual, useSelector } from 'react-redux';
import { IMediaActionsStrings } from '../../../model';
import { mediaActionsSelector } from '../../../selector';
import ProgressPlayButton from '../../ProgressPlayButton';

interface IProps {
  speaking: boolean;
  progress: number;
  onClick: () => void;
}

/**
 * Speaks a Reference Text, ringed by how much has been spoken. Speech can't
 * be resumed, so while speaking it offers Stop rather than Pause.
 */
export function ReferenceTextPlayButton({
  speaking,
  progress,
  onClick,
}: Readonly<IProps>) {
  const t: IMediaActionsStrings = useSelector(
    mediaActionsSelector,
    shallowEqual
  );
  const label = speaking ? t.stop : t.play;

  return (
    <ProgressPlayButton
      playing={speaking}
      progress={progress}
      onClick={onClick}
      title={label}
      ariaLabel={label}
      playingIcon="stop"
      size={28}
      // 28px plus margins fills the same 40px as the View IconButton
      sx={{ m: 0.75 }}
    />
  );
}

export default ReferenceTextPlayButton;
