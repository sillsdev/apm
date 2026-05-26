import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import {
  ArtifactTypeSlug,
  IMediaState,
  MediaSt,
  remoteIdGuid,
  useArtifactType,
} from '../../../crud';
import { ReplaceRelatedRecord } from '../../../model/baseModel';
import {
  RecordIdentity,
  RecordKeyMap,
  RecordTransformBuilder,
} from '@orbit/records';
import { useGlobal } from '../../../context/useGlobal';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import { UnsavedContext } from '../../../context/UnsavedContext';
import MediaRecord from '../../MediaRecord';
import { useStepPermissions } from '../../../utils/useStepPermission';
import { useSecResCreate, useSecResDelete } from '../../../crud';
import { usePromptSectionResource } from './usePromptSectionResource';
import { SectionResourceD } from '../../../model';
import { promptSelector, sharedSelector } from '../../../selector';
import { IPromptStrings, ISharedStrings } from '../../../model';
import { useMobile } from '../../../utils';

interface IProps {
  width: number;
}

const toolId = 'PromptTool';

export default function PassageDetailPromptAdmin(props: IProps) {
  const { width } = props;
  const [memory] = useGlobal('memory');
  const [offline] = useGlobal('offline');
  const [offlineOnly] = useGlobal('offlineOnly');
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const promptStrings: IPromptStrings = useSelector(
    promptSelector,
    shallowEqual
  );
  const { getTypeId } = useArtifactType();
  const {
    rowData,
    section,
    currentstep,
    forceRefresh,
    setRecording,
    setPromptDockedRecordButton,
  } = usePassageDetailContext();
  const { canDoSectionStep, canAlwaysDoStep } = useStepPermissions();
  const { promptMediaId, sectionResource, hasPrompt } =
    usePromptSectionResource(rowData, section, currentstep);
  const { AddSectionResource } = useSecResCreate(section, currentstep);
  const DeleteSectionResource = useSecResDelete();
  const {
    startSave,
    toolChanged,
    toolsChanged,
    clearRequested,
    clearCompleted,
  } = useContext(UnsavedContext).state;
  const [, setBigBusy] = useGlobal('importexportBusy');
  const [canSave, setCanSave] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [preload, setPreload] = useState(0);
  const [recorderState, setRecorderState] = useState<IMediaState>();
  const sectionResourceRef = useRef<SectionResourceD | null>(null);
  /** Prevents preload ↔ trackState update loops; reset when promptMediaId changes. */
  const recordPreloadInitiatedRef = useRef<string | null>(null);

  const resourceArtifactId = useMemo(
    () => getTypeId(ArtifactTypeSlug.Resource) || '',
    [getTypeId]
  );

  const canEdit = canAlwaysDoStep() || canDoSectionStep(currentstep, section);
  const promptAddBlocked = offline || offlineOnly;
  const { isMobile } = useMobile();

  useEffect(() => {
    sectionResourceRef.current = sectionResource;
  }, [sectionResource]);

  useEffect(() => {
    toolChanged(toolId, canSave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSave]);

  useEffect(() => {
    if (clearRequested(toolId)) {
      const sr = sectionResourceRef.current;
      if (sr) {
        void DeleteSectionResource(sr).then(() => {
          forceRefresh();
          clearCompleted(toolId);
        });
      } else {
        clearCompleted(toolId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolsChanged]);

  useEffect(() => {
    recordPreloadInitiatedRef.current = null;
  }, [promptMediaId]);

  useEffect(() => {
    return () => setPromptDockedRecordButton(null);
  }, [setPromptDockedRecordButton]);

  useEffect(() => {
    if (!isMobile) {
      setPromptDockedRecordButton(null);
    }
  }, [isMobile, setPromptDockedRecordButton]);

  useEffect(() => {
    const hasExisting =
      Boolean(promptMediaId) &&
      recorderState?.status === MediaSt.FETCHED &&
      recorderState?.id === promptMediaId;
    const shouldAutoPreload =
      hasExisting && recordPreloadInitiatedRef.current !== promptMediaId;
    if (shouldAutoPreload && promptMediaId) {
      recordPreloadInitiatedRef.current = promptMediaId;
      setPreload((p) => p + 1);
    }
  }, [promptMediaId, recorderState]);

  const linkMediaToStep = async (mediaId: string) => {
    const mediaRecId = { type: 'mediafile', id: mediaId } as RecordIdentity;
    const t = new RecordTransformBuilder();
    await memory.update([
      ...ReplaceRelatedRecord(
        t,
        mediaRecId,
        'orgWorkflowStep',
        'orgworkflowstep',
        currentstep
      ),
    ]);
  };

  const afterUploadCb = async (mediaId: string | undefined) => {
    if (!mediaId) {
      setStatusText(ts.NoSaveWoMedia);
      return;
    }
    setStatusText('');
    const existing = sectionResourceRef.current;
    if (existing) {
      await DeleteSectionResource(existing);
      sectionResourceRef.current = null;
    }
    const mediaRecId = {
      type: 'mediafile',
      id:
        remoteIdGuid('mediafile', mediaId, memory?.keyMap as RecordKeyMap) ||
        mediaId,
    } as RecordIdentity;
    await linkMediaToStep(mediaRecId.id);
    await AddSectionResource(0, null, mediaRecId);
    forceRefresh();
    setPreload((p) => p + 1);
  };

  const handleTrackRecorder = (state: IMediaState) => setRecorderState(state);

  const handleRecording = (recording: boolean) => {
    setRecording(recording);
  };

  const handleSave = () => {
    startSave(toolId);
  };

  const onSaving = () => {
    setBigBusy(true);
  };

  const onReady = () => {
    setBigBusy(false);
  };

  const defaultFilename = useMemo(() => `prompt-${section.id}`, [section.id]);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const desktopWidth = Math.max(0, width);
  const [mobilePlayerWidth, setMobilePlayerWidth] = useState(desktopWidth);

  useLayoutEffect(() => {
    if (!isMobile) {
      setMobilePlayerWidth(desktopWidth);
      return;
    }
    const el = playerContainerRef.current;
    if (!el) return;
    const updateWidth = () => setMobilePlayerWidth(el.offsetWidth);
    updateWidth();
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateWidth);
      observer.observe(el);
    }
    return () => observer?.disconnect();
  }, [isMobile, desktopWidth]);

  const playerWidth = isMobile ? mobilePlayerWidth : desktopWidth;
  const layoutWidth = isMobile ? '100%' : desktopWidth;

  return (
    <Stack
      sx={{
        width: layoutWidth,
        maxWidth: layoutWidth,
        minWidth: 0,
        alignItems: 'stretch',
        boxSizing: 'border-box',
      }}
    >
      <Box ref={playerContainerRef} sx={{ width: '100%', minWidth: 0 }}>
        <MediaRecord
          toolId={toolId}
          artifactId={resourceArtifactId}
          passageId={undefined}
          afterUploadCb={afterUploadCb}
          mediaId={promptMediaId}
          onSaving={onSaving}
          onReady={onReady}
          onRecording={handleRecording}
          defaultFilename={defaultFilename}
          allowRecord={canEdit && !promptAddBlocked}
          allowZoom={true}
          allowWave={true}
          preload={preload}
          trackState={handleTrackRecorder}
          setCanSave={setCanSave}
          setStatusText={setStatusText}
          handleSave={handleSave}
          isSaveDisabled={!canEdit || promptAddBlocked}
          height={280}
          width={playerWidth}
          forceMobileView={true}
          dockRecordButton={isMobile}
          onDockedRecordButton={
            isMobile ? setPromptDockedRecordButton : undefined
          }
          metaData={hasPrompt ? undefined : <span>{statusText}</span>}
        />
      </Box>
      {canEdit && promptAddBlocked && (
        <Typography
          variant="body1"
          align="center"
          color="text.secondary"
          sx={{ mt: 2, px: 1, width: '100%', alignSelf: 'stretch' }}
        >
          {promptStrings.offlineCannotAdd}
        </Typography>
      )}
      {canEdit && !promptAddBlocked && (
        <Typography
          variant="body1"
          align="center"
          sx={{ mt: 2, px: 1, width: '100%', alignSelf: 'stretch' }}
        >
          {promptStrings.adminInstructions}
        </Typography>
      )}
    </Stack>
  );
}
