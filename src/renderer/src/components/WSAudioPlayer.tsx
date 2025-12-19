import {
  Paper,
  IconButton,
  Typography,
  Divider,
  DividerProps,
  Grid,
  ToggleButton,
  Box,
  SxProps,
  Badge,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  useState,
  useEffect,
  useRef,
  useContext,
  useMemo,
  useCallback,
  MouseEvent,
} from 'react';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import ForwardIcon from '@mui/icons-material/Refresh';
import ReplayIcon from '@mui/icons-material/Replay';
import PlayIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import LoopIcon from '@mui/icons-material/Loop';
import DeleteIcon from '@mui/icons-material/Delete';
import TimerIcon from '@mui/icons-material/AccessTime';
import NextSegmentIcon from '@mui/icons-material/ArrowRightAlt';
import UndoIcon from '@mui/icons-material/Undo';
import MicIcon from '@mui/icons-material/SettingsVoice';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import NormalizeIcon from '../control/NormalizeIcon';
import { ISharedStrings, IWsAudioPlayerStrings } from '../model';
import { FaHandScissors } from 'react-icons/fa';
import type { IconBaseProps } from 'react-icons/lib';

import { useWavRecorder } from '../crud/useWavRecorder';
import { IMarker, useWaveSurfer } from '../crud/useWaveSurfer';
import { Duration } from '../control/Duration';
import { GrowingSpacer } from '../control/GrowingSpacer';
import { LightTooltip } from '../control/LightTooltip';
import { RecordButton } from '../control/RecordButton';
import { useSnackBar } from '../hoc/SnackBar';
import { HotKeyContext } from '../context/HotKeyContext';
import WSAudioPlayerZoom, { maxZoom } from './WSAudioPlayerZoom';
import {
  dataPath,
  logError,
  PathType,
  Severity,
  useCheckOnline,
  LocalKey,
  localUserKey,
} from '../utils';
import { isMobileWidth } from '../utils/isMobileWidth';
import {
  IRegion,
  IRegionParams,
  parseRegionParams,
  parseRegions,
} from '../crud/useWavesurferRegions';
import WSAudioPlayerSegment from './WSAudioPlayerSegment';
import Confirm from './AlertDialog';
import { NamedRegions } from '../utils/namedSegments';
import { sharedSelector, wsAudioPlayerSelector } from '../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { AltButton } from '../control';
import { AudioAiFunc, useAudioAi } from '../utils/useAudioAi';
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
import VcButton from '../control/ConfButton';
import VoiceConversionLogo from '../control/VoiceConversionLogo';
import BigDialog from '../hoc/BigDialog';
import { useVoiceUrl } from '../crud/useVoiceUrl';
import SelectVoice from '../business/voice/SelectVoice';
import { isElectron } from '../../api-variable';
import WSAudioPlayerRate from './WSAudioPlayerRate';
import { IVoicePerm } from '../business/voice/PersonalizeVoicePermission';
import BigDialogBp from '../hoc/BigDialogBp';
import { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;

const HandScissors = FaHandScissors as unknown as React.FC<IconBaseProps>;

const VertDivider = (prop: DividerProps) => (
  <Divider orientation="vertical" flexItem sx={{ ml: '5px' }} {...prop} />
);

const toolbarProp = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyItems: 'flex-start',
  display: 'flex',
} as SxProps;

