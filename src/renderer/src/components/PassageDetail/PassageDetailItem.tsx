import { shallowEqual } from 'react-redux';
import { ICommunityStrings, ISharedStrings, MediaFileD } from '../../model';
import {
  Button,
  FormControlLabel,
  IconButton,
  Paper,
  Radio,
  RadioGroup,
  TextField,
  Typography,
  Box,
  SxProps,
  styled,
  Stack,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArtifactTypeSlug,
  IRegionParams,
  related,
  useArtifactType,
  useFetchMediaUrl,
  useOrgDefaults,
  useRole,
} from '../../crud';
import usePassageDetailContext from '../../context/usePassageDetailContext';
import Memory from '@orbit/memory';
import { AlertSeverity, useSnackBar } from '../../hoc/SnackBar';
import { getSegments, NamedRegions } from '../../utils/namedSegments';
import PassageDetailPlayer from './PassageDetailPlayer';
import { SaveSegments } from './SaveSegments';
import MediaPlayer from '../MediaPlayer';
import MediaRecord from '../MediaRecord';
import SelectRecording from './SelectRecording';
import { useGlobal } from '../../context/useGlobal';
import { UnsavedContext } from '../../context/UnsavedContext';
import Confirm from '../AlertDialog';
import Uploader from '../Uploader';
import AddIcon from '@mui/icons-material/LibraryAddOutlined';
import { GrowingSpacer, LightTooltip, PriButton } from '../../control';
import { useSelector } from 'react-redux';
import { communitySelector, sharedSelector } from '../../selector';
import { passageDefaultFilename } from '../../utils/passageDefaultFilename';
import PassageDetailChooser from './PassageDetailChooser';
import ArtifactStatus from '../ArtifactStatus';
import { useOrbitData } from '../../hoc/useOrbitData';
import { useStepPermissions } from '../../utils/useStepPermission';
import { btDefaultSegParams } from './btDefaultSegParams';
import DiscussionPanel from '../../components/Discussions/DiscussionPanel';

const PlayerRow = styled('div')(() => ({
  width: '100%',
  '& audio': {
    display: 'flex',
    width: 'inherit',
  },
  display: 'flex',
}));

const paperProps = { p: 2, m: 'auto', width: `calc(100% - 40px)` } as SxProps;
const buttonProp = { mx: 1 } as SxProps;
const ctlProps = { m: 1, pb: 2 } as SxProps;
const statusProps = {
  mr: 2,
  alignSelf: 'center',
  display: 'block',
  gutterBottom: 'true',
} as SxProps;

interface IProps {
  ready?: () => boolean;
  width: number;
  slugs: ArtifactTypeSlug[];
  segments: NamedRegions | undefined;
  showTopic: boolean;
}

