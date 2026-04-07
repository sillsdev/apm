import { shallowEqual, useSelector } from 'react-redux';
import { ISharedStrings, IState, MediaFileD } from '../../model';
import { Typography, Box, Stack } from '@mui/material';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  findRecord,
  IMediaState,
  MediaSt,
  related,
  useFetchMediaUrl,
  useSharedResRead,
  VernacularTag,
} from '../../crud';
import { useGlobal } from '../../context/useGlobal';
import usePassageDetailContext from '../../context/usePassageDetailContext';
import { passageDefaultFilename } from '../../utils/passageDefaultFilename';
import { useStepTool } from '../../crud/useStepTool';
import { useSnackBar } from '../../hoc/SnackBar';
import MediaRecord from '../MediaRecord';
import { UnsavedContext } from '../../context/UnsavedContext';
import Uploader from '../Uploader';
import AudacityManager from '../Sheet/AudacityManager';
import { AltButton, PriButton } from '../../control';
import BigDialog from '../../hoc/BigDialog';
import BigDialogBp from '../../hoc/BigDialogBp';
import VersionDlg from '../AudioTab/VersionDlg';
import { usePassageVernacularVersionCount } from '../AudioTab/usePassageVersionAudioRows';
import SpeakerName from '../SpeakerName';
import { sharedSelector } from '../../selector';
import { useMobile } from '../../utils';
import { useOrbitData } from '../../hoc/useOrbitData';
import { RecordIdentity } from '@orbit/records';
import { useStepPermissions } from '../../utils/useStepPermission';

interface IProps {
  ready?: () => boolean;
  width: number;
}

const SaveWait = 500;