interface IProps {
  id?: string;
  visible?: boolean;
  blob?: Blob;
  initialposition?: number;
  setInitialPosition?: (position: number | undefined) => void;
  allowRecord?: boolean;
  allowZoom?: boolean;
  allowSegment?: NamedRegions | undefined;
  allowGoTo?: boolean;
  allowAutoSegment?: boolean;
  allowSpeed?: boolean;
  allowDeltaVoice?: boolean;
  alternatePlayer?: boolean;
  oneTryOnly?: boolean;
  height: number;
  width: number;
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
  setBlobReady?: (ready: boolean) => void;
  setChanged?: (changed: boolean) => void;
  onSaveProgress?: (progress: number) => void; //user initiated
  onDuration?: (duration: number) => void;
  onInteraction?: () => void;
  onRecording?: (r: boolean) => void;
  onCurrentSegment?: (currentSegment: IRegion | undefined) => void;
  onMarkerClick?: (time: number) => void;
  reload?: (blob: Blob) => void;
  noNewVoice?: boolean;
  allowNoNoise?: boolean;
  keepItSmall?: boolean;
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

function WSAudioPlayer(props: IProps) {
  const {
    blob,
    initialposition,
    setInitialPosition,
    allowRecord,
    allowZoom,
    allowSegment,
    allowGoTo,
    allowAutoSegment,
    allowSpeed,
    allowDeltaVoice,
    oneTryOnly,
    height,
    width,
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
    setBlobReady,
    setChanged,
    onSaveProgress,
    onDuration,
    onInteraction,
    onRecording,
    onCurrentSegment,
    onMarkerClick,
    reload,
    noNewVoice,
    allowNoNoise,
    keepItSmall,
  } = props;

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
  const [playing, setPlayingx] = useState(false);
  const loopingRef = useRef(false);
  const [looping, setLoopingx] = useState(false);
  const [hasRegion, setHasRegion] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const recordStartPosition = useRef(0);
  const recordOverwritePosition = useRef<number | undefined>(undefined);
  const recordingRef = useRef(false);
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
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
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
  const [isMobileView, setIsMobileView] = useState(isMobileWidth());
  const cancelAIRef = useRef(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(isMobileWidth());
    };

    window.addEventListener('resize', handleResize);
    // Check on mount in case the initial state was wrong
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  const { requestAudioAi } = useAudioAi();
  const checkOnline = useCheckOnline(t.reduceNoise);
  const { subscribe, unsubscribe, localizeHotKey } =
    useContext(HotKeyContext).state;
  const [pxPerSec, setPxPerSecx] = useState(maxZoom);
  const pxPerSecRef = useRef(maxZoom);
  const insertingRef = useRef(false);
  const currentSegmentRef = useRef<IRegion | undefined>(undefined);
  // Recording timer refs for local progress/duration while recording
  const recElapsedRef = useRef<number>(0);
  const recTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const recBaseProgressRef = useRef<number>(0);
  const recBaseDurationRef = useRef<number>(0);

  const setPxPerSec = (px: number) => {
    if (recordingRef.current) return;
    pxPerSecRef.current = px;
    setPxPerSecx(px);
  };

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
    [allowZoom]
  );

  const singleRegionOnly = useMemo(() => {
    return allowRecord || !allowSegment;
  }, [allowRecord, allowSegment]);

  const calculatedHeight = useMemo(() => height - 120, [height]);

