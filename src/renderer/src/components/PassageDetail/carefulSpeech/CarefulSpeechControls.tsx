import { Box, IconButton, Stack, TextField, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import UndoIcon from '@mui/icons-material/Undo';
import { PriButton } from '../../../control';
import MediaRecord from '../../MediaRecord';
import { formatClauseRange } from './carefulSpeechFormat';
import { IRegion } from '../../../crud/useWavesurferRegions';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { IGuidedPhraseRecordControlStrings } from '../guidedPhraseRecord/types';

export type CarefulSpeechPhase =
  | 'bootstrapping'
  | 'playing'
  | 'readyToRecord'
  | 'recordReady'
  | 'recording'
  | 'recorded';

const primaryHighlightSx = { boxShadow: 4 };

interface Props {
  width: number;
  phase: CarefulSpeechPhase;
  recordingPassStarted: boolean;
  currentRegion: IRegion | undefined;
  speaker: string;
  onSpeakerChange: (value: string) => void;
  onMoreClauses: () => void;
  onFewerClauses: () => void;
  onCombineWithNext: () => void;
  onSplitClause: () => void;
  onUndoCombine: () => void;
  canFewerClauses: boolean;
  canCombineWithNext: boolean;
  canSplitClause: boolean;
  showUndoCombine: boolean;
  onStartRecording: () => void;
  onNextClause: () => void;
  onClearRecording: () => void;
  allClausesHeard: boolean;
  allClausesComplete: boolean;
  highlightSpeaker: boolean;
  allowRecord: boolean;
  savingRecording?: boolean;
  onSaving?: () => void;
  onSaveSettled?: () => void;
  toolId: string;
  passageId: string | undefined;
  artifactId: string | null;
  sourceMediaId: string;
  sourceSegments: string;
  defaultFilename: string;
  recordingMediaId?: string;
  afterUploadCb: (mediaId: string | undefined) => Promise<void>;
  onRecording: (active: boolean) => void;
  resetMedia: boolean;
  setResetMedia: (v: boolean) => void;
  setCanSave: (v: boolean) => void;
  setStatusText: (t: string) => void;
  showRecorder: boolean;
  strings: IGuidedPhraseRecordControlStrings;
  showBoundaryTools: boolean;
  controlIdPrefix?: string;
}

export default function CarefulSpeechControls({
  width,
  phase,
  recordingPassStarted,
  currentRegion,
  speaker,
  onSpeakerChange,
  onMoreClauses,
  onFewerClauses,
  onCombineWithNext,
  onSplitClause,
  onUndoCombine,
  canFewerClauses,
  canCombineWithNext,
  canSplitClause,
  showUndoCombine,
  onStartRecording,
  onNextClause,
  onClearRecording,
  allClausesHeard,
  allClausesComplete,
  highlightSpeaker,
  allowRecord,
  savingRecording = false,
  onSaving,
  onSaveSettled,
  toolId,
  passageId,
  artifactId,
  sourceMediaId,
  sourceSegments,
  defaultFilename,
  recordingMediaId,
  afterUploadCb,
  onRecording,
  resetMedia,
  setResetMedia,
  setCanSave,
  setStatusText,
  showRecorder,
  strings,
  showBoundaryTools,
  controlIdPrefix = 'careful-speech',
}: Props) {
  const speakerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (highlightSpeaker) {
      speakerInputRef.current?.focus();
    }
  }, [highlightSpeaker]);

  const listenPass = useMemo(
    () => !recordingPassStarted,
    [recordingPassStarted]
  );
  const showMoreFewer = useMemo(
    () => showBoundaryTools && listenPass && phase !== 'bootstrapping',
    [showBoundaryTools, listenPass, phase]
  );
  const showStartButton = useMemo(
    () => listenPass && phase !== 'bootstrapping',
    [listenPass, phase]
  );
  const highlightStart = useMemo(
    () => showStartButton && allClausesHeard,
    [showStartButton, allClausesHeard]
  );
  const showCombineRow = useMemo(
    () => showBoundaryTools && recordingPassStarted,
    [showBoundaryTools, recordingPassStarted]
  );
  const showNextClause = useMemo(() => phase === 'recorded', [phase]);
  const showDockedRecordButton = useMemo(
    () =>
      recordingPassStarted &&
      showRecorder &&
      phase !== 'recorded' &&
      phase !== 'bootstrapping',
    [recordingPassStarted, showRecorder, phase]
  );
  const [dockedRecordButton, setDockedRecordButton] =
    useState<ReactNode | null>(null);
  const onDockedRecordButton = useCallback((node: ReactNode | null) => {
    setDockedRecordButton(node);
  }, []);

  useEffect(() => {
    return () => onDockedRecordButton(null);
  }, [onDockedRecordButton]);

  return (
    <Box sx={{ width: '100%', px: 1 }}>
      {showMoreFewer && (
        <Stack
          direction="row"
          spacing={1}
          justifyContent="center"
          sx={{ pb: 1 }}
        >
          <PriButton
            id={`${controlIdPrefix}-more-clauses`}
            onClick={onMoreClauses}
            variant="outlined"
            color="inherit"
          >
            {strings.moreUnits}
          </PriButton>
          <PriButton
            id={`${controlIdPrefix}-fewer-clauses`}
            disabled={!canFewerClauses}
            onClick={onFewerClauses}
            variant="outlined"
            color="inherit"
          >
            {strings.fewerUnits}
          </PriButton>
        </Stack>
      )}
      {showCombineRow && (
        <Stack
          direction="row"
          spacing={1}
          justifyContent="center"
          alignItems="center"
        >
          <PriButton
            id={`${controlIdPrefix}-split`}
            disabled={!canSplitClause || phase === 'recording'}
            onClick={onSplitClause}
            variant="outlined"
            color="inherit"
            sx={{ px: '8px', py: '2px' }}
          >
            {strings.splitUnit}
          </PriButton>
          <PriButton
            id={`${controlIdPrefix}-combine`}
            disabled={!canCombineWithNext || phase === 'recording'}
            onClick={onCombineWithNext}
            variant="outlined"
            color="inherit"
            sx={{ px: '8px', py: '2px' }}
          >
            {strings.combineWithNext}
          </PriButton>
          {showUndoCombine && (
            <IconButton
              id={`${controlIdPrefix}-undo-combine`}
              aria-label={strings.undo}
              onClick={onUndoCombine}
              size="small"
            >
              <UndoIcon />
            </IconButton>
          )}
        </Stack>
      )}
      <Typography variant="body2" align="center" sx={{ py: 2 }}>
        {strings.unitLabel.replace('{0}', formatClauseRange(currentRegion))}
      </Typography>
      {showStartButton && (
        <Box sx={{ display: 'flex', justifyContent: 'center', pb: 1 }}>
          <PriButton
            id={`${controlIdPrefix}-start`}
            onClick={onStartRecording}
            disabled={phase === 'playing'}
            variant={highlightStart ? 'contained' : 'outlined'}
          >
            {strings.startRecording} &gt;
          </PriButton>
        </Box>
      )}
      {showRecorder && (
        <Box>
          <Stack direction="row" alignItems="center" justifyContent="center">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <MediaRecord
                toolId={toolId}
                passageId={passageId}
                sourceMediaId={sourceMediaId}
                sourceSegments={sourceSegments}
                artifactId={artifactId}
                performedBy={speaker}
                defaultFilename={defaultFilename}
                mediaId={recordingMediaId}
                allowRecord={allowRecord}
                allowWave={false}
                height={160}
                width={width - 80}
                afterUploadCb={afterUploadCb}
                onSaving={onSaving}
                onReady={onSaveSettled}
                setCanSave={setCanSave}
                setStatusText={setStatusText}
                doReset={resetMedia}
                setDoReset={setResetMedia}
                onRecording={onRecording}
                forceMobileView={true}
                isStopLogic={true}
                noNewVoice={true}
                allowDeltaVoice={true}
                allowDownload={false}
                allowNoNoise={true}
                dockRecordButton
                showDockedRecordButton={showDockedRecordButton}
                onDockedRecordButton={onDockedRecordButton}
              />
            </Box>
          </Stack>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1}
            sx={{ my: 1, pr: 1 }}
          >
            <TextField
              id={`${controlIdPrefix}-speaker`}
              label={strings.speaker}
              value={speaker}
              onChange={(e) => onSpeakerChange(e.target.value)}
              size="small"
              inputRef={speakerInputRef}
              error={highlightSpeaker}
              sx={{
                width: '40%',
                ...(highlightSpeaker
                  ? {
                      '& .MuiOutlinedInput-root': {
                        boxShadow: 4,
                      },
                    }
                  : undefined),
              }}
            />
            {phase === 'recorded' && (
              <IconButton
                aria-label={strings.clearRecording}
                onClick={onClearRecording}
              >
                <DeleteIcon />
              </IconButton>
            )}
          </Stack>
          {(showDockedRecordButton || showNextClause) && (
            <Box
              sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}
              data-cy={`${controlIdPrefix}-docked-record`}
            >
              {showNextClause ? (
                <PriButton
                  id={`${controlIdPrefix}-next`}
                  onClick={onNextClause}
                  disabled={allClausesComplete || savingRecording}
                  sx={primaryHighlightSx}
                >
                  {strings.nextUnit} &gt;
                </PriButton>
              ) : (
                dockedRecordButton
              )}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
