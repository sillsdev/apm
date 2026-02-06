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
  BoxProps,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { IoMdBarcode } from 'react-icons/io';
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
import {
  Duration,
  GrowingSpacer,
  LightTooltip,
  PriButton,
  RecordButton,
} from '../../control';
import { useSelector } from 'react-redux';
import { communitySelector, sharedSelector } from '../../selector';
import { passageDefaultFilename } from '../../utils/passageDefaultFilename';
import { prettySegment } from '../../utils/prettySegment';
import { useMobile } from '../../utils';
import PassageDetailChooser from './PassageDetailChooser';
import ArtifactStatus from '../ArtifactStatus';
import { useOrbitData } from '../../hoc/useOrbitData';
import { useStepPermissions } from '../../utils/useStepPermission';
import { btDefaultSegParams } from './btDefaultSegParams';
import PassageDetailMobileDetail from './PassageDetailMobileDetail';
import DiscussionPanel from '../../components/Discussions/DiscussionPanel';
import HighlightButton from './mobile/HighlightButton';
import SegmentStatusMobile from './mobile/SegmentStatusMobile';
import { WSAudioPlayerControls } from '../WSAudioPlayer';
import reactStringReplace from 'react-string-replace';
import Guidance from '../../control/Guidance';

enum Activity {
  Preview,
  Segment,
  Listen,
  Record,
  Next,
}

