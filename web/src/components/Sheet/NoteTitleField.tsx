import type { CSSProperties, SyntheticEvent } from 'react';
import { IconButton } from '@mui/material';
import { Pause, PlayArrow } from '@mui/icons-material';
import { useSelector, shallowEqual } from 'react-redux';
import { IMediaTitleStrings, IScriptureTableStrings } from '@model/index';
import { NoteIcon } from '../../control/PlanIcons';
import { mediaTitleSelector, scriptureTableSelector } from '../../selector';
import { usePassagePlayback } from './usePassagePlayback';

// Chromium only spellchecks an editable input, which is what the desktop
// dictionary menu reads. The note title is not edited in the sheet, so the
// input rejects every change and is drawn as cell text.
const noteTitleStyle: CSSProperties = {
  border: 'none',
  padding: 0,
  margin: 0,
  background: 'transparent',
  outline: 'none',
  boxShadow: 'none',
  appearance: 'none',
  display: 'inline-block',
  boxSizing: 'border-box',
  font: 'inherit',
  color: 'inherit',
  lineHeight: 'inherit',
  verticalAlign: 'baseline',
  caretColor: 'transparent',
  cursor: 'inherit',
  fieldSizing: 'content',
};

function NoteTitlePlay({ mediaId }: Readonly<{ mediaId: string }>) {
  const { playing, toggle, audio } = usePassagePlayback(mediaId);
  const t: IMediaTitleStrings = useSelector(mediaTitleSelector, shallowEqual);
  return (
    <>
      <IconButton
        size="small"
        aria-label={t.playPause}
        title={t.playPause}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          toggle();
        }}
        sx={{ p: 0, width: 16, height: 16, mr: '2px' }}
      >
        {playing ? (
          <Pause sx={{ fontSize: 16 }} />
        ) : (
          <PlayArrow sx={{ fontSize: 16 }} />
        )}
      </IconButton>
      {audio}
    </>
  );
}

export function NoteTitleField({
  value,
  mediaId,
}: Readonly<{ value: string; mediaId?: string }>) {
  const t: IScriptureTableStrings = useSelector(
    scriptureTableSelector,
    shallowEqual
  );
  const rejectEdit = (event: SyntheticEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.currentTarget.value = value;
  };
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      {mediaId ? <NoteTitlePlay mediaId={mediaId} /> : null}
      {NoteIcon}
      {'\u00A0'}
      <input
        value={value}
        size={Math.max(value.length, 1)}
        aria-label={t.title}
        aria-readonly="true"
        spellCheck
        tabIndex={-1}
        style={noteTitleStyle}
        onBeforeInput={rejectEdit}
        onChange={rejectEdit}
      />
    </span>
  );
}
