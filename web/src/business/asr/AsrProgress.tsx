import * as React from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import { Stack, Typography } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { Button, ActionRow } from '../../control';
import {
  ICardsStrings,
  ISharedStrings,
  ITranscriberStrings,
  MediaFileD,
} from '../../model';
import {
  cardsSelector,
  sharedSelector,
  transcriberSelector,
} from '../../selector';
import { useOrbitData } from '../../hoc/useOrbitData';
import { useGetAsrSettings } from '../../crud/useGetAsrSettings';
import { estimateAiSeconds } from '../../control/estimateAiTime';
import AiTimeProgress from '../../components/AiTimeProgress';
import { aeroErrorMessage } from './aeroTaskError';
import {
  aeroProgressPercent,
  transcriptionText,
} from './aeroTranscriptionPoll';
import { IAsrState } from './asrState';
import { useNeedsSisterLanguage } from './useNeedsSisterLanguage';
import { asrShowsLanguagePicker } from './asrShowsLanguagePicker';
import { asrPollStateLabel } from './asrPollStateLabel';
import { useAsrTaskLifecycle } from './useAsrTaskLifecycle';

interface AsrProgressProps {
  mediaId: string;
  phonetic: boolean;
  asrState?: IAsrState;
  /** True when ASR settings changed; re-run even if transcription or TRTask exists. */
  force?: boolean;
  /** Step/primary language when not the project vernacular (e.g. LWC). */
  primaryBcp47?: string;
  contentVerses?: string[];
  /** Full result, then the result without verses that already have text. */
  setTranscription: (transcription: string, withoutFilled?: string) => void;
  /** Bump passage-detail context after the mediafile pull (optional). */
  forceRefresh?: () => void;
  onClose: () => void;
}

export default function AsrProgress({
  mediaId,
  phonetic,
  asrState,
  force,
  primaryBcp47,
  contentVerses,
  setTranscription,
  forceRefresh,
  onClose,
}: Readonly<AsrProgressProps>) {
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const { getVernacularLanguage } = useGetAsrSettings();
  const t: ITranscriberStrings = useSelector(transcriberSelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const tc: ICardsStrings = useSelector(cardsSelector, shallowEqual);

  const asrPrimaryBcp47 =
    primaryBcp47 ?? getVernacularLanguage()?.bcp47 ?? 'und';
  const { needsSister } = useNeedsSisterLanguage(asrPrimaryBcp47);
  const showDifferentLanguageTip = asrShowsLanguagePicker(
    asrPrimaryBcp47,
    needsSister
  );

  const { working, taskId, pollProgress, pollClip, run, closing } =
    useAsrTaskLifecycle({
      mediaId,
      phonetic,
      asrState,
      force,
      contentVerses,
      setTranscription,
      forceRefresh,
      onClose,
    });

  const aiDuration = React.useMemo(
    () => mediafiles.find((m) => m.id === mediaId)?.attributes?.duration ?? 0,
    [mediafiles, mediaId]
  );
  const estimateSec = React.useMemo(
    () =>
      run.key && aiDuration > 0
        ? estimateAiSeconds(run.key, aiDuration)
        : undefined,
    [run.key, aiDuration]
  );
  const hasClipProgress = Boolean(pollProgress && pollProgress.total > 0);

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      <Stack spacing={1} sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
        {pollProgress && hasClipProgress ? (
          <>
            <LinearProgress
              id="asr-clip-progress"
              variant="determinate"
              value={aeroProgressPercent(pollProgress)}
            />
            <Typography id="asr-progress-count">
              {pollProgress.completed}/{pollProgress.total}
            </Typography>
          </>
        ) : (
          <AiTimeProgress
            estimateSec={estimateSec}
            startedAt={run.startedAt}
            textId="asr-time-estimate"
          />
        )}
        {(pollClip || taskId) && (
          <Box id="asr-clip-0">
            <Typography>{asrPollStateLabel(pollClip?.state, t)}</Typography>
            {pollClip?.state === 'FAILURE' && (
              <Typography color="error">
                {aeroErrorMessage(pollClip.error) ?? t.aiAsrFailed}
              </Typography>
            )}
            {pollClip?.state === 'SUCCESS' &&
              pollClip.segments.map((segment, segIx) => (
                <Typography
                  key={`${segment.start}-${segIx}`}
                  id={`asr-segment-0-${segIx}`}
                >
                  {transcriptionText(segment.transcription, phonetic) ?? ''}
                </Typography>
              ))}
          </Box>
        )}
        {(working || Boolean(taskId)) && (
          <Typography
            sx={{
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
            }}
          >
            {[
              t.aiWillContinue.replaceAll('{0}', tc.recognizeSpeech),
              showDifferentLanguageTip
                ? t.aiWillContinueDifferentLanguage.replaceAll(
                    '{0}',
                    tc.recognizeSpeech
                  )
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
          </Typography>
        )}
        <ActionRow>
          <Button onClick={closing}>{ts.close}</Button>
        </ActionRow>
      </Stack>
    </Box>
  );
}