const PlayerRow = styled(Box)<BoxProps>(() => ({
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
const smallInputProps = {
  maxWidth: 200,
  '& .MuiInputBase-input': { py: 1 },
  '& .MuiInputLabel-root': {
    top: '50%',
    left: '10px',
    transform: 'translateY(-50%)',
  },
  '& .MuiInputLabel-shrink': {
    top: '5px',
    left: '15px',
    transform: 'translateY(-50%) scale(0.75)',
  },
} as SxProps;
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
  isMobile?: boolean;
}

export function PassageDetailItem(props: IProps) {
  const { width, slugs, segments, showTopic, isMobile } = props;
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const oneTryOnly = slugs.includes(ArtifactTypeSlug.WholeBackTranslation);
  const t: ICommunityStrings = useSelector(communitySelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const [reporter] = useGlobal('errorReporter');
  const [organization] = useGlobal('organization');
  const [plan] = useGlobal('plan'); //will be constant here
  const { fetchMediaUrl, mediaState } = useFetchMediaUrl(reporter);
  const isPhraseBackTranslation = slugs.includes(
    ArtifactTypeSlug.PhraseBackTranslation
  );
  const [activity, setActivityx] = useState<Activity>(() =>
    isPhraseBackTranslation ? Activity.Preview : Activity.Listen
  );
  const activityRef = useRef<Activity>(activity);
  const setActivity = (activity: Activity) => {
    setActivityx(activity);
    activityRef.current = activity;
  };
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
  const { isMobileWidth } = useMobile();
  const {
    passage,
    sharedResource,
    playerMediafile,
    playing,
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
  const toolId = 'RecordBackTranslationTool';
  const [paneWidth, setPaneWidth] = useState(0);
  const mobileView = useMemo(() => Boolean(isMobile), [isMobile]);
  const playerControlsRef = useRef<WSAudioPlayerControls | null>(null);
  const recorderControlsRef = useRef<WSAudioPlayerControls | null>(null);
  const [playerProgress, setPlayerProgress] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);
  const [playerPosition, setPlayerPosition] = useState<number | undefined>(
    undefined
  );
  const [segmentUndoValue, setSegmentUndoValueState] = useState<
    string | undefined
  >(undefined);
  const segmentUndoRef = useRef<string | undefined>(undefined);
  const currentSegmentsRef = useRef<string | undefined>(undefined);
  const [recorderProgress, setRecorderProgress] = useState(0);
  const [recorderDuration, setRecorderDuration] = useState(0);
  const [isRecorderPlaying, setIsRecorderPlaying] = useState(false);
  const recorderRecordingRef = useRef(false);
  const recorderPlayingRef = useRef(false);
  const userSegmentInteractionRef = useRef(false);
  const previewStartedRef = useRef(false);
  const showTextRef = useRef(false);

  const rowProp = useMemo(
    () => ({ display: 'flex', width: paneWidth - 40 }),
    [paneWidth]
  );

  useEffect(() => {
    let newPaneWidth = width - 16;
    if (discussOpen) newPaneWidth -= discussionSize.width;
    setPaneWidth(newPaneWidth);
  }, [discussionSize, width, discussOpen]);

  const setUploadVisible = (value: boolean) => {
    if (value) {
      cancelled.current = false;
    }
    setUploadVisiblex(value);
  };

  const mediafileId = useMemo(() => {
    return playerMediafile?.id ?? '';
    // this seemed to need to refresh when the passage and shared resource were updated
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerMediafile, passage, sharedResource]);
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
    if (
      mobileView &&
      canSave &&
      ArtifactTypeSlug.PhraseBackTranslation === recordType &&
      (segString || '{}') !== '{}'
    ) {
      setTimeout(() => handleSave(), 500);
    }
    toolChanged(toolId, canSave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSave, mobileView, recordType, segString]);

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
  const showSegmentsChangedMessage = () => {
    if (
      hasBtRecordings &&
      userSegmentInteractionRef.current &&
      Boolean(currentSegmentMediaId)
    )
      showMessage(t.segmentsChanged, AlertSeverity.Warning);
  };

  useEffect(() => {
    if (hasBtRecordings && activityRef.current === Activity.Preview) {
      setActivity(Activity.Listen);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBtRecordings]);

  useEffect(() => {
    const mediaRec = mediafiles.find((m) => m.id === mediafileId);
    const defaultSegments = mediaRec?.attributes?.segments ?? '{}';
    const newSegString = getSegments(
      NamedRegions.BackTranslation,
      defaultSegments
    );
    if (segString !== newSegString) {
      setSegString(newSegString);
      showSegmentsChangedMessage();
    }
    setVerses(getSegments(NamedRegions.Verse, defaultSegments));
    setCurrentVersion(mediaRec?.attributes?.versionNumber || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediafileId, mediafiles, hasBtRecordings]);

  useEffect(() => {
    userSegmentInteractionRef.current = false;
  }, [mediafileId]);

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
      saveCompleted(toolId, ts.NoSaveWoMedia);
      showMessage(ts.NoSaveWoMedia);
    }
  };

  //from recorder
  const afterUploadCb = async (mediaId: string | undefined) => {
    afterUpload('', mediaId ? [mediaId] : undefined);
    if (activityRef.current === Activity.Record) {
      setActivity(Activity.Next);
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

  const isRecording = () =>
    recorderRecordingRef.current || recorderPlayingRef.current;
  const updateRecorderBusy = () => {
    setRecording(isRecording());
  };
  const handleRecorderRecording = (recording: boolean) => {
    const wasRecording = recorderRecordingRef.current;
    recorderRecordingRef.current = recording;
    updateRecorderBusy();
    if (wasRecording && !recording) {
      setActivity(Activity.Next);
    }
  };
  const handleRecorderPlayStatus = (playing: boolean) => {
    recorderPlayingRef.current = playing;
    setIsRecorderPlaying(playing);
    updateRecorderBusy();
  };
  const handleSegmentFinished = () => {
    if (
      segments &&
      activityRef.current !== Activity.Record &&
      activityRef.current !== Activity.Preview
    ) {
      setActivity(Activity.Record);
    }
  };
  const nextSegmentPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const handleNextSegmentClick = () => {
    setActivity(Activity.Next);
    playerControlsRef.current?.nextSegment();
    if (nextSegmentPlayTimerRef.current) {
      clearTimeout(nextSegmentPlayTimerRef.current);
    }
    nextSegmentPlayTimerRef.current = setTimeout(() => {
      if (!playerControlsRef.current?.isPlaying()) {
        playerControlsRef.current?.togglePlay();
      }
    }, 75);
  };
  const onSegmentParamChange = (
    params: IRegionParams,
    teamDefault: boolean
  ) => {
    setSegParams(params);
    if (teamDefault && segments) setOrgDefault(segments, params);
  };

  const setSegmentUndoValue = (value: string | undefined) => {
    segmentUndoRef.current = value;
    setSegmentUndoValueState(value);
  };

  const handleSegmentChange = (segments: string, init: boolean) => {
    if (init) {
      currentSegmentsRef.current = segments;
      setSegmentUndoValue(undefined);
      return;
    }
    if (segmentUndoRef.current && segmentUndoRef.current === segments) {
      currentSegmentsRef.current = segments;
      setSegmentUndoValue(undefined);
      return;
    }
    const previous = currentSegmentsRef.current;
    if (previous !== undefined && previous !== segments) {
      setSegmentUndoValue(previous);
    }
    currentSegmentsRef.current = segments;
  };

  const editStep = useMemo(
    () => canDoSectionStep(currentstep, section),
    [canDoSectionStep, currentstep, section]
  );
  const currentSegmentKey = useMemo(
    () => currentSegment.trim(),
    [currentSegment]
  );
  const currentSegmentMediaId = useMemo(() => {
    showTextRef.current = false;
    if (!recordTypeId) return undefined;
    if (!currentSegmentKey) return undefined;
    const matches = rowData.filter(
      (r) =>
        related(r.mediafile, 'artifactType') === recordTypeId &&
        prettySegment(r.mediafile?.attributes?.sourceSegments ?? '').trim() ===
          currentSegmentKey
    );
    if (!matches.length) return undefined;
    const latest = [...matches].sort((a, b) => {
      const aDate = Date.parse(a.mediafile?.attributes?.dateUpdated ?? '');
      const bDate = Date.parse(b.mediafile?.attributes?.dateUpdated ?? '');
      return (bDate || 0) - (aDate || 0);
    })[0];
    showTextRef.current = Boolean(latest?.mediafile?.id);
    return latest?.mediafile?.id;
  }, [currentSegmentKey, recordTypeId, rowData]);

  useEffect(() => {
    if (!currentSegmentMediaId) return;
    const media = rowData.find(
      (r) => r.mediafile?.id === currentSegmentMediaId
    )?.mediafile;
    const performer = media?.attributes?.performedBy;
    if (performer && performer !== speaker) {
      setSpeaker(performer);
    }
  }, [currentSegmentMediaId, rowData, speaker]);

  const showSideBySide = !isMobileWidth;
  const flushDiscussionLeft = discussOpen && !showSideBySide;

  useEffect(() => {
    if (activityRef.current !== Activity.Preview) {
      previewStartedRef.current = false;
    }
  }, [activity]);

  useEffect(() => {
    if (playerPosition === undefined) return;
    const resetTimer = setTimeout(() => {
      setPlayerPosition(undefined);
    }, 0);
    return () => {
      clearTimeout(resetTimer);
    };
  }, [playerPosition]);

  useEffect(() => {
    if (
      activityRef.current === Activity.Preview &&
      previewStartedRef.current &&
      !playing &&
      playerDuration > 0 &&
      playerProgress >= playerDuration - 0.25
    ) {
      previewStartedRef.current = false;
      setPlayerPosition(0);
      setActivity(Activity.Segment);
    }
  }, [activity, playing, playerDuration, playerProgress]);

  const renderMobileRecordContent = () => {
    if (discussOpen && !showSideBySide) return null;
    return (
      <>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <HighlightButton
            ariaLabel={playing ? 'Pause' : 'Play'}
            onClick={() => {
              setActivity(Activity.Preview);
              if (!playing) previewStartedRef.current = true;
              playerControlsRef.current?.togglePlay();
            }}
            disabled={playerDuration === 0 || isRecording()}
            highlight={activityRef.current === Activity.Preview}
            sx={{ py: '2px', px: '4px' }}
          >
            {playing ? <PauseIcon /> : <PlayArrowIcon />}
          </HighlightButton>
          <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
            <Duration seconds={playerProgress} /> {' / '}{' '}
            <Duration seconds={playerDuration} />
          </Typography>
        </Box>
        <PassageDetailPlayer
          width={Math.max(0, paneWidth - 10)}
          allowSegment={segments}
          allowAutoSegment={segments !== undefined && !hasBtRecordings}
          saveSegments={
            segments !== undefined && editStep
              ? SaveSegments.showSaveButton
              : undefined
          }
          forceRegionOnly={
            activityRef.current === Activity.Preview ? false : Boolean(segments)
          }
          highlightAutoSegment={
            isPhraseBackTranslation &&
            mobileView &&
            activityRef.current === Activity.Segment
          }
          hasSegmentUndo={Boolean(segmentUndoValue)}
          segmentUndoValue={segmentUndoValue}
          onSegment={handleSegmentChange}
          onAutoSegment={() => {
            if (isPhraseBackTranslation && mobileView) {
              setActivity(Activity.Listen);
            }
          }}
          position={playerPosition}
          defaultSegParams={segParams}
          suggestedSegments={segString}
          verses={verses}
          canSetDefaultParams={editStep && canSetOrgDefault}
          onSegmentParamChange={editStep ? onSegmentParamChange : undefined}
          controlsRef={playerControlsRef}
          hideToolbar={true}
          hideSegmentControls={false}
          onProgress={setPlayerProgress}
          onDuration={setPlayerDuration}
          onSegmentFinished={handleSegmentFinished}
          onInteraction={() => {
            if (activityRef.current === Activity.Segment) {
              setActivity(Activity.Listen);
            }
            showSegmentsChangedMessage();
            userSegmentInteractionRef.current = true;
          }}
        />
        {activity === Activity.Preview ? (
          <Guidance>
            {reactStringReplace(t.listen, `{0}`, () => (
              <PlayArrowIcon key="play-arrow" sx={{ height: 14, width: 14 }} />
            ))}
          </Guidance>
        ) : activity === Activity.Segment ? (
          <Guidance>
            {reactStringReplace(t.autoSegment, `{0}`, () => (
              <IoMdBarcode height={14} width={14} />
            ))}
          </Guidance>
        ) : (
          <>
            <SegmentStatusMobile segmentText={currentSegment} />
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <IconButton
                aria-label={isRecorderPlaying ? 'Pause' : 'Play'}
                onClick={() => recorderControlsRef.current?.togglePlay()}
                disabled={recorderDuration === 0 || isRecording()}
                sx={{ pl: 0 }}
              >
                {isRecorderPlaying ? <PauseIcon /> : <PlayArrowIcon />}
              </IconButton>
              <Typography variant="body2">
                <Duration seconds={recorderProgress} /> {' / '}
                <Duration seconds={recorderDuration} />
              </Typography>
            </Box>
            <MediaRecord
              hideControls={true}
              toolId={toolId}
              passageId={related(sharedResource, 'passage') ?? passage.id}
              sourceSegments={
                ArtifactTypeSlug.PhraseBackTranslation === recordType
                  ? JSON.stringify(getCurrentSegment())
                  : '{}'
              }
              sourceMediaId={mediafileId}
              artifactId={recordTypeId}
              performedBy={speaker}
              topic={topic}
              afterUploadCb={afterUploadCb}
              defaultFilename={defaultFilename}
              allowWave={false}
              setCanSave={handleSetCanSave}
              setStatusText={setStatusText}
              doReset={resetMedia}
              setDoReset={setResetMedia}
              mediaId={currentSegmentMediaId}
              preload={currentSegmentMediaId ? 1 : 0}
              height={200}
              width={Math.max(0, paneWidth - 10)}
              onRecording={handleRecorderRecording}
              onPlayStatus={handleRecorderPlayStatus}
              oneTryOnly={oneTryOnly}
              noNewVoice={true}
              allowDeltaVoice={true}
              allowNoNoise={true}
              controlsRef={recorderControlsRef}
              onProgress={setRecorderProgress}
              onDuration={setRecorderDuration}
              hideToolbar={true}
              hasRecording={Boolean(currentSegmentMediaId)}
              isStopLogic={true}
              showSize={false}
            />
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <TextField
                id="speaker"
                label={t.speaker}
                value={speaker}
                disabled={isRecording() || playing}
                onChange={handleChangeSpeaker}
                sx={smallInputProps}
              />
              <GrowingSpacer />
              <IconButton
                aria-label={t.deleteItem}
                onClick={() => {
                  setActivity(Activity.Listen);
                  recorderControlsRef.current?.deleteRecording();
                }}
                disabled={isRecording() || playing}
              >
                <DeleteIcon />
              </IconButton>
            </Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Typography variant="caption" sx={statusProps}>
                {statusText}
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                gap: 1,
                py: 1,
              }}
            >
              <HighlightButton
                ariaLabel="Listen"
                onClick={() => {
                  setActivity(Activity.Listen);
                  playerControlsRef.current?.togglePlay();
                }}
                disabled={isRecording()}
                highlight={activityRef.current === Activity.Listen}
              >
                {playerControlsRef.current?.isPlaying() ? (
                  <PauseIcon />
                ) : (
                  <PlayArrowIcon />
                )}
              </HighlightButton>
              <RecordButton
                recording={recorderRecordingRef.current}
                oneTryOnly={true}
                onClick={() => {
                  setActivity(Activity.Record);
                  showTextRef.current = false;
                  if (currentSegmentMediaId) {
                    recorderControlsRef.current?.confirmedDelete();
                    setTimeout(() => {
                      recorderControlsRef.current?.toggleRecord();
                    }, 1000);
                  } else {
                    recorderControlsRef.current?.toggleRecord();
                  }
                }}
                disabled={playing}
                isSmall={false}
                showText={showTextRef.current}
                hasRecording={Boolean(currentSegmentMediaId)}
                isStopLogic={true}
                active={true}
              />
              <HighlightButton
                ariaLabel="Next Segment"
                onClick={() => {
                  handleNextSegmentClick();
                }}
                disabled={
                  isRecording() || playing || Boolean(toolChanged(toolId))
                }
                highlight={activityRef.current === Activity.Next}
              >
                <ArrowForwardIcon />
              </HighlightButton>
            </Box>
          </>
        )}
      </>
    );
  };

  if (mobileView)
    return (
      <div>
        <PassageDetailMobileDetail
          currentVersion={currentVersion}
          showSideBySide={showSideBySide}
          flushDiscussionLeft={flushDiscussionLeft}
          recordContent={renderMobileRecordContent()}
          noAudioText={ts.noAudio}
        />
        {confirm && (
          <Confirm
            text={t.deleteItem}
            yesResponse={handleDeleteConfirmed}
            noResponse={handleDeleteRefused}
          />
        )}
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

  return (
    <div>
      <Paper sx={paperProps}>
        <div>
          {currentVersion !== 0 ? (
            <Stack direction="row" spacing={1}>
              <Box>
                <PassageDetailChooser width={paneWidth} />
                <PassageDetailPlayer
                  width={paneWidth - 10}
                  allowSegment={segments}
                  allowAutoSegment={segments !== undefined}
                  saveSegments={
                    segments !== undefined && editStep
                      ? SaveSegments.showSaveButton
                      : undefined
                  }
                  forceRegionOnly={Boolean(segments)}
                  defaultSegParams={segParams}
                  suggestedSegments={segString}
                  verses={verses}
                  canSetDefaultParams={editStep && canSetOrgDefault}
                  onSegmentParamChange={
                    editStep ? onSegmentParamChange : undefined
                  }
                  hasSegmentUndo={Boolean(segmentUndoValue)}
                  segmentUndoValue={segmentUndoValue}
                  onSegment={handleSegmentChange}
                  metaData={
                    recordType === ArtifactTypeSlug.PhraseBackTranslation &&
                    segString === '{}' ? (
                      <Typography
                        variant="h6"
                        sx={{ color: 'primary.main', px: 1 }}
                      >
                        {t.selectSegments}
                      </Typography>
                    ) : undefined
                  }
                  onInteraction={() => {
                    showSegmentsChangedMessage();
                    userSegmentInteractionRef.current = true;
                  }}
                  onSegmentFinished={handleSegmentFinished}
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
                    {currentSegment &&
                      segString !== '{}' &&
                      ArtifactTypeSlug.PhraseBackTranslation === recordType && (
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
                      sx={smallInputProps}
                      id="speaker"
                      label={t.speaker}
                      value={speaker}
                      onChange={handleChangeSpeaker}
                    />
                  </Box>
                  <MediaRecord
                    toolId={toolId}
                    passageId={related(sharedResource, 'passage') ?? passage.id}
                    sourceSegments={
                      ArtifactTypeSlug.PhraseBackTranslation === recordType
                        ? JSON.stringify(getCurrentSegment())
                        : '{}'
                    }
                    sourceMediaId={mediafileId}
                    artifactId={recordTypeId}
                    performedBy={speaker}
                    topic={topic}
                    afterUploadCb={afterUploadCb}
                    defaultFilename={defaultFilename}
                    allowWave={false}
                    setCanSave={handleSetCanSave}
                    setStatusText={setStatusText}
                    doReset={resetMedia}
                    setDoReset={setResetMedia}
                    height={200}
                    width={paneWidth - 40}
                    onRecording={handleRecorderRecording}
                    onPlayStatus={handleRecorderPlayStatus}
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
                      disabled={
                        !canSave ||
                        (ArtifactTypeSlug.PhraseBackTranslation ===
                          recordType &&
                          (segString || '{}') === '{}')
                      }
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
