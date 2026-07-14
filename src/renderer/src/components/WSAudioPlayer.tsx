import {
  IconButton,
  Typography,
  Divider,
  DividerProps,
  Grid,
  ToggleButton,
  Box,
  Menu,
  MenuItem,
  Stack,
} from '@mui/material';
import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useContext,
  useMemo,
  useCallback,
  MouseEvent,
} from 'react';
import PlayIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import LoopIcon from '@mui/icons-material/Loop';
import NextSegmentIcon from '@mui/icons-material/ArrowRightAlt';
import TimerIcon from '@mui/icons-material/AccessTime';
import UndoIcon from '@mui/icons-material/Undo';
import MicIcon from '@mui/icons-material/SettingsVoice';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SettingsIcon from '@mui/icons-material/Settings';
import VersionsIcon from '@mui/icons-material/List';
import NormalizeIcon from '../control/NormalizeIcon';
import UploadIcon from '@mui/icons-material/CloudUpload';
import { Button } from '@mui/material';
import {
  IAudioDownloadStrings,
  IMainStrings,
  ISharedStrings,
  IWsAudioPlayerStrings,
} from '../model';
import { FaHandScissors } from 'react-icons/fa';
import type { IconBaseProps } from 'react-icons/lib';

import { useWavRecorder } from '../crud/useWavRecorder';
import { IMarker, useWaveSurfer } from '../crud/useWaveSurfer';
import { Duration } from '../control/Duration';
import { LightTooltip } from '../control/LightTooltip';
import { RecordButton } from '../control/RecordButton';
import { useSnackBar, AlertSeverity } from '../hoc/SnackBar';
import { HotKeyContext } from '../context/HotKeyContext';
import { PriButton } from '../control';
import WSAudioPlayerZoom, { maxZoom } from './WSAudioPlayerZoom';
import {
  dataPath,
  logError,
  PathType,
  Severity,
  useCheckOnline,
  LocalKey,
  localUserKey,
  useMobile,
} from '../utils';
import {
  ApplyRegionColor,
  IRegion,
  IRegionParams,
  parseRegionParams,
  parseRegions,
} from '../crud/useWavesurferRegions';
import WSAudioPlayerSegment from './WSAudioPlayerSegment';
import Confirm from './AlertDialog';
import { getSortedRegions, NamedRegions } from '../utils/namedSegments';
import {
  audioDownloadSelector,
  mainSelector,
  sharedSelector,
  wsAudioPlayerSelector,
} from '../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { AltButton, smallButtonProps } from '../control';
import { AudioAiFunc, useAudioAi } from '../utils/useAudioAi';
import AeroTaskErrorMessage from '../business/asr/AeroTaskErrorMessage';
import {
  aeroTaskErrorParts,
  axiosErrorMessage,
} from '../business/asr/aeroTaskError';
import { Exception } from '@orbit/core';
import { useGlobal } from '../context/useGlobal';
import { AxiosError } from 'axios';
import { IFeatures } from './Team/TeamSettings';
import {
  orgDefaultFeatures,
  orgDefaultVoices,
  useOrgDefaults,
} from '../crud/useOrgDefaults';
import NoChickenIcon from '../control/NoChickenIcon';
import VoiceConversionLogo from '../control/VoiceConversionLogo';
import BigDialog from '../hoc/BigDialog';
import { useVoiceUrl } from '../crud/useVoiceUrl';
import SelectVoice from '../business/voice/SelectVoice';
import { isElectron } from '../../api-variable';
import WSAudioPlayerRate from './WSAudioPlayerRate';
import { IVoicePerm } from '../business/voice/PersonalizeVoicePermission';
import BigDialogBp from '../hoc/BigDialogBp';
import { MainAPI } from '@model/main-api';
import { AudioDownloadView } from './AudioDownload';
import { useAudioDownload } from './useAudioDownload';
const ipc = window?.api as MainAPI;

const HandScissors = FaHandScissors as unknown as React.FC<IconBaseProps>;

const VertDivider = (prop: DividerProps) => (
  <Divider orientation="vertical" flexItem sx={{ ml: '5px' }} {...prop} />
);

interface IProps {
  id?: string;
  visible?: boolean;
  blob?: Blob;
  initialposition?: number;
  setInitialPosition?: (position: number | undefined) => void;
  allowRecord?: boolean;
  allowZoom?: boolean;
  hideZoom?: boolean;
  mediaId?: string;
  allowSegment?: NamedRegions | undefined;
  allowAutoSegment?: boolean;
  /** When true, hide the generic segment-edit controls (Add/Remove Segment and
   * Reset) even though segments are shown/colored/navigable. Used by Careful
   * Speech, which supplies its own Split/Combine controls. */
  hideSegmentControls?: boolean;
  allowSpeed?: boolean;
  allowDeltaVoice?: boolean;
  /** When false, hide the Download item in the more menu. Default true if omitted. */
  allowDownload?: boolean;
  alternatePlayer?: boolean;
  oneTryOnly?: boolean;
  height: number;
  segments: string;
  verses?: string;
  currentSegmentIndex?: number;
  markers?: IMarker[];
  metaData?: React.JSX.Element;
  isPlaying?: boolean;
  regionOnly?: boolean;
  request?: Date;
  loading?: boolean;
  busy?: boolean;
  defaultRegionParams?: IRegionParams;
  canSetDefaultParams?: boolean;
  doReset?: boolean;
  autoStart?: boolean;
  setBusy?: (busy: boolean) => void;
  setMimeType?: (type: string) => void;
  onPlayStatus?: (playing: boolean) => void;
  onProgress?: (progress: number) => void;
  onSegmentChange?: (segments: string) => void;
  onSegmentParamChange?: (params: IRegionParams, teamDefault: boolean) => void;
  onStartRegion?: (position: number) => void;
  onBlobReady?: (blob: Blob | undefined) => void;
  /** When waveform decode/load fails after a blob is supplied. */
  onLoadError?: (error: unknown) => void;
  setBlobReady?: (ready: boolean) => void;
  setChanged?: (changed: boolean) => void;
  onProcessingRecordingChange?: (processing: boolean) => void;
  onSaveProgress?: (progress: number) => void; //user initiated
  onDuration?: (duration: number) => void;
  onInteraction?: () => void;
  onRecording?: (r: boolean) => void;
  onCurrentSegment?: (
    currentSegment: IRegion | undefined,
    index?: number
  ) => void;
  onSegmentPlaybackEnd?: (segment: IRegion) => void;
  forceRegionOnly?: boolean;
  /** When true, user-initiated selection (clicks, prev/next) is ignored. Playhead-driven region-in is not blocked; consumers that must hold the current clause during recording/saving should guard their segment effects separately (e.g. Careful Speech). */
  lockSegmentSelection?: boolean;
  onMarkerClick?: (time: number) => void;
  reload?: (blob: Blob) => void;
  noNewVoice?: boolean;
  allowNoNoise?: boolean;
  /** From Record step toolSettings; when omitted, echo cancellation is off (higher-fidelity default). */
  captureEchoCancellation?: boolean;
  /** From Record step toolSettings; when omitted, noise suppression is off (higher-fidelity default). */
  captureNoiseSuppression?: boolean;
  keepItSmall?: boolean;
  controlsRef?: React.RefObject<WSAudioPlayerControls | null>;
  /** Tool-specific waveform region coloring (Mark Verses, Careful Speech, etc.). */
  applyRegionColor?: ApplyRegionColor;
  hideToolbar?: boolean;
  hideControls?: boolean;
  highlightAutoSegment?: boolean;
  /** Careful Speech / guided flows: emphasize the main play control until used. */
  highlightPlay?: boolean;
  /** Invoked before starting playback. Return false to skip default play handling. */
  beforePlay?: () => void | Promise<void | boolean>;
  onAutoSegment?: () => void;
  /** When set, Clear Segments invokes this instead of only clearing regions. */
  onClearSegments?: () => void | Promise<void>;
  /** Overrides the disabled state of the segment Reset button (defaults to
   * "no regions / recording"). Lets a host (e.g. Mark Verses) gate on its own
   * resettable state. */
  resetDisabled?: boolean;
  hasRecording?: boolean;
  isStopLogic?: boolean;
  /** When true, hide undo and scissors (region delete) waveform edit tools. */
  hideWaveformEditTools?: boolean;
  hasSegmentUndo?: boolean;
  onSegmentUndo?: () => void;
  isRecordingRights?: boolean;
  handleUpload?: () => void;
  /** Extra controls to show just left of Upload on rights mobile layout when space permits. */
  rightsLeftActions?: React.JSX.Element;
  /** Force mobile layout even when global mobile view is false. */
  forceMobileView?: boolean;
  onVersions?: () => void;
  handleSave?: () => void;
  isSaveDisabled?: boolean;
  /** True while passage media save/upload is in progress (disables Clear, etc.). */
  mediaSaveInProgress?: boolean;
  /** When false, hide Save (e.g. waveform already persisted). Default true if omitted. */
  showWaveformSave?: boolean;
  /** When true in mobile layout, record button is rendered via onDockedRecordButton instead of inline. */
  dockRecordButton?: boolean;
  onDockedRecordButton?: (node: React.ReactNode | null) => void;
  /** When true, show the docked record button even if allowRecord is false (button may be disabled). */
  showDockedRecordButton?: boolean;
  onRecordingCleared?: () => void;
}

