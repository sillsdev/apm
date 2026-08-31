import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Box, Stack } from '@mui/material';
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
  Project,
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
  getFontData,
  GetUser,
  pullTableList,
  related,
  ToolSlug,
  useArtifactType,
  orgDefaultFeatures,
  useOrgDefaults,
  useProjectType,
  useStepTool,
} from '../../../../crud';
import {
  isNoParatextWorkflow,
  resolvedProjectType,
} from '../../../../crud/nextTranscriptionState';
import IndexedDBSource from '@orbit/indexeddb';
import JSONAPISource from '@orbit/jsonapi';
import {
  getSegments,
  NamedRegions,
  updateSegments,
} from '../../../../utils/namedSegments';
import { logError, Severity } from '../../../../utils/logErrorService';
import { useProjectSegmentSave } from '../../Internalization/useProjectSegmentSave';
import type { FontData } from '../../../../crud/fontChoice';
import {
  ArtifactTypeSlug,
  artifactStampsStepLanguage,
} from '../../../../crud/artifactTypeSlug';
import { parseMediaLanguageField } from '../../carefulSpeech/matchesGuidedOutputRow';
import { useStepPermissions } from '../../../../utils/useStepPermission';
import { isLinkedNote } from '../../../../crud/isLinkedNote';
import { isLangSet, JSONParse, toCamel } from '../../../../utils';
import { Button } from '../../../../control/Button';
import TranscriptionLogo from '../../../../control/TranscriptionLogo';
import { StyledTextAreaAutosize } from '../../../../control/WebFontStyles';
import PassageDetailPlayer from '../../PassageDetailPlayer';
import BigDialog from '../../../../hoc/BigDialog';
import { BigDialogBp } from '../../../../hoc/BigDialogBp';
import Confirm from '../../../AlertDialog';
import SelectAsrLanguage from '../../../../business/asr/SelectAsrLanguage';
import AsrProgress from '../../../../business/asr/AsrProgress';
import TranscribeReject from '../../../TranscribeReject';
import { asrStatesEqual } from '../../../../business/asr/asrState';
import { useOrbitData } from '../../../../hoc/useOrbitData';
import { useSnackBar } from '../../../../hoc/SnackBar';
import { useTranscribeActions } from '../../transcribe/useTranscribeActions';
import { useTranscribeAsr } from '../../transcribe/useTranscribeAsr';
import { IRegionParams } from '../../../../crud/useWavesurferRegions';

interface IProps {
  width: number;
}

interface IStep {
  id: string;
  sequencenum: number;
  tool: string;
  settings: string;
}