export function PassageDetailRecord(props: IProps) {
  const { ready } = props;
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const {
    startSave,
    toolChanged,
    toolsChanged,
    saveRequested,
    clearRequested,
    clearCompleted,
    waitForSave,
  } = useContext(UnsavedContext).state;
  const [reporter] = useGlobal('errorReporter');
  const [, setBigBusy] = useGlobal('importexportBusy');
  const [plan] = useGlobal('plan'); //will be constant here
  const { fetchMediaUrl, mediaState } = useFetchMediaUrl(reporter);
  const [statusText, setStatusText] = useState('');
  const [canSave, setCanSave] = useState(false);
  const [offline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [memory] = useGlobal('memory');
  const {
    passage,
    sharedResource,
    mediafileId,
    chooserSize,
    setRecording,
    currentstep,
  } = usePassageDetailContext();
  const { showMessage } = useSnackBar();
  const toolId = 'RecordTool';
  const { settings: toolSettings } = useStepTool(currentstep);
  const onSaving = () => {
    setBigBusy(true);
  };
  const onReady = () => {
    setBigBusy(false);
  };
  const [importList, setImportList] = useState<File[]>();
  const cancelled = useRef(false);
  const [uploadVisible, setUploadVisiblex] = useState(false);
  const [audacityVisible, setAudacityVisible] = useState(false);
  const [versionVisible, setVersionVisible] = useState(false);
  const [preload, setPreload] = useState(0);
  const [recorderState, setRecorderState] = useState<IMediaState>();
  const [hasExistingVersion, setHasExistingVersion] = useState(false);
  /** Prevents handleReload ↔ mediaState PENDING/FETCHED loops; reset when mediafileId changes. */
  const recordPreloadInitiatedRef = useRef<string | null>(null);
  const [resetMedia, setResetMedia] = useState(false);
  const [speaker, setSpeaker] = useState('');
  const [hasRights, setHasRight] = useState(false);
  const { canDoVernacular } = useStepPermissions();
  const { isMobile: isMobileView } = useMobile();
  const allBookData = useSelector((state: IState) => state.books.bookData);
  const { getSharedResource } = useSharedResRead();

  const defaultFilename = useMemo(() => {
    const sr = getSharedResource(passage);
    return passageDefaultFilename(
      passage,
      plan,
      memory,
      VernacularTag,
      offline,
      '',
      toolSettings,
      allBookData,
      sr?.attributes.title
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getSharedResource, passage, plan, offline, toolSettings, allBookData]);

  const setUploadVisible = (value: boolean) => {
    if (value) {
      cancelled.current = false;
    }
    setUploadVisiblex(value);
  };

  useEffect(() => {
    toolChanged(toolId, canSave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSave]);

  useEffect(() => {
    if (saveRequested(toolId)) handleSave();
    else if (clearRequested(toolId)) {
      clearCompleted(toolId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolsChanged]);
  useEffect(() => {
    if (!mediafileId) {
      fetchMediaUrl({ id: mediafileId });
      setResetMedia(true);
    } else if (mediafileId !== mediaState.id) {
      fetchMediaUrl({ id: mediafileId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediafileId, passage]);

  useEffect(() => {
    const mediaRec = findRecord(memory, 'mediafile', mediafileId) as
      | MediaFileD
      | undefined;
    const performer = mediaRec?.attributes?.performedBy;
    if (performer) {
      setSpeaker(performer);
      setHasRight(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediafileId, mediafiles]);

  useEffect(() => {
    recordPreloadInitiatedRef.current = null;
  }, [mediafileId]);

  useEffect(() => {
    const hasExisting =
      Boolean(mediafileId) &&
      recorderState?.status === MediaSt.FETCHED &&
      recorderState?.id === mediafileId;
    const shouldAutoPreload =
      hasExisting && recordPreloadInitiatedRef.current !== mediafileId;
    if (shouldAutoPreload) {
      recordPreloadInitiatedRef.current = mediafileId;
      handleReload();
    }
    setHasExistingVersion(hasExisting);
  }, [mediafileId, recorderState]);

  const passageId = useMemo(
    () => related(sharedResource, 'passage') ?? passage.id,
    [sharedResource, passage]
  );
  const vernacularVersionCount = usePassageVernacularVersionCount(passageId);
  const handleSave = () => {
    startSave(toolId);
  };
  const afterUploadCb = async (mediaId: string | undefined) => {
    if (mediaId) {
      setStatusText('');
    } else setStatusText(ts.NoSaveWoMedia);
  };
  const afterUpload = async (planId: string, mediaRemoteIds?: string[]) => {
    const mediaId =
      mediaRemoteIds && mediaRemoteIds.length > 0
        ? mediaRemoteIds[0]
        : undefined;
    afterUploadCb(mediaId);
    if (mediaId) handleReload();
    if (importList) {
      setImportList(undefined);
      setUploadVisible(false);
      setAudacityVisible(false);
    }
  };

  const saveIfChanged = (cb: () => void) => {
    if (canSave) {
      startSave(toolId);
      waitForSave(() => cb(), SaveWait);
    } else cb();
  };

  const handleAudacityImport = (i: number, list: File[]) => {
    saveIfChanged(() => {
      setImportList(list);
      setUploadVisible(true);
    });
  };

  const handleAudacityClose = () => {
    setAudacityVisible(false);
  };
  const handleUploadVisible = (v: boolean) => {
    setUploadVisible(v);
  };
  const handleUpload = () => {
    saveIfChanged(() => {
      setUploadVisible(true);
    });
  };
  const handleAudacity = () => {
    saveIfChanged(() => {
      setAudacityVisible(true);
    });
  };
  const handleVersions = () => {
    setVersionVisible(true);
  };
  const handleVerHistClose = () => {
    setVersionVisible(false);
  };
  const handleNameChange = (name: string) => {
    setSpeaker(name);
  };
  const handleRights = (hasRights: boolean) => setHasRight(hasRights);
  const handleReload = () => {
    setPreload((p) => p + 1);
  };
  const handleTrackRecorder = (state: IMediaState) => setRecorderState(state);
  const handleRecording = (recording: boolean) => {
    setRecording(recording);
  };

  const canVern = canDoVernacular(related(passage, 'section'));

  return (
    <Stack sx={{ width: props.width, maxWidth: props.width, minWidth: 0 }}>
      <Box sx={{ py: 1 }}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ width: '100%', minWidth: 0 }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <SpeakerName
              name={speaker}
              onChange={handleNameChange}
              onRights={handleRights}
              disabled={!canVern}
            />
          </Box>
          {canVern && (
            <AltButton
              id="pdRecordLoadFile"
              onClick={handleUpload}
              title={ts.loadFromFile}
              startIcon={
                <FolderOpenOutlinedIcon sx={{ width: '14px', height: '14px' }} />
              }
              sx={{ flexShrink: 0 }}
            >
              {ts.loadFromFile}
            </AltButton>
          )}
        </Stack>
      </Box>
      <MediaRecord
        toolId={toolId}
        artifactId={VernacularTag}
        passageId={passageId}
        afterUploadCb={afterUploadCb}
        performedBy={speaker}
        mediaId={mediafileId}
        onSaving={onSaving}
        onReady={onReady}
        onRecording={handleRecording}
        defaultFilename={defaultFilename}
        allowRecord={hasRights && canVern}
        allowZoom={true}
        allowWave={true}
        preload={preload}
        trackState={handleTrackRecorder}
        setCanSave={setCanSave}
        setStatusText={setStatusText}
        doReset={resetMedia}
        setDoReset={setResetMedia}
        height={300 - chooserSize}
        width={props.width}
        allowNoNoise={true}
        allowDeltaVoice={true}
        handleSave={handleSave}
        forceMobileView={true}
        isSaveDisabled={
          (ready && !ready()) || !hasRights || !canVern
        }
        metaData={
          <>
            <Typography
              variant="caption"
              sx={{
                mr: 2,
                alignSelf: 'center',
                display: 'block',
                gutterBottom: 'true',
              }}
            >
              {statusText}
            </Typography>
            {!isMobileView && canSave && (
              <PriButton
                id="rec-save"
                onClick={handleSave}
                disabled={
                  (ready && !ready()) || !hasRights || !canVern
                }
              >
                {ts.save}
              </PriButton>
            )}
          </>
        }
        onVersions={
          hasExistingVersion &&
          (vernacularVersionCount > 1)
            ? handleVersions
            : undefined
        }
      />

      <Uploader
        recordAudio={false}
        importList={importList}
        isOpen={uploadVisible}
        onOpen={handleUploadVisible}
        showMessage={showMessage}
        multiple={false}
        finish={afterUpload}
        cancelled={cancelled}
        passageId={passageId}
        performedBy={speaker}
        onSpeakerChange={handleNameChange}
      />
      <AudacityManager
        item={1}
        open={audacityVisible}
        onClose={handleAudacityClose}
        passageId={
          {
            type: 'passage',
            id: passageId,
          } as RecordIdentity
        }
        mediaId={mediafileId}
        onImport={handleAudacityImport}
        speaker={speaker}
        onSpeaker={handleNameChange}
      />
      <BigDialog
        title={ts.versionHistory}
        isOpen={versionVisible}
        onOpen={handleVerHistClose}
        bp={isMobileView ? BigDialogBp.mobile : undefined}
      >
        <VersionDlg
          passId={passageId}
          canSetDestination={false}
          hasPublishing={false}
          close={handleVerHistClose}
          onVersionApplied={handleReload}
        />
      </BigDialog>
    </Stack>
  );
}

export default PassageDetailRecord;