export function PassageDetailItem(props: IProps) {
  const { width, slugs, segments, showTopic } = props;
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const oneTryOnly = slugs.includes(ArtifactTypeSlug.WholeBackTranslation);
  const t: ICommunityStrings = useSelector(communitySelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const [reporter] = useGlobal('errorReporter');
  const [organization] = useGlobal('organization');
  const [plan] = useGlobal('plan'); //will be constant here
  const { fetchMediaUrl, mediaState } = useFetchMediaUrl(reporter);
  const [statusText, setStatusText] = useState('');
  const [canSave, setCanSave] = useState(false);
  const [defaultFilename, setDefaultFileName] = useState('');
  const [coordinator] = useGlobal('coordinator');
  const [offline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const memory = coordinator?.getSource('memory') as Memory;
  const [speaker, setSpeaker] = useState('');
  const [topic, setTopic] = useState('');
  const [importList, setImportList] = useState<File[]>();
  const [uploadVisible, setUploadVisiblex] = useState(false);
  const [resetMedia, setResetMedia] = useState(false);
  const [confirm, setConfirm] = useState('');
  const { userIsAdmin } = useRole();
  const {
    passage,
    sharedResource,
    playerMediafile,
    discussionSize,
    rowData,
    currentSegment,
    currentSegmentIndex,
    getCurrentSegment,
    setCommentPlaying,
    playItem,
    setPlayItem,
    itemPlaying,
    setItemPlaying,
    handleItemTogglePlay,
    handleItemPlayEnd,
    setRecording,
    currentstep,
    section,
    discussOpen,
  } = usePassageDetailContext();
  const { toolChanged, startSave, saveCompleted, saveRequested } =
    useContext(UnsavedContext).state;

  const { getTypeId, localizedArtifactType } = useArtifactType();
  const { showMessage } = useSnackBar();
  const [recordType, setRecordType] = useState<ArtifactTypeSlug>(
    slugs[0] as ArtifactTypeSlug
  );
  const [currentVersion, setCurrentVersion] = useState(1);
  const [segString, setSegString] = useState('{}');
  const [verses, setVerses] = useState('');
  const cancelled = useRef(false);
  const { canDoSectionStep } = useStepPermissions();
  const { getOrgDefault, setOrgDefault, canSetOrgDefault } = useOrgDefaults();
  const [segParams, setSegParams] = useState<IRegionParams>(btDefaultSegParams);
  const toolId = 'RecordArtifactTool';
  const [paneWidth, setPaneWidth] = useState(0);

  const rowProp = useMemo(
    () => ({ display: 'flex', width: paneWidth - 40 }),
    [discussOpen, paneWidth, width]
  );

  useEffect(() => {
    let newPaneWidth = width - 16;
    if (discussOpen) newPaneWidth -= discussionSize.width;
    setPaneWidth(newPaneWidth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discussionSize, width, discussOpen]);

  const setUploadVisible = (value: boolean) => {
    if (value) {
      cancelled.current = false;
    }
    setUploadVisiblex(value);
  };

  const mediafileId = useMemo(() => {
    return playerMediafile?.id ?? '';
  }, [playerMediafile]);
  useEffect(() => {
    if (segments) {
      const def = getOrgDefault(segments) as IRegionParams;
      if (def) setSegParams(def);
      else setSegParams(btDefaultSegParams);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization]);

  useEffect(() => {
    if (!slugs.find((s) => s === recordType))
      setRecordType(slugs[0] as ArtifactTypeSlug);
    setSpeaker('');
  }, [slugs, recordType]);

  useEffect(() => {
    toolChanged(toolId, canSave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSave]);

  useEffect(() => {
    if (mediafileId !== mediaState.id) fetchMediaUrl({ id: mediafileId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediafileId, mediaState.id]);

  const hasBtRecordings = useMemo(() => {
    const mediaRec = mediafiles.find((m) => m.id === mediafileId);
    const btType = localizedArtifactType(
      ArtifactTypeSlug.PhraseBackTranslation
    );
    const version = mediaRec?.attributes.versionNumber;
    return rowData.some(
      (r) => r.artifactType === btType && r.sourceVersion === version
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowData, mediafileId, mediafiles]);

  useEffect(() => {
    const mediaRec = mediafiles.find((m) => m.id === mediafileId);
    const defaultSegments = mediaRec?.attributes?.segments ?? '{}';
    const newSegString = getSegments(
      NamedRegions.BackTranslation,
      defaultSegments
    );
    if (segString !== newSegString) {
      setSegString(newSegString);
      if (hasBtRecordings)
        showMessage(t.segmentsChanged, AlertSeverity.Warning);
    }
    setVerses(getSegments(NamedRegions.Verse, defaultSegments));
    setCurrentVersion(mediaRec?.attributes?.versionNumber || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediafileId, mediafiles, hasBtRecordings]);

  const recordTypeId = useMemo(
    () => getTypeId(recordType),
    [recordType, getTypeId]
  );

  const artifactState = useMemo(() => ({ id: recordTypeId }), [recordTypeId]);

  useEffect(() => {
    const mediaRec = rowData.filter(
      (r) => related(r.mediafile, 'artifactType') === recordTypeId
    );
    let postfix =
      recordType +
      (mediaRec.length + 1).toString() +
      '_v' +
      currentVersion.toString();
    if (currentSegmentIndex > 0)
      postfix += 's' + currentSegmentIndex.toString();
    setDefaultFileName(
      passageDefaultFilename(
        passage,
        plan,
        memory,
        recordTypeId,
        offline,
        postfix
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    memory,
    passage,
    rowData,
    recordType,
    currentSegmentIndex,
    currentVersion,
  ]);

  const handleSave = () => {
    //tell the media recorder to save
    if (!saveRequested(toolId)) {
      startSave(toolId);
    }
  };

  //from recorder
  const afterUploadCb = async (mediaId: string | undefined) => {
    afterUpload('', mediaId ? [mediaId] : undefined);
  };

  const afterUpload = async (planId: string, mediaRemoteIds?: string[]) => {
    if (mediaRemoteIds && mediaRemoteIds[0]) {
      setStatusText('');
      setTopic('');
      saveCompleted(toolId);
      setResetMedia(true);
      if (importList) {
        setImportList(undefined);
        setUploadVisible(false);
      }
    } else {
      saveCompleted(toolId, ts.NoSaveOffline);
      showMessage(ts.NoSaveOffline);
    }
  };

  const handleCancel = () => {
    handleItemPlayEnd();
    setPlayItem('');
  };

  const handleUploadVisible = (v: boolean) => {
    setUploadVisible(v);
  };
  const handleUpload = () => {
    if (canSave) {
      showMessage(t.saveFirst);
      return;
    }
    setImportList(undefined);
    setUploadVisible(true);
  };

  const handleSetCanSave = (valid: boolean) => {
    if (valid !== canSave) {
      setCanSave(valid);
    }
  };
  const handleChangeType = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRecordType((event.target as HTMLInputElement).value as ArtifactTypeSlug);
  };
  const handleChangeSpeaker = (e: any) => {
    e.persist();
    setSpeaker(e.target.value);
  };
  const handleChangeTopic = (e: any) => {
    e.persist();
    setTopic(e.target.value);
  };
  const handleSelect = (id: string) => {
    //latest isn't used anymore but might be useful...so leave it
    setPlayItem(id);
    setItemPlaying(true);
    setCommentPlaying(false);
  };

  const handleDelete = (id: string) => () => {
    setConfirm(id);
  };

  const handleDeleteConfirmed = () => {
    memory
      .update((t) => t.removeRecord({ type: 'mediafile', id: confirm }))
      .finally(() => {
        setConfirm('');
        setPlayItem('');
      });
  };
  const handleDeleteRefused = () => {
    setConfirm('');
  };

  const onRecordingOrPlaying = (doingsomething: boolean) => {
    setRecording(doingsomething);
  };
  const onSegmentParamChange = (
    params: IRegionParams,
    teamDefault: boolean
  ) => {
    setSegParams(params);
    if (teamDefault && segments) setOrgDefault(segments, params);
  };

  const editStep = useMemo(
    () => canDoSectionStep(currentstep, section),
    [canDoSectionStep, currentstep, section]
  );

  return (
    <div>
      <Paper sx={paperProps}>
        <div>
          {currentVersion !== 0 ? (
            <Stack direction="row" spacing={1}>
              <Box>
                <PassageDetailChooser width={paneWidth} />
                <PassageDetailPlayer
                  width={paneWidth - 40}
                  allowSegment={segments}
                  allowAutoSegment={segments !== undefined}
                  saveSegments={
                    segments !== undefined && editStep
                      ? SaveSegments.showSaveButton
                      : undefined
                  }
                  defaultSegParams={segParams}
                  suggestedSegments={segString}
                  verses={verses}
                  canSetDefaultParams={editStep && canSetOrgDefault}
                  onSegmentParamChange={
                    editStep ? onSegmentParamChange : undefined
                  }
                />
                <Box>
                  <Box sx={rowProp}>
                    <ArtifactStatus
                      recordType={recordType}
                      currentVersion={currentVersion}
                      rowData={rowData}
                      segments={segString}
                      width={paneWidth}
                    />
                  </Box>
                  <Box sx={rowProp}>
                    <Button
                      sx={buttonProp}
                      id="pdRecordUpload"
                      onClick={handleUpload}
                      title={ts.uploadMediaSingular}
                    >
                      <AddIcon />
                      {ts.uploadMediaSingular}
                    </Button>
                    <GrowingSpacer />
                    {currentSegment && (
                      <TextField
                        sx={ctlProps}
                        id="segment"
                        value={currentSegment}
                        size={'small'}
                        label={t.segment}
                      />
                    )}
                  </Box>
                  <Box sx={rowProp}>
                    <Typography sx={statusProps}>{t.record}</Typography>
                    {slugs.length > 1 && (
                      <RadioGroup
                        row={true}
                        id="filetype"
                        aria-label="filetype"
                        name="filetype"
                        value={recordType}
                        onChange={handleChangeType}
                      >
                        {slugs.map((s) => (
                          <FormControlLabel
                            key={s}
                            id={s}
                            value={s}
                            control={<Radio />}
                            label={localizedArtifactType(s)}
                          />
                        ))}
                      </RadioGroup>
                    )}
                    <GrowingSpacer />
                    {showTopic && (
                      <TextField
                        sx={ctlProps}
                        id="itemtopic"
                        label={t.topic}
                        value={topic}
                        fullWidth={true}
                        onChange={handleChangeTopic}
                      />
                    )}
                    <TextField
                      sx={ctlProps}
                      id="speaker"
                      label={t.speaker}
                      value={speaker}
                      onChange={handleChangeSpeaker}
                      fullWidth={true}
                    />
                  </Box>
                  <MediaRecord
                    toolId={toolId}
                    passageId={related(sharedResource, 'passage') ?? passage.id}
                    sourceSegments={JSON.stringify(getCurrentSegment())}
                    sourceMediaId={mediafileId}
                    artifactId={recordTypeId}
                    performedBy={speaker}
                    topic={topic}
                    afterUploadCb={afterUploadCb}
                    defaultFilename={defaultFilename}
                    allowWave={false}
                    showFilename={false}
                    setCanSave={handleSetCanSave}
                    setStatusText={setStatusText}
                    doReset={resetMedia}
                    setDoReset={setResetMedia}
                    height={200}
                    width={paneWidth - 40}
                    onRecording={onRecordingOrPlaying}
                    onPlayStatus={onRecordingOrPlaying}
                    oneTryOnly={oneTryOnly}
                    noNewVoice={true}
                    allowDeltaVoice={true}
                    allowNoNoise={true}
                  />
                  <Box sx={rowProp}>
                    <Typography variant="caption" sx={statusProps}>
                      {statusText}
                    </Typography>
                    <GrowingSpacer />
                    <PriButton
                      id="rec-save"
                      sx={buttonProp}
                      onClick={handleSave}
                      disabled={!canSave}
                    >
                      {ts.save}
                    </PriButton>
                  </Box>
                </Box>
                <Box>
                  <Box sx={rowProp}>
                    <Box sx={{ width: '100%' }}>
                      <Box
                        id="playselect"
                        sx={{
                          display: 'flex',
                          flexDirection: 'row',
                          pr: 4,
                          pb: 1,
                        }}
                      >
                        <SelectRecording
                          onChange={handleSelect}
                          tags={slugs}
                          latestVernacular={currentVersion}
                        />
                      </Box>
                      <PlayerRow id="rowplayer">
                        <MediaPlayer
                          srcMediaId={playItem}
                          requestPlay={itemPlaying}
                          onEnded={handleItemPlayEnd}
                          onCancel={handleCancel}
                          onTogglePlay={handleItemTogglePlay}
                          controls={true}
                        />
                        {playItem && userIsAdmin && (
                          <LightTooltip title={t.deleteItem}>
                            <IconButton
                              id="delete-recording"
                              onClick={handleDelete(playItem)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </LightTooltip>
                        )}
                        <Box sx={{ width: '40px' }} />
                      </PlayerRow>
                    </Box>
                  </Box>
                </Box>
              </Box>
              <DiscussionPanel />
            </Stack>
          ) : (
            <Paper sx={paperProps}>
              <Typography variant="h2" align="center">
                {ts.noAudio}
              </Typography>
            </Paper>
          )}
          {confirm && (
            <Confirm
              text={t.deleteItem}
              yesResponse={handleDeleteConfirmed}
              noResponse={handleDeleteRefused}
            />
          )}
        </div>
      </Paper>
      <Uploader
        noBusy={true}
        recordAudio={false}
        importList={importList ?? []}
        isOpen={uploadVisible}
        onOpen={handleUploadVisible}
        showMessage={showMessage}
        multiple={false}
        finish={afterUpload}
        cancelled={cancelled}
        passageId={related(sharedResource, 'passage') ?? passage.id}
        sourceSegments={JSON.stringify(getCurrentSegment())}
        sourceMediaId={mediafileId}
        artifactState={artifactState}
        performedBy={speaker}
        topic={topic}
      />
    </div>
  );
}

export default PassageDetailItem;
