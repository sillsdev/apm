import { useGlobal } from '../../context/useGlobal';
import { Box, Button, IconButton } from '@mui/material';
import { useContext, useEffect, useRef, useState, type RefObject } from 'react';
import { UnsavedContext } from '../../context/UnsavedContext';
import {
  IRegion,
  IRegionParams,
  IRegions,
  parseRegions,
} from '../../crud/useWavesurferRegions';
import WSAudioPlayer, { type WSAudioPlayerControls } from '../WSAudioPlayer';
import { useSelector, shallowEqual } from 'react-redux';
import { IWsAudioPlayerStrings, MediaFile, MediaFileD } from '../../model';
import { UpdateRecord } from '../../model/baseModel';
import { playerSelector } from '../../selector';
import {
  getSegments,
  NamedRegions,
  updateSegments,
} from '../../utils/namedSegments';
import usePassageDetailContext from '../../context/usePassageDetailContext';
import ViewIcon from '@mui/icons-material/RemoveRedEye';
import TranscriptionShow from '../TranscriptionShow';
import { related } from '../../crud/related';
import {
  RequestPlay,
  usePlayerLogic,
} from '../../business/player/usePlayerLogic';
import { smallButtonProps } from '../StepEditor';
import { useOrbitData } from '../../hoc/useOrbitData';
import { ToolSlug, useStepTool } from '../../crud';
import { SaveSegments } from './SaveSegments';
import { IMarker } from '../../crud/useWaveSurfer';
export const PLAYER_HEIGHT = 120 + 80;

export interface IPlayerState {
  loading: boolean;
  pdBusy: boolean;
  setPDBusy: (busy: boolean) => void;
  audioBlob?: Blob;
  setupLocate: (callback?: (segments: string) => void) => void;
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  currentstep?: string;
  currentSegmentIndex?: number;
  setCurrentSegment?: (region: IRegion | undefined, index: number) => void;
  discussionMarkers?: IMarker[];
  handleHighlightDiscussion?: (time: number | undefined) => void;
  playerMediafile?: MediaFile;
  forceRefresh?: () => void;
}

export interface DetailPlayerProps {
  allowSegment?: NamedRegions | undefined;
  saveSegments?: SaveSegments | undefined;
  allowAutoSegment?: boolean;
  suggestedSegments?: string;
  forceRegionOnly?: boolean;
  verses?: string;
  defaultSegParams?: IRegionParams;
  canSetDefaultParams?: boolean;
  onSegment?: (segment: string, init: boolean) => void;
  onSegmentParamChange?:
    | ((params: IRegionParams, teamDefault: boolean) => void)
    | undefined;
  onStartRegion?: (position: number) => void;
  onDuration?: (duration: number) => void;
  onProgress?: (progress: number) => void;
  onSaveProgress?: (progress: number) => void;
  onInteraction?: () => void;
  allowZoomAndSpeed?: boolean;
  allowZoom?: boolean;
  allowSpeed?: boolean;
  position?: number;
  width: number;
  parentToolId?: string;
  role?: string;
  metaData?: React.ReactNode;
  /** When set, exposes waveform imperative controls (e.g. add segment at playhead). */
  controlsRef?: RefObject<WSAudioPlayerControls | null>;
  /** Mark Verses: true while verse rows after the first still lack timestamps. */
  markVersesTailOpenRef?: React.RefObject<boolean>;
  playerState?: IPlayerState;
}