export function PassageDetailTranscribeMobileContent({ width }: IProps) {
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
  const { waitForSave } = useContext(UnsavedContext).state;
  const {
    toolChanged,
    isChanged,
    saveCompleted,
    clearCompleted,
    saveRequested,
    clearRequested,
    toolsChanged,
  } = useContext(UnsavedContext).state;
  const projectSegmentSave = useProjectSegmentSave();
  const { canDoSectionStep } = useStepPermissions();
  const hasPermission =
    canDoSectionStep(currentstep, section) &&
    !isLinkedNote(passage, sharedResource);

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
  const [coordinator] = useGlobal('coordinator');
  const [errorReporter] = useGlobal('errorReporter');
  const remote = coordinator?.getSource('remote') as JSONAPISource;
  const backup = coordinator?.getSource('backup') as IndexedDBSource;
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

  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');

  const { settings: workflowStepSettingsRaw } = useStepTool(currentstep);
  const stepSettings = useMemo(() => {
    if (!workflowStepSettingsRaw || workflowStepSettingsRaw === '') return '{}';
    return typeof workflowStepSettingsRaw === 'string'
      ? workflowStepSettingsRaw
      : JSON.stringify(workflowStepSettingsRaw);
  }, [workflowStepSettingsRaw]);

  const parsedSettings = useMemo(() => {
    try {
      return JSON.parse(stepSettings || '{}') as { artifactTypeId?: string };
    } catch {
      return {} as { artifactTypeId?: string };
    }
  }, [stepSettings]);

  const artifactTypeId = parsedSettings?.artifactTypeId ?? null;

  const { rowData, transSelected } = useTodo();

  const selectedMediaRow = useMemo(() => {
    const targetId = artifactTypeId
      ? transSelected
      : (transSelected ?? mediafileId);
    if (!targetId) return undefined;
    const asTranscriber = rowData.find(
      (r) => r.mediafile?.id === targetId && r.role === 'transcriber'
    );
    if (asTranscriber) return asTranscriber;
    const asEditor = rowData.find(
      (r) => r.mediafile?.id === targetId && r.role === 'editor'
    );
    if (asEditor) return asEditor;
    return rowData.find((r) => r.mediafile?.id === targetId);
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

  const parsedSteps = useMemo(() => {
    if (!orgWorkflowSteps) return [];
    return orgWorkflowSteps
      .slice()
      .sort(
        (a, b) =>
          (a.attributes.sequencenum ?? 0) - (b.attributes.sequencenum ?? 0)
      )
      .map((s, ix) => {
        const toolData = JSONParse(s?.attributes?.tool) as {
          tool?: string;
          settings?: string | object;
        };
        return {
          id: s.id,
          sequencenum: ix,
          tool: toolData.tool ?? '',
          settings:
            typeof toolData.settings === 'string'
              ? toolData.settings || '{}'
              : JSON.stringify(toolData.settings ?? {}),
        } as IStep;
      });
  }, [orgWorkflowSteps]);

  const vernacularSteps = useMemo(() => {
    return parsedSteps.filter(
      (s) =>
        s.tool === ToolSlug.Transcribe && !JSON.parse(s.settings).artifactTypeId
    );
  }, [parsedSteps]);

  const hasChecking = useMemo(() => {
    return (
      vernacularSteps.length > 1 &&
      (vernacularSteps[1] as IStep).sequencenum ===
        (vernacularSteps[0] as IStep).sequencenum + 1
    );
  }, [vernacularSteps]);

  const nextStep = useMemo(() => {
    if (!currentstep || !parsedSteps) return null;
    let found = false;
    for (const s of parsedSteps) {
      if (s.id === currentstep) {
        found = true;
        continue;
      }
      if (!found) continue;
      return s.id;
    }
    return null;
  }, [currentstep, parsedSteps]);

  const prevStep = useMemo(() => {
    if (!currentstep || !parsedSteps) return null;
    let found = '';
    for (const s of parsedSteps) {
      if (s.id === currentstep) {
        break;
      } else {
        found = s.id;
      }
    }
    return found;
  }, [currentstep, parsedSteps]);

  const curRole = useMemo(() => {
    if (!currentstep) return undefined;
    if (!hasPermission) return 'view';
    if (!hasChecking) return 'transcriber';
    if (artifactTypeId) return 'transcriber';
    if ((vernacularSteps[0] as IStep)?.id === currentstep) return 'transcriber';
    return 'editor';
  }, [
    currentstep,
    vernacularSteps,
    artifactTypeId,
    hasChecking,
    hasPermission,
  ]);

  const handleComplete = useCallback(
    (complete: boolean) => {
      const waitPending = pendingSegmentSaveRef.current
        ? pendingSegmentSaveRef.current.catch(() => {})
        : Promise.resolve();

      waitPending
        .then(() => waitForSave(undefined, 200))
        .then(async () => {
          if (pendingSegmentSaveRef.current) {
            await pendingSegmentSaveRef.current.catch(() => {});
          }
          await setStepComplete(currentstep, complete);
          if (complete) gotoNextStep();
        })
        .catch(() => {
          // save failed or timed out; do not mark complete or navigate
        });
    },
    [waitForSave, setStepComplete, currentstep, gotoNextStep]
  );

  const uncompletedSteps = useCallback(async () => {
    await setStepComplete(currentstep, false);
    if (hasChecking && nextStep) await setStepComplete(nextStep, false);
    if (curRole === 'editor' && prevStep) setCurrentStep(prevStep || '');
  }, [
    setStepComplete,
    currentstep,
    hasChecking,
    nextStep,
    curRole,
    prevStep,
    setCurrentStep,
  ]);

  const handleReopenCallback = useCallback(() => {
    uncompletedSteps();
  }, [uncompletedSteps]);

  const handleRejectCallback = useCallback(
    async (reason: string) => {
      await uncompletedSteps();
      if (reason === ActivityStates.NeedsNewRecording) {
        const curStep = parsedSteps.find((s) => s.id === currentstep);
        if (curStep?.settings === '{}') {
          const recordStep = parsedSteps.find(
            (s) => s.tool === ToolSlug.Record
          );
          if (recordStep) {
            await setStepComplete(recordStep.id, false);
            setCurrentStep(recordStep.id);
            return;
          }
        }
      }
      if (curRole === 'editor' && prevStep) {
        await setStepComplete(prevStep, false);
        setCurrentStep(prevStep);
      }
    },
    [
      uncompletedSteps,
      parsedSteps,
      currentstep,
      curRole,
      prevStep,
      setStepComplete,
      setCurrentStep,
    ]
  );

  const handleReloadPlayer = useCallback(
    (playerMediafile: MediaFile) => {
      setState((s) => ({ ...s, playerMediafile }));
    },
    [setState]
  );

  const [textValue, setTextValue] = useState(
    mediafile?.attributes?.transcription ?? ''
  );
  const [projData, setProjData] = useState<FontData>();
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
    () =>
      project
        ? (findRecord(memory, 'project', project) as Project | undefined)
        : undefined,
    [memory, project]
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
    if (!hasPermission) return 'view';
    if (isCompleted || selectedMediaRow?.role === 'view') return 'view';
    if (selectedMediaRow?.role && selectedMediaRow.role !== 'view') {
      return selectedMediaRow.role;
    }
    return curRole;
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

  // Load project font data
  useEffect(() => {
    if (!project) return;
    const projRec = findRecord(memory, 'project', project) as
      Project | undefined;
    if (!projRec) return;
    let cancelled = false;
    void getFontData(projRec, artifactTypeId ?? 'project').then((data) => {
      if (!cancelled) setProjData(data);
    });
    return () => {
      cancelled = true;
    };
  }, [project, memory, artifactTypeId]);

  const handleTextAdd = useCallback(
    (newText: string) => {
      if (isReadOnly || !hasPermission || !mediafile) return;
      setTextValue((prev) => {
        const updated = prev + newText;
        toolChanged(currentstep, true);
        return updated;
      });
    },
    [isReadOnly, hasPermission, mediafile, toolChanged, currentstep]
  );

  const asr = useTranscribeAsr({
    team,
    sharedStr,
    tPlayer,
    showMessage,
    onTextAdd: handleTextAdd,
    getCurrentText: getTextValue,
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

  const [segParams, setSegParams] = useState<IRegionParams>({
    silenceThreshold: 0.004,
    timeThreshold: 0.02,
    segLenThreshold: 0.5,
  });

  useEffect(() => {
    const params = getOrgDefault(NamedRegions.Transcription) as IRegionParams;
    if (params) setSegParams(params);
  }, [getOrgDefault]);

  const onSegmentParamChange = useCallback(
    (params: IRegionParams, teamDefault: boolean) => {
      setSegParams(params);
      if (teamDefault && hasPermission && canSetOrgDefault) {
        setOrgDefault(NamedRegions.Transcription, params);
      }
    },
    [canSetOrgDefault, hasPermission, setOrgDefault]
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
      const savePromise = (async () => {
        try {
          await projectSegmentSave({
            media: currentMedia,
            segments: updatedSegments,
          });
        } catch (err) {
          logError(Severity.error, errorReporter, err as Error);
        }
      })();
      pendingSegmentSaveRef.current = savePromise;
      try {
        await savePromise;
      } finally {
        if (pendingSegmentSaveRef.current === savePromise) {
          pendingSegmentSaveRef.current = null;
        }
      }
    },
    [
      isReadOnly,
      hasPermission,
      mediafile,
      memory,
      projectSegmentSave,
      errorReporter,
    ]
  );

  const handleProgress = useCallback((progress: number) => {
    playedSecsRef.current = progress;
  }, []);

  const onPullTasks = useCallback(
    (remoteId: string) => {
      pullTableList(
        'mediafile',
        Array(remoteId),
        memory,
        remote,
        backup,
        errorReporter
      ).then(() => {
        if (forceRefresh) forceRefresh();
      });
    },
    [memory, remote, backup, errorReporter, forceRefresh]
  );

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
    actions.handleSave();
    setConfirm(undefined);
  }, [actions]);

  useEffect(() => {
    if (saveRequested(currentstep)) {
      actions.handleSave();
    } else if (clearRequested(currentstep)) {
      clearCompleted(currentstep);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolsChanged]);

  const stateKey = toCamel(actions.state);
  const localizedState = (ta as any)[stateKey] || actions.state;

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
        maxWidth: width,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <PassageDetailPlayer
        width={width}
        layoutMode="mobileTranscribe"
        allowSegment={
          !isReadOnly && hasPermission ? NamedRegions.Transcription : undefined
        }
        allowAutoSegment={!isReadOnly && hasPermission}
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
          <Button
            id="asrButton"
            variant="outlined"
            onClick={asr.handleTranscribe}
            startIcon={<TranscriptionLogo />}
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
            {tPlayer.recognizeSpeech || 'Auto Transcription...'}
          </Button>
        </Box>
      )}

      <Box sx={{ width: '100%', minWidth: 0 }}>
        <StyledTextAreaAutosize
          id="transcriptionText"
          ref={textareaRef}
          value={textValue}
          family={fontStyle.fontFamily}
          onChange={handleTextChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          readOnly={isReadOnly}
          placeholder={t.transcriptionType ?? 'Transcription'}
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
            .replace(
              '{0}',
              GetUser(memory, related(mediafile, 'lastModifiedByUser'))
                ?.attributes?.name ?? 'unknown'
            )
            .replace('{1}', confirm)}
          yesResponse={handleUpdateConfirmed}
          noResponse={handleUpdateRefused}
        />
      )}

      <BigDialog
        title={tPlayer.recognizeSpeechSettings}
        isOpen={asr.asrLangVisible}
        onOpen={() => asr.handleAsrLanguageClose(true)}
        bp={BigDialogBp.mobile}
      >
        <SelectAsrLanguage
          key={asr.asrLangVisible ? 'open' : 'closed'}
          team={team}
          onClose={asr.handleAsrLanguageClose}
        />
      </BigDialog>

      {asr.asrProgressVisible && (
        <BigDialog
          title={tPlayer.recognizeProgress}
          isOpen={asr.asrProgressVisible}
          onOpen={asr.setAsrProgressVisible}
          bp={BigDialogBp.mobile}
          mobileNoHorizontalScroll={true}
          mobilePaperWidth="min(356px, calc(100vw - 4px))"
          dialogContentSx={{ minWidth: 0, overflowX: 'hidden' }}
        >
          <AsrProgress
            mediaId={mediafile?.id ?? ''}
            phonetic={asr.phonetic}
            asrState={asr.asrOverride}
            force={!asrStatesEqual(asr.asrOverride, asr.asrSettings)}
            contentVerses={[]}
            setTranscription={asr.handleAutoTranscribe}
            onPullTasks={onPullTasks}
            onClose={() => asr.setAsrProgressVisible(false)}
          />
        </BigDialog>
      )}
    </Box>
  );
}

