import { Box, IconButton, Stack, TextField } from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { PriButton } from '../../../control';
import MediaRecord from '../../MediaRecord';
import { ICarefulSpeechStrings } from '@model/index';
import { shallowEqual, useSelector } from 'react-redux';
import { carefulSpeechSelector } from '../../../selector';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type LwcTranslationPhase =
  | 'bootstrapping'
  | 'playing'
  | 'recordReady'
  | 'recording'
  | 'recorded';

const primaryHighlightSx = { boxShadow: 4 };

interface Props {
  width: number;
  phase: LwcTranslationPhase;
  speaker: string;
  onSpeakerChange: (value: string) => void;
  onNextClause: () => void;
  onClearRecording: () => void;
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
}

export default function LwcTranslationControls({
  width,
  phase,
  speaker,
  onSpeakerChange,
  onNextClause,
  onClearRecording,
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
}: Props) {
  const strings: ICarefulSpeechStrings = useSelector(
    carefulSpeechSelector,
    shallowEqual
  );
  const speakerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (highlightSpeaker) {
      speakerInputRef.current?.focus();
    }
  }, [highlightSpeaker]);

  const showNextClause = useMemo(() => phase === 'recorded', [phase]);
  const showDockedRecordButton = useMemo(
    () => showRecorder && phase !== 'recorded' && phase !== 'bootstrapping',
    [showRecorder, phase]
  );
  const [dockedRecordButton, setDockedRecordButton] =
    useState<ReactNode | null>(null);
  const onDockedRecordButton = useCallback((node: ReactNode | null) => {
    setDockedRecordButton(node);
  }, []);

  useEffect(() => {
    return () => onDockedRecordButton(null);
  }, [onDockedRecordButton]);

  if (!showRecorder) return null;

  return (
    <Box sx={{ width: '100%', px: 1 }} data-cy="lwc-recorder">
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={1}
        sx={{ mb: 1, pr: 1 }}
      >
        <TextField
          id="lwc-translation-speaker"
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
            id="lwc-clear-recording"
          >
            <DeleteIcon />
          </IconButton>
        )}
      </Stack>
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
            hideToolbar
            dockRecordButton
            showDockedRecordButton={showDockedRecordButton}
            onDockedRecordButton={onDockedRecordButton}
          />
        </Box>
      </Stack>
      {(showDockedRecordButton || showNextClause) && (
        <Box
          sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}
          data-cy="lwc-docked-record"
        >
          {showNextClause ? (
            <PriButton
              id="lwc-next-clause"
              onClick={onNextClause}
              disabled={allClausesComplete || savingRecording}
              sx={primaryHighlightSx}
            >
              {strings.nextClause} &gt;
            </PriButton>
          ) : (
            dockedRecordButton
          )}
        </Box>
      )}
    </Box>
  );
}
