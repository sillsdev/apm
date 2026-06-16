import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Box, Paper, SxProps, Typography } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { useGlobal } from '../../context/useGlobal';
import usePassageDetailContext from '../../context/usePassageDetailContext';
import PassageDetailPlayer from './PassageDetailPlayer';
import {
  ArtifactTypeSlug,
  remoteIdGuid,
  useArtifactType,
  useStepTool,
} from '../../crud';
import { getSortedRegions, NamedRegions } from '../../utils/namedSegments';
import { IRegion } from '../../crud/useWavesurferRegions';
import { WSAudioPlayerControls } from '../WSAudioPlayer';
import { useOrbitData } from '../../hoc/useOrbitData';
import { ICarefulSpeechStrings, ISharedStrings, MediaFileD } from '../../model';
import { passageDefaultFilename } from '../../utils/passageDefaultFilename';
import { related } from '../../crud/related';
import { RecordKeyMap } from '@orbit/records';
import Confirm from '../AlertDialog';
import CarefulSpeechControls, {
  CarefulSpeechPhase,
} from './carefulSpeech/CarefulSpeechControls';
import { useCarefulSpeechSegments } from './carefulSpeech/useCarefulSpeechSegments';
import {
  CLAUSE_BOUNDARY_THRESHOLD_SEC,
  hasClauseRegions,
  regionsJsonFromList,
} from './carefulSpeech/carefulSpeechBoundary';
import {
  firstIncompleteClauseIndex,
  getCompletedClauseIndices,
  getRecordingForClause,
} from './carefulSpeech/carefulSpeechCompletion';
import {
  createCarefulSpeechApplyRegionColor,
  type ICarefulSpeechColorStatus,
} from '../../utils/carefulSpeechSegmentColors';
import { useStepPermissions } from '../../utils/useStepPermission';
import { carefulSpeechSelector, sharedSelector } from '../../selector';
import { UnsavedContext } from '../../context/UnsavedContext';
import {
  applyFewerClauses,
  applyMoreClauses,
  boldDefaultSegParams,
} from './carefulSpeech/boldCarefulSpeechSegParams';
import {
  canCombineWithNext,
  mergeClauseWithNext,
} from './carefulSpeech/carefulSpeechClauseMerge';
import {
  canSplitClause,
  splitClauseAt,
} from './carefulSpeech/carefulSpeechClauseSplit';
import { LocalKey } from '../../utils/localUserKey';

const paperProps = { p: 2, m: 'auto', width: 'calc(100% - 32px)' } as SxProps;
const toolId = 'CarefulSpeechTool';

interface IProps {
  width: number;
}

function findClauseIndex(clauseRegions: IRegion[], region: IRegion): number {
  return clauseRegions.findIndex(
    (r) =>
      Math.abs(r.start - region.start) < 0.05 &&
      Math.abs(r.end - region.end) < 0.05
  );
}

