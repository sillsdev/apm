import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Box, IconButton, Stack } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { shallowEqual, useSelector } from 'react-redux';
import {
  ActivityStates,
  IActivityStateStrings,
  ISharedStrings,
  ITranscriberStrings,
  IWsAudioPlayerStrings,
  MediaFile,
  MediaFileD,
  OrganizationD,
  PassageD,
  ProjectD,
  SectionD,
} from '../../../../model';
import {
  activitySelector,
  playerSelector,
  sharedSelector,
  transcriberSelector,
} from '../../../../selector';
import { useGlobal } from '../../../../context/useGlobal';
import usePassageDetailContext from '../../../../context/usePassageDetailContext';
import { PassageDetailContext } from '../../../../context/PassageDetailContext';
import { PlayInPlayer } from '../../../../context/PlayInPlayer';
import { TranscriberProvider } from '../../../../context/TranscriberContext';
import useTodo from '../../../../context/useTodo';
import { UnsavedContext } from '../../../../context/UnsavedContext';
import {
  findRecord,
  useArtifactType,
  orgDefaultFeatures,
  useOrgDefaults,
  useProjectType,
} from '../../../../crud';
import {
  isNoParatextWorkflow,
  resolvedProjectType,
} from '../../../../crud/nextTranscriptionState';
import {
  getSegments,
  hasTranscriptionTask,
  NamedRegions,
  updateSegments,
} from '../../../../utils/namedSegments';
import { logError, Severity } from '../../../../utils/logErrorService';
import { useProjectSegmentSave } from '../../Internalization/useProjectSegmentSave';
import { useTeamSegParams } from './useTeamSegParams';
import { ArtifactTypeSlug } from '../../../../crud/artifactTypeSlug';
import { usePassageStepPermission } from '../../../../utils/usePassageStepPermission';
import { toCamel } from '../../../../utils';
import { Button } from '../../../../control/Button';
import AsrButtonIcon from '../../../../control/AsrButtonIcon';
import { StyledTextAreaAutosize } from '../../../../control/WebFontStyles';
import PassageDetailPlayer from '../../PassageDetailPlayer';
import { SaveSegments } from '../../SaveSegments';
import { BigDialogBp } from '../../../../hoc/BigDialogBp';
import Confirm from '../../../AlertDialog';
import TranscribeReject from '../../../TranscribeReject';
import { useOrbitData } from '../../../../hoc/useOrbitData';
import { useSnackBar } from '../../../../hoc/SnackBar';
import { completeStepAfterSave } from '../../../../context/completeStepAfterSave';
import { useTranscribeActions } from '../../transcribe/useTranscribeActions';
import { useTranscribeAsr } from '../../transcribe/useTranscribeAsr';
import { applyAsrText, type AsrTextMode } from '../../transcribe/insertAsrText';
import { useTranscribeStepRole } from '../../transcribe/useTranscribeStepRole';
import { useTranscribeStepNav } from '../../transcribe/useTranscribeStepNav';
import { useTranscribeProjData } from '../../transcribe/useTranscribeProjData';
import { TranscribeAsrDialogs } from '../../transcribe/TranscribeAsrDialogs';
import { useOtherEditorName } from '../../transcribe/useOtherEditorName';
import { pickTodoMediaRow } from '../../transcribe/pickTodoMediaRow';
import { IRegionParams } from '../../../../crud/useWavesurferRegions';