  const voiceConvertTip = useMemo(
    () =>
      (t.convertVoice + '\u00A0\u00A0').replace(
        '{0}',
        voice ? `\u2039 ${voice} \u203A` : ''
      ),
    [t.convertVoice, voice]
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

  const noiseRemovalTooltipTitle = useMemo(
    () => <Badge badgeContent={ts.ai}>{t.reduceNoise}</Badge>,
    [ts.ai, t.reduceNoise]
  );

  const voiceChangeTooltipTitle = useMemo(
    () => <Badge badgeContent={ts.ai}>{voiceConvertTip}</Badge>,
    [ts.ai, voiceConvertTip]
  );

  const myOnCurrentSegment = useCallback(
    (currentSegment: IRegion | undefined) => {
      //
      //if (singleRegionOnly && currentSegment) {
      //console.log('singleRegionOnly');
      //play it??
      //wsPlayRegion(currentSegment);
      //onPlayStatus && onPlayStatus(true);
      //}
      currentSegmentRef.current = currentSegment;
      onCurrentSegment && onCurrentSegment(currentSegment);
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
    wsPrevRegion,
    wsNextRegion,
    wsRemoveSplitRegion,
    wsAddRegion,
    wsSetHeight,
    wsStartRecord,
    wsStopRecord,
    wsAddMarkers,
  } = useWaveSurfer(
    allowSegment,
    waveformRef,
    onWSReady,
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
    verses
  );

  //because we have to call hooks consistently, call this even if we aren't going to record
  const { startRecording, stopRecording } = useWavRecorder(
    allowRecord,
    onRecordStart,
    onRecordStop,
    onRecordError,
    onRecordDataAvailable,
    selectedMicrophoneId || undefined
  );

  const setProcessingRecording = (value: boolean) => {
    setProcessingRecordingx(value);
    processRecordRef.current = value;
  };
  //#region hotkey handlers
  const handleJumpForward = () => {
    return handleJumpFn(jump);
  };
  const handleJumpBackward = () => {
    return handleJumpFn(-1 * jump);
  };
  const handleJumpFn = (amount: number) => {
    if (!readyRef.current || recordingRef.current) return false;
    wsSkip(amount);
    return true;
  };
  const handleJumpEv = (amount: number) => () => handleJumpFn(amount);
  const handleGotoEv = (place: number) => () => wsGoto(place);

  const handleToggleLoop = () => {
    setLooping(wsLoopRegion(!looping));
  };
  const handlePrevRegion = () => {
    setPlaying(wsPrevRegion());
    return true;
  };
  const handleNextRegion = () => {
    setPlaying(wsNextRegion());
    return true;
  };

  const gotoEnd = () => {
    wsPause();
    setPlaying(false);
    wsGoto(durationRef.current);
  };
  const handleGoToEnd = () => {
    gotoEnd();
  };
  const handleSendProgress = () => {
    if (onSaveProgressRef.current) {
      onSaveProgressRef.current(wsPosition());
      return true;
    }
    return false;
  };
  const handleRecorder = () => {
    if (
      !allowRecord ||
      playingRef.current ||
      processRecordRef.current ||
      oneShotUsed
    )
      return false;
    if (!recordingRef.current) {
      setPxPerSec(100);
      setBlobReady && setBlobReady(false);
      wsPause(); //stop if playing
      recordStartPosition.current = wsPosition();
      wsStartRecord();
      startRecording(500).then((value) => {
        setRecording(value);
      });

      insertingRef.current = durationRef.current > 0;
      recordOverwritePosition.current = insertingRef.current
        ? recordStartPosition.current
        : undefined;
    } else {
      setProcessingRecording(true);
      stopRecording();
      wsStopRecord();
      setRecording(false);
      if (oneTryOnly) setOneShotUsed(true);
    }
    return true;
  };

  const setRecording = (value: boolean) => {
    recordingRef.current = value;
    setRecordingx(value);
    if (onRecording) onRecording(value);

    if (value) {
      // start timer
      recElapsedRef.current = 0;
      // capture base values at start
      recBaseProgressRef.current = progressRef.current;
      recBaseDurationRef.current = durationRef.current;
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      recTimerRef.current = setInterval(() => {
        if (!recordingRef.current) return;
        recElapsedRef.current++;
        setDuration(recBaseDurationRef.current + recElapsedRef.current);
        setProgress(recBaseProgressRef.current + recElapsedRef.current);
      }, 1000);
    } else {
      // stop timer
      if (recTimerRef.current) {
        clearInterval(recTimerRef.current);
        recTimerRef.current = undefined;
      }
    }
  };

  const handleClearRegions = () => {
    wsClearRegions();
    if (verses) {
      segmentsRef.current = verses;
      loadRegions();
      onSegmentChange && onSegmentChange(verses);
    }
  };
  //#endregion

  const playerKeys = [
    {
      key: PLAY_PAUSE_KEY,
      cb: () => {
        togglePlayStatus();
        return true;
      },
    },
    {
      key: HOME_KEY,
      cb: () => {
        if (!readyRef.current || recordingRef.current) return false;
        wsGoto(0);
        return true;
      },
    },
    {
      key: END_KEY,
      cb: () => {
        if (!readyRef.current || recordingRef.current) return false;
        gotoEnd();
        return true;
      },
    },
    { key: BACK_KEY, cb: handleJumpBackward },
    { key: AHEAD_KEY, cb: handleJumpForward },
    { key: TIMER_KEY, cb: handleSendProgress },
  ];
  const simplePlayerKeys = [
    {
      key: ALT_PLAY_PAUSE_KEY,
      cb: () => {
        togglePlayStatus();
        return true;
      },
    },
  ];

  const recordKeys = [{ key: RECORD_KEY, cb: handleRecorder }];

  const segmentKeys = [
    { key: LEFT_KEY, cb: handlePrevRegion },
    { key: RIGHT_KEY, cb: handleNextRegion },
  ];
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
      playerKeys.forEach((k) => unsubscribe(k.key));
      simplePlayerKeys.forEach((k) => unsubscribe(k.key));
      recordKeys.forEach((k) => unsubscribe(k.key));
      segmentKeys.forEach((k) => unsubscribe(k.key));
      if (recTimerRef.current) {
        clearInterval(recTimerRef.current);
        recTimerRef.current = undefined;
      }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (justPlayButton) simplePlayerKeys.forEach((k) => subscribe(k.key, k.cb));
    else playerKeys.forEach((k) => subscribe(k.key, k.cb));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justPlayButton]);

