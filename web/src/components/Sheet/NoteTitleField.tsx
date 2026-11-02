import { NoteIcon } from '../../control/PlanIcons';
import { PassagePlayButton } from './PassagePlayButton';

export function NoteTitleField({
  value,
  mediaId,
}: Readonly<{ value: string; mediaId?: string }>) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
      }}
    >
      {mediaId ? (
        <span style={{ display: 'inline-flex', marginInlineEnd: 8 }}>
          <PassagePlayButton mediaId={mediaId} ring="playing" />
        </span>
      ) : null}
      {NoteIcon}
      {'\u00A0'}
      {value}
    </span>
  );
}