export function PassageDetailCarefulSpeech({ width }: IProps) {
  const t: ICarefulSpeechStrings = useSelector(
    carefulSpeechSelector,
    shallowEqual
  );
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const [memory] = useGlobal('memory');
  const [plan] = useGlobal('plan');
  const [offline] = useGlobal('offline');
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const { getTypeId } = useArtifactType();
  const {
    passage,
    playerMediafile,
    mediafileId,
    rowData,
    currentstep,
    section,
    setCurrentSegment,
    setPlaying,
    setRecording,
    forceRefresh,
    currentSegmentIndex,
    getCurrentSegment,
    isBoldWorkflow,
    carefulSpeechSegParams,
    setCarefulSpeechSegParams,
    setStepComplete,
    gotoNextStep,
    stepComplete,
  } = usePassageDetailContext();
  const { settings } = useStepTool(currentstep);
  const { canDoSectionStep } = useStepPermissions();
  const { startSave, waitForSave } = useContext(UnsavedContext).state;

  const playerControlsRef = useRef<WSAudioPlayerControls | null>(null);
  const carefulSpeechStatusRef = useRef<ICarefulSpeechColorStatus | null>(null);
  const applyRegionColor = useMemo(
    () => createCarefulSpeechApplyRegionColor(carefulSpeechStatusRef),
    []
  );
  const bootstrapPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bootstrapCompletedRef = useRef(false);
  const lastResetMediafileRef = useRef<string | undefined>(undefined);
  const initialPositionDoneRef = useRef(false);
  const suppressClauseAutoPlayRef = useRef(0);
  const playClauseInFlightRef = useRef(false);
  const skipBeforePlayRef = useRef(false);
  const entryPauseDoneRef = useRef(false);
  const [highlightPlayButton, setHighlightPlayButton] = useState(false);
  const [allowSourcePlayer, setAllowSourcePlayer] = useState(false);
  const [entryPositioned, setEntryPositioned] = useState(false);
  const [playerPlaying, setPlayerPlaying] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<CarefulSpeechPhase>('bootstrapping');
  const [speaker, setSpeaker] = useState(
    localStorage.getItem(LocalKey.carefulSpeaker) ?? ''
  );
  const [showRecorder, setShowRecorder] = useState(false);
  const [resetMedia, setResetMedia] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [canSave, setCanSave] = useState(false);
  const [confirmAllComplete, setConfirmAllComplete] = useState(false);
  const [recordingPassStarted, setRecordingPassStarted] = useState(false);
  // Mirror of recordingPassStarted set synchronously at the call sites below.
  // region-out can fire before React commits the state-update render, leaving
  // the handler's closure (and handleRegionPlayEndRef) on the stale false
  // value; reading this ref makes the recording/listen branch decision reflect
  // intent immediately rather than waiting for a render (TT-7360).
  const recordingPassStartedRef = useRef(false);
  // Set true when we park after an auto-play. The playback overshoot into the
  // next clause (or a recorder-mount-induced region-in) advances by exactly one
  // clause; this lets the recording effect swallow that single +1 advance while
  // still treating any non-adjacent jump as a genuine user tap (TT-7360).
  const pendingOvershootSwallowRef = useRef(false);
  // Guards the all-complete dialog so it shows once per completion. Re-armed
  // when a recording is cleared (allClausesComplete drops back to false).
  const allCompleteNotifiedRef = useRef(false);
  const [heardIndices, setHeardIndices] = useState<number[]>([]);
  const [currentClausePlayed, setCurrentClausePlayed] = useState(false);
  const [combineUndo, setCombineUndo] = useState<string | null>(null);

  const mediafile = useMemo(
    () => mediafiles.find((m) => m.id === mediafileId),
    [mediafiles, mediafileId]
  );

  const artifactTypeId = useMemo((): string => {
    const id = (settings as { artifactTypeId?: string })?.artifactTypeId;
    if (id) {
      return (
        remoteIdGuid('artifacttype', id, memory?.keyMap as RecordKeyMap) ?? id
      );
    }
    return getTypeId(ArtifactTypeSlug.CarefulSpeech) ?? '';
  }, [settings, memory?.keyMap, getTypeId]);

  const {
    clauseSegString,
    setClauseSegString,
    bootstrapped,
    ensureSegments,
    resetForMediafile,
    resegmentWithParams,
    resetToDefaultSegments,
    persistClauseSegments,
  } = useCarefulSpeechSegments(mediafile, playerControlsRef);

  const clauseRegions = useMemo(
    () => getSortedRegions(clauseSegString),
    [clauseSegString]
  );

  const heardSet = useMemo(() => new Set(heardIndices), [heardIndices]);
  const allClausesHeard = useMemo(
    () => clauseRegions.length > 0 && heardSet.size >= clauseRegions.length,
    [heardSet.size, clauseRegions]
  );

  const suggestedSegmentsForPlayer = useMemo(() => {
    if (!hasClauseRegions(clauseSegString)) return undefined;
    return clauseSegString;
  }, [clauseSegString]);

  const currentVersion = mediafile?.attributes?.versionNumber ?? 0;

  const completedIndices = useMemo(
    () =>
      getCompletedClauseIndices(
        clauseRegions,
        rowData,
        artifactTypeId,
        currentVersion
      ),
    [clauseRegions, rowData, artifactTypeId, currentVersion]
  );

  const allClausesComplete = useMemo(
    () =>
      clauseRegions.length > 0 && completedIndices.size >= clauseRegions.length,
    [completedIndices, clauseRegions]
  );

  // Raise the all-complete dialog once when every clause has a recording —
  // both on entry to an already-complete step and the moment the user records
  // the last clause. Re-arms if a recording is later cleared.
  useEffect(() => {
    if (!recordingPassStarted) return;
    if (allClausesComplete) {
      if (!allCompleteNotifiedRef.current) {
        allCompleteNotifiedRef.current = true;
        setConfirmAllComplete(true);
      }
    } else {
      allCompleteNotifiedRef.current = false;
    }
  }, [allClausesComplete, recordingPassStarted]);

  const currentRegion = clauseRegions[currentIndex];

  const currentClauseSplitPoint = useMemo(() => {
    if (!recordingPassStarted || !currentRegion) return undefined;
    const ctrl = playerControlsRef.current;
    if (!ctrl?.isReady?.() || !ctrl.findClauseSplitPoint) return undefined;
    return ctrl.findClauseSplitPoint(currentRegion, carefulSpeechSegParams);
  }, [recordingPassStarted, currentRegion, carefulSpeechSegParams]);

  const recordingRow = useMemo(
    () =>
      currentRegion
        ? getRecordingForClause(
            rowData,
            artifactTypeId,
            currentVersion,
            currentRegion
          )
        : undefined,
    [rowData, artifactTypeId, currentVersion, currentRegion]
  );

  const editStep = useMemo(
    () => canDoSectionStep(currentstep, section),
    [canDoSectionStep, currentstep, section]
  );

  const defaultFilename = useMemo(() => {
    const postfix = `carefulspeech${currentIndex + 1}_v${currentVersion}`;
    return passageDefaultFilename(
      passage,
      plan,
      memory,
      artifactTypeId,
      offline,
      postfix
    );
  }, [
    passage,
    plan,
    memory,
    artifactTypeId,
    offline,
    currentIndex,
    currentVersion,
  ]);

  carefulSpeechStatusRef.current = {
    currentIndex,
    isCompleted: (i) =>
      recordingPassStarted ? completedIndices.has(i) : heardSet.has(i),
  };

  const applyColors = useCallback(() => {
    playerControlsRef.current?.applyRegionColors?.();
  }, []);

  const bumpSuppressClauseAutoPlay = useCallback((count = 1) => {
    suppressClauseAutoPlayRef.current += count;
  }, []);

  const consumeSuppressClauseAutoPlay = useCallback(() => {
    if (suppressClauseAutoPlayRef.current > 0) {
      suppressClauseAutoPlayRef.current -= 1;
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    setAllowSourcePlayer(false);
    setPlaying(false);
    const frame = requestAnimationFrame(() => {
      setAllowSourcePlayer(true);
    });
    return () => cancelAnimationFrame(frame);
    // setPlaying is not stable; only reset when mediafile changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediafileId]);

  useEffect(() => {
    applyColors();
  }, [
    currentIndex,
    completedIndices,
    heardSet,
    recordingPassStarted,
    clauseSegString,
    applyColors,
  ]);

  const handleSpeakerChange = useCallback((value: string) => {
    setSpeaker(value);
    localStorage.setItem(LocalKey.carefulSpeaker, value);
  }, []);

  useEffect(() => {
    if (!currentRegion) return;
    const seg = getCurrentSegment();
    if (
      seg &&
      Math.abs(seg.start - currentRegion.start) < 0.05 &&
      Math.abs(seg.end - currentRegion.end) < 0.05
    ) {
      return;
    }
    setCurrentSegment(currentRegion, currentIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRegion, currentIndex]);

  useEffect(() => {
    if (canSave) startSave(toolId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSave]);

  const snapToClauseStart = useCallback(
    async (index: number) => {
      const ctrl = playerControlsRef.current;
      const region = clauseRegions[index];
      if (!ctrl?.isReady() || !region) return;
      const seek =
        region.start > 0 ? region.start + CLAUSE_BOUNDARY_THRESHOLD_SEC : 0;
      await ctrl.gotoTime(seek, region);
      applyColors();
    },
    [clauseRegions, applyColors]
  );

  const playCurrentClause = useCallback(
    async (index: number = currentIndex, regionOverride?: IRegion) => {
      const ctrl = playerControlsRef.current;
      const region = regionOverride ?? clauseRegions[index];
      if (!ctrl?.isReady() || !region || playClauseInFlightRef.current) return;
      playClauseInFlightRef.current = true;
      try {
        setPhase('playing');
        const seek =
          region.start > 0 ? region.start + CLAUSE_BOUNDARY_THRESHOLD_SEC : 0;
        await ctrl.gotoTime(seek, region);
        if (!ctrl.isPlaying()) {
          skipBeforePlayRef.current = true;
          try {
            ctrl.setPlay(true);
          } finally {
            skipBeforePlayRef.current = false;
          }
        }
      } finally {
        playClauseInFlightRef.current = false;
      }
    },
    [clauseRegions, currentIndex]
  );

  const resetListenProgress = useCallback(() => {
    setHeardIndices([]);
    setCurrentIndex(0);
    setCombineUndo(null);
  }, []);

  const applyResegmentResult = useCallback(
    async (ok: string | false) => {
      if (!ok) return;
      resetListenProgress();
      setPhase('readyToRecord');
      const regions = getSortedRegions(ok);
      const first = regions[0];
      if (first) {
        bumpSuppressClauseAutoPlay(4);
        setCurrentIndex(0);
        setCurrentSegment(first, 0);
        await snapToClauseStart(0);
      }
      setHighlightPlayButton(true);
      applyColors();
    },
    [
      resetListenProgress,
      applyColors,
      snapToClauseStart,
      setCurrentSegment,
      bumpSuppressClauseAutoPlay,
    ]
  );

  const handlePlayStatusNotify = useCallback(
    (playingNow: boolean) => {
      if (playingNow) setHighlightPlayButton(false);
      if (currentIndex === clauseRegions.length - 1) {
        markClauseHeard(currentIndex);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clauseRegions.length, currentIndex]
  );

  const handleBeforeSourcePlay = useCallback(async () => {
    if (skipBeforePlayRef.current) return;
    if (!recordingPassStarted || !showRecorder || currentClausePlayed) return;
    setHighlightPlayButton(false);
    await snapToClauseStart(currentIndex);
  }, [
    recordingPassStarted,
    showRecorder,
    currentClausePlayed,
    snapToClauseStart,
    currentIndex,
  ]);

  const setPlayerPlayingBoth = useCallback(
    (playingNow: boolean) => {
      setPlayerPlaying(playingNow);
      setPlaying(playingNow);
    },
    [setPlaying]
  );

  useLayoutEffect(() => {
    setPlayerPlaying(false);
    setPlaying(false);
    // setPlaying is not stable; only reset when mediafile changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediafileId]);

  useEffect(() => {
    // StrictMode double-invokes effects on mount (setup → cleanup → setup) and
    // refs persist across that re-run. Without this guard the second invocation
    // re-resets recordingPassStarted to false and clears initialPositionDoneRef
    // mid-entry, clobbering an already-started recording pass and dropping the
    // user back into the listen pass (TT-7360). Only reset once per actual
    // mediafile change.
    if (lastResetMediafileRef.current === mediafileId) return;
    lastResetMediafileRef.current = mediafileId;
    resetForMediafile(mediafileId);
    bootstrapCompletedRef.current = false;
    setPhase('bootstrapping');
    setCurrentIndex(0);
    setRecordingPassStarted(false);
    recordingPassStartedRef.current = false;
    pendingOvershootSwallowRef.current = false;
    allCompleteNotifiedRef.current = false;
    setHeardIndices([]);
    setCurrentClausePlayed(false);
    setCombineUndo(null);
    setShowRecorder(false);
    entryPauseDoneRef.current = false;
    initialPositionDoneRef.current = false;
    setEntryPositioned(false);
    suppressClauseAutoPlayRef.current = 0;
    setHighlightPlayButton(false);
    // Gate only on the stable mediafileId string. resetForMediafile's identity
    // changes whenever the mediafile record is updated (e.g. persisting combined
    // clause segments), which would otherwise re-fire this reset and drop the
    // user from the recording pass back into the listen pass (TT-7360).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediafileId]);

  useEffect(() => {
    if (!mediafileId || !isBoldWorkflow) return;

    const stopPoll = () => {
      if (bootstrapPollRef.current) {
        clearInterval(bootstrapPollRef.current);
        bootstrapPollRef.current = null;
      }
    };

    const tryBootstrap = async () => {
      if (bootstrapCompletedRef.current) {
        stopPoll();
        return;
      }
      const ok = await ensureSegments();
      if (!ok) return;
      bootstrapCompletedRef.current = true;
      stopPoll();
      setPhase('readyToRecord');
      applyColors();
    };

    void tryBootstrap();
    bootstrapPollRef.current = setInterval(() => {
      void tryBootstrap();
    }, 250);

    return stopPoll;
  }, [mediafileId, ensureSegments, applyColors, isBoldWorkflow]);

  useEffect(() => {
    if (!bootstrapped || !isBoldWorkflow || !allowSourcePlayer) {
      return;
    }

    const runInitialPosition = (): boolean => {
      if (initialPositionDoneRef.current) return true;
      if (clauseRegions.length === 0) return false;
      const ctrl = playerControlsRef.current;
      if (!ctrl?.isReady()) return false;

      initialPositionDoneRef.current = true;
      const completed = getCompletedClauseIndices(
        clauseRegions,
        rowData,
        artifactTypeId,
        currentVersion
      );
      const firstIdx = firstIncompleteClauseIndex(clauseRegions, completed);
      if (firstIdx >= clauseRegions.length) {
        // All clauses are recorded. Enter recording (review) mode positioned on
        // the first clause so the user can replay both the original and the
        // careful-speech take per clause. The all-complete dialog is raised by
        // the effect that watches allClausesComplete (TT-7360).
        setRecordingPassStarted(true);
        recordingPassStartedRef.current = true;
        setShowRecorder(true);
        setCurrentIndex(0);
        setCurrentSegment(clauseRegions[0], 0);
        setCurrentClausePlayed(true);
        setPhase('recorded');
        void snapToClauseStart(0);
        applyColors();
        setEntryPositioned(true);
        return true;
      }

      const hasRecordings = completed.size > 0;
      if (hasRecordings) {
        setRecordingPassStarted(true);
        recordingPassStartedRef.current = true;
        setShowRecorder(true);
      }

      setCurrentIndex(firstIdx);
      setCurrentSegment(clauseRegions[firstIdx], firstIdx);
      setPhase('readyToRecord');

      if (hasRecordings) {
        // Recording pass: auto-play the first unrecorded clause once.
        // region-out will stop and snap the playhead back to the clause start.
        setCurrentClausePlayed(false);
        setHighlightPlayButton(false);
        void playCurrentClause(firstIdx);
      } else {
        // Listen pass: position and wait for the user to tap play.
        bumpSuppressClauseAutoPlay(4);
        setHighlightPlayButton(true);
        void snapToClauseStart(firstIdx);
      }
      applyColors();
      setEntryPositioned(true);
      return true;
    };

    if (runInitialPosition()) return;

    const pollRef = setInterval(() => {
      if (runInitialPosition()) {
        clearInterval(pollRef);
      }
    }, 250);

    return () => clearInterval(pollRef);
  }, [
    bootstrapped,
    isBoldWorkflow,
    allowSourcePlayer,
    clauseRegions,
    rowData,
    artifactTypeId,
    currentVersion,
    snapToClauseStart,
    setCurrentSegment,
    applyColors,
    bumpSuppressClauseAutoPlay,
    playCurrentClause,
  ]);

  const handleSegment = useCallback(
    async (seg: string, init: boolean) => {
      if (init) {
        setClauseSegString(seg);
        return;
      }
      const regions = getSortedRegions(seg);
      if (regions.length === 0) return;
      const json = regionsJsonFromList(regions, carefulSpeechSegParams);
      setClauseSegString(json);
      await persistClauseSegments(json);
      applyColors();
    },
    [
      setClauseSegString,
      persistClauseSegments,
      carefulSpeechSegParams,
      applyColors,
    ]
  );

  const markClauseHeard = useCallback((index: number) => {
    setHeardIndices((prev) =>
      prev.includes(index) ? prev : [...prev, index].sort((a, b) => a - b)
    );
  }, []);

  const handleRegionPlayEnd = useCallback(
    (region: IRegion) => {
      const idx = findClauseIndex(clauseRegions, region);
      if (idx < 0) return;

      if (!recordingPassStartedRef.current) {
        playerControlsRef.current?.setPlay(false);
        markClauseHeard(idx);
        if (idx < clauseRegions.length - 1) {
          const next = idx + 1;
          bumpSuppressClauseAutoPlay(4);
          setCurrentIndex(next);
          const nextRegion = clauseRegions[next];
          setCurrentSegment(nextRegion, next);
          void snapToClauseStart(next);
          setHighlightPlayButton(true);
        } else {
          setCurrentIndex(idx);
        }
        setPhase('readyToRecord');
        applyColors();
        return;
      }

      setCurrentIndex(idx);
      setCurrentClausePlayed(true);
      // Parking after an auto-play. A spurious +1 segment change usually
      // follows — playback overshoot into the next clause, or the recorder
      // mounting once allowRecord turns true — which the recording effect would
      // otherwise read as a user tap and auto-play. Arm the overshoot swallow so
      // that single adjacent advance is ignored while we stay parked (TT-7360).
      pendingOvershootSwallowRef.current = true;
      if (phase === 'recording') return;
      setPhase('recordReady');
      applyColors();
    },
    [
      clauseRegions,
      phase,
      applyColors,
      markClauseHeard,
      bumpSuppressClauseAutoPlay,
      setCurrentSegment,
      snapToClauseStart,
    ]
  );

  // WaveSurfer registers region-out once on audio ready, capturing a snapshot
  // of this callback. Start Recording changes recordingPassStarted without
  // reloading the audio, which would leave the listener on a stale listen-pass
  // closure. Stable wrapper + ref keeps it current. See docs/adr/0006.
  const handleRegionPlayEndRef = useRef(handleRegionPlayEnd);
  handleRegionPlayEndRef.current = handleRegionPlayEnd;
  const onSegmentPlaybackEnd = useCallback((region: IRegion) => {
    handleRegionPlayEndRef.current(region);
  }, []);

  useEffect(() => {
    if (!bootstrapped || !entryPositioned || entryPauseDoneRef.current) return;
    if (recordingPassStarted) return; // recording pass auto-plays on entry; don't pause
    entryPauseDoneRef.current = true;
    playerControlsRef.current?.setPlay(false);
    setPlayerPlaying(false);
  }, [bootstrapped, entryPositioned, recordingPassStarted]);

  useEffect(() => {
    const seg = getCurrentSegment();
    if (!seg || clauseRegions.length === 0 || !recordingPassStarted) return;
    if (!entryPositioned) return;
    const idx = findClauseIndex(clauseRegions, seg);
    if (idx < 0) return;

    const indexChanged = idx !== currentIndex;

    if (completedIndices.has(idx)) {
      if (playerControlsRef.current?.isPlaying?.()) {
        playerControlsRef.current.setPlay(false);
      }
      if (indexChanged) {
        setCurrentIndex(idx);
        setCurrentSegment(clauseRegions[idx], idx);
      }
      setShowRecorder(true);
      setPhase('recorded');
      setCurrentClausePlayed(true);
      void snapToClauseStart(idx);
      return;
    }

    // Only stop playback when the user actually navigates to a different
    // clause. The region-in event that fires when the current clause starts
    // playing also bumps currentSegmentIndex; pausing here unconditionally
    // would kill that playback the instant it begins (TT-7360).
    if (!indexChanged) return;

    if (playerControlsRef.current?.isPlaying?.()) {
      playerControlsRef.current.setPlay(false);
    }

    if (pendingOvershootSwallowRef.current && idx === currentIndex + 1) {
      // Spurious +1 advance right after an auto-play park (playback overshoot or
      // recorder-mount region-in). Re-assert the parked clause; don't play.
      // A non-adjacent change reaches the branch below and is treated as a tap.
      pendingOvershootSwallowRef.current = false;
      setCurrentSegment(clauseRegions[currentIndex], currentIndex);
      void snapToClauseStart(currentIndex);
      return;
    }
    // Genuine navigation (user tap) — cancel any armed swallow and play it.
    pendingOvershootSwallowRef.current = false;

    setCurrentIndex(idx);
    setCurrentSegment(clauseRegions[idx], idx);
    setShowRecorder(true);
    setCurrentClausePlayed(false);
    setPhase((p) => (p === 'recording' ? 'recording' : 'readyToRecord'));
    void playCurrentClause(idx);
  }, [
    currentSegmentIndex,
    clauseRegions,
    currentIndex,
    completedIndices,
    getCurrentSegment,
    recordingPassStarted,
    entryPositioned,
    setCurrentSegment,
    playCurrentClause,
    snapToClauseStart,
  ]);

  useEffect(() => {
    const seg = getCurrentSegment();
    if (!seg || clauseRegions.length === 0 || recordingPassStarted) return;
    if (!entryPositioned) return;
    const idx = findClauseIndex(clauseRegions, seg);
    if (idx < 0 || idx === currentIndex) return;

    if (playerControlsRef.current?.isPlaying?.()) {
      playerControlsRef.current.setPlay(false);
    }
    setCurrentIndex(idx);
    setCurrentSegment(clauseRegions[idx], idx);
    if (!consumeSuppressClauseAutoPlay()) {
      void playCurrentClause(idx);
    }
  }, [
    currentSegmentIndex,
    clauseRegions,
    currentIndex,
    getCurrentSegment,
    recordingPassStarted,
    entryPositioned,
    setCurrentSegment,
    playCurrentClause,
    consumeSuppressClauseAutoPlay,
  ]);

  const [changeLength, setChangeLength] = useState(false);

  const handleMoreClauses = useCallback(async () => {
    if (recordingPassStarted) return;
    const nextParams = applyMoreClauses(carefulSpeechSegParams, changeLength);
    setCarefulSpeechSegParams(nextParams);
    setChangeLength(!changeLength);
    const ok = await resegmentWithParams(nextParams);
    await applyResegmentResult(ok);
  }, [
    recordingPassStarted,
    carefulSpeechSegParams,
    setCarefulSpeechSegParams,
    changeLength,
    resegmentWithParams,
    applyResegmentResult,
  ]);

  const handleFewerClauses = useCallback(async () => {
    if (recordingPassStarted) return;
    const nextParams = applyFewerClauses(carefulSpeechSegParams, changeLength);
    setCarefulSpeechSegParams(nextParams);
    setChangeLength(!changeLength);
    const ok = await resegmentWithParams(nextParams);
    await applyResegmentResult(ok);
  }, [
    recordingPassStarted,
    carefulSpeechSegParams,
    setCarefulSpeechSegParams,
    changeLength,
    resegmentWithParams,
    applyResegmentResult,
  ]);

  const handleClearSegments = useCallback(async () => {
    if (recordingPassStarted) return;
    setCarefulSpeechSegParams(boldDefaultSegParams);
    setShowRecorder(false);
    const ok = await resetToDefaultSegments();
    await applyResegmentResult(ok);
  }, [
    recordingPassStarted,
    resetToDefaultSegments,
    applyResegmentResult,
    setCarefulSpeechSegParams,
  ]);

  const handleSplitClause = useCallback(async () => {
    const region = clauseRegions[currentIndex];
    if (!region) return;
    const splitPoint = playerControlsRef.current?.findClauseSplitPoint?.(
      region,
      carefulSpeechSegParams
    );
    if (
      !canSplitClause(currentIndex, clauseRegions, completedIndices, splitPoint)
    ) {
      return;
    }
    const updated = splitClauseAt(clauseRegions, currentIndex, splitPoint!);
    if (!updated) return;
    setCombineUndo(clauseSegString);
    const json = regionsJsonFromList(updated, carefulSpeechSegParams);
    setClauseSegString(json);
    await persistClauseSegments(json);
    playerControlsRef.current?.loadRegionsJson?.(json);
    applyColors();
    const firstSubClause = updated[currentIndex];
    setCurrentSegment(firstSubClause, currentIndex);
    setCurrentClausePlayed(false);
    setPhase('readyToRecord');
    void playCurrentClause(currentIndex, firstSubClause);
  }, [
    currentIndex,
    clauseRegions,
    completedIndices,
    clauseSegString,
    carefulSpeechSegParams,
    setClauseSegString,
    persistClauseSegments,
    applyColors,
    setCurrentSegment,
    playCurrentClause,
  ]);

  const handleCombineWithNext = useCallback(async () => {
    if (!canCombineWithNext(currentIndex, clauseRegions, completedIndices)) {
      return;
    }
    const updated = mergeClauseWithNext(clauseRegions, currentIndex);
    if (!updated) return;
    setCombineUndo(clauseSegString);
    const json = regionsJsonFromList(updated);
    setClauseSegString(json);
    await persistClauseSegments(json);
    playerControlsRef.current?.loadRegionsJson?.(json);
    applyColors();
    void playCurrentClause(currentIndex, updated[currentIndex]);
  }, [
    currentIndex,
    clauseRegions,
    completedIndices,
    clauseSegString,
    setClauseSegString,
    persistClauseSegments,
    applyColors,
    playCurrentClause,
  ]);

  const handleUndoCombine = useCallback(async () => {
    if (!combineUndo) return;
    setClauseSegString(combineUndo);
    await persistClauseSegments(combineUndo);
    playerControlsRef.current?.loadRegionsJson?.(combineUndo);
    setCombineUndo(null);
    applyColors();
    void playCurrentClause(currentIndex);
  }, [
    combineUndo,
    setClauseSegString,
    persistClauseSegments,
    applyColors,
    playCurrentClause,
    currentIndex,
  ]);

  const handleStartRecording = useCallback(() => {
    setRecordingPassStarted(true);
    recordingPassStartedRef.current = true;
    setHeardIndices([]);
    setShowRecorder(true);
    setCombineUndo(null);
    const next = firstIncompleteClauseIndex(clauseRegions, completedIndices);
    if (next >= clauseRegions.length) {
      setConfirmAllComplete(true);
      return;
    }
    setCurrentIndex(next);
    const region = clauseRegions[next];
    setCurrentSegment(region, next);
    setCurrentClausePlayed(false);
    setPhase('readyToRecord');
    setHighlightPlayButton(false);
    void playCurrentClause(next);
  }, [clauseRegions, completedIndices, setCurrentSegment, playCurrentClause]);

  const handleNextClause = useCallback(async () => {
    const effectiveCompleted = new Set(completedIndices);
    effectiveCompleted.add(currentIndex);
    const next = firstIncompleteClauseIndex(clauseRegions, effectiveCompleted);
    if (next >= clauseRegions.length) {
      setConfirmAllComplete(true);
      return;
    }
    setCurrentIndex(next);
    const region = clauseRegions[next];
    setCurrentSegment(region, next);
    setCurrentClausePlayed(false);
    setPhase('readyToRecord');
    setResetMedia(true);
    // playCurrentClause plays clause `next` once. When it ends,
    // handleRegionPlayEnd parks us on `next` (recordReady) and arms the
    // overshoot swallow, so the region-in into next+1 is ignored by the
    // recording effect rather than advancing the clause. This replaces the old
    // duration-based setTimeout that re-asserted `next` after playback — see
    // TT-7360.
    await playCurrentClause(next);
  }, [
    clauseRegions,
    completedIndices,
    currentIndex,
    setCurrentSegment,
    playCurrentClause,
  ]);

  const afterUploadCb = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (_mediaId: string | undefined) => {
      forceRefresh();
      setPhase('recorded');
      setResetMedia(false);
      applyColors();
    },
    [forceRefresh, applyColors]
  );

  const handleAllCompleteDismiss = useCallback(() => {
    setConfirmAllComplete(false);
    if (stepComplete(currentstep)) return;
    waitForSave(undefined, 200).finally(async () => {
      await setStepComplete(currentstep, true);
      gotoNextStep();
    });
  }, [currentstep, stepComplete, setStepComplete, gotoNextStep, waitForSave]);

  const handleClearRecording = useCallback(async () => {
    if (!recordingRow?.mediafile?.id) return;
    await memory.update((t) =>
      t.removeRecord({ type: 'mediafile', id: recordingRow.mediafile.id })
    );
    forceRefresh();
    if (stepComplete(currentstep)) {
      await setStepComplete(currentstep, false);
    }
    setPhase('recordReady');
    setCurrentClausePlayed(true);
    setResetMedia(true);
    applyColors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    recordingRow,
    forceRefresh,
    applyColors,
    currentstep,
    stepComplete,
    setStepComplete,
  ]);

  const allowRecord =
    recordingPassStarted &&
    currentClausePlayed &&
    (phase === 'recordReady' || phase === 'recording') &&
    !completedIndices.has(currentIndex);

  const highlightSpeaker =
    recordingPassStarted && showRecorder && !speaker.trim();

  if (!isBoldWorkflow) {
    return (
      <Paper sx={paperProps}>
        <Typography variant="h2" align="center">
          {t.boldOnly}
        </Typography>
      </Paper>
    );
  }

  if (!mediafileId) {
    return (
      <Paper sx={paperProps}>
        <Typography variant="h2" align="center">
          {ts.noAudio}
        </Typography>
      </Paper>
    );
  }

  return (
    <Box
      id="careful-speech"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        width: '100%',
      }}
    >
      {allowSourcePlayer && (
        <PassageDetailPlayer
          key={`careful-speech-player-${mediafileId}`}
          width={width}
          allowSegment={NamedRegions.Clause}
          suggestedSegments={suggestedSegmentsForPlayer}
          forceRegionOnly={true}
          allowAutoSegment={false}
          autoPlayOnSegmentLocate={false}
          playing={playerPlaying}
          setPlayingOverride={setPlayerPlayingBoth}
          defaultSegParams={carefulSpeechSegParams}
          onSegment={handleSegment}
          onClearSegments={handleClearSegments}
          controlsRef={playerControlsRef}
          applyRegionColor={applyRegionColor}
          onSegmentPlaybackEnd={onSegmentPlaybackEnd}
          highlightPlay={highlightPlayButton}
          onPlayStatusNotify={handlePlayStatusNotify}
          beforePlay={handleBeforeSourcePlay}
          allowZoom={true}
        />
      )}
      {editStep && bootstrapped && (
        <CarefulSpeechControls
          width={width}
          phase={phase}
          recordingPassStarted={recordingPassStarted}
          currentRegion={currentRegion}
          speaker={speaker}
          onSpeakerChange={handleSpeakerChange}
          onMoreClauses={() => void handleMoreClauses()}
          onFewerClauses={() => void handleFewerClauses()}
          onSplitClause={() => void handleSplitClause()}
          onCombineWithNext={() => void handleCombineWithNext()}
          onUndoCombine={() => void handleUndoCombine()}
          canFewerClauses={!recordingPassStarted}
          canSplitClause={canSplitClause(
            currentIndex,
            clauseRegions,
            completedIndices,
            currentClauseSplitPoint
          )}
          canCombineWithNext={canCombineWithNext(
            currentIndex,
            clauseRegions,
            completedIndices
          )}
          showUndoCombine={combineUndo !== null}
          onStartRecording={handleStartRecording}
          onNextClause={() => void handleNextClause()}
          onClearRecording={() => void handleClearRecording()}
          allClausesHeard={allClausesHeard}
          allClausesComplete={allClausesComplete}
          highlightSpeaker={highlightSpeaker}
          allowRecord={allowRecord}
          toolId={toolId}
          passageId={related(playerMediafile, 'passage') ?? passage?.id}
          artifactId={artifactTypeId}
          sourceMediaId={mediafileId}
          sourceSegments={JSON.stringify(currentRegion ?? {})}
          defaultFilename={defaultFilename}
          recordingMediaId={recordingRow?.mediafile?.id}
          afterUploadCb={afterUploadCb}
          onRecording={(active) => {
            setRecording(active);
            if (active) {
              setPhase('recording');
            } else if (showRecorder) {
              setPhase('recorded');
            }
          }}
          resetMedia={resetMedia}
          setResetMedia={setResetMedia}
          setCanSave={setCanSave}
          setStatusText={setStatusText}
          showRecorder={showRecorder}
        />
      )}
      {statusText && (
        <Typography variant="caption" align="center">
          {statusText}
        </Typography>
      )}
      {confirmAllComplete && (
        <Confirm
          text={t.allComplete}
          yesResponse={handleAllCompleteDismiss}
          noResponse={handleAllCompleteDismiss}
        />
      )}
    </Box>
  );
}

export default PassageDetailCarefulSpeech;
