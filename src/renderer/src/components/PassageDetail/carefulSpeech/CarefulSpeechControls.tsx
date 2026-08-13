import { Box, IconButton, Stack, TextField, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import UndoIcon from '@mui/icons-material/Undo';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
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
import { useRenderProfiler, useWhyRender } from '../../../utils/perf';

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
  languagebcp47?: string;
  defaultFilename: string;
  recordingMediaId?: string;
  afterUploadCb: (mediaId: string | undefined) => Promise<void>;
  onRecording: (active: boolean) => void;
  resetMedia: boolean;
  setResetMedia: (v: boolean) => void;
  setCanSave: (v: boolean) => void;
  /** Passed through to MediaRecord; see its prop docs (TT-7583). */
  onSaveRejected?: () => void;
  setStatusText: (t: string) => void;
  showRecorder: boolean;
  strings: IGuidedPhraseRecordControlStrings;
  showBoundaryTools: boolean;
  controlIdPrefix?: string;
  /** Phrase BT: prev/next flanking Record; hide first-incomplete Next. */
  sequentialUnitNavAroundRecord?: boolean;
  onPrevUnit?: () => void;
  onNextUnitSequential?: () => void;
  canPrevUnit?: boolean;
  canNextUnit?: boolean;
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
  languagebcp47,
  defaultFilename,
  recordingMediaId,
  afterUploadCb,
  onRecording,
  resetMedia,
  setResetMedia,
  setCanSave,
  onSaveRejected,
  setStatusText,
  showRecorder,
  strings,
  showBoundaryTools,
  controlIdPrefix = 'careful-speech',
  sequentialUnitNavAroundRecord = false,
  onPrevUnit,
  onNextUnitSequential,
  canPrevUnit = false,
  canNextUnit = false,
}: Props) {
  useRenderProfiler('CarefulSpeechControls');
  useWhyRender('CarefulSpeechControls', {
    phase,
    currentRegion,
    recordingPassStarted,
    allClausesHeard,
    allClausesComplete,
    highlightSpeaker,
    allowRecord,
    savingRecording,
    resetMedia,
    recordingMediaId,
    sourceSegments,
  });
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
  const showNextClause = useMemo(
    () => phase === 'recorded' && !sequentialUnitNavAroundRecord,
    [phase, sequentialUnitNavAroundRecord]
  );
  const showDockedRecordButton = useMemo(
    () =>
      recordingPassStarted &&
      showRecorder &&
      phase !== 'bootstrapping' &&
      (sequentialUnitNavAroundRecord || phase !== 'recorded'),
    [recordingPassStarted, showRecorder, phase, sequentialUnitNavAroundRecord]
  );
  const showRecordNavRow = useMemo(
    () => showDockedRecordButton || showNextClause,
    [showDockedRecordButton, showNextClause]
  );
  const navLocked = useMemo(
    () => phase === 'recording' || savingRecording,
    [phase, savingRecording]
  );
  /** After save settles on a completed segment, nudge the user to advance. */
  const highlightNextUnit = useMemo(
    () =>
      sequentialUnitNavAroundRecord &&
      phase === 'recorded' &&
      !savingRecording &&
      canNextUnit,
    [sequentialUnitNavAroundRecord, phase, savingRecording, canNextUnit]
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
                languagebcp47={languagebcp47}
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
                onSaveRejected={onSaveRejected}
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
          {showRecordNavRow && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 2,
                pt: 1,
              }}
              data-cy={`${controlIdPrefix}-docked-record`}
            >
              {sequentialUnitNavAroundRecord && (
                <IconButton
                  id={`${controlIdPrefix}-prev-unit`}
                  aria-label="Previous segment"
                  onClick={onPrevUnit}
                  disabled={!canPrevUnit || navLocked}
                  size="small"
                >
                  <ChevronLeftIcon />
                </IconButton>
              )}
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
                <Box>{dockedRecordButton}</Box>
              )}
              {sequentialUnitNavAroundRecord && (
                <IconButton
                  id={`${controlIdPrefix}-next-unit`}
                  aria-label="Next segment"
                  onClick={onNextUnitSequential}
                  disabled={!canNextUnit || navLocked}
                  size="small"
                  data-highlighted={highlightNextUnit ? 'true' : undefined}
                  sx={
                    highlightNextUnit
                      ? {
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                          '&:hover': { bgcolor: 'primary.dark' },
                        }
                      : undefined
                  }
                >
                  <ChevronRightIcon />
                </IconButton>
              )}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