export interface WSAudioPlayerControls {
  togglePlay: () => void;
  /** Start or stop playback without toggling (avoids flip when already playing). */
  setPlay: (play: boolean) => void;
  toggleRecord: () => void;
  prevSegment: () => void;
  nextSegment: () => void;
  undoSegmentChange: () => void;
  resetSegments: () => void;
  deleteRecording: () => void;
  confirmedDelete: () => void;
  getProgress: () => number;
  getDuration: () => number;
  isReady: () => boolean;
  isPlaying: () => boolean;
  gotoTime: (seconds: number, targetRegion?: IRegion) => Promise<void>;
  applyRegionColors?: () => void;
  runAutoSegment?: (
    params: import('../crud/useWavesurferRegions').IRegionParams
  ) => Promise<number>;
  getRegionsJson?: () => string;
  loadRegionsJson?: (regionsJson: string) => void;
  findClauseSplitPoint?: (
    clause: import('../crud/useWavesurferRegions').IRegion,
    params: import('../crud/useWavesurferRegions').IRegionParams
  ) => number | undefined;
}

const PLAY_PAUSE_KEY = 'F1,CTRL+SPACE';
const ALT_PLAY_PAUSE_KEY = 'ALT+F1,ALT+CTRL+SPACE';
const HOME_KEY = 'CTRL+HOME';
const BACK_KEY = 'F2,CTRL+SHIFT+<';
const AHEAD_KEY = 'F3,CTRL+SHIFT+>';
const END_KEY = 'CTRL+END';
const TIMER_KEY = 'F6,CTRL+6';
const RECORD_KEY = 'F9,CTRL+9';
const LEFT_KEY = 'CTRL+ARROWLEFT';
const RIGHT_KEY = 'CTRL+ARROWRIGHT';
/**
 * MediaRecorder / WavRecorder timeslice for live waveform preview (not final quality).
 * 1000ms balances preview responsiveness vs. decode/insert overhead.
 */
const RECORD_PREVIEW_TIMESLICE_MS = 1000;

/** Distance (seconds) within which the playhead counts as being "at" a segment
 * boundary. Drives the Add/Remove segment button enablement below. */
const SEGMENT_BOUNDARY_TOLERANCE_SEC = 0.1;

/**
 * True when the playhead sits within `tol` of any region boundary (either edge
 * of any region, or the track start). Used to disable Add so a new split isn't
 * created on top of an existing boundary.
 */
function isProgressNearAnyRegionBoundary(
  progressSec: number,
  regions: IRegion[],
  tol: number
): boolean {
  if (Math.abs(progressSec) <= tol) return true;
  for (const r of regions) {
    if (Math.abs(progressSec - r.start) <= tol) return true;
    if (Math.abs(progressSec - r.end) <= tol) return true;
  }
  return false;
}

/**
 * True when the playhead is within `tol` of an internal join — a boundary shared
 * between two adjacent regions (a removable one, excluding the outer track
 * edges). Used to enable Remove.
 */
function isProgressNearInternalJoin(
  progressSec: number,
  regions: IRegion[],
  tol: number
): boolean {
  if (regions.length < 2) return false;
  const sorted = [...regions].sort((a, b) => a.start - b.start);
  for (let i = 0; i < sorted.length - 1; i++) {
    if (Math.abs(progressSec - sorted[i].end) <= tol) return true;
  }
  return false;
}

