import { Box, IconButton, ListItem, Tooltip, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import AddIcon from '@mui/icons-material/Add';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CloseIcon from '@mui/icons-material/Close';
import type { ReactElement } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { mediaActionsSelector, ttsVoicesSelector } from '../../../selector';
import { IMediaActionsStrings, ITtsVoicesStrings } from '../../../model';
import {
  voiceProvider,
  type VoiceRow,
} from '../../../business/referenceText/voiceGroups';

export interface VoiceRowItemProps {
  row: VoiceRow;
  /** How many voices are ranked in this row's language. */
  rankedCount: number;
  reading: boolean;
  /** No sample text to read. */
  noSample: boolean;
  onRead: () => void;
  onRank: () => void;
  onUnrank: () => void;
  onMove: (delta: -1 | 1) => void;
}

interface ActionProps {
  title: string;
  disabled?: boolean;
  onClick: () => void;
  icon: ReactElement;
}

function Action(props: ActionProps) {
  const { title, disabled, onClick, icon } = props;
  return (
    <Tooltip title={title}>
      {/* span keeps the tooltip on a disabled button */}
      <span>
        <IconButton
          size="small"
          aria-label={title}
          disabled={disabled}
          onClick={onClick}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
}

/** One voice: its rank, name, region and source, a Read button, and ranking buttons. */
export function VoiceRowItem(props: VoiceRowItemProps) {
  const {
    row,
    rankedCount,
    reading,
    noSample,
    onRead,
    onRank,
    onUnrank,
    onMove,
  } = props;
  const t: ITtsVoicesStrings = useSelector(ttsVoicesSelector, shallowEqual);
  const tm: IMediaActionsStrings = useSelector(
    mediaActionsSelector,
    shallowEqual
  );
  const { voice, device, rank } = row;
  const provider = voiceProvider(voice);
  const source = voice.localService
    ? t.local
    : [t.online, provider].filter(Boolean).join(' · ');

  return (
    <ListItem divider sx={{ gap: 1, px: 0 }}>
      <Typography sx={{ minWidth: '2ch', textAlign: 'end' }} fontWeight="bold">
        {rank}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap>{voice.name}</Typography>
        <Typography variant="caption" color="text.secondary">
          {[voice.lang, source, !device && t.notOnDevice]
            .filter(Boolean)
            .join(' · ')}
        </Typography>
      </Box>
      <Action
        title={reading ? tm.stop : t.read}
        disabled={!device || (noSample && !reading)}
        onClick={onRead}
        icon={reading ? <StopIcon /> : <PlayArrowIcon />}
      />
      {rank === undefined ? (
        <Action title={t.add} onClick={onRank} icon={<AddIcon />} />
      ) : (
        <>
          <Action
            title={t.moveUp}
            disabled={rank === 1}
            onClick={() => onMove(-1)}
            icon={<ArrowUpwardIcon />}
          />
          <Action
            title={t.moveDown}
            disabled={rank === rankedCount}
            onClick={() => onMove(1)}
            icon={<ArrowDownwardIcon />}
          />
          <Action title={t.remove} onClick={onUnrank} icon={<CloseIcon />} />
        </>
      )}
    </ListItem>
  );
}
