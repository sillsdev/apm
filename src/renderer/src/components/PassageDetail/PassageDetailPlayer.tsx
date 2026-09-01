import { useGlobal } from '../../context/useGlobal';
import { Box, IconButton } from '@mui/material';
import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { UnsavedContext } from '../../context/UnsavedContext';
import {
  ApplyRegionColor,
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
import { Button } from '../../control/Button';
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
  /** Hide the generic Add/Remove Segment and Reset controls (Careful Speech
   * supplies its own Split/Combine controls). */
  hideSegmentControls?: boolean;
  suggestedSegments?: string;
  forceRegionOnly?: boolean;
  verses?: string;
  defaultSegParams?: IRegionParams;
  canSetDefaultParams?: boolean;
  onSegment?: (segment: string, init: boolean) => void;
  onSegmentParamChange?:
    ((params: IRegionParams, teamDefault: boolean) => void) | undefined;
  onStartRegion?: (position: number) => void;
  onDuration?: (duration: number) => void;
  onProgress?: (progress: number) => void;
  onSaveProgress?: (progress: number) => void;
  onInteraction?: () => void;
  /** Careful Speech: reset params, auto-segment, and persist instead of only clearing. */
  onClearSegments?: () => void | Promise<void>;
  /** Overrides the disabled state of the waveform segment Reset button. */
  resetDisabled?: boolean;
  /** Hide Reset while still showing +/− (Phrase BT listen pass). */
  hideSegmentReset?: boolean;
  /** When set, show a tool-managed Undo button in the player's top-right
   * toolbar. Used by Mark Verses for its own undo stack. */
  hasSegmentUndo?: boolean;
  onSegmentUndo?: () => void;
  onTranscription?: (transcription: string) => void;
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
  /** Tool-specific waveform region coloring (Mark Verses, Careful Speech, etc.). */
  applyRegionColor?: ApplyRegionColor;
  onSegmentPlaybackEnd?: (region: IRegion) => void;
  /** A segment was clicked on the waveform (not selected by the playhead). */
  onSegmentClick?: (region: IRegion) => void;
  /** Called when waveform play/pause changes (in addition to internal player logic). */
  onPlayStatusNotify?: (playing: boolean) => void;
  highlightPlay?: boolean;
  playerState?: IPlayerState;
  /** When false, locating a segment does not start playback. Default true. */
  autoPlayOnSegmentLocate?: boolean;
  /** When set, overrides PassageDetailContext `playing` for this player. */
  playing?: boolean;
  setPlayingOverride?: (playing: boolean) => void;
  /** Invoked before starting playback. Return false to skip default play handling. */
  beforePlay?: () => void | Promise<void | boolean>;
  /** When true, waveform region clicks cannot change the selected segment. */
  lockSegmentSelection?: boolean;
  /** Show the "view transcription" button when a transcription exists. Default true.
   * Set false where the button isn't wanted (e.g. Mark Verses Mobile). */
  showTranscriptionButton?: boolean;
  hideZoom?: boolean;
  layoutMode?: 'default' | 'mobileTranscribe';
}

export function PassageDetailPlayer(props: DetailPlayerProps) {
  const {
    allowSegment,
    allowAutoSegment,
    hideSegmentControls,
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
    onClearSegments,
    resetDisabled,
    hideSegmentReset,
    hasSegmentUndo,
    onSegmentUndo,
    allowZoomAndSpeed,
    allowZoom: allowZoomProp,
    allowSpeed: allowSpeedProp,
    position,
    width,
    parentToolId,
    metaData,
    controlsRef,
    applyRegionColor,
    onSegmentPlaybackEnd,
    onSegmentClick,
    onPlayStatusNotify,
    highlightPlay,
    playerState,
    autoPlayOnSegmentLocate = true,
    playing: playingOverride,
    setPlayingOverride,
    beforePlay,
    lockSegmentSelection,
    showTranscriptionButton = true,
    hideZoom,
    layoutMode,
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
  /** Segments string last applied by discussion locate; matching onSegmentChange
   * emissions are treated as init (not user edits). Cleared on match or unmount. */
  const pendingLocateSegmentsRef = useRef<string | undefined>(undefined);
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

  if (playingOverride !== undefined) {
    playing = playingOverride;
  }
  if (setPlayingOverride) {
    setPlaying = setPlayingOverride;
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

  const {
    onPlayStatus: onPlayStatusInternal,
    onCurrentSegment,
    setSegmentToWhole,
  } = usePlayerLogic({
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

  const onPlayStatus = useCallback(
    (playingNow: boolean) => {
      onPlayStatusInternal(playingNow);
      onPlayStatusNotify?.(playingNow);
    },
    [onPlayStatusInternal, onPlayStatusNotify]
  );

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
      // Remember what locate applied so the waveform's later onSegmentChange
      // can be recognized without a wall-clock heuristic.
      pendingLocateSegmentsRef.current = segments;
      setDefaultSegments(segments);
      onSegment && onSegment(segments, true);
    }
    //TT 6149 but I wonder why this was here? if (!playingRef.current) {
    const segs = parseRegions(segments) as IRegions | undefined;
    if (autoPlayOnSegmentLocate && (segs?.regions?.length ?? 0) > 0) {
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
    const fromLocate = pendingLocateSegmentsRef.current === segments;
    if (fromLocate) pendingLocateSegmentsRef.current = undefined;
    onSegment && onSegment(segments, fromLocate);
    if (fromLocate) return;
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
      pendingLocateSegmentsRef.current = undefined;
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
    <Box
      id="detailplayer"
      sx={{
        width: width,
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      <WSAudioPlayer
        id="audioPlayer"
        allowRecord={false}
        height={PLAYER_HEIGHT}
        controlsRef={controlsRef}
        applyRegionColor={applyRegionColor}
        onSegmentPlaybackEnd={onSegmentPlaybackEnd}
        onSegmentClick={onSegmentClick}
        blob={audioBlob}
        initialposition={initialposition}
        setInitialPosition={setInitialPosition}
        isPlaying={requestPlay.play}
        regionOnly={requestPlay.regionOnly}
        forceRegionOnly={forceRegionOnly}
        lockSegmentSelection={lockSegmentSelection}
        request={requestPlay.request}
        loading={loading}
        busy={pdBusy}
        allowSegment={allowSegment}
        allowAutoSegment={allowAutoSegment}
        layoutMode={layoutMode}
        hideSegmentControls={hideSegmentControls}
        hideZoom={hideZoom}
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
        highlightPlay={highlightPlay}
        beforePlay={beforePlay}
        onInteraction={onInteraction}
        onClearSegments={onClearSegments}
        resetDisabled={resetDisabled}
        hideSegmentReset={hideSegmentReset}
        hasSegmentUndo={hasSegmentUndo}
        onSegmentUndo={onSegmentUndo}
        onCurrentSegment={onCurrentSegment}
        allowZoom={allowZoom}
        allowSpeed={allowSpeed}
        onProgress={onProgress}
        onSaveProgress={onSaveProgress}
        onDuration={onDuration}
        metaData={
          <>
            {showTranscriptionButton &&
            playerMediafile?.attributes?.transcription &&
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