export default function PassageDetailTranscribeMobile(props: IProps) {
  const { currentstep, orgWorkflowSteps, section, passage, sharedResource } =
    usePassageDetailContext();
  const { canDoSectionStep } = useStepPermissions();
  const hasPermission =
    canDoSectionStep(currentstep, section) &&
    !isLinkedNote(passage, sharedResource);

  const { settings: workflowStepSettingsRaw } = useStepTool(currentstep);
  const stepSettings = useMemo(() => {
    if (!workflowStepSettingsRaw || workflowStepSettingsRaw === '') return '{}';
    return typeof workflowStepSettingsRaw === 'string'
      ? workflowStepSettingsRaw
      : JSON.stringify(workflowStepSettingsRaw);
  }, [workflowStepSettingsRaw]);

  const parsedSettings = useMemo(() => {
    try {
      return JSON.parse(stepSettings || '{}') as { artifactTypeId?: string };
    } catch {
      return {} as { artifactTypeId?: string };
    }
  }, [stepSettings]);

  const artifactTypeId = parsedSettings?.artifactTypeId ?? null;
  const { slugFromId } = useArtifactType();

  const parsedSteps = useMemo(() => {
    if (!orgWorkflowSteps) return [];
    return orgWorkflowSteps
      .slice()
      .sort(
        (a, b) =>
          (a.attributes.sequencenum ?? 0) - (b.attributes.sequencenum ?? 0)
      )
      .map((s, ix) => {
        const toolData = JSONParse(s?.attributes?.tool) as {
          tool?: string;
          settings?: string | object;
        };
        return {
          id: s.id,
          sequencenum: ix,
          tool: toolData.tool ?? '',
          settings:
            typeof toolData.settings === 'string'
              ? toolData.settings || '{}'
              : JSON.stringify(toolData.settings ?? {}),
        } as IStep;
      });
  }, [orgWorkflowSteps]);

  const vernacularSteps = useMemo(() => {
    return parsedSteps.filter(
      (s) =>
        s.tool === ToolSlug.Transcribe && !JSON.parse(s.settings).artifactTypeId
    );
  }, [parsedSteps]);

  const hasChecking = useMemo(() => {
    return (
      vernacularSteps.length > 1 &&
      (vernacularSteps[1] as IStep).sequencenum ===
        (vernacularSteps[0] as IStep).sequencenum + 1
    );
  }, [vernacularSteps]);

  const curRole = useMemo(() => {
    if (!currentstep) return undefined;
    if (!hasPermission) return 'view';
    if (!hasChecking) return 'transcriber';
    if (artifactTypeId) return 'transcriber';
    if ((vernacularSteps[0] as IStep)?.id === currentstep) return 'transcriber';
    return 'editor';
  }, [
    currentstep,
    vernacularSteps,
    artifactTypeId,
    hasChecking,
    hasPermission,
  ]);

  const stepLanguageBcp47 = useMemo(() => {
    if (!artifactTypeId) return undefined;
    if (
      !artifactStampsStepLanguage(
        slugFromId(artifactTypeId) as ArtifactTypeSlug
      )
    )
      return undefined;
    const { bcp47 } = parseMediaLanguageField(
      (() => {
        try {
          return (JSON.parse(stepSettings) as { language?: unknown }).language;
        } catch {
          return undefined;
        }
      })()
    );
    return isLangSet(bcp47) ? bcp47 : undefined;
  }, [artifactTypeId, slugFromId, stepSettings]);

  return (
    <TranscriberProvider
      artifactTypeId={artifactTypeId}
      curRole={curRole as string}
      stepLanguageBcp47={stepLanguageBcp47}
    >
      <PassageDetailTranscribeMobileContent {...props} />
    </TranscriberProvider>
  );
}