export function PassageDetailPlayer(props: DetailPlayerProps) {
  const {
    allowSegment,
    allowAutoSegment,
    saveSegments,
    suggestedSegments,
    forceRegionOnly,
    verses,
    defaultSegParams,
    canSetDefaultParams,
    onSegment,
    onSegmentParamChange,
    onStartRegion,
    onDuration: onDurationProp,
    onProgress,
    onSaveProgress,
    onInteraction,
    allowZoomAndSpeed,
    allowZoom: allowZoomProp,
    allowSpeed: allowSpeedProp,
    position,
    width,
    parentToolId,
    metaData,
    controlsRef,
    markVersesTailOpenRef,
    playerState,
  } = props;

  const allowZoom = allowZoomProp ?? allowZoomAndSpeed ?? false;
  const allowSpeed = allowSpeedProp ?? allowZoomAndSpeed ?? false;

  const [memory] = useGlobal('memory');
  const [user] = useGlobal('user');
  const {
    toolChanged,
    toolsChanged,
    isChanged,
    saveRequested,
    clearRequested,
    clearCompleted,
    startSave,
    saveCompleted,
  } = useContext(UnsavedContext).state;
  const t: IWsAudioPlayerStrings = useSelector(playerSelector, shallowEqual);
  const toolId = 'ArtifactSegments';
  const [requestPlay, setRequestPlay] = useState<RequestPlay>({
    play: undefined,
    regionOnly: false,
    request: new Date(),
  });
  const [initialposition, setInitialPosition] = useState<number | undefined>(0);
  let {
    loading,
    pdBusy,
    setPDBusy,
    audioBlob,
    setupLocate,
    playing,
    setPlaying,
    currentstep,
    currentSegmentIndex,
    setCurrentSegment,
    discussionMarkers,
    handleHighlightDiscussion,
    playerMediafile,
    forceRefresh,
  } = usePassageDetailContext();

  if (playerState) {
    loading = playerState.loading;
    pdBusy = playerState.pdBusy;
    setPDBusy = playerState.setPDBusy;
    audioBlob = playerState.audioBlob;
    setupLocate = playerState.setupLocate;
    playing = playerState.playing;
    setPlaying = playerState.setPlaying;
    if (playerState.currentstep !== undefined)
      currentstep = playerState.currentstep;
    if (playerState.currentSegmentIndex !== undefined)
      currentSegmentIndex = playerState.currentSegmentIndex;
    if (playerState.setCurrentSegment)
      setCurrentSegment = playerState.setCurrentSegment;
    if (playerState.discussionMarkers)
      discussionMarkers = playerState.discussionMarkers;
    if (playerState.handleHighlightDiscussion)
      handleHighlightDiscussion = playerState.handleHighlightDiscussion;
    if (playerState.playerMediafile)
      playerMediafile = playerState.playerMediafile;
    if (playerState.forceRefresh) forceRefresh = playerState.forceRefresh;
  }

  const [defaultSegments, setDefaultSegments] = useState('{}');
  const [showTranscriptionId, setShowTranscriptionId] = useState('');
  const segmentsRef = useRef('');
  const playingRef = useRef(playing);
  const savingRef = useRef(false);
  const mediafileRef = useRef<MediaFile | undefined>(undefined);
  const durationRef = useRef(0);
  const mediarecs = useOrbitData<MediaFileD[]>('mediafile');
  const { tool } = useStepTool(currentstep ?? '');

  const { onPlayStatus, onCurrentSegment, setSegmentToWhole } = usePlayerLogic({
    allowSegment,
    suggestedSegments,
    position,
    playing,
    setPlaying,
    setCurrentSegment,
    playerMediafile,
    setDefaultSegments,
    setRequestPlay,
    setInitialPosition,
    mediafileRef,
    segmentsRef,
    durationRef,
    playingRef,
    onSegment,
  });

  const writeSegments = async () => {
    if (!savingRef.current) {
      savingRef.current = true;
      if (mediafileRef.current) {
        const mediafile = mediafileRef.current;
        await memory
          .update((t) => [
            ...UpdateRecord(
              t,
              {
                type: 'mediafile',
                id: mediafile.id,
                attributes: {
                  ...mediafile?.attributes,
                  segments: updateSegments(
                    allowSegment ?? NamedRegions.BackTranslation,
                    mediafile.attributes?.segments || '{}',
                    segmentsRef.current
                  ),
                },
              } as unknown as MediaFileD,
              user
            ),
          ])
          .then(() => {
            saveCompleted(toolId);
            savingRef.current = false;
          })
          .catch((err) => {
            //so we don't come here...we go to continue/logout
            saveCompleted(toolId, err.message);
            savingRef.current = false;
          });
      }
    }
  };

  const onDuration = (duration: number) => {
    durationRef.current = duration;
    if (onDurationProp) onDurationProp(duration);
    if (
      mediafileRef.current &&
      !mediafileRef.current.attributes.sourceSegments &&
      duration &&
      Math.floor(duration) !==
        Math.floor(mediafileRef.current.attributes.duration)
    ) {
      console.log(
        `update duration to ${Math.floor(duration)} from
        ${Math.floor(mediafileRef.current.attributes.duration)}`
      );
      memory
        .update((t) =>
          t.replaceAttribute(
            mediafileRef.current as MediaFileD, //I already checked for undefined
            'duration',
            Math.floor(duration)
          )
        )
        .then(() => {
          if (forceRefresh) forceRefresh();
        });
    }
    setSegmentToWhole();
  };

  const setPlayerSegments = (segments: string) => {
    if (
      !allowSegment ||
      !segmentsRef.current ||
      segmentsRef.current.indexOf('},{') === -1
    ) {
      setDefaultSegments(segments);
      onSegment && onSegment(segments, true);
    }
    //TT 6149 but I wonder why this was here? if (!playingRef.current) {
    const segs = parseRegions(segments) as IRegions | undefined;
    if ((segs?.regions?.length ?? 0) > 0) {
      setInitialPosition(segs?.regions[0]?.start ?? 0);
      setRequestPlay({
        play: true,
        regionOnly: true,
        request: new Date(),
      });
    }
    //}
  };

  const onSegmentChange = (segments: string) => {
    segmentsRef.current = segments;
    setDefaultSegments(segments); //now we'll notice if we reset them in SetPlayerSegments
    onSegment && onSegment(segments, false);
    if (allowSegment && saveSegments !== undefined) {
      const currentMedia = mediarecs.find((m) => m.id === playerMediafile?.id);
      const saved = getSegments(
        allowSegment,
        currentMedia?.attributes?.segments ?? '{}'
      );
      if (segments !== saved) {
        toolChanged(parentToolId ?? toolId);
      }
    } else {
      //not saving segments...so don't update changed
    }
  };

  useEffect(() => {
    setupLocate(setPlayerSegments);
    return () => {
      setupLocate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentstep, allowSegment]);

  useEffect(() => {
    if (saveRequested(toolId) && !savingRef.current) writeSegments();
    else if (clearRequested(toolId)) {
      clearCompleted(toolId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolsChanged]);

  const handleSave = () => {
    if (!saveRequested(toolId)) {
      startSave(toolId);
    }
    //save the segments here
  };

  const handleShowTranscription = () => {
    setShowTranscriptionId(related(playerMediafile, 'passage') ?? '');
  };

  const handleCloseTranscription = () => {
    setShowTranscriptionId('');
  };

  return (
    <Box id="detailplayer" sx={{ width: width }}>
      <WSAudioPlayer
        id="audioPlayer"
        allowRecord={false}
        height={PLAYER_HEIGHT}
        width={width}
        controlsRef={controlsRef}
        markVersesTailOpenRef={markVersesTailOpenRef}
        blob={audioBlob}
        initialposition={initialposition}
        setInitialPosition={setInitialPosition}
        isPlaying={requestPlay.play}
        regionOnly={requestPlay.regionOnly}
        forceRegionOnly={forceRegionOnly}
        request={requestPlay.request}
        loading={loading}
        busy={pdBusy}
        allowSegment={allowSegment}
        allowAutoSegment={allowAutoSegment}
        defaultRegionParams={defaultSegParams}
        canSetDefaultParams={canSetDefaultParams}
        segments={defaultSegments}
        verses={verses}
        currentSegmentIndex={currentSegmentIndex}
        markers={discussionMarkers}
        onMarkerClick={handleHighlightDiscussion}
        setBusy={setPDBusy}
        onSegmentChange={onSegmentChange}
        onSegmentParamChange={onSegmentParamChange}
        onStartRegion={onStartRegion}
        onPlayStatus={onPlayStatus}
        onInteraction={onInteraction}
        onCurrentSegment={onCurrentSegment}
        allowZoom={allowZoom}
        allowSpeed={allowSpeed}
        onProgress={onProgress}
        onSaveProgress={onSaveProgress}
        onDuration={onDuration}
        metaData={
          <>
            {playerMediafile?.attributes?.transcription &&
            tool !== ToolSlug.Transcribe ? (
              <IconButton
                id="show-transcription"
                onClick={handleShowTranscription}
              >
                <ViewIcon fontSize="small" />
              </IconButton>
            ) : (
              <></>
            )}
            {saveSegments === SaveSegments.showSaveButton ? (
              <Button
                id="segment-save"
                onClick={handleSave}
                variant="contained"
                color="primary"
                disabled={!isChanged(toolId)}
                sx={smallButtonProps}
              >
                {t.saveSegments}
              </Button>
            ) : (
              <></>
            )}
            {metaData}
          </>
        }
      />
      {showTranscriptionId !== '' && (
        <TranscriptionShow
          id={showTranscriptionId}
          visible={showTranscriptionId !== ''}
          closeMethod={handleCloseTranscription}
        />
      )}
    </Box>
  );
}

export default PassageDetailPlayer;
