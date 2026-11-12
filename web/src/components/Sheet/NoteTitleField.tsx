import { NoteIcon } from '../../control/PlanIcons';
import { useGlobal } from '../../context/useGlobal';
import { PassagePlayButton } from './PassagePlayButton';

export function NoteTitleField({
  value,
  mediaId,
  disabled = false,
}: Readonly<{ value: string; mediaId?: string; disabled?: boolean }>) {
  const [playingMediaId] = useGlobal('playingMediaId');
  const playDisabled = disabled || Boolean(playingMediaId);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
      }}
    >
      {mediaId ? (
        <span
          style={{ display: 'inline-flex', marginInlineEnd: 8 }}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <PassagePlayButton
            mediaId={mediaId}
            ring="playing"
            disabled={playDisabled}
          />
        </span>
      ) : null}
      {NoteIcon}
      {'\u00A0'}
      {value}
    </span>
  );
}