  useEffect(() => {
    if (allowRecord) recordKeys.forEach((k) => subscribe(k.key, k.cb));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowRecord]);
  useEffect(() => {
    if (allowSegment) segmentKeys.forEach((k) => subscribe(k.key, k.cb));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowSegment]);

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
    wsSetHeight(waitingForAI ? 0 : height - 120); //does this need to be smarter?
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, waitingForAI]);

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
      if (setBusy) setBusy(true); //turned off on ready
      wsLoad(blob, 0);
    } else {
      if (setBusy) setBusy(false);
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

  const togglePlayStatus = () => {
    handlePlayStatus(!playingRef.current);
  };
  const handlePlayStatus = (play: boolean) => {
    if (durationRef.current === 0 || recordingRef.current) return false;
    let nowplaying = play;

    if (play && regionOnly && currentSegmentRef.current) {
      wsPlayRegion(currentSegmentRef.current);
      nowplaying = true;
    } else nowplaying = wsTogglePlay();
    if (nowplaying && Math.abs(wsPosition() - durationRef.current) < 0.2)
      wsGoto(0);
    setPlaying(nowplaying);
    if (onPlayStatus && isPlaying !== undefined && nowplaying !== isPlaying) {
      onPlayStatus(nowplaying);
    }
    return undefined;
  };

  useEffect(() => {
    if (isPlaying !== undefined) handlePlayStatus(isPlaying);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, request, duration]);

  function onRecordStart() {
    setPxPerSec(100);
  }

  async function onRecordStop(blob: Blob) {
    const newPos = await wsInsertAudio(
      blob,
      undefined,
      recordStartPosition.current,
      recordOverwritePosition.current
    );
    initialPosRef.current = newPos;
    recordOverwritePosition.current = undefined;
    setProcessingRecording(false);
    handleChanged();
  }

  function onRecordError(e: any) {
    setProcessingRecording(false);

    if (autostartTimer.current && e.error === 'No mediaRecorder') {
      cleanupAutoStart();
      launchTimer();
    } else {
      showMessage(e.error || e.toString());
    }
  }

  async function onRecordDataAvailable(blob: Blob) {
    if (blob.size > 0) {
      const newPos = await wsInsertAudio(
        blob,
        undefined,
        recordStartPosition.current,
        recordOverwritePosition.current
      );
      if (insertingRef.current) recordOverwritePosition.current = newPos;
      initialPosRef.current = newPos;
    }
  }

  function onWSReady(duration: number, loadingAnother: boolean) {
    // Ignore WS-driven progress while recording; we drive from timer
    if (recordingRef.current) {
      const recElapsed = Math.round(duration - recBaseDurationRef.current);
      if (recElapsed > recElapsedRef.current) {
        recElapsedRef.current = recElapsed;
      }
      return;
    }
    setDuration(duration);
    if (loadingAnother) return;
    setReady(true);
    if (!recordingRef.current) setPxPerSec(wsFillPx());
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
    if (onSegmentChange && newRegion) onSegmentChange(wsGetRegions());
  }
  function onWSCanUndo(canUndo: boolean) {
    setCanUndo(canUndo);
  }
  function onWSPlayStatus(status: boolean) {
    setPlaying(status);
    if (onPlayStatus) onPlayStatus(status);
  }

  const setPlaying = (value: boolean) => {
    playingRef.current = value;
    setPlayingx(value);
  };
  const setLooping = (value: boolean) => {
    loopingRef.current = value;
    setLoopingx(value);
  };
  const setPlaybackRate = (value: number) => {
    const newVal = parseFloat(value.toFixed(2));
    playbackRef.current = newVal;
    setPlaybackRatex(newVal);
  };

  const setDuration = (value: number) => {
    durationRef.current = value;
    setDurationx(value);
    if (onDuration) onDuration(value);
  };

  const setProgress = (value: number) => {
    progressRef.current = value;
    setProgressx(value);
    if (onProgress) onProgress(value);
  };

  const setReady = (value: boolean) => {
    setReadyx(value);
    readyRef.current = value;
  };

  const handleChanged = async () => {
    setChanged && setChanged(durationRef.current !== 0);
    setBlobReady && setBlobReady(false);
    wsBlob().then((newblob) => {
      onBlobReady && onBlobReady(newblob);
      setBlobReady && setBlobReady(newblob !== undefined);
      if (setMimeType && newblob?.type) setMimeType(newblob?.type);
      setDuration(wsDuration());
    });
  };
  const handleActionConfirmed = () => {
    initialPosRef.current = undefined;
    if (confirmAction === t.deleteRecording) {
      setPlaying(false);
      wsClear();
      setDuration(0);
      setProgress(0);
      setChanged && setChanged(false);
      onBlobReady && onBlobReady(undefined);
      setBlobReady && setBlobReady(false);
      oneShotUsed && setOneShotUsed(false);
      setReady(false);
    } else {
      handleDeleteRegion();
    }
    setConfirmAction('');
  };
  const handleActionRefused = () => {
    setConfirmAction('');
  };
  const handleDelete = () => {
    setConfirmAction(t.deleteRecording);
  };
  const handleDeleteRegion = () => {
    setPlaying(false);
    wsRegionDelete();
    handleChanged();
  };
  const handleUndo = () => {
    wsUndo();
    handleChanged();
  };
  const doingProcess = (inprogress: boolean, msg?: string) => {
    setProcessMsg(msg ?? t.aiInProgress);
    setWaitingForAI(inprogress);
    setBusy && setBusy(inprogress);
    setBlobReady && setBlobReady(!inprogress);
  };
  const audioAiMsg = (
    func: AudioAiFunc,
    targetVoice?: string,
    error?: Error | AxiosError
  ) => {
    let msg =
      t.getString(`${func}Failed`) ??
      t.aiFailed
        .replace('{0}', targetVoice ? ` for ${targetVoice}` : '')
        .replace('{1}', func);
    if (error instanceof Error) {
      msg += ` ${error.message}`;
    }
    if (error instanceof AxiosError) {
      msg += ` ${error.response?.data}`;
    }
    return msg;
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
                      setChanged && setChanged(true);
                    });
                  }
                } else {
                  if ((file as Error).message !== 'canceled') {
                    const msg = audioAiMsg(func, targetVoice, file);
                    showMessage(msg);
                    logError(Severity.error, errorReporter, msg);
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
        const msg = audioAiMsg(func, targetVoice, error);
        logError(Severity.error, errorReporter, msg);
        showMessage(msg);
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
        setChanged && setChanged(true);
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

  const noiseRemovalControl = useCallback(() => {
    if (!allowNoNoise || !features?.noNoise || offline) return null;

    const handleClick = (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      handleNoiseRemoval();
      isMobileView && handleMoreMenuClose?.();
    };

    return (
      <LightTooltip id={`noiseRemovalTip`} title={noiseRemovalTooltipTitle}>
        <IconButton
          id={`noiseRemoval`}
          onClick={handleClick}
          disabled={isControlDisabled}
          size={isMobileView ? 'small' : 'medium'}
        >
          <NoChickenIcon
            sx={{ width: '20pt', height: '20pt' }}
            disabled={isControlDisabled}
          />
        </IconButton>
      </LightTooltip>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isMobileView,
    allowNoNoise,
    features?.noNoise,
    offline,
    isControlDisabled,
    noiseRemovalTooltipTitle,
  ]);

  const voiceChangeControl = useCallback(
    () => {
      if (!features?.deltaVoice || allowDeltaVoice === false || offline)
        return null;

      const handleClick = () => {
        handleVoiceChange();
        handleMoreMenuClose();
      };

      return (
        <LightTooltip id={`voiceChangeTip`} title={voiceChangeTooltipTitle}>
          <span
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <VcButton
              id={`voiceChange`}
              onClick={handleClick}
              onSettings={handleVoiceSettings}
              disabled={isControlDisabled}
              allowSettings={duration === 0}
            >
              <VoiceConversionLogo
                sx={{
                  width: '18pt',
                  height: '18pt',
                }}
                disabled={isControlDisabled}
              />
            </VcButton>
          </span>
        </LightTooltip>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      features?.deltaVoice,
      allowDeltaVoice,
      offline,
      isControlDisabled,
      voiceChangeTooltipTitle,
      duration,
    ]
  );

  const normalizeControl = useCallback(
    () => {
      if (!features?.normalize || !isElectron) return null;

      const handleClick = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        handleNormal();
        handleMoreMenuClose();
      };

      return (
        <LightTooltip id={`normalizeTip`} title={t.normalize}>
          <IconButton
            id={`normalize`}
            onClick={handleClick}
            disabled={isControlDisabled}
            size={isMobileView ? 'small' : 'medium'}
          >
            <NormalizeIcon
              width={'20pt'}
              height={'20pt'}
              disabled={isControlDisabled}
            />
          </IconButton>
        </LightTooltip>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [features?.normalize, isControlDisabled]
  );

  const microphoneControl = useCallback(() => {
    const handleClick = (e: React.MouseEvent<HTMLElement>) => {
      e.stopPropagation();
      handleMicMenuOpen(e);
      handleMoreMenuClose();
    };

    return (
      <LightTooltip id={`wsAudioMicTip`} title={t.microphone}>
        <IconButton
          id={`wsAudioMic`}
          onClick={handleClick}
          size={isMobileView ? 'small' : 'medium'}
        >
          <MicIcon
            sx={{
              color:
                audioInputDevices.length === 0 ? 'text.disabled' : 'inherit',
            }}
          />
        </IconButton>
      </LightTooltip>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioInputDevices.length, isMobileView]);

  const onSplit = () => {};

  return (
    <Box>
      <Paper sx={{ p: 1, mb: 1, width: width, maxWidth: width }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            whiteSpace: 'nowrap',
            width: '100%',
          }}
          style={style}
        >
          <>
            <Grid container sx={toolbarProp}>
              <Grid sx={{ ml: 1 }}>
                <LightTooltip id="wsAudioPlayTip" title={playTooltipTitle}>
                  <span>
                    <IconButton
                      id="wsAudioPlay"
                      onClick={togglePlayStatus}
                      disabled={duration === 0 || recording || waitingForAI}
                    >
                      <>{playing ? <PauseIcon /> : <PlayIcon />}</>
                    </IconButton>
                  </span>
                </LightTooltip>
              </Grid>
              <VertDivider id="wsAudioDiv1" />

              <Grid>
                <Typography sx={{ m: '5px' }}>
                  <Duration id="wsAudioPosition" seconds={progress} /> {' / '}
                  <Duration id="wsAudioDuration" seconds={duration} />
                </Typography>
              </Grid>
              <VertDivider id="wsAudioDiv2" />
              {allowZoom && !isMobileView && (
                <>
                  <Grid>
                    <WSAudioPlayerZoom
                      // startBig={allowRecord || false}
                      ready={ready && !recording && !waitingForAI}
                      fillPx={recording ? 100 : wsFillPx()}
                      curPx={pxPerSec}
                      onZoom={wsZoom}
                    ></WSAudioPlayerZoom>
                  </Grid>
                  <VertDivider id="wsAudioDiv3" />
                </>
              )}
              {allowRecord && !isMobileView && (
                <>
                  {noiseRemovalControl()}
                  {voiceChangeControl()}
                  {normalizeControl()}
                </>
              )}
              {allowRecord && (
                <>
                  {hasRegion !== 0 && !oneShotUsed && (
                    <LightTooltip
                      id="wsAudioDeleteRegionTip"
                      title={t.deleteRegion}
                    >
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
                  )}
                  {canUndo && !oneShotUsed && (
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
                  )}
                  {hasRegion === 0 && (
                    <LightTooltip
                      id="wsAudioDeleteTip"
                      title={t.deleteRecording}
                    >
                      <span>
                        <IconButton
                          id="wsAudioDelete"
                          onClick={handleDelete}
                          disabled={recording || duration === 0 || waitingForAI}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </span>
                    </LightTooltip>
                  )}
                  <GrowingSpacer />
                  {!isMobileView && !keepItSmall && (
                    <Grid>
                      {microphoneControl()}
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
                              selected={
                                selectedMicrophoneId === device.deviceId
                              }
                              onClick={() => handleMicSelect(device.deviceId)}
                            >
                              {device.label || `Input ${index + 1}`}
                            </MenuItem>
                          ))
                        )}
                      </Menu>
                    </Grid>
                  )}
                  {isMobileView && (
                    <Grid>
                      <LightTooltip id="wsAudioMoreTip" title="More options">
                        <span>
                          <IconButton
                            id="wsAudioMore"
                            onClick={handleMoreMenuOpen}
                          >
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
                        {allowZoom && (
                          <MenuItem
                            onClick={handleMoreMenuClose}
                            sx={{ pointerEvents: 'none' }}
                          >
                            <WSAudioPlayerZoom
                              ready={ready && !recording && !waitingForAI}
                              fillPx={recording ? 100 : wsFillPx()}
                              curPx={pxPerSec}
                              onZoom={wsZoom}
                            />
                          </MenuItem>
                        )}
                        {allowRecord && (
                          <>
                            {noiseRemovalControl() && (
                              <MenuItem onClick={handleMoreMenuClose}>
                                {noiseRemovalControl()}
                              </MenuItem>
                            )}
                            {voiceChangeControl() && (
                              <MenuItem onClick={handleMoreMenuClose}>
                                {voiceChangeControl()}
                              </MenuItem>
                            )}
                            {normalizeControl() && (
                              <MenuItem onClick={handleMoreMenuClose}>
                                {normalizeControl()}
                              </MenuItem>
                            )}
                            {!keepItSmall && (
                              <MenuItem onClick={handleMoreMenuClose}>
                                {microphoneControl()}
                              </MenuItem>
                            )}
                          </>
                        )}
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
                              selected={
                                selectedMicrophoneId === device.deviceId
                              }
                              onClick={() => handleMicSelect(device.deviceId)}
                            >
                              {device.label || `Input ${index + 1}`}
                            </MenuItem>
                          ))
                        )}
                      </Menu>
                    </Grid>
                  )}
                </>
              )}
              {allowSegment && (
                <WSAudioPlayerSegment
                  ready={ready}
                  onSplit={onSplit}
                  onParamChange={onSegmentParamChange}
                  loop={loopingRef.current || false}
                  playing={playing}
                  currentNumRegions={hasRegion}
                  params={defaultRegionParams}
                  canSetDefault={canSetDefaultParams}
                  wsAutoSegment={allowAutoSegment ? wsAutoSegment : undefined}
                  wsRemoveSplitRegion={wsRemoveSplitRegion}
                  wsAddRegion={wsAddRegion}
                  wsClearRegions={handleClearRegions}
                  setBusy={setBusy}
                />
              )}
              {waitingForAI && (
                <Grid container sx={{ pr: 6 }}>
                  <Grid size={12}>
                    <Typography sx={{ whiteSpace: 'normal' }}>
                      {processMsg}
                    </Typography>
                  </Grid>
                  <Grid
                    size={12}
                    sx={{ display: 'flex', justifyContent: 'center' }}
                  >
                    <AltButton
                      id="ai-cancel"
                      onClick={() => {
                        cancelAIRef.current = true;
                        doingProcess(false);
                      }}
                    >
                      {ts.cancel}
                    </AltButton>
                  </Grid>
                </Grid>
              )}
            </Grid>
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
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <div id="wsAudioWaveform" ref={waveformRef} />
                </Box>

                <RecordButton
                  recording={recording}
                  oneTryOnly={oneTryOnly}
                  onClick={handleRecorder}
                  disabled={playing || processingRecording || waitingForAI}
                  tooltipTitle={recordTooltipTitle}
                  isSmall={true}
                />
              </Box>
            ) : (
              <>
                <Box
                  sx={{ width: width - 40, maxWidth: width - 40, minWidth: 0 }}
                >
                  <div id="wsAudioWaveform" ref={waveformRef} />
                </Box>
                {justPlayButton || (
                  <Grid
                    container
                    sx={{
                      ...toolbarProp,
                      width: width - 40,
                      maxWidth: width - 40,
                      minWidth: 0,
                    }}
                  >
                    <Grid>
                      {allowAutoSegment && (
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
                      )}
                      {allowSegment && (
                        <>
                          <LightTooltip
                            id="wsPrevTip"
                            title={t.prevRegion.replace(
                              '{0}',
                              localizeHotKey(LEFT_KEY)
                            )}
                          >
                            <span>
                              <IconButton
                                disabled={!hasRegion || waitingForAI}
                                id="wsNext"
                                onClick={handlePrevRegion}
                              >
                                <NextSegmentIcon
                                  sx={{ transform: 'rotate(180deg)' }}
                                />
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
                                disabled={!hasRegion || waitingForAI}
                                id="wsNext"
                                onClick={handleNextRegion}
                              >
                                <NextSegmentIcon />
                              </IconButton>
                            </span>
                          </LightTooltip>
                        </>
                      )}
                    </Grid>
                    {allowGoTo && (
                      <>
                        <VertDivider id="wsAudioDiv5" />
                        <Grid>
                          <>
                            <LightTooltip
                              id="wsAudioHomeTip"
                              title={t.beginningTip.replace(
                                '{0}',
                                localizeHotKey(HOME_KEY)
                              )}
                            >
                              <span>
                                <IconButton
                                  id="wsAudioHome"
                                  onClick={handleGotoEv(0)}
                                  disabled={!ready || recording}
                                >
                                  <SkipPreviousIcon />
                                </IconButton>
                              </span>
                            </LightTooltip>
                            <LightTooltip
                              id="wsAudioBackTip"
                              title={t.backTip
                                .replace('{jump}', jump.toString())
                                .replace('{1}', t.seconds)
                                .replace('{0}', localizeHotKey(BACK_KEY))}
                            >
                              <span>
                                <IconButton
                                  id="wsAudioBack"
                                  onClick={handleJumpEv(-1 * jump)}
                                  disabled={!ready || recording}
                                >
                                  <ReplayIcon />
                                </IconButton>
                              </span>
                            </LightTooltip>

                            <LightTooltip
                              id="wsAudioPlayTip"
                              title={(playing
                                ? oneTryOnly
                                  ? t.stopTip
                                  : t.pauseTip
                                : t.playTip
                              ).replace('{0}', localizeHotKey(PLAY_PAUSE_KEY))}
                            >
                              <span>
                                <IconButton
                                  id="wsAudioPlay"
                                  onClick={togglePlayStatus}
                                  disabled={duration === 0 || recording}
                                >
                                  <>{playing ? <PauseIcon /> : <PlayIcon />}</>
                                </IconButton>
                              </span>
                            </LightTooltip>
                            <LightTooltip
                              id="wsAudioForwardTip"
                              title={t.aheadTip
                                .replace('{jump}', jump.toString())
                                .replace('{1}', t.seconds)
                                .replace('{0}', localizeHotKey(AHEAD_KEY))}
                            >
                              <span>
                                <IconButton
                                  id="wsAudioForward"
                                  onClick={handleJumpEv(jump)}
                                  disabled={!ready || recording}
                                >
                                  <ForwardIcon />{' '}
                                </IconButton>
                              </span>
                            </LightTooltip>

                            <LightTooltip
                              id="wsAudioEndTip"
                              title={t.endTip.replace(
                                '{0}',
                                localizeHotKey(END_KEY)
                              )}
                            >
                              <span>
                                <IconButton
                                  id="wsAudioEnd"
                                  onClick={handleGoToEnd}
                                  disabled={!ready || recording}
                                >
                                  <SkipNextIcon />{' '}
                                </IconButton>
                              </span>
                            </LightTooltip>
                          </>
                        </Grid>
                      </>
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
                        <Grid>
                          <LightTooltip
                            id="wsAudioTimestampTip"
                            title={t.timerTip.replace(
                              '{0}',
                              localizeHotKey(TIMER_KEY)
                            )}
                          >
                            <span>
                              <IconButton
                                id="wsAudioTimestamp"
                                onClick={handleSendProgress}
                              >
                                <>
                                  <TimerIcon />
                                </>
                              </IconButton>
                            </span>
                          </LightTooltip>
                        </Grid>
                        {metaData}
                      </>
                    )}
                    <GrowingSpacer />
                    {!onSaveProgress && <>{metaData}</>}
                  </Grid>
                )}
                {allowRecord && !oneShotUsed && !keepItSmall && (
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      width: '100%',
                      py: 1,
                    }}
                  >
                    <RecordButton
                      recording={recording}
                      oneTryOnly={oneTryOnly}
                      onClick={handleRecorder}
                      disabled={playing || processingRecording || waitingForAI}
                      tooltipTitle={recordTooltipTitle}
                      isSmall={false}
                    />
                  </Box>
                )}
              </>
            )}
            {confirmAction === '' || (
              <Confirm
                jsx={
                  typeof confirmAction !== 'string' ? confirmAction : undefined
                }
                text={typeof confirmAction === 'string' ? confirmAction : ''}
                yesResponse={handleActionConfirmed}
                noResponse={handleActionRefused}
              />
            )}
            <BigDialog
              title={t.selectVoice}
              description={<Typography>{t.selectVoicePrompt}</Typography>}
              isOpen={voiceVisible}
              onOpen={handleCloseVoice}
              bp={BigDialogBp.sm}
            >
              <SelectVoice
                noNewVoice={noNewVoice && duration > 0}
                onlySettings={duration === 0}
                onOpen={handleCloseVoice}
                begin={applyVoiceChange}
                refresh={handleRefresh}
              />
            </BigDialog>
          </>
        </Box>
      </Paper>
    </Box>
  );
}

export default WSAudioPlayer;