function WSAudioPlayer(props: IProps) {
  const {
    blob,
    initialposition,
    setInitialPosition,
    allowRecord,
    allowZoom,
    hideZoom,
    mediaId,
    allowSegment,
    allowAutoSegment,
    hideSegmentControls,
    allowSpeed,
    allowDeltaVoice,
    allowDownload,
    oneTryOnly,
    height,
    segments,
    verses,
    currentSegmentIndex,
    markers,
    metaData,
    isPlaying,
    regionOnly,
    request,
    loading,
    busy,
    defaultRegionParams,
    canSetDefaultParams,
    doReset,
    autoStart,
    setBusy,
    setMimeType,
    onProgress,
    onSegmentChange,
    onSegmentParamChange,
    onStartRegion,
    onPlayStatus,
    onBlobReady,
    onLoadError,
    setBlobReady,
    setChanged,
    onProcessingRecordingChange,
    onSaveProgress,
    onDuration,
    onInteraction,
    onRecording,
    onCurrentSegment,
    onSegmentPlaybackEnd,
    forceRegionOnly,
    lockSegmentSelection,
    onMarkerClick,
    reload,
    noNewVoice,
    allowNoNoise,
    captureEchoCancellation = false,
    captureNoiseSuppression = false,
    keepItSmall,
    controlsRef,
    applyRegionColor,
    hideToolbar,
    hideControls,
    highlightAutoSegment,
    highlightPlay,
    beforePlay,
    onAutoSegment,
    onClearSegments,
    resetDisabled,
    hasRecording,
    isStopLogic,
    hideWaveformEditTools,
    hasSegmentUndo,
    onSegmentUndo,
    isRecordingRights,
    handleUpload,
    rightsLeftActions,
    forceMobileView,
    onVersions,
    handleSave,
    isSaveDisabled,
    mediaSaveInProgress,
    showWaveformSave,
    dockRecordButton,
    onDockedRecordButton,
    showDockedRecordButton,
    onRecordingCleared,
  } = props;

  const audioDownload = useAudioDownload(mediaId ?? '');

  const showWaveformSaveButton = showWaveformSave ?? true;
  const [myMediaId, setMyMediaId] = useState(mediaId ?? '');
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const [offline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [org] = useGlobal('organization');
  const [features, setFeatures] = useState<IFeatures>();
  const [voiceVisible, setVoiceVisible] = useState(false);
  const [voice, setVoice] = useState('');
  const voiceUrl = useVoiceUrl();
  const { getOrgDefault } = useOrgDefaults();
  const [confirmAction, setConfirmAction] = useState<
    string | React.JSX.Element
  >('');
  const [jump] = useState(2);
  const playbackRef = useRef(1);
  const [playbackRate, setPlaybackRatex] = useState(1);
  const playingRef = useRef(false);
  const lastTogglePlayRef = useRef(0);
  const TOGGLE_PLAY_DEBOUNCE_MS = 300;
  const [playing, setPlayingx] = useState(false);
  const loopingRef = useRef(false);
  const [looping, setLoopingx] = useState(false);
  const [hasRegion, setHasRegion] = useState(0);
  // Sorted region boundaries, kept in sync so the Add/Remove segment buttons can
  // react to whether the playhead is near an existing boundary.
  const [regionBounds, setRegionBounds] = useState<IRegion[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const recordStartPosition = useRef(0);
  const recordOverwritePosition = useRef<number | undefined>(undefined);
  const recordingRef = useRef(false);
  // When recording is initiated, `recordingRef` is updated asynchronously
  // (after `startRecording(...).then(...)` resolves). This ref closes the
  // timing gap so global play hotkeys can't toggle while recording is
  // starting/stopping.
  const recordingStartPendingRef = useRef(false);
  const [recording, setRecordingx] = useState(false);
  const [waitingForAI, setWaitingForAI] = useState(false);
  const [processMsg, setProcessMsg] = useState<string | undefined>(undefined);
  const readyRef = useRef(false);
  const [ready, setReadyx] = useState(false);
  const [progress, setProgressx] = useState(0);
  const progressRef = useRef(0);
  const durationRef = useRef(0);
  const initialPosRef = useRef(initialposition);
  const segmentsRef = useRef('{}'); //do not set to segments
  const markersRef = useRef<IMarker[]>([]);
  const [duration, setDurationx] = useState(0);
  const justPlayButton = allowRecord;
  const [processingRecording, setProcessingRecordingx] = useState(false);
  const processRecordRef = useRef(false);
  const { showMessage } = useSnackBar();
  const [errorReporter] = useGlobal('errorReporter');
  const t: IWsAudioPlayerStrings = useSelector(
    wsAudioPlayerSelector,
    shallowEqual
  );
  const ta: IAudioDownloadStrings = useSelector(audioDownloadSelector);

  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const tm: IMainStrings = useSelector(mainSelector, shallowEqual);
  const [style, setStyle] = useState({
    cursor: busy || loading ? 'progress' : 'default',
  });
  const autostartTimer = useRef<NodeJS.Timeout | undefined>(undefined);
  const onSaveProgressRef = useRef<((progress: number) => void) | undefined>(
    undefined
  );
  const [oneShotUsed, setOneShotUsed] = useState(false);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>(
    []
  );
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState(
    localStorage.getItem(localUserKey(LocalKey.microphoneId)) ?? ''
  );

  const [micMenuAnchorEl, setMicMenuAnchorEl] = useState<null | HTMLElement>(
    null
  );
  const micMenuOpen = Boolean(micMenuAnchorEl);
  const [moreMenuAnchorEl, setMoreMenuAnchorEl] = useState<null | HTMLElement>(
    null
  );
  const moreMenuOpen = Boolean(moreMenuAnchorEl);
  const { isMobile: isMobileView, isMobileWidth } = useMobile();
  const effectiveMobileView = Boolean(forceMobileView) || isMobileView;

  const cancelAIRef = useRef(false);

  useEffect(() => {
    onProcessingRecordingChange?.(processingRecording);
  }, [processingRecording, onProcessingRecordingChange]);

  const { requestAudioAi } = useAudioAi();
  const checkOnline = useCheckOnline(t.reduceNoise);
  const { subscribe, unsubscribe, localizeHotKey } =
    useContext(HotKeyContext).state;
  const [pxPerSec, setPxPerSecx] = useState(maxZoom);
  const pxPerSecRef = useRef(maxZoom);
  /** When set, the zoom to re-apply after an edit reload (snip/undo) so the
   * waveform doesn't snap back to fit-to-width. Cleared once consumed. */
  const preserveZoomOnReloadRef = useRef<number | undefined>(undefined);
  const insertingRef = useRef(false);
  /** True after Stop until final `onRecordStop` finishes — blocks late preview ticks. */
  const recordPreviewSuppressedRef = useRef(false);
  const currentSegmentRef = useRef<IRegion | undefined>(undefined);
  // Recording timer refs for local progress/duration while recording
  const recElapsedRef = useRef<number>(0);
  const recTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const recBaseProgressRef = useRef<number>(0);
  const recBaseDurationRef = useRef<number>(0);
  const setPlaying = useCallback((value: boolean) => {
    playingRef.current = value;
    setPlayingx(value);
  }, []);
  const setDuration = useCallback(
    (value: number) => {
      durationRef.current = value;
      setDurationx(value);
      if (onDuration) onDuration(value);
    },
    [onDuration]
  );
  const setProgress = useCallback(
    (value: number) => {
      progressRef.current = value;
      setProgressx(value);
      if (onProgress) onProgress(value);
    },
    [onProgress]
  );
  const setReady = useCallback((value: boolean) => {
    setReadyx(value);
    readyRef.current = value;
  }, []);

  const setPxPerSec = useCallback((px: number) => {
    if (recordingRef.current) return;
    pxPerSecRef.current = px;
    setPxPerSecx(px);
  }, []);

  useEffect(() => {
    setMyMediaId(mediaId ?? '');
  }, [mediaId]);

  useEffect(() => {
    try {
      const storageKey = localUserKey(LocalKey.microphoneId);
      if (selectedMicrophoneId) {
        localStorage.setItem(storageKey, selectedMicrophoneId);
      }
    } catch {
      // ignore storage errors
    }
  }, [selectedMicrophoneId]);

  const handleMicMenuOpen = (event: MouseEvent<HTMLElement>) => {
    if (audioInputDevices.length === 0) return;
    setMicMenuAnchorEl(event.currentTarget);
  };

  const handleMicMenuClose = () => {
    setMicMenuAnchorEl(null);
  };

  const handleMicSelect = (deviceId: string) => {
    setSelectedMicrophoneId(deviceId);
    handleMicMenuClose();
  };

  const handleMoreMenuOpen = (event: MouseEvent<HTMLElement>) => {
    setMoreMenuAnchorEl(event.currentTarget);
  };

  const handleMoreMenuClose = () => {
    setMoreMenuAnchorEl(null);
  };

  const onZoom = useMemo(
    () =>
      allowZoom
        ? (px: number) => {
            px = Math.round(px * 10) / 10;
            if (px !== pxPerSecRef.current) {
              setPxPerSec(px);
            }
          }
        : undefined,
    [allowZoom, setPxPerSec]
  );

  const singleRegionOnly = useMemo(() => {
    return allowRecord || !allowSegment;
  }, [allowRecord, allowSegment]);

  const calculatedHeight = useMemo(
    () => (keepItSmall && hideToolbar ? height : height - 120),
    [height, keepItSmall, hideToolbar]
  );

  /** Fetching (loading prop) or decoding an existing-media blob — not a failed/cleared load. */
  const waveformLoading = useMemo(
    () =>
      Boolean(myMediaId) &&
      !recording &&
      !waitingForAI &&
      (Boolean(loading) || (Boolean(blob) && !ready)),
    [myMediaId, recording, waitingForAI, loading, blob, ready]
  );

  // Memoize tooltip titles to prevent infinite re-renders
  const recordTooltipTitle = useMemo(() => {
    const baseTitle = recording
      ? oneTryOnly
        ? t.stopTip
        : t.pauseTip
      : t.record;
    return baseTitle.replace('{0}', RECORD_KEY);
  }, [recording, oneTryOnly, t.stopTip, t.pauseTip, t.record]);

  const playTooltipTitle = useMemo(() => {
    const baseTitle = playing
      ? oneTryOnly
        ? t.stopTip
        : t.pauseTip
      : t.playTip;
    return baseTitle.replace(
      '{0}',
      localizeHotKey(justPlayButton ? ALT_PLAY_PAUSE_KEY : PLAY_PAUSE_KEY)
    );
  }, [
    playing,
    oneTryOnly,
    t.stopTip,
    t.pauseTip,
    t.playTip,
    localizeHotKey,
    justPlayButton,
  ]);

  const myOnCurrentSegment = useCallback(
    (currentSegment: IRegion | undefined, index?: number) => {
      //
      //if (singleRegionOnly && currentSegment) {
      //console.log('singleRegionOnly');
      //play it??
      //wsPlayRegion(currentSegment);
      //onPlayStatus && onPlayStatus(true);
      //}
      currentSegmentRef.current = currentSegment;
      onCurrentSegment && onCurrentSegment(currentSegment, index);
    },
    [onCurrentSegment]
  );

  const {
    wsLoad,
    wsClear,
    wsTogglePlay,
    wsPlayRegion,
    wsBlob,
    wsRegionBlob,
    wsPause,
    wsDuration,
    wsPosition,
    wsSetPlaybackRate,
    wsSkip,
    wsGoto,
    wsLoadRegions,
    wsClearRegions,
    wsGetRegions,
    wsLoopRegion,
    wsRegionDelete,
    wsRegionReplace,
    wsUndo,
    wsInsertAudio,
    wsFillPx,
    wsZoom,
    wsAutoSegment,
    wsFindClauseSplitPoint,
    wsPrevRegion,
    wsNextRegion,
    wsRemoveSplitRegion,
    wsAddRegion,
    wsSetHeight,
    wsStartRecord,
    wsStopRecord,
    wsRecordingPeaks,
    wsAddMarkers,
    applyRegionColors,
  } = useWaveSurfer(
    allowSegment,
    waveformRef,
    onWSReady,
    onWSLoadError,
    onWSProgress,
    onWSRegion,
    onWSCanUndo,
    onWSPlayStatus,
    onInteraction,
    onZoom,
    onMarkerClick,
    calculatedHeight,
    singleRegionOnly,
    currentSegmentIndex,
    myOnCurrentSegment,
    onStartRegion,
    onSegmentPlaybackEnd ? onSegmentPlaybackEnd : undefined,
    verses,
    hasSegmentUndo,
    applyRegionColor,
    lockSegmentSelection
  );

  //because we have to call hooks consistently, call this even if we aren't going to record
  const { startRecording, stopRecording } = useWavRecorder(
    allowRecord,
    onRecordStart,
    onRecordStop,
    onRecordError,
    onRecordDataAvailable,
    selectedMicrophoneId || undefined,
    captureEchoCancellation,
    captureNoiseSuppression,
    onRecordPeaks
  );

  const setProcessingRecording = useCallback((value: boolean) => {
    setProcessingRecordingx(value);
    processRecordRef.current = value;
  }, []);
  //#region hotkey handlers
  const handleJumpFn = useCallback(
    (amount: number) => {
      if (!readyRef.current || recordingRef.current) return false;
      wsSkip(amount);
      return true;
    },
    [wsSkip]
  );
  const handleJumpForward = useCallback(
    () => handleJumpFn(jump),
    [handleJumpFn, jump]
  );
  const handleJumpBackward = useCallback(
    () => handleJumpFn(-1 * jump),
    [handleJumpFn, jump]
  );

  const handleToggleLoop = () => {
    setLooping(wsLoopRegion(!looping));
  };
  const handlePrevRegion = useCallback(() => {
    wsPrevRegion();
    return true;
  }, [wsPrevRegion]);
  const handleNextRegion = useCallback(() => {
    wsNextRegion();
    return true;
  }, [wsNextRegion]);

  const handleSendProgress = useCallback(() => {
    if (onSaveProgressRef.current) {
      onSaveProgressRef.current(wsPosition());
      return true;
    }
    return false;
  }, [wsPosition]);
  const setRecording = useCallback(
    (value: boolean) => {
      recordingRef.current = value;
      setRecordingx(value);
      if (onRecording) onRecording(value);

      if (value) {
        // start timer
        recElapsedRef.current = 0;
        recBaseProgressRef.current = progressRef.current;
        recBaseDurationRef.current = durationRef.current;
        if (recTimerRef.current) clearInterval(recTimerRef.current);
        recTimerRef.current = setInterval(() => {
          if (!recordingRef.current) return;
          recElapsedRef.current++;
          // The timer is the pipeline-independent heartbeat (TT-7276); the
          // peaks pipeline keeps wsDuration() more accurate when it's flowing.
          // Take the max so long recordings don't drift with setInterval, but
          // a silent pipeline never freezes the display.
          setDuration(
            Math.max(
              recBaseDurationRef.current + recElapsedRef.current,
              wsDuration()
            )
          );
          setProgress(recBaseProgressRef.current + recElapsedRef.current);
        }, 1000);
      } else {
        if (recTimerRef.current) {
          clearInterval(recTimerRef.current);
          recTimerRef.current = undefined;
        }
      }
    },
    [onRecording, setDuration, setProgress, wsDuration]
  );

  const handleRecorder = useCallback(() => {
    if (
      !allowRecord ||
      playingRef.current ||
      processRecordRef.current ||
      oneShotUsed ||
      loading ||
      busy ||
      waveformLoading
    )
      return false;
    if (!recordingRef.current) {
      recordPreviewSuppressedRef.current = false;
      setPxPerSec(100);
      setBlobReady && setBlobReady(false);
      wsPause(); //stop if playing
      recordStartPosition.current = wsPosition();
      wsStartRecord();
      recordingStartPendingRef.current = true;
      // onRecording(true) fires only after startRecording succeeds — not while
      // the mic is still being acquired (see recordingStartPendingRef for that
      // window). Consumers should treat onRecording(true) as "capture active".
      startRecording(RECORD_PREVIEW_TIMESLICE_MS).then((value) => {
        recordingStartPendingRef.current = false;
        if (value) setRecording(true);
      });

      insertingRef.current = durationRef.current > 0;
      recordOverwritePosition.current = insertingRef.current
        ? recordStartPosition.current
        : undefined;
    } else {
      recordPreviewSuppressedRef.current = true;
      setProcessingRecording(true);
      recordingStartPendingRef.current = false;
      stopRecording();
      wsStopRecord();
      setRecording(false);
      if (oneTryOnly) setOneShotUsed(true);
    }
    return true;
  }, [
    allowRecord,
    setBlobReady,
    wsPause,
    wsPosition,
    wsStartRecord,
    startRecording,
    stopRecording,
    wsStopRecord,
    oneTryOnly,
    setOneShotUsed,
    oneShotUsed,
    setPxPerSec,
    setRecording,
    setProcessingRecording,
    loading,
    busy,
    waveformLoading,
  ]);

  const notifySegmentInteraction = useCallback(() => {
    onInteraction?.();
  }, [onInteraction]);

  const handleClearRegions = useCallback(async () => {
    notifySegmentInteraction();
    if (onClearSegments) {
      await onClearSegments();
      return;
    }
    wsClearRegions();
    if (verses) {
      segmentsRef.current = verses;
      loadRegions();
      onSegmentChange && onSegmentChange(verses);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    wsClearRegions,
    verses,
    onSegmentChange,
    notifySegmentInteraction,
    onClearSegments,
  ]);

  const handleAddRegion = useCallback(() => {
    notifySegmentInteraction();
    return wsAddRegion();
  }, [notifySegmentInteraction, wsAddRegion]);

  const handleRemoveSplitRegion = useCallback(() => {
    notifySegmentInteraction();
    return wsRemoveSplitRegion();
  }, [notifySegmentInteraction, wsRemoveSplitRegion]);
  //#endregion

  const handleRefresh = () => {
    setVoice((getOrgDefault(orgDefaultVoices) as IVoicePerm)?.fullName ?? '');
  };

  useEffect(() => {
    if (!navigator?.mediaDevices?.enumerateDevices) return;

    let active = true;

    const updateDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!active) return;
        const inputs = devices.filter((device) => device.kind === 'audioinput');
        setAudioInputDevices(inputs);
        setSelectedMicrophoneId((current) => {
          if (current && inputs.some((device) => device.deviceId === current)) {
            return current;
          }
          return inputs[0]?.deviceId ?? '';
        });
      } catch {
        if (active) {
          setAudioInputDevices([]);
          setSelectedMicrophoneId('');
        }
      }
    };

    updateDevices();

    const handleDeviceChange = () => {
      updateDevices();
    };

    navigator.mediaDevices.addEventListener?.(
      'devicechange',
      handleDeviceChange
    );

    return () => {
      active = false;
      navigator.mediaDevices.removeEventListener?.(
        'devicechange',
        handleDeviceChange
      );
      [
        PLAY_PAUSE_KEY,
        ALT_PLAY_PAUSE_KEY,
        HOME_KEY,
        END_KEY,
        BACK_KEY,
        AHEAD_KEY,
        TIMER_KEY,
        RECORD_KEY,
        LEFT_KEY,
        RIGHT_KEY,
      ].forEach((key) => unsubscribe(key));
      if (recTimerRef.current) {
        clearInterval(recTimerRef.current);
        recTimerRef.current = undefined;
      }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (org) {
      setFeatures(getOrgDefault(orgDefaultFeatures) as IFeatures);
      handleRefresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  const cleanupAutoStart = () => {
    if (autostartTimer.current) {
      try {
        //make sure clearTimeout is not imported from timers
        clearTimeout(autostartTimer.current);
      } catch (error) {
        console.log(error);
      }
      autostartTimer.current = undefined;
    }
  };
  const launchTimer = () => {
    autostartTimer.current = setTimeout(() => {
      handleRecorder();
    }, 1000 * 0.5);
  };

  useEffect(() => {
    if (autoStart) {
      launchTimer();
    }
    return () => {
      cleanupAutoStart();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  useEffect(() => {
    wsSetHeight(
      waitingForAI ? 0 : keepItSmall && hideToolbar ? height : height - 120
    ); //does this need to be smarter?
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, waitingForAI, keepItSmall, hideToolbar]);

  useEffect(() => {
    if (initialposition !== undefined) {
      if (ready) wsGoto(initialposition);
      else initialPosRef.current = initialposition;
      setInitialPosition && setInitialPosition(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialposition, ready]);

  useEffect(() => {
    if (ready && duration > 0 && markers && markers !== markersRef.current) {
      markersRef.current = markers;
      wsAddMarkers(markers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, duration, ready]);

  useEffect(() => {
    if (segments !== segmentsRef.current) {
      segmentsRef.current = segments;
      if (ready && segmentsRef.current !== wsGetRegions()) {
        loadRegions(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, ready]);

  const loadRegions = (setPosition: boolean = true) => {
    wsLoadRegions(segmentsRef.current, loopingRef.current);
    const region = parseRegions(segmentsRef.current);
    if (setPosition && region.regions.length) {
      const start = region.regions[0].start;
      wsGoto(start);
    }
    const params = parseRegionParams(segmentsRef.current, defaultRegionParams);
    if (params && params !== defaultRegionParams && onSegmentParamChange)
      onSegmentParamChange(params, false);
  };

  useEffect(() => {
    onSaveProgressRef.current = onSaveProgress;
  }, [onSaveProgress]);

  useEffect(() => {
    setDuration(0);
    setProgress(0);
    setHasRegion(0);
    if (blob) {
      setReady(false);
      setBusy && setBusy(true); //turned off on ready
      wsLoad(blob, 0);
    } else {
      setReady(true);
      setBusy && setBusy(false);
      wsClear(true);
      initialPosRef.current = undefined;
      recordStartPosition.current = 0;
      setOneShotUsed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob, doReset]); //passed in by user

  useEffect(() => {
    wsSetPlaybackRate(playbackRate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackRate]);

  useEffect(() => {
    setStyle({
      cursor: busy || loading ? 'progress' : 'default',
    });
  }, [busy, loading]);

  const handlePlayStatus = useCallback(
    async (play: boolean) => {
      if (durationRef.current === 0 || recordingRef.current) return false;
      if (play && beforePlay) {
        const skipDefault = await beforePlay();
        if (skipDefault === false) return playingRef.current;
      }
      const wouldReplayRegion =
        play && (regionOnly || forceRegionOnly) && !!currentSegmentRef.current;
      if (play === playingRef.current && !wouldReplayRegion) {
        return playingRef.current;
      }
      let nowplaying = play;

      if (
        play &&
        (regionOnly || forceRegionOnly) &&
        currentSegmentRef.current
      ) {
        const position = wsPosition();
        const { start, end } = currentSegmentRef.current;
        const resumeWithinSegment =
          position > start + 0.01 && position < end - 0.01;
        const regionPlayed = wsPlayRegion(
          currentSegmentRef.current,
          resumeWithinSegment
        );
        nowplaying = regionPlayed ? true : wsTogglePlay();
      } else nowplaying = wsTogglePlay();
      if (nowplaying && Math.abs(wsPosition() - durationRef.current) < 0.2)
        wsGoto(0);
      setPlaying(nowplaying);
      if (onPlayStatus) {
        onPlayStatus(nowplaying);
      }
      return undefined;
    },
    [
      regionOnly,
      forceRegionOnly,
      wsPosition,
      wsPlayRegion,
      wsTogglePlay,
      wsGoto,
      onPlayStatus,
      setPlaying,
      beforePlay,
    ]
  );
  const togglePlayStatus = useCallback(() => {
    const now = Date.now();
    if (now - lastTogglePlayRef.current < TOGGLE_PLAY_DEBOUNCE_MS) return;
    lastTogglePlayRef.current = now;
    handlePlayStatus(!playingRef.current);
  }, [handlePlayStatus]);

  const handlePlayPauseHotkey = useCallback(() => {
    if (
      recordingRef.current ||
      recordingStartPendingRef.current ||
      processRecordRef.current
    )
      return false;
    togglePlayStatus();
    return true;
  }, [togglePlayStatus]);

  const handleHomeHotkey = useCallback(() => {
    if (!readyRef.current || recordingRef.current) return false;
    wsGoto(0);
    return true;
  }, [wsGoto]);

  const handleEndHotkey = useCallback(() => {
    if (!readyRef.current || recordingRef.current) return false;
    wsPause();
    setPlaying(false);
    wsGoto(durationRef.current);
    return true;
  }, [wsGoto, wsPause, setPlaying]);

  useEffect(() => {
    if (justPlayButton) {
      subscribe(ALT_PLAY_PAUSE_KEY, handlePlayPauseHotkey);
      return () => unsubscribe(ALT_PLAY_PAUSE_KEY);
    }
    subscribe(PLAY_PAUSE_KEY, handlePlayPauseHotkey);
    subscribe(HOME_KEY, handleHomeHotkey);
    subscribe(END_KEY, handleEndHotkey);
    subscribe(BACK_KEY, handleJumpBackward);
    subscribe(AHEAD_KEY, handleJumpForward);
    subscribe(TIMER_KEY, handleSendProgress);
    return () => {
      unsubscribe(PLAY_PAUSE_KEY);
      unsubscribe(HOME_KEY);
      unsubscribe(END_KEY);
      unsubscribe(BACK_KEY);
      unsubscribe(AHEAD_KEY);
      unsubscribe(TIMER_KEY);
    };
  }, [
    justPlayButton,
    handlePlayPauseHotkey,
    handleHomeHotkey,
    handleEndHotkey,
    handleJumpBackward,
    handleJumpForward,
    handleSendProgress,
    subscribe,
    unsubscribe,
  ]);

  useEffect(() => {
    if (!allowRecord) return;
    subscribe(RECORD_KEY, handleRecorder);
    return () => unsubscribe(RECORD_KEY);
  }, [allowRecord, handleRecorder, subscribe, unsubscribe]);

  useEffect(() => {
    if (!allowSegment) return;
    subscribe(LEFT_KEY, handlePrevRegion);
    subscribe(RIGHT_KEY, handleNextRegion);
    return () => {
      unsubscribe(LEFT_KEY);
      unsubscribe(RIGHT_KEY);
    };
  }, [
    allowSegment,
    handlePrevRegion,
    handleNextRegion,
    subscribe,
    unsubscribe,
  ]);

  useEffect(() => {
    if (isPlaying !== undefined) handlePlayStatus(isPlaying);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, request, duration]);

  function onRecordStart() {
    setPxPerSec(100);
  }

  async function onRecordStop(blob: Blob) {
    recordingStartPendingRef.current = false;
    try {
      try {
        await wsInsertAudio(
          blob,
          undefined,
          recordStartPosition.current,
          recordOverwritePosition.current
        );
      } catch (err) {
        // Inserting the take against the live-preview buffer failed
        // (decode/splice race or aborted wavesurfer load). Retry with a splice
        // at recordStartPosition when overdubbing; undefined endposition is only
        // for a fresh recording (replaces the whole waveform).
        logError(
          Severity.error,
          errorReporter,
          err instanceof Error ? err : new Error(String(err))
        );
        try {
          // Fresh take: endposition undefined replaces the waveform. Adding to existing
          // audio must splice at recordStartPosition or the original take is discarded.
          const fallbackEnd = insertingRef.current
            ? recordStartPosition.current
            : undefined;
          await wsInsertAudio(
            blob,
            undefined,
            recordStartPosition.current,
            fallbackEnd
          );
        } catch (fallbackErr) {
          logError(
            Severity.error,
            errorReporter,
            fallbackErr instanceof Error
              ? fallbackErr
              : new Error(String(fallbackErr))
          );
        }
      }
      recordOverwritePosition.current = undefined;
    } finally {
      recordPreviewSuppressedRef.current = false;
      setProcessingRecording(false);
      // Preview ticks may have already updated the waveform when adding to
      // existing audio; always sync blob/duration/save even if the final insert
      // threw (TT-7384).
      try {
        await handleChanged();
      } catch (err) {
        logError(
          Severity.error,
          errorReporter,
          err instanceof Error ? err : new Error(String(err))
        );
      }
    }
  }

  function onRecordError(e: any) {
    recordingStartPendingRef.current = false;
    recordPreviewSuppressedRef.current = false;
    setProcessingRecording(false);

    if (autostartTimer.current && e.error === 'No mediaRecorder') {
      cleanupAutoStart();
      launchTimer();
    } else {
      showMessage(e.error || e.toString());
    }
  }

  // Live waveform is rendered from precomputed peaks (onRecordPeaks below) —
  // the record plugin's technique. Preview data ticks no longer decode/splice/
  // reload the whole take each second (that work grew with recording length and
  // the waveform could not keep up). The complete take is inserted once, in
  // onRecordStop; recordOverwritePosition stays at the start position so the
  // final splice is a pure insert when overdubbing.
  async function onRecordDataAvailable(blob: Blob) {
    if (blob.size <= 0) return;
    if (recordPreviewSuppressedRef.current) return;
  }

  /** Cheap live render: pre/post peaks around the record point + live mic peaks. */
  function onRecordPeaks(peaks: Float32Array, seconds: number) {
    if (recordPreviewSuppressedRef.current) return;
    void wsRecordingPeaks(peaks, seconds);
  }

  function onWSLoadError(error: unknown) {
    setReady(true);
    if (setBusy) setBusy(false);
    if (onLoadError) {
      onLoadError(error);
    } else {
      showMessage(ts.mediaError, AlertSeverity.Error);
    }
  }

  function onWSReady(duration: number, loadingAnother: boolean) {
    // Safety guard: peaks preview loads suppress 'ready' during recording, so
    // this should not fire mid-recording anymore; if a stray ready arrives,
    // ignore it — the rec timer drives duration/progress while recording.
    if (recordingRef.current) return;
    setDuration(duration);
    if (loadingAnother) return;
    setReady(true);
    if (!recordingRef.current) {
      // After an edit reload (snip/undo) restore the prior zoom instead of
      // snapping to fit-to-width. Only restore when it was zoomed in past fit.
      const preserved = preserveZoomOnReloadRef.current;
      preserveZoomOnReloadRef.current = undefined;
      if (preserved !== undefined && preserved > wsFillPx()) {
        setPxPerSec(preserved);
        wsZoom(preserved);
      } else {
        setPxPerSec(wsFillPx());
      }
    }
    if (segmentsRef.current) loadRegions();

    if (setBusy) setBusy(false);
    if (initialPosRef.current) wsGoto(initialPosRef.current);
    initialPosRef.current = undefined;
  }

  function onWSProgress(progress: number) {
    // Ignore WS-driven progress while recording; we drive from timer
    if (recordingRef.current) return;
    if (progressRef.current !== progress) {
      setProgress(progress);
    }
  }
  function onWSRegion(count: number, newRegion: boolean) {
    setHasRegion(count);
    const regionsJson = wsGetRegions();
    setRegionBounds(getSortedRegions(regionsJson));
    if (onSegmentChange && newRegion) onSegmentChange(regionsJson);
  }
  function onWSCanUndo(canUndo: boolean) {
    setCanUndo(canUndo);
  }
  function onWSPlayStatus(status: boolean) {
    setPlaying(status);
    if (onPlayStatus) onPlayStatus(status);
  }

  const setLooping = (value: boolean) => {
    loopingRef.current = value;
    setLoopingx(value);
  };

  const setPlaybackRate = (value: number) => {
    const newVal = parseFloat(value.toFixed(2));
    playbackRef.current = newVal;
    setPlaybackRatex(newVal);
  };

  const handleChanged = useCallback(async () => {
    setMyMediaId('');
    setBlobReady && setBlobReady(false);
    const newblob = await wsBlob();
    onBlobReady && onBlobReady(newblob);
    setBlobReady && setBlobReady(newblob !== undefined);
    if (setMimeType && newblob?.type) setMimeType(newblob?.type);
    const nextDuration = wsDuration();
    setDuration(nextDuration);
    setProgress(wsPosition());
    // Only positive duration counts as savable audio. A trim can yield 0:00 while the blob still
    // has non-zero size (e.g. container/header only); those must not enable Save.
    const hasAudio = nextDuration > 0;
    setChanged && setChanged(hasAudio);
  }, [
    setChanged,
    setBlobReady,
    wsBlob,
    onBlobReady,
    setMimeType,
    setDuration,
    setProgress,
    wsDuration,
    wsPosition,
  ]);

  const confirmedDelete = useCallback(() => {
    setProcessingRecording(false);
    setPlaying(false);
    wsClear();
    setDuration(0);
    setProgress(0);
    setChanged && setChanged(false);
    onBlobReady && onBlobReady(undefined);
    setBlobReady && setBlobReady(false);
    oneShotUsed && setOneShotUsed(false);
    setReady(true);
    setMyMediaId('');
    onRecordingCleared?.();
  }, [
    wsClear,
    setChanged,
    onBlobReady,
    setBlobReady,
    oneShotUsed,
    setOneShotUsed,
    setPlaying,
    setDuration,
    setProgress,
    setReady,
    onRecordingCleared,
    setProcessingRecording,
  ]);
  const handleActionConfirmed = () => {
    initialPosRef.current = undefined;
    if (confirmAction === t.clearRecording) {
      confirmedDelete();
    } else {
      handleDeleteRegion();
    }
    setConfirmAction('');
  };
  const handleActionRefused = () => {
    setConfirmAction('');
  };
  const handleClear = useCallback(() => {
    setConfirmAction(t.clearRecording);
  }, [t.clearRecording]);

  const handleDeleteRegion = () => {
    setPlaying(false);
    preserveZoomOnReloadRef.current = pxPerSecRef.current;
    wsRegionDelete().then(() => {
      handleChanged();
    });
  };

  const handleUndo = useCallback(() => {
    preserveZoomOnReloadRef.current = pxPerSecRef.current;
    wsUndo().then(() => {
      handleChanged();
    });
  }, [wsUndo, handleChanged]);
  useEffect(() => {
    if (!controlsRef) return;
    controlsRef.current = {
      togglePlay: togglePlayStatus,
      setPlay: handlePlayStatus,
      toggleRecord: handleRecorder,
      prevSegment: handlePrevRegion,
      nextSegment: handleNextRegion,
      undoSegmentChange: handleUndo,
      resetSegments: handleClearRegions,
      deleteRecording: handleClear,
      confirmedDelete: confirmedDelete,
      getProgress: () => progressRef.current,
      getDuration: () => durationRef.current,
      isReady: () => readyRef.current,
      isPlaying: () => playingRef.current,
      gotoTime: (seconds: number, targetRegion?: IRegion) =>
        wsGoto(seconds, false, targetRegion),
      applyRegionColors,
      runAutoSegment: (params) => Promise.resolve(wsAutoSegment(false, params)),
      findClauseSplitPoint: (clause, params) =>
        wsFindClauseSplitPoint(clause, params),
      getRegionsJson: () => wsGetRegions(),
      loadRegionsJson: (regionsJson: string) => {
        segmentsRef.current = regionsJson;
        wsLoadRegions(regionsJson, loopingRef.current);
      },
    };
    return () => {
      controlsRef.current = null;
    };
  }, [
    controlsRef,
    allowSegment,
    togglePlayStatus,
    handlePlayStatus,
    handleRecorder,
    handlePrevRegion,
    handleNextRegion,
    handleUndo,
    handleClearRegions,
    handleClear,
    confirmedDelete,
    wsGoto,
    applyRegionColors,
    wsAutoSegment,
    wsFindClauseSplitPoint,
    wsGetRegions,
    wsLoadRegions,
  ]);

  const doingProcess = (inprogress: boolean, msg?: string) => {
    setProcessMsg(msg ?? t.aiInProgress);
    setWaitingForAI(inprogress);
    setBusy && setBusy(inprogress);
    setBlobReady && setBlobReady(!inprogress);
  };
  const showAiProgressOverlay = waitingForAI;

  const waveformNode = (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        position: 'relative',
        minHeight: calculatedHeight,
        overflow: 'hidden',
      }}
    >
      <div
        id="wsAudioWaveform"
        ref={waveformRef}
        style={{
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
          visibility:
            waveformLoading || showAiProgressOverlay ? 'hidden' : 'visible',
        }}
      />
      {waveformLoading && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <Typography>{ts.loading}</Typography>
        </Box>
      )}
      {showAiProgressOverlay && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            px: 2,
            pointerEvents: 'auto',
          }}
        >
          <Typography
            sx={{
              textAlign: 'center',
              whiteSpace: 'normal',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              overflowWrap: 'break-word',
              wordBreak: 'break-word',
            }}
          >
            {processMsg}
          </Typography>
          <AltButton
            id="ai-cancel"
            onClick={() => {
              cancelAIRef.current = true;
              doingProcess(false);
            }}
          >
            {ts.cancel}
          </AltButton>
        </Box>
      )}
    </Box>
  );

  const audioAiError = (
    func: AudioAiFunc,
    targetVoice?: string,
    error?: Error | AxiosError
  ) => {
    const summary =
      t.getString(`${func}Failed`) ??
      t.aiFailed
        .replace('{0}', targetVoice ? ` for ${targetVoice}` : '')
        .replace('{1}', func);
    const { summary: displaySummary, details } = aeroTaskErrorParts(
      error ? axiosErrorMessage(error) : '',
      summary
    );
    const logText = details ? `${displaySummary}: ${details}` : displaySummary;
    const display = (
      <AeroTaskErrorMessage
        summary={displaySummary}
        details={details}
        detailsLabel={tm.details}
      />
    );
    return { display, logText };
  };
  const applyAudioAi = (func: AudioAiFunc, targetVoice?: string) => {
    checkOnline((online) => {
      if (!online) {
        showMessage(ts.mustBeOnline);
        return;
      }
      if (!reload) throw new Exception('need reload defined.');
      cancelAIRef.current = false;
      try {
        doingProcess(true);
        const filename = `${Date.now()}ai.wav`;
        wsRegionBlob().then((blob) => {
          if (blob) {
            requestAudioAi({
              func,
              cancelRef: cancelAIRef,
              file: new File([blob], filename, { type: 'audio/wav' }),
              targetVoice,
              cb: (file: File | Error) => {
                if (file instanceof File) {
                  const regionblob = new Blob([file], { type: file.type });
                  if (regionblob) {
                    wsRegionReplace(regionblob).then((newblob) => {
                      if (newblob) reload(newblob);
                      void handleChanged();
                    });
                  }
                } else {
                  if ((file as Error).message !== 'canceled') {
                    const { display, logText } = audioAiError(
                      func,
                      targetVoice,
                      file
                    );
                    showMessage(display, AlertSeverity.Error);
                    logError(Severity.error, errorReporter, logText);
                  }
                }
                doingProcess(false);
              },
            });
          } else {
            doingProcess(false);
          }
        });
      } catch (error: any) {
        const { display, logText } = audioAiError(func, targetVoice, error);
        logError(Severity.error, errorReporter, logText);
        showMessage(display, AlertSeverity.Error);
        doingProcess(false);
      }
    });
  };
  const handleNoiseRemoval = () => {
    applyAudioAi(AudioAiFunc.noiseRemoval);
  };
  const applyVoiceChange = () => {
    checkOnline(async (online) => {
      if (!online) {
        showMessage(ts.mustBeOnline);
        return;
      }
      if (!voice) return;
      const targetVoice = await voiceUrl(voice);
      if (targetVoice) {
        applyAudioAi(AudioAiFunc.voiceConversion, targetVoice);
        setVoiceVisible(false);
        showMessage(t.beginVoiceConvert);
      }
    });
  };
  const handleVoiceChange = () => {
    if (voice) {
      applyVoiceChange();
    } else {
      setVoiceVisible(true);
    }
  };
  const handleCloseVoice = () => {
    setVoiceVisible(false);
  };
  const handleVoiceSettings = () => {
    checkOnline((online) => {
      if (!online) {
        showMessage(ts.mustBeOnline);
        return;
      }
      setVoiceVisible(true);
    });
  };

  const voiceDialogNode = (
    <BigDialog
      title={t.selectVoice}
      description={
        <Typography
          sx={{
            overflowWrap: 'break-word',
            wordBreak: 'break-word',
          }}
        >
          {t.selectVoicePrompt}
        </Typography>
      }
      isOpen={voiceVisible}
      onOpen={handleCloseVoice}
      bp={effectiveMobileView ? BigDialogBp.mobile : BigDialogBp.sm}
      mobileNoHorizontalScroll={effectiveMobileView}
      mobilePaperWidth={
        effectiveMobileView ? 'min(356px, calc(100vw - 4px))' : undefined
      }
      dialogContentSx={{ minWidth: 0, overflowX: 'hidden' }}
    >
      <SelectVoice
        noNewVoice={noNewVoice && duration > 0}
        onlySettings={duration === 0}
        onOpen={handleCloseVoice}
        begin={applyVoiceChange}
        refresh={handleRefresh}
      />
    </BigDialog>
  );

  const handleNormal = async () => {
    if (!reload) throw new Exception('need reload defined.');

    try {
      doingProcess(true, t.normalizeInProgress);
      const fileBeg = await dataPath(`${Date.now()}b-norm.wav`, PathType.MEDIA);
      const fileEnd = await dataPath(`${Date.now()}e-norm.wav`, PathType.MEDIA);
      const blob = await wsRegionBlob();
      if (blob) {
        // write to local file system
        const arrayBuffer = await blob.arrayBuffer();
        const absMax = new Uint8Array(arrayBuffer).reduce(
          (a, b) => Math.max(a, Math.abs(b)),
          0
        );

        if (absMax < 255) throw new Exception(t.tooQuiet);
        await ipc?.writeBuffer(fileBeg, arrayBuffer);
        await ipc?.normalize(fileBeg, fileEnd);
        const result = (await ipc?.read(fileEnd)) as Uint8Array;
        const regionblob = new Blob([new Uint8Array(result)], {
          type: blob.type,
        });
        const newblob = await wsRegionReplace(regionblob);
        if (newblob) reload(newblob);
        void handleChanged();
        await ipc?.delete(fileBeg);
        await ipc?.delete(fileEnd);
      }
    } catch (error: any) {
      const msg = t.normalizeFail.replace('{0}', error.message);
      if (errorReporter) logError(Severity.error, errorReporter, msg);
      showMessage(msg);
    } finally {
      doingProcess(false);
    }
  };

  const isControlDisabled = useMemo(
    () => !ready || playing || recording || duration === 0 || waitingForAI,
    [ready, playing, recording, duration, waitingForAI]
  );
  const renderMoreMenuItems = () =>
    [
      allowRecord === true && allowNoNoise && features?.noNoise && !offline && (
        <MenuItem
          key="noise-removal"
          id="noiseRemoval"
          onClick={() => {
            handleNoiseRemoval();
            handleMoreMenuClose();
          }}
          disabled={isControlDisabled}
        >
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ py: 0.25 }}
          >
            <NoChickenIcon
              sx={{ width: '14pt', height: '14pt', flexShrink: 0 }}
              disabled={isControlDisabled}
            />
            <Typography variant="body2">{t.reduceNoiseAi}</Typography>
          </Stack>
        </MenuItem>
      ),
      allowRecord === true &&
        features?.deltaVoice &&
        allowDeltaVoice !== false &&
        !offline && (
          <MenuItem
            key="voice-convert"
            id="voiceChange"
            onClick={() => {
              handleVoiceChange();
              handleMoreMenuClose();
            }}
            disabled={isControlDisabled}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <VoiceConversionLogo
                sx={{
                  width: '18pt',
                  height: '18pt',
                  flexShrink: 0,
                }}
                disabled={isControlDisabled}
              />
              <Typography variant="body2">{t.convertVoiceAi}</Typography>
            </Stack>
          </MenuItem>
        ),
      allowRecord === true &&
        features?.deltaVoice &&
        allowDeltaVoice !== false &&
        !offline && (
          <MenuItem
            key="voice-convert-settings"
            onClick={() => {
              handleVoiceSettings();
              handleMoreMenuClose();
            }}
            disabled={isControlDisabled && duration > 0}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <SettingsIcon
                fontSize="small"
                sx={{
                  flexShrink: 0,
                  color:
                    isControlDisabled && duration > 0
                      ? 'action.disabled'
                      : 'secondary.light',
                  opacity: 0.85,
                }}
              />
              <Typography variant="body2">
                {t.selectVoiceForConversion}
              </Typography>
            </Stack>
          </MenuItem>
        ),
      allowRecord === true && features?.normalize && isElectron && (
        <MenuItem
          key="normalize"
          id="normalize"
          onClick={() => {
            handleNormal();
            handleMoreMenuClose();
          }}
          disabled={isControlDisabled}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <NormalizeIcon
              width="18pt"
              height="18pt"
              disabled={isControlDisabled}
            />
            <Typography variant="body2">{t.normalize}</Typography>
          </Stack>
        </MenuItem>
      ),
      myMediaId && allowDownload !== false && (
        <MenuItem
          key="audio-download"
          disabled={audioDownload.isDisabled}
          onClick={() => {
            audioDownload.startDownload();
            handleMoreMenuClose();
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ py: 0.25 }}
          >
            <AudioDownloadView
              mediaId={myMediaId}
              menuItem
              {...audioDownload}
            />
            <Typography variant="body2">{ta.downloadMedia}</Typography>
          </Stack>
        </MenuItem>
      ),
      allowRecord === true && !keepItSmall && (
        <MenuItem
          key="microphone-control"
          id="wsAudioMic"
          onClick={(e) => {
            handleMicMenuOpen(e);
            handleMoreMenuClose();
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <MicIcon
              sx={{
                flexShrink: 0,
                color:
                  audioInputDevices.length === 0 ? 'text.disabled' : 'inherit',
              }}
            />
            <Typography variant="body2">{t.selectMicrophoneMenu}</Typography>
          </Stack>
        </MenuItem>
      ),
    ].filter(Boolean);

  const onSplit = () => {};

  const positionDurationNode = (
    <Typography sx={{ m: '5px' }}>
      <Duration id="wsAudioPosition" seconds={progress} /> {' / '}
      <Duration id="wsAudioDuration" seconds={duration} />
    </Typography>
  );

  // Disable Add when the playhead is on an existing boundary, and enable Remove
  // only when it's on a removable internal join. Recomputed as the playhead
  // (`progress`) moves or the regions change.
  const playheadNearBoundary = useMemo(
    () =>
      isProgressNearAnyRegionBoundary(
        progress,
        regionBounds,
        SEGMENT_BOUNDARY_TOLERANCE_SEC
      ),
    [progress, regionBounds]
  );
  const playheadNearInternalJoin = useMemo(
    () =>
      isProgressNearInternalJoin(
        progress,
        regionBounds,
        SEGMENT_BOUNDARY_TOLERANCE_SEC
      ),
    [progress, regionBounds]
  );

  const renderSegmentControls = () => (
    <WSAudioPlayerSegment
      ready={ready}
      onSplit={onSplit}
      onParamChange={onSegmentParamChange}
      loop={loopingRef.current || false}
      playing={playing}
      currentNumRegions={hasRegion}
      params={defaultRegionParams}
      canSetDefault={canSetDefaultParams}
      highlightAutoSegment={highlightAutoSegment}
      onAutoSegment={onAutoSegment}
      wsAutoSegment={allowAutoSegment ? wsAutoSegment : undefined}
      wsRemoveSplitRegion={handleRemoveSplitRegion}
      wsAddRegion={handleAddRegion}
      disableSplit={playheadNearBoundary}
      removeEnabled={playheadNearInternalJoin}
      setBusy={setBusy}
    />
  );

  const renderRecordButton = (opts: {
    isSmall: boolean;
    isMobileView?: boolean;
    isRecordingRights?: boolean;
    showText?: boolean;
  }) => (
    <RecordButton
      recording={recording}
      oneTryOnly={oneTryOnly}
      onClick={handleRecorder}
      disabled={
        playing ||
        processingRecording ||
        waitingForAI ||
        Boolean(loading) ||
        Boolean(busy) ||
        waveformLoading ||
        (Boolean(oneTryOnly) && oneShotUsed && !recording) ||
        (!allowRecord && !recording)
      }
      tooltipTitle={recordTooltipTitle}
      hasRecording={hasRecording ?? false}
      isStopLogic={isStopLogic ?? false}
      oneShotUsed={oneShotUsed}
      {...opts}
    />
  );

  const dockedRecordButtonNode = useMemo(
    () =>
      allowRecord || recording || showDockedRecordButton
        ? renderRecordButton({
            isSmall: true,
            isMobileView: true,
            isRecordingRights: false,
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      allowRecord,
      recording,
      showDockedRecordButton,
      processingRecording,
      waitingForAI,
      loading,
      busy,
      waveformLoading,
      oneTryOnly,
      oneShotUsed,
      hasRecording,
      isStopLogic,
      recordTooltipTitle,
    ]
  );

  useLayoutEffect(() => {
    if (!dockRecordButton || !onDockedRecordButton) return;
    onDockedRecordButton(dockedRecordButtonNode);
    return () => onDockedRecordButton(null);
  }, [dockRecordButton, onDockedRecordButton, dockedRecordButtonNode]);

  const deleteRegionNode = !hideWaveformEditTools &&
    hasRegion !== 0 &&
    !oneShotUsed &&
    !isMobileView && (
      <LightTooltip id="wsAudioDeleteRegionTip" title={t.deleteRegion}>
        <span>
          <IconButton
            id="wsAudioDeleteRegion"
            onClick={handleDeleteRegion}
            disabled={recording || waitingForAI}
          >
            <HandScissors />
          </IconButton>
        </span>
      </LightTooltip>
    );

  // Waveform-edit undo (trim/delete-region): undoes edits on the wavesurfer
  // itself via the internal `handleUndo`. Only shown in recording/editing
  // contexts (rendered inside `allowRecord`). Distinct from `segmentUndoNode`,
  // which delegates to a host tool's own undo stack.
  const recordingUndoNode = !hideWaveformEditTools &&
    canUndo &&
    !oneShotUsed && (
      <LightTooltip id="wsUndoTip" title={t.undoTip}>
        <span>
          <IconButton
            id="wsUndo"
            onClick={handleUndo}
            disabled={recording || waitingForAI}
          >
            <UndoIcon />
          </IconButton>
        </span>
      </LightTooltip>
    );

  // Tool-managed segment undo (e.g. Mark Verses). Distinct from the recording undo;
  // this delegates to the host's
  // own undo stack via onSegmentUndo. The two never render together (no
  // consumer should set both allowRecord and hasSegmentUndo).
  const segmentUndoNode = !hideToolbar && hasSegmentUndo && onSegmentUndo && (
    <LightTooltip id="wsSegmentUndoTip" title={t.undoTip}>
      <span>
        <IconButton
          id="wsSegmentUndo"
          aria-label={t.undoTip}
          onClick={() => onSegmentUndo?.()}
          disabled={recording || waitingForAI}
        >
          <UndoIcon />
        </IconButton>
      </span>
    </LightTooltip>
  );

  const moreAndMicMenusNode = renderMoreMenuItems().length > 0 && (
    <Grid>
      {audioDownload.hiddenAnchor}
      <LightTooltip id="wsAudioMoreTip" title={t.moreOptions}>
        <span>
          <IconButton id="wsAudioMore" onClick={handleMoreMenuOpen}>
            <MoreVertIcon />
          </IconButton>
        </span>
      </LightTooltip>
      <Menu
        anchorEl={moreMenuAnchorEl}
        open={moreMenuOpen}
        onClose={handleMoreMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {renderMoreMenuItems()}
      </Menu>
      <Menu
        anchorEl={micMenuAnchorEl}
        open={micMenuOpen}
        onClose={handleMicMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        {audioInputDevices.length === 0 ? (
          <MenuItem disabled>{ts.noAudio}</MenuItem>
        ) : (
          audioInputDevices.map((device, index) => (
            <MenuItem
              key={device.deviceId || `input-${index}`}
              selected={selectedMicrophoneId === device.deviceId}
              onClick={() => handleMicSelect(device.deviceId)}
            >
              {device.label || `Input ${index + 1}`}
            </MenuItem>
          ))
        )}
      </Menu>
    </Grid>
  );
  const hasClearableAudio =
    duration > 0 || recording || Boolean(blob) || oneShotUsed;
  const clearRecordingNode = allowRecord &&
    hasClearableAudio &&
    !dockRecordButton && (
      <LightTooltip id="wsAudioClearTip" title={t.clearRecordingTip}>
        <span>
          <AltButton
            id="wsAudioClear"
            onClick={() => handleClear()}
            disabled={
              recording ||
              duration === 0 ||
              waitingForAI ||
              Boolean(mediaSaveInProgress)
            }
            sx={smallButtonProps}
          >
            {t.reset}
          </AltButton>
        </span>
      </LightTooltip>
    );
  const playDisabled = duration === 0 || recording || waitingForAI;
  const highlightPlayNow = highlightPlay && !playing;
  const playNode = (
    <LightTooltip id="wsAudioPlayTip" title={playTooltipTitle}>
      <span>
        <IconButton
          id="wsAudioPlay"
          aria-label={playTooltipTitle}
          onClick={togglePlayStatus}
          disabled={playDisabled}
          variant={highlightPlayNow ? 'primary' : undefined}
          // The play button is large to make it more
          // prominent, but drop the large padding and constrain the size when highlighted,
          // so spacing looks balanced.
          size={highlightPlayNow ? undefined : 'large'}
          sx={highlightPlayNow ? { width: 40, height: 40, p: 0 } : { p: 0 }}
        >
          {playing ? (
            <PauseIcon fontSize="large" />
          ) : (
            <PlayIcon fontSize="large" />
          )}
        </IconButton>
      </span>
    </LightTooltip>
  );

  const zoomNode = allowZoom && !hideZoom && (
    <WSAudioPlayerZoom
      ready={ready && !recording && !waitingForAI}
      fillPx={recording ? 100 : wsFillPx()}
      curPx={pxPerSec}
      onZoom={wsZoom}
    />
  );
  const confirmNode = confirmAction !== '' && (
    <Confirm
      jsx={typeof confirmAction !== 'string' ? confirmAction : undefined}
      text={typeof confirmAction === 'string' ? confirmAction : ''}
      yesResponse={handleActionConfirmed}
      noResponse={handleActionRefused}
    />
  );

  if (keepItSmall && hideToolbar && allowRecord && !oneShotUsed) {
    return (
      <>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'stretch',
            gap: 1,
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0, height: calculatedHeight }}>
            {waveformNode}
          </Box>
          {renderRecordButton({ isSmall: true })}
        </Box>
        {confirmNode}
      </>
    );
  }

  if (isRecordingRights) {
    return (
      <>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            mx: 1,
            py: 1,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          {duration === 0 || recording ? (
            renderRecordButton({
              isSmall: true,
              isMobileView: true,
              isRecordingRights: true,
            })
          ) : (
            <Stack
              direction="row"
              spacing={1}
              sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}
            >
              {playNode}
              {positionDurationNode}
              {clearRecordingNode}
            </Stack>
          )}
          {handleUpload && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {!isMobileWidth && rightsLeftActions}
              <Button
                sx={{
                  mx: 1,
                  border: '0.5px solid blue',
                  borderRadius: '8px',
                }}
                id="spkr-upload"
                onClick={handleUpload}
                title={ts.upload}
              >
                <UploadIcon sx={{ mr: 1 }} />
                {ts.upload}
              </Button>
            </Box>
          )}
        </Stack>
        {waveformNode}
        {confirmNode}
        {voiceDialogNode}
      </>
    );
  }
  return (
    <Stack
      direction="column"
      sx={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        px: 1,
        boxSizing: 'border-box',
        overflowX: 'hidden',
        ...(dockRecordButton
          ? {}
          : {
              height: '100%',
              justifyContent: 'space-between',
            }),
      }}
      style={style}
    >
      <Stack>
        {!hideToolbar && (
          <Stack
            direction="row"
            spacing={1}
            sx={{
              py: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}
            >
              {playNode}
              {positionDurationNode}
              {!isMobileView && zoomNode}
            </Stack>

            <Stack
              direction="row"
              spacing={1}
              sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}
            >
              {segmentUndoNode}
              {allowRecord && (
                <>
                  {deleteRegionNode}
                  {recordingUndoNode}
                  {moreAndMicMenusNode}
                </>
              )}
            </Stack>
          </Stack>
        )}

        {keepItSmall && allowRecord && !oneShotUsed ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'stretch',
              gap: 1,
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>{waveformNode}</Box>
            {renderRecordButton({ isSmall: true })}
          </Box>
        ) : (
          <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
            {waveformNode}
          </Box>
        )}

        {!hideControls && (
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            sx={{
              py: 1,
              rowGap: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              flexWrap="wrap"
              sx={{
                display: 'flex',
                alignItems: 'center',
                rowGap: 1,
                minWidth: 0,
              }}
            >
              {allowSegment && (
                <Stack direction="row" spacing={1}>
                  {!hideSegmentControls && renderSegmentControls()}
                  {hideToolbar && canUndo && !oneShotUsed && (
                    <IconButton
                      id="wsUndo"
                      onClick={handleUndo}
                      disabled={recording || waitingForAI}
                    >
                      <UndoIcon />
                    </IconButton>
                  )}
                </Stack>
              )}
              {/* Segment navigation and loop only make sense for the transcriber
                  (allowAutoSegment) */}
              {allowAutoSegment && !isMobileView && (
                <>
                  {allowSegment && <VertDivider id="wsAudioSegDiv" />}
                  <LightTooltip
                    id="wsAudioLoopTip"
                    title={looping ? t.loopon : t.loopoff}
                  >
                    <span>
                      <ToggleButton
                        id="wsAudioLoop"
                        sx={{ mx: 1, p: 0.5 }}
                        value="loop"
                        selected={looping}
                        onChange={handleToggleLoop}
                        disabled={!hasRegion || waitingForAI}
                      >
                        <LoopIcon />
                      </ToggleButton>
                    </span>
                  </LightTooltip>
                  <LightTooltip
                    id="wsPrevTip"
                    title={t.prevRegion.replace(
                      '{0}',
                      localizeHotKey(LEFT_KEY)
                    )}
                  >
                    <span>
                      <IconButton
                        id="wsPrev"
                        onClick={handlePrevRegion}
                        disabled={!hasRegion || waitingForAI}
                      >
                        <NextSegmentIcon sx={{ transform: 'rotate(180deg)' }} />
                      </IconButton>
                    </span>
                  </LightTooltip>
                  <LightTooltip
                    id="wsNextTip"
                    title={t.nextRegion.replace(
                      '{0}',
                      localizeHotKey(RIGHT_KEY)
                    )}
                  >
                    <span>
                      <IconButton
                        id="wsNext"
                        onClick={handleNextRegion}
                        disabled={!hasRegion || waitingForAI}
                      >
                        <NextSegmentIcon />
                      </IconButton>
                    </span>
                  </LightTooltip>
                </>
              )}
              {onVersions && (
                <AltButton
                  id="pdRecordVersions"
                  onClick={onVersions}
                  title={ts.versionHistory}
                  startIcon={
                    <VersionsIcon sx={{ width: '14px', height: '14px' }} />
                  }
                >
                  {ts.versionHistory}
                </AltButton>
              )}
              {allowSpeed && (
                <>
                  <VertDivider id="wsAudioDiv6" />
                  <WSAudioPlayerRate
                    playbackRate={playbackRate}
                    setPlaybackRate={setPlaybackRate}
                    recording={recording}
                  />
                </>
              )}
              {onSaveProgress && (
                <>
                  <VertDivider id="wsAudioDiv7" />
                  <LightTooltip
                    id="wsAudioTimestampTip"
                    title={t.timerTip.replace('{0}', localizeHotKey(TIMER_KEY))}
                  >
                    <span>
                      <IconButton
                        id="wsAudioTimestamp"
                        onClick={handleSendProgress}
                      >
                        <TimerIcon />
                      </IconButton>
                    </span>
                  </LightTooltip>
                </>
              )}
            </Stack>

            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              flexWrap="wrap"
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                rowGap: 1,
                minWidth: 0,
              }}
            >
              {metaData}
              {clearRecordingNode}
              {allowSegment && !hideSegmentControls && (
                <AltButton
                  id="wsSegmentReset"
                  sx={smallButtonProps}
                  onClick={handleClearRegions}
                  disabled={
                    resetDisabled ?? (recording || waitingForAI || !hasRegion)
                  }
                >
                  {t.resetSegments}
                </AltButton>
              )}
              {handleSave && showWaveformSaveButton && (
                <PriButton
                  id="rec-save"
                  onClick={handleSave}
                  disabled={isSaveDisabled}
                >
                  {ts.save}
                </PriButton>
              )}
            </Stack>
          </Stack>
        )}
      </Stack>

      {allowRecord && !dockRecordButton && !keepItSmall && !hideControls && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            py: 1,
          }}
        >
          {renderRecordButton({
            isSmall: Boolean(isMobileView),
            isMobileView: Boolean(isMobileView),
            isRecordingRights: false,
            showText: isMobileView ? undefined : (hasRecording ?? false),
          })}
        </Box>
      )}
      {confirmNode}
      {voiceDialogNode}
    </Stack>
  );
}

export default WSAudioPlayer;