export function PassageDetailTranscribeMobileContent() {
  const {
    mediafileId,
    section,
    currentstep,
    orgWorkflowSteps,
    setStepComplete,
    setCurrentStep,
    gotoNextStep,
    passage,
    sharedResource,
    playing,
    setHideMobileHeader,
    forceRefresh,
    playerMediafile,
    setSelected,
  } = usePassageDetailContext();

  const { setState } = useContext(PassageDetailContext);
  const {
    waitForSave,
    toolChanged,
    isChanged,
    saveCompleted,
    clearCompleted,
    saveRequested,
    clearRequested,
    toolsChanged,
  } = useContext(UnsavedContext).state;
  const projectSegmentSave = useProjectSegmentSave();
  const hasPermission = usePassageStepPermission(
    currentstep,
    section,
    passage,
    sharedResource
  );

  const sharedStr: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const t: ITranscriberStrings = useSelector(transcriberSelector, shallowEqual);
  const tPlayer: IWsAudioPlayerStrings = useSelector(
    playerSelector,
    shallowEqual
  );
  const ta: IActivityStateStrings = useSelector(activitySelector, shallowEqual);

  const [memory] = useGlobal('memory');
  const [user] = useGlobal('user');
  const [project] = useGlobal('project');
  const [projType] = useGlobal('projType');
  const [organization] = useGlobal('organization');
  const [offline] = useGlobal('offline');
  const [errorReporter] = useGlobal('errorReporter');
  const { showMessage } = useSnackBar();
  const { getOrgDefault, setOrgDefault, canSetOrgDefault } = useOrgDefaults();
  const features = getOrgDefault(orgDefaultFeatures) as
    { aiTranscribe?: boolean } | undefined;
  const showAsrButton = Boolean(features?.aiTranscribe) && !offline;
  const { getProjType } = useProjectType();
  const { slugFromId } = useArtifactType();

  const teams = useOrbitData<OrganizationD[]>('organization');
  const team = useMemo(
    () => teams.find((o) => o.id === organization),
    [teams, organization]
  );

  const projects = useOrbitData<ProjectD[]>('project');
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');

  const {
    stepSettings,
    artifactTypeId,
    parsedSteps,
    hasChecking,
    nextStep,
    prevStep,
    curRole,
  } = useTranscribeStepRole({
    currentstep,
    orgWorkflowSteps,
    hasPermission,
  });

  const { rowData, transSelected } = useTodo();

  const selectedMediaRow = useMemo(() => {
    const targetId = artifactTypeId
      ? transSelected
      : (transSelected ?? mediafileId);
    return pickTodoMediaRow(rowData, targetId);
  }, [artifactTypeId, rowData, transSelected, mediafileId]);

  const mediafile = useMemo(() => {
    if (artifactTypeId) {
      if (!selectedMediaRow?.mediafile?.id) return undefined;
      return (
        mediafiles.find((m) => m.id === selectedMediaRow.mediafile.id) ??
        (selectedMediaRow.mediafile as MediaFileD)
      );
    }
    return mediafiles.find((m) => m.id === mediafileId);
  }, [artifactTypeId, selectedMediaRow, mediafiles, mediafileId]);

  const {
    handleReopen: handleReopenCallback,
    handleReject: handleRejectCallback,
  } = useTranscribeStepNav({
    currentstep,
    parsedSteps,
    hasChecking,
    nextStep,
    prevStep,
    curRole,
    setStepComplete,
    setCurrentStep,
  });

  const handleComplete = useCallback(
    (complete: boolean) => {
      // Save and step-write failures are shown inside; only an onDone bug rejects, and it should surface.
      void completeStepAfterSave({
        stepId: currentstep,
        complete,
        // A segment save can start while the tool save is awaited; wait out both.
        waitForSaves: async () => {
          await pendingSegmentSaveRef.current;
          await waitForSave(undefined, 200);
          await pendingSegmentSaveRef.current;
        },
        setStepComplete,
        showMessage,
        onDone: complete ? gotoNextStep : undefined,
      });
    },
    [waitForSave, setStepComplete, currentstep, gotoNextStep, showMessage]
  );

  const handleReloadPlayer = useCallback(
    (playerMediafile: MediaFile) => {
      setState((s) => ({ ...s, playerMediafile }));
    },
    [setState]
  );

  const [textValue, setTextValue] = useState(
    () => mediafile?.attributes?.transcription ?? ''
  );
  const [confirm, setConfirm] = useState<string | undefined>(undefined);
  const playedSecsRef = useRef(0);
  const segmentsRef = useRef<string | undefined>(undefined);
  const pendingSegmentSaveRef = useRef<Promise<void> | null>(null);
  const transcriptionInRef = useRef<string | undefined>(
    mediafile?.attributes?.transcription ?? ''
  );
  const mediaRef = useRef<MediaFileD | undefined>(mediafile);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const getTextValue = useCallback(() => textValue, [textValue]);
  const getSegmentsCb = useCallback(() => segmentsRef.current, []);
  const getPositionCb = useCallback(() => playedSecsRef.current, []);
  const setPositionCb = useCallback((pos: number) => {
    playedSecsRef.current = pos;
  }, []);

  const projRec = useMemo(
    () => (project ? projects.find((p) => p.id === project) : undefined),
    [projects, project]
  );
  const recordType = useMemo(
    () => (projRec && project ? getProjType(project) : ''),
    [getProjType, projRec, project]
  );
  const resolvedType = useMemo(
    () => resolvedProjectType(projType, recordType),
    [projType, recordType]
  );
  const artifactTypeSlug = useMemo(
    () =>
      artifactTypeId
        ? (slugFromId(artifactTypeId) as ArtifactTypeSlug)
        : ArtifactTypeSlug.Vernacular,
    [artifactTypeId, slugFromId]
  );
  const noParatext = useMemo(
    () => isNoParatextWorkflow(resolvedType, artifactTypeSlug),
    [resolvedType, artifactTypeSlug]
  );

  const [projData] = useTranscribeProjData({
    project,
    memory,
    stepSettings,
    artifactTypeSlug,
    artifactId: artifactTypeId,
  });

  const actions = useTranscribeActions({
    passage: selectedMediaRow?.passage?.id
      ? (selectedMediaRow.passage as PassageD)
      : passage,
    mediafile,
    user,
    memory,
    section: selectedMediaRow?.section?.id
      ? (selectedMediaRow.section as SectionD)
      : section,
    toolId: currentstep,
    hasChecking,
    noParatext,
    onReject: handleRejectCallback,
    onReopen: handleReopenCallback,
    onReloadPlayer: handleReloadPlayer,
    setComplete: handleComplete,
    getTranscriptionText: getTextValue,
    getSegments: getSegmentsCb,
    getPosition: getPositionCb,
    setPosition: setPositionCb,
    toolChanged,
    saveCompleted,
    showMessage,
    savingMessage: t.saving,
    errorReporter,
  });

  const isCompleted = useMemo(() => {
    const st = actions.state;
    return (
      st === ActivityStates.Approved ||
      st === ActivityStates.Done ||
      st === ActivityStates.Synced
    );
  }, [actions.state]);

  const effectiveRole = useMemo(() => {
    if (!hasPermission) return 'view' as const;
    if (isCompleted || selectedMediaRow?.role === 'view')
      return 'view' as const;
    if (selectedMediaRow?.role && selectedMediaRow.role !== 'view') {
      return selectedMediaRow.role;
    }
    return curRole ?? ('view' as const);
  }, [hasPermission, isCompleted, selectedMediaRow?.role, curRole]);

  const isReadOnly =
    !hasPermission || !mediafile || isCompleted || effectiveRole === 'view';

  useEffect(() => {
    const targetMediaId = artifactTypeId
      ? mediafile?.id
      : (mediafile?.id ?? mediafileId);
    if (targetMediaId && playerMediafile?.id !== targetMediaId) {
      setSelected(targetMediaId, PlayInPlayer.yes);
    }
  }, [
    artifactTypeId,
    mediafile?.id,
    mediafileId,
    playerMediafile?.id,
    setSelected,
  ]);

  useEffect(() => {
    const isDifferentMedia = mediaRef.current?.id !== mediafile?.id;
    mediaRef.current = mediafile;
    const incomingTranscription = mediafile?.attributes?.transcription ?? '';

    if (isDifferentMedia) {
      transcriptionInRef.current = incomingTranscription;
      setTextValue(incomingTranscription);
      segmentsRef.current = undefined;
      setConfirm(undefined);
      return;
    }

    if (
      transcriptionInRef.current !== undefined &&
      incomingTranscription !== transcriptionInRef.current &&
      !actions.savingRef.current
    ) {
      if (textValue !== incomingTranscription) {
        setConfirm(incomingTranscription);
      } else {
        transcriptionInRef.current = incomingTranscription;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mediafile?.id,
    mediafile?.attributes?.transcription,
    textValue,
    actions.savingRef,
  ]);

  const handleTextAdd = useCallback(
    (newText: string, mode: AsrTextMode) => {
      if (isReadOnly || !hasPermission || !mediafile) return;
      // Read the caret now; the textarea keeps it while the prompt is open.
      const selection = {
        start: textareaRef.current?.selectionStart ?? 0,
        end: textareaRef.current?.selectionEnd ?? 0,
      };
      setTextValue((prev) => {
        toolChanged(currentstep, true);
        return applyAsrText(prev, newText, mode, selection).value;
      });
    },
    [isReadOnly, hasPermission, mediafile, toolChanged, currentstep]
  );

  const hasAiTask = useMemo(
    () => hasTranscriptionTask(mediafile?.attributes?.segments),
    [mediafile]
  );

  const asr = useTranscribeAsr({
    team,
    sharedStr,
    tPlayer,
    showMessage,
    onTextAdd: handleTextAdd,
    getCurrentText: getTextValue,
    hasActiveTask: hasAiTask,
  });

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (isReadOnly || !hasPermission || !mediafile) return;
      setTextValue(e.target.value);
      toolChanged(currentstep, true);
    },
    [isReadOnly, hasPermission, mediafile, toolChanged, currentstep]
  );

  const handleFocus = useCallback(() => {
    setHideMobileHeader(true);
  }, [setHideMobileHeader]);

  const handleBlur = useCallback(() => {
    setHideMobileHeader(false);
  }, [setHideMobileHeader]);

  useEffect(() => {
    return () => {
      setHideMobileHeader(false);
    };
  }, [setHideMobileHeader]);

  const [segParams, setSegParams] = useTeamSegParams();

  const onSegmentParamChange = useCallback(
    (params: IRegionParams, teamDefault: boolean) => {
      setSegParams(params);
      if (teamDefault && hasPermission && canSetOrgDefault) {
        setOrgDefault(NamedRegions.Transcription, params);
      }
    },
    [canSetOrgDefault, hasPermission, setOrgDefault, setSegParams]
  );

  const onSegmentChange = useCallback(
    async (segments: string, init?: boolean) => {
      segmentsRef.current = segments;
      if (isReadOnly || !hasPermission || init || !mediafile) return;
      const currentMedia =
        (findRecord(memory, 'mediafile', mediafile.id) as
          MediaFileD | undefined) ?? mediafile;
      const currentSavedSegments = getSegments(
        NamedRegions.Transcription,
        currentMedia.attributes?.segments ?? '{}'
      );
      if (segments === currentSavedSegments) return;
      const updatedSegments = updateSegments(
        NamedRegions.Transcription,
        currentMedia.attributes?.segments ?? '{}',
        segments
      );
      toolChanged(currentstep, true);
      const savePromise = (async () => {
        try {
          await projectSegmentSave({
            media: currentMedia,
            segments: updatedSegments,
          });
          saveCompleted(currentstep);
        } catch (err) {
          const message = (err as Error).message;
          logError(Severity.error, errorReporter, err as Error);
          saveCompleted(currentstep, message);
          throw err;
        }
      })();
      pendingSegmentSaveRef.current = savePromise;
      try {
        await savePromise;
        if (pendingSegmentSaveRef.current === savePromise) {
          pendingSegmentSaveRef.current = null;
        }
      } catch {
        // Keep rejected savePromise in pendingSegmentSaveRef so handleComplete blocks.
      }
    },
    [
      isReadOnly,
      hasPermission,
      mediafile,
      memory,
      projectSegmentSave,
      errorReporter,
      saveCompleted,
      toolChanged,
      currentstep,
    ]
  );

  const handleProgress = useCallback((progress: number) => {
    playedSecsRef.current = progress;
  }, []);

  const handleUpdateConfirmed = useCallback(() => {
    if (confirm !== undefined) {
      transcriptionInRef.current = confirm;
      setTextValue(confirm);
      toolChanged(currentstep, false);
    }
    setConfirm(undefined);
  }, [confirm, currentstep, toolChanged]);

  const handleUpdateRefused = useCallback(() => {
    // Keep local changes and save them over remote changes
    void actions.handleSave();
    setConfirm(undefined);
  }, [actions]);

  useEffect(() => {
    if (saveRequested(currentstep)) {
      void actions.handleSave();
    } else if (clearRequested(currentstep)) {
      clearCompleted(currentstep);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolsChanged]);

  const stateKey = toCamel(actions.state);
  const localizedState = (ta as any)[stateKey] || actions.state;

  const otherEditorName = useOtherEditorName(
    mediafile,
    confirm !== undefined,
    t.unknownUser
  );

  const fontStyle = useMemo(() => {
    return {
      fontFamily: projData?.fontFamily || 'inherit',
      fontSize: projData?.fontSize || 'inherit',
      direction: projData?.fontDir ? ('rtl' as const) : ('ltr' as const),
    };
  }, [projData]);

  return (
    <Box
      sx={{
        width: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <PassageDetailPlayer
        layoutMode="transport"
        allowSegment={
          !isReadOnly && hasPermission ? NamedRegions.Transcription : undefined
        }
        allowSegmentNav={!isReadOnly && hasPermission}
        allowAutoSegment={!isReadOnly && hasPermission}
        saveSegments={
          !isReadOnly && hasPermission
            ? SaveSegments.saveButNoButton
            : undefined
        }
        allowZoomAndSpeed={true}
        hideZoom={true}
        showTranscriptionButton={false}
        defaultSegParams={segParams}
        canSetDefaultParams={!isReadOnly && hasPermission && canSetOrgDefault}
        onProgress={handleProgress}
        onSegment={!isReadOnly && hasPermission ? onSegmentChange : undefined}
        onSegmentParamChange={
          !isReadOnly && hasPermission ? onSegmentParamChange : undefined
        }
        parentToolId={currentstep}
      />

      {showAsrButton && (
        <Box
          data-cy="mobile-asr-control"
          sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}
        >
          <IconButton
            id="asrButton-settings"
            aria-label={tPlayer.recognizeSpeechSettings}
            onClick={asr.openAsrLanguageSettings}
            disabled={isReadOnly}
            size="small"
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
          <Button
            id="asrButton"
            variant="outlined"
            onClick={asr.handleTranscribe}
            startIcon={
              <AsrButtonIcon active={hasAiTask && !asr.asrProgressVisible} />
            }
            disabled={isReadOnly}
            sx={{
              textTransform: 'none',
              borderColor: 'divider',
              color: 'text.primary',
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
            }}
          >
            {t.aiAutomaticTranscription}
          </Button>
        </Box>
      )}

      <Box sx={{ width: '100%', minWidth: 0 }}>
        <StyledTextAreaAutosize
          id="transcriptionText"
          ref={textareaRef}
          value={textValue}
          family={fontStyle.fontFamily}
          url={projData?.url}
          lang={projData?.langTag || 'en'}
          spellCheck={projData?.spellCheck === true}
          onChange={handleTextChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          readOnly={isReadOnly}
          placeholder={t.transcriptionType}
          style={{
            ...fontStyle,
            width: '100%',
            minHeight: 120,
            boxSizing: 'border-box',
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            resize: 'vertical',
            outline: 'none',
          }}
        />
      </Box>

      <Stack
        direction="row"
        spacing={1}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
            borderRadius: '4px',
            px: 1,
            py: 0.5,
            fontSize: '0.8125rem',
            fontWeight: 600,
            textTransform: 'capitalize',
            display: 'inline-flex',
            alignItems: 'center',
          }}
          data-cy="transcribe-state-badge"
        >
          {localizedState}
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          {effectiveRole !== 'view' ? (
            <>
              <Button
                id="transcriber.reject"
                variant="outlined"
                disabled={playing || !hasPermission || !mediafile}
                onClick={actions.handleReject}
              >
                {t.reject}
              </Button>
              <Button
                id="transcriber.save"
                variant="outlined"
                color={isChanged(currentstep) ? 'primary' : 'inherit'}
                disabled={playing || !hasPermission || !mediafile}
                onClick={() => actions.handleSave()}
              >
                {t.save}
              </Button>
              <Button
                id="transcriber.submit"
                variant="contained"
                color="primary"
                disabled={playing || !hasPermission || !mediafile}
                onClick={actions.handleSubmit}
              >
                {t.submit}
              </Button>
            </>
          ) : (
            <Button
              id="transcriber.reopen"
              variant="outlined"
              disabled={
                !actions.canReopen || playing || !hasPermission || !mediafile
              }
              onClick={actions.handleReopen}
            >
              {t.reopen}
            </Button>
          )}
        </Stack>
      </Stack>

      {actions.rejectVisible && mediafile && (
        <TranscribeReject
          mediaIn={mediafile}
          visible={actions.rejectVisible}
          editMethod={actions.handleRejected}
          cancelMethod={actions.handleRejectCancel}
        />
      )}

      {confirm && (
        <Confirm
          isDelete={false}
          text={t.updateByOther2
            .replace('{0}', otherEditorName)
            .replace('{1}', confirm)}
          yesResponse={handleUpdateConfirmed}
          noResponse={handleUpdateRefused}
        />
      )}

      <TranscribeAsrDialogs
        team={team}
        mediaId={mediafile?.id ?? ''}
        asrLangVisible={asr.asrLangVisible}
        asrProgressVisible={asr.asrProgressVisible}
        phonetic={asr.phonetic}
        asrOverride={asr.asrOverride}
        forceAsr={asr.forceAsr}
        forceRefresh={forceRefresh}
        onLanguageClose={asr.handleAsrLanguageClose}
        onProgressOpen={asr.setAsrProgressVisible}
        onAsrResult={asr.handleAutoTranscribe}
        asrPrompt={asr.asrPrompt}
        bp={BigDialogBp.mobile}
        isMobile
      />
    </Box>
  );
}

export default function PassageDetailTranscribeMobile() {
  const { currentstep, orgWorkflowSteps, section, passage, sharedResource } =
    usePassageDetailContext();
  const hasPermission = usePassageStepPermission(
    currentstep,
    section,
    passage,
    sharedResource
  );

  const { artifactTypeId, curRole, stepLanguageBcp47 } = useTranscribeStepRole({
    currentstep,
    orgWorkflowSteps,
    hasPermission,
  });

  return (
    <TranscriberProvider
      artifactTypeId={artifactTypeId}
      curRole={curRole}
      stepLanguageBcp47={stepLanguageBcp47}
    >
      <PassageDetailTranscribeMobileContent />
    </TranscriberProvider>
  );
}
