import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { useGlobal } from '../../context/useGlobal';
import usePassageDetailContext from '../../context/usePassageDetailContext';
import { useRenderProfiler, useWhyRender } from '../../utils/perf';
import PassageDetailPlayer from './PassageDetailPlayer';
import StepMessage from './boldClause/StepMessage';
import { remoteIdGuid, useArtifactType, useStepTool } from '../../crud';
import {
  getSegments,
  getSortedRegions,
  NamedRegions,
} from '../../utils/namedSegments';
import { IRegion } from '../../crud/useWavesurferRegions';
import { WSAudioPlayerControls } from '../WSAudioPlayer';
import { useOrbitData } from '../../hoc/useOrbitData';
import {
  IMediaTabStrings,
  IMediaTitleStrings,
  ISharedStrings,
  MediaFileD,
} from '../../model';
import { passageDefaultFilename } from '../../utils/passageDefaultFilename';
import { related } from '../../crud/related';
import { RecordKeyMap } from '@orbit/records';
import CarefulSpeechControls, {
  CarefulSpeechPhase,
} from './carefulSpeech/CarefulSpeechControls';
import { useGuidedPhraseSegments } from './carefulSpeech/useGuidedPhraseSegments';
import { resolveSegmentSpeaker } from './carefulSpeech/resolveSegmentSpeaker';
import {
  CLAUSE_BOUNDARY_THRESHOLD_SEC,
  hasPhraseRegions,
  preservesRecordedBoundaries,
  regionBoundariesEqual,
  regionsJsonFromList,
} from './carefulSpeech/carefulSpeechBoundary';
import {
  firstIncompleteClauseIndex,
  getCompletedClauseIndices,
  getRecordingForClause,
} from './carefulSpeech/carefulSpeechCompletion';
import {
  matchesGuidedOutputRow,
  phraseBtBoundaryRegionName,
  parseMediaLanguageField,
} from './carefulSpeech/matchesGuidedOutputRow';
import { planLegacyPhraseBtClaim } from './carefulSpeech/claimLegacyPhraseBt';
import { UpdateRecord } from '../../model/baseModel';
import {
  createCarefulSpeechApplyRegionColor,
  type ICarefulSpeechColorStatus,
} from '../../utils/carefulSpeechSegmentColors';
import { useStepPermissions } from '../../utils/useStepPermission';
import { isLinkedNote } from '../../crud/isLinkedNote';
import {
  mediaTabSelector,
  mediaTitleSelector,
  sharedSelector,
} from '../../selector';
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
import {
  type GuidedPhraseRecordConfig,
  type IGuidedPhraseRecordControlStrings,
} from '../../components/PassageDetail/guidedPhraseRecord/types';
import { createPhraseSegmentUndoStack } from '../../utils/phraseSegmentUndoStack';
import Confirm from '../AlertDialog';

interface IProps {
  width: number;
  config: GuidedPhraseRecordConfig;
  controlStrings: IGuidedPhraseRecordControlStrings;
  /** Shown when config.requireBoldWorkflow and the team is not BOLD. */
  workflowGateMessage?: string;
}

/**
 * A stop reported sooner than this after playback started is the seek that
 * started it, not the audio finishing. Auto-segmenting never produces a clause
 * anywhere near this short.
 */
const SPURIOUS_STOP_WINDOW_MS = 250;

function findClauseIndex(clauseRegions: IRegion[], region: IRegion): number {
  return clauseRegions.findIndex(
    (r) =>
      Math.abs(r.start - region.start) < 0.05 &&
      Math.abs(r.end - region.end) < 0.05
  );
}

export function PassageDetailGuidedPhraseRecord({
  width,
  config,
  controlStrings,
  workflowGateMessage,
}: IProps) {
  useRenderProfiler('PassageDetailGuidedPhraseRecord');
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const tm: IMediaTabStrings = useSelector(mediaTabSelector, shallowEqual);
  const tt: IMediaTitleStrings = useSelector(mediaTitleSelector, shallowEqual);
  const [memory] = useGlobal('memory');
  const [user] = useGlobal('user');
  const [plan] = useGlobal('plan');
  const [offline] = useGlobal('offline');
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const [connected] = useGlobal('connected');
  const { getTypeId } = useArtifactType();
  const {
    passage,
    sharedResource,
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
    stepComplete,
  } = usePassageDetailContext();
  useWhyRender('PassageDetailGuidedPhraseRecord', {
    passage,
    playerMediafile,
    mediafileId,
    rowData,
    currentstep,
    currentSegmentIndex,
    isBoldWorkflow,
    stepComplete,
    carefulSpeechSegParams,
    mediafiles,
  });
  const { settings } = useStepTool(currentstep);
  const stepSettings = useMemo((): Record<string, unknown> => {
    if (!settings) return {};
    if (typeof settings === 'string') {
      try {
        return JSON.parse(settings || '{}') as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return settings as Record<string, unknown>;
  }, [settings]);
  const { canDoSectionStep } = useStepPermissions();
  const { startSave, waitForSave } = useContext(UnsavedContext).state;

  const stepEnabled = config.requireBoldWorkflow ? isBoldWorkflow : true;
  const [localSegParams, setLocalSegParams] = useState(boldDefaultSegParams);
  const phraseSegParams = config.requireBoldWorkflow
    ? carefulSpeechSegParams
    : localSegParams;
  const setPhraseSegParams = config.requireBoldWorkflow
    ? setCarefulSpeechSegParams
    : setLocalSegParams;
  const toolId = config.mediaRecordToolId;

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
  /**
   * When playback of the current clause last began - whether this component
   * started it or the user pressed Play. See SPURIOUS_STOP_WINDOW_MS: a stale
   * timestamp would make the seek-suppression window compare against an old
   * time and mark a clause played before it had been.
   */
  const clausePlaybackStartedAtRef = useRef(0);
  const skipBeforePlayRef = useRef(false);
  const entryPauseDoneRef = useRef(false);
  const [highlightPlayButton, setHighlightPlayButton] = useState(false);
  const [allowSourcePlayer, setAllowSourcePlayer] = useState(false);
  const [entryPositioned, setEntryPositioned] = useState(false);
  const [playerPlaying, setPlayerPlaying] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<CarefulSpeechPhase>('bootstrapping');
  const [speaker, setSpeaker] = useState(
    localStorage.getItem(config.speakerLocalKey) ?? ''
  );
  const [showRecorder, setShowRecorder] = useState(false);
  const [resetMedia, setResetMedia] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [canSave, setCanSave] = useState(false);
  const [savingRecording, setSavingRecording] = useState(false);
  // Mirrors saveRejectedRef for render: shows the failure message + Retry.
  const [saveRejected, setSaveRejected] = useState(false);
  // Mirror of savingRecording, set synchronously wherever the state is toggled.
  // The clause-boundary guards read this ref rather than the state value so a
  // save that begins before React commits the disabling render is still seen by
  // an in-flight callback closure (state would be captured stale). See the
  // savingRecording toggles below (TT-7427).
  const savingRecordingRef = useRef(false);
  const [recordingPassStarted, setRecordingPassStarted] = useState(false);
  // Mirror of recordingPassStarted set synchronously at the call sites below.
  // region-out can fire before React commits the state-update render, leaving
  // the handler's closure (and handleRegionPlayEndRef) on the stale false
  // value; reading this ref makes the recording/listen branch decision reflect
  // intent immediately rather than waiting for a render (TT-7360).
  const recordingPassStartedRef = useRef(false);
  /** Mirrors context recording for segment-lock checks once capture is active. */
  const recordingActiveRef = useRef(false);
  // Set true when we park after an auto-play. The playback overshoot into the
  // next clause (or a recorder-mount-induced region-in) advances by exactly one
  // clause; this lets the recording effect swallow that single +1 advance while
  // still treating any non-adjacent jump as a genuine user tap (TT-7360).
  const pendingOvershootSwallowRef = useRef(false);
  /** Indices saved this session whose rowData may not have caught up yet (TT-7552). */
  const optimisticCompletedRef = useRef<Set<number>>(new Set());
  const currentIndexRef = useRef(0);
  const [heardIndices, setHeardIndices] = useState<number[]>([]);
  const [currentClausePlayed, setCurrentClausePlayed] = useState(false);
  const [combineUndo, setCombineUndo] = useState<string | null>(null);
  const [segmentUndoCan, setSegmentUndoCan] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState<string | null>(null);
  const [baselineSeg, setBaselineSeg] = useState<string | null>(null);
  const segmentUndoStackRef = useRef(createPhraseSegmentUndoStack());
  const baselineSegRef = useRef<string | null>(null);

  const mediafile = useMemo(
    () => mediafiles.find((m) => m.id === mediafileId),
    [mediafiles, mediafileId]
  );

  const artifactTypeId = useMemo((): string => {
    const id = stepSettings.artifactTypeId as string | undefined;
    if (id) {
      return (
        remoteIdGuid('artifacttype', id, memory?.keyMap as RecordKeyMap) ?? id
      );
    }
    return getTypeId(config.defaultArtifactSlug) ?? '';
  }, [stepSettings, memory?.keyMap, getTypeId, config.defaultArtifactSlug]);

  const stepLanguageBcp47 = useMemo(() => {
    if (config.requireBoldWorkflow) return undefined;
    const { bcp47 } = parseMediaLanguageField(stepSettings.language);
    return bcp47 !== 'und' ? bcp47 : undefined;
  }, [config.requireBoldWorkflow, stepSettings.language]);

  const stepLanguageField = useMemo(() => {
    if (config.requireBoldWorkflow) return undefined;
    const raw = stepSettings.language;
    if (raw == null || raw === '') return undefined;
    const { bcp47 } = parseMediaLanguageField(raw);
    return bcp47 !== 'und' ? String(raw) : undefined;
  }, [config.requireBoldWorkflow, stepSettings.language]);

  const currentVersion = mediafile?.attributes?.versionNumber ?? 0;

  const hasAnyOutputRecordings = useMemo(
    () =>
      rowData.some((r) =>
        matchesGuidedOutputRow(r, {
          artifactTypeId,
          vernacularMediaId: mediafileId,
          languageBcp47: stepLanguageBcp47,
        })
      ),
    [rowData, artifactTypeId, mediafileId, stepLanguageBcp47]
  );

  const claimRanRef = useRef(false);
  useEffect(() => {
    if (
      config.requireBoldWorkflow ||
      !stepLanguageBcp47 ||
      !stepLanguageField ||
      !mediafile ||
      !artifactTypeId ||
      claimRanRef.current
    ) {
      return;
    }
    claimRanRef.current = true;
    const { languageName } = parseMediaLanguageField(stepLanguageField);
    const plan = planLegacyPhraseBtClaim({
      languageName,
      languageBcp47: stepLanguageBcp47,
      artifactTypeId,
      vernacularMedia: [mediafile],
      outputMedia: rowData
        .filter((r) => related(r.mediafile, 'artifactType') === artifactTypeId)
        .map((r) => r.mediafile),
    });
    if (plan.languageUpdates.size === 0 && plan.segmentUpdates.size === 0) {
      return;
    }
    void memory
      .update((t) => {
        const ops = [];
        for (const [id, languagebcp47] of plan.languageUpdates) {
          const m = rowData.find((r) => r.mediafile.id === id)?.mediafile;
          if (!m) continue;
          ops.push(
            ...UpdateRecord(
              t,
              {
                type: 'mediafile',
                id,
                attributes: { ...m.attributes, languagebcp47 },
              } as MediaFileD,
              user
            )
          );
        }
        for (const [id, segments] of plan.segmentUpdates) {
          if (id !== mediafile.id) continue;
          ops.push(
            ...UpdateRecord(
              t,
              {
                type: 'mediafile',
                id,
                attributes: { ...mediafile.attributes, segments },
              } as MediaFileD,
              user
            )
          );
        }
        return ops;
      })
      .then(() => forceRefresh());
  }, [
    config.requireBoldWorkflow,
    stepLanguageBcp47,
    stepLanguageField,
    mediafile,
    artifactTypeId,
    rowData,
    memory,
    user,
    forceRefresh,
  ]);

  const verseSegString = useMemo(() => {
    if (!config.constrainAutoSegmentWithVerses || !mediafile) return undefined;
    const verseJson = getSegments(
      NamedRegions.Verse,
      mediafile.attributes?.segments ?? '[]'
    );
    return hasPhraseRegions(verseJson) ? verseJson : undefined;
  }, [config.constrainAutoSegmentWithVerses, mediafile]);

  const {
    phraseSegString: clauseSegString,
    setPhraseSegString: setClauseSegString,
    bootstrapped,
    ensureSegments,
    resetForMediafile,
    resegmentWithParams,
    resetToDefaultSegments,
    persistPhraseSegments: persistClauseSegments,
  } = useGuidedPhraseSegments(mediafile, playerControlsRef, {
    namedRegion:
      stepLanguageBcp47 && config.persistSegments && !config.requireBoldWorkflow
        ? phraseBtBoundaryRegionName(stepLanguageBcp47)
        : config.namedRegion,
    fallbackNamedRegion:
      stepLanguageBcp47 && config.persistSegments && !config.requireBoldWorkflow
        ? NamedRegions.BackTranslation
        : undefined,
    singleSegmentMode: config.singleSegmentMode,
    persistSegments: config.persistSegments,
    constrainAutoSegmentWithVerses: config.constrainAutoSegmentWithVerses,
    shouldReseedFromVerses:
      config.constrainAutoSegmentWithVerses && !hasAnyOutputRecordings,
  });

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
    if (!hasPhraseRegions(clauseSegString)) return undefined;
    return clauseSegString;
  }, [clauseSegString]);

  const completedIndices = useMemo(
    () =>
      getCompletedClauseIndices(
        clauseRegions,
        rowData,
        artifactTypeId,
        currentVersion,
        mediafileId,
        config.singleSegmentMode,
        stepLanguageBcp47
      ),
    [
      clauseRegions,
      rowData,
      artifactTypeId,
      currentVersion,
      mediafileId,
      config.singleSegmentMode,
      stepLanguageBcp47,
    ]
  );

  const allClausesComplete = useMemo(
    () =>
      clauseRegions.length > 0 && completedIndices.size >= clauseRegions.length,
    [completedIndices, clauseRegions]
  );

  // Mirror clause recording coverage into step completion (no auto-advance).
  useEffect(() => {
    if (!bootstrapped || clauseRegions.length === 0) return;

    const syncStepComplete = async () => {
      const isComplete = stepComplete(currentstep);
      if (allClausesComplete) {
        if (!isComplete) {
          try {
            await waitForSave(undefined, 200);
          } catch {
            return;
          }
          await setStepComplete(currentstep, true);
        }
      } else if (isComplete) {
        await setStepComplete(currentstep, false);
      }
    };

    void syncStepComplete();
    // stepComplete reads psgCompleted internally; waitForSave identity is unstable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allClausesComplete, bootstrapped, clauseRegions.length, currentstep]);

  const currentRegion = clauseRegions[currentIndex];

  const currentClauseSplitPoint = useMemo(() => {
    if (!recordingPassStarted || !currentRegion) return undefined;
    const ctrl = playerControlsRef.current;
    if (!ctrl?.isReady?.() || !ctrl.findClauseSplitPoint) return undefined;
    return ctrl.findClauseSplitPoint(currentRegion, phraseSegParams);
  }, [recordingPassStarted, currentRegion, phraseSegParams]);

  const recordingRow = useMemo(
    () =>
      currentRegion
        ? getRecordingForClause(
            rowData,
            artifactTypeId,
            currentVersion,
            currentRegion,
            mediafileId,
            config.singleSegmentMode,
            currentIndex,
            stepLanguageBcp47
          )
        : undefined,
    [
      currentRegion,
      rowData,
      artifactTypeId,
      currentVersion,
      mediafileId,
      config.singleSegmentMode,
      currentIndex,
      stepLanguageBcp47,
    ]
  );

  const editStep = useMemo(
    () =>
      canDoSectionStep(currentstep, section) &&
      !isLinkedNote(passage, sharedResource),
    [canDoSectionStep, currentstep, section, passage, sharedResource]
  );

  const defaultFilename = useMemo(() => {
    const postfix = config.buildFilenamePostfix(currentIndex, currentVersion);
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
    config,
  ]);

  carefulSpeechStatusRef.current = {
    currentIndex,
    isCompleted: (i) =>
      recordingPassStarted
        ? completedIndices.has(i) || optimisticCompletedRef.current.has(i)
        : heardSet.has(i),
  };
  currentIndexRef.current = currentIndex;

  const applyColors = useCallback(() => {
    playerControlsRef.current?.applyRegionColors?.();
  }, []);

  // Drop optimistic flags once rowData confirms those clauses.
  useEffect(() => {
    let changed = false;
    for (const i of [...optimisticCompletedRef.current]) {
      if (completedIndices.has(i)) {
        optimisticCompletedRef.current.delete(i);
        changed = true;
      }
    }
    if (changed) applyColors();
  }, [completedIndices, applyColors]);

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

  const handleSpeakerChange = useCallback(
    (value: string) => {
      setSpeaker(value);
      localStorage.setItem(config.speakerLocalKey, value);
    },
    [config.speakerLocalKey]
  );

  // TT-7440: existing take keeps its performedBy; new takes use last localStorage speaker
  useEffect(() => {
    setSpeaker(
      resolveSegmentSpeaker(
        recordingRow?.mediafile?.attributes?.performedBy,
        config.speakerLocalKey
      )
    );
  }, [recordingRow, currentIndex, config.speakerLocalKey]);

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

  // TT-7583: this step auto-saves on every rising edge of canSave. A failed
  // upload leaves the take dirty, so canSave goes false→true again and we used
  // to retry the same doomed take forever (finalizeTerminalFailure + error
  // snackbar on a loop). MediaRecord tells us the attempt was rejected; hold
  // off until the user records again rather than latching canSave off, which
  // would break the manual Save button on every other recording screen.
  const saveRejectedRef = useRef(false);

  const previousConnectedRef = useRef(connected);
  useEffect(() => {
    if (canSave && !saveRejectedRef.current) {
      savingRecordingRef.current = true;
      setSavingRecording(true);
      startSave(toolId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSave]);

  // The take is still dirty after a rejection, so asking for the save again is
  // all it takes to re-upload it (TT-7583).
  const handleRetrySave = useCallback(() => {
    saveRejectedRef.current = false;
    setSaveRejected(false);
    savingRecordingRef.current = true;
    setSavingRecording(true);
    startSave(toolId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolId]);

  // The failure message belongs to the clause whose take failed. Navigating away
  // clears MediaRecord's blob, so a Retry from another clause would only hit the
  // no-audio branch — drop the message with the take it referred to (TT-7583).
  // Keyed on the index rather than the navigation handlers because every clause
  // move funnels through it.
  useEffect(() => {
    saveRejectedRef.current = false;
    setSaveRejected(false);
  }, [currentIndex]);

  useEffect(() => {
    const reconnected = !previousConnectedRef.current && connected;
    previousConnectedRef.current = connected;
    if (reconnected && saveRejectedRef.current && !savingRecordingRef.current) {
      handleRetrySave();
    }
  }, [connected, handleRetrySave]);

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
      clausePlaybackStartedAtRef.current = Date.now();
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

  const pushSegmentUndo = useCallback(() => {
    if (!config.multiLevelSegmentUndo) return;
    if (!hasPhraseRegions(clauseSegString)) return;
    segmentUndoStackRef.current.push(clauseSegString);
    setSegmentUndoCan(segmentUndoStackRef.current.canUndo());
  }, [config.multiLevelSegmentUndo, clauseSegString]);

  const clearSegmentUndo = useCallback(() => {
    segmentUndoStackRef.current.clear();
    setSegmentUndoCan(false);
  }, []);

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
      if (playingNow) {
        setHighlightPlayButton(false);
        // Playback began, whatever started it. Time the window from here, so a
        // stop that this start provokes is discarded below instead of being read
        // as the clause having finished.
        clausePlaybackStartedAtRef.current = Date.now();
      }
      if (currentIndex === clauseRegions.length - 1) {
        markClauseHeard(currentIndex);
      }
      // Only a stop tells us the clause has been heard; the start case is
      // handled above.
      if (playingNow) return;
      // The listen pass has nothing to record, so nothing to enable.
      if (!recordingPassStartedRef.current) return;
      // Capturing or saving a take stops the source audio, and that stop is not
      // the clause being heard. Defensive:
      if (recordingActiveRef.current || savingRecordingRef.current) return;
      // Starting a clause seeks the playhead to its start, and that seek reports
      // a stop of its own before anything has been heard. This can be
      // differentiated from a real stop (user pause) by how long playback had
      // been running. If under SPURIOUS_STOP_WINDOW_MS it is the seek, ignore it.
      if (
        Date.now() - clausePlaybackStartedAtRef.current <
        SPURIOUS_STOP_WINDOW_MS
      ) {
        return;
      }
      setCurrentClausePlayed(true);
      setPhase((p) =>
        p === 'recording' || p === 'recorded' ? p : 'recordReady'
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clauseRegions.length, currentIndex]
  );

  const handleBeforeSourcePlay = useCallback(async () => {
    // The user pressed Play rather than the step starting playback, so the
    // seek-suppression window has to be re-based here too.
    clausePlaybackStartedAtRef.current = Date.now();
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
    recordingActiveRef.current = false;
    savingRecordingRef.current = false;
    setSavingRecording(false);
    saveRejectedRef.current = false;
    setSaveRejected(false);
    pendingOvershootSwallowRef.current = false;
    optimisticCompletedRef.current.clear();
    setHeardIndices([]);
    setCurrentClausePlayed(false);
    setCombineUndo(null);
    clearSegmentUndo();
    baselineSegRef.current = null;
    setBaselineSeg(null);
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
    if (!mediafileId || !stepEnabled) return;

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
  }, [mediafileId, ensureSegments, applyColors, stepEnabled]);

  useEffect(() => {
    if (!bootstrapped || !hasPhraseRegions(clauseSegString)) return;
    if (baselineSegRef.current === null) {
      baselineSegRef.current = clauseSegString;
      setBaselineSeg(clauseSegString);
      clearSegmentUndo();
    }
  }, [bootstrapped, clauseSegString, clearSegmentUndo]);

  useEffect(() => {
    if (!bootstrapped || !stepEnabled || !allowSourcePlayer) {
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
        currentVersion,
        mediafileId,
        config.singleSegmentMode,
        stepLanguageBcp47
      );
      const firstIdx = firstIncompleteClauseIndex(clauseRegions, completed);
      if (firstIdx >= clauseRegions.length) {
        // All clauses are recorded. Enter recording (review) mode positioned on
        // the first clause so the user can replay both the original and the
        // careful-speech take per clause. Step completion syncs via effect.
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
    stepEnabled,
    allowSourcePlayer,
    clauseRegions,
    rowData,
    artifactTypeId,
    currentVersion,
    mediafileId,
    config.singleSegmentMode,
    snapToClauseStart,
    setCurrentSegment,
    applyColors,
    bumpSuppressClauseAutoPlay,
    playCurrentClause,
    stepLanguageBcp47,
  ]);

  const handleSegment = useCallback(
    async (seg: string, init: boolean) => {
      if (init) {
        setClauseSegString(seg);
        return;
      }
      if (recordingActiveRef.current || savingRecording) return;
      const regions = getSortedRegions(seg);
      if (regions.length === 0) return;
      if (
        recordingPassStarted &&
        !preservesRecordedBoundaries(clauseRegions, regions, completedIndices)
      ) {
        playerControlsRef.current?.loadRegionsJson?.(clauseSegString);
        return;
      }
      const json = regionsJsonFromList(regions, phraseSegParams);
      if (regionBoundariesEqual(json, clauseSegString)) return;
      pushSegmentUndo();
      setClauseSegString(json);
      await persistClauseSegments(json);
      applyColors();
    },
    [
      setClauseSegString,
      persistClauseSegments,
      phraseSegParams,
      applyColors,
      savingRecording,
      recordingPassStarted,
      clauseRegions,
      completedIndices,
      clauseSegString,
      pushSegmentUndo,
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
    if (recordingActiveRef.current || savingRecording) return;
    const idx = findClauseIndex(clauseRegions, seg);
    if (idx < 0) return;

    const indexChanged = idx !== currentIndex;

    if (completedIndices.has(idx)) {
      if (playerControlsRef.current?.isPlaying?.()) {
        playerControlsRef.current.setPlay(false);
      }
      if (indexChanged) {
        // TT-7552: clear prior take from MediaRecord when changing segments.
        setResetMedia(true);
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

    // TT-7552: clear prior take so Segment N+1 starts empty (same as Next Clause).
    setResetMedia(true);
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
    savingRecording,
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
    pushSegmentUndo();
    const nextParams = applyMoreClauses(phraseSegParams, changeLength);
    setPhraseSegParams(nextParams);
    setChangeLength(!changeLength);
    const ok = await resegmentWithParams(nextParams);
    await applyResegmentResult(ok);
  }, [
    recordingPassStarted,
    phraseSegParams,
    setPhraseSegParams,
    changeLength,
    resegmentWithParams,
    applyResegmentResult,
    pushSegmentUndo,
  ]);

  const handleFewerClauses = useCallback(async () => {
    if (recordingPassStarted) return;
    pushSegmentUndo();
    const nextParams = applyFewerClauses(phraseSegParams, changeLength);
    setPhraseSegParams(nextParams);
    setChangeLength(!changeLength);
    const ok = await resegmentWithParams(nextParams);
    await applyResegmentResult(ok);
  }, [
    recordingPassStarted,
    phraseSegParams,
    setPhraseSegParams,
    changeLength,
    resegmentWithParams,
    applyResegmentResult,
    pushSegmentUndo,
  ]);

  const performStepBaselineReset = useCallback(async () => {
    const baseline = baselineSegRef.current;
    if (!baseline) return;
    const toDelete = rowData.filter((r) =>
      matchesGuidedOutputRow(r, {
        artifactTypeId,
        vernacularMediaId: mediafileId,
        languageBcp47: stepLanguageBcp47,
      })
    );
    if (toDelete.length > 0) {
      await memory.update((t) =>
        toDelete.map((r) =>
          t.removeRecord({ type: 'mediafile', id: r.mediafile.id })
        )
      );
    }
    clearSegmentUndo();
    setCombineUndo(null);
    setClauseSegString(baseline);
    await persistClauseSegments(baseline);
    playerControlsRef.current?.loadRegionsJson?.(baseline);
    setRecordingPassStarted(false);
    recordingPassStartedRef.current = false;
    optimisticCompletedRef.current.clear();
    setShowRecorder(false);
    setHeardIndices([]);
    setCurrentClausePlayed(false);
    setCurrentIndex(0);
    setPhase('readyToRecord');
    const regions = getSortedRegions(baseline);
    if (regions[0]) {
      bumpSuppressClauseAutoPlay(4);
      setCurrentSegment(regions[0], 0);
      await snapToClauseStart(0);
    }
    setHighlightPlayButton(true);
    if (stepComplete(currentstep)) {
      await setStepComplete(currentstep, false);
    }
    forceRefresh();
    applyColors();
  }, [
    rowData,
    artifactTypeId,
    mediafileId,
    stepLanguageBcp47,
    memory,
    clearSegmentUndo,
    setClauseSegString,
    persistClauseSegments,
    bumpSuppressClauseAutoPlay,
    setCurrentSegment,
    snapToClauseStart,
    stepComplete,
    currentstep,
    setStepComplete,
    forceRefresh,
    applyColors,
  ]);

  const handleClearSegments = useCallback(async () => {
    if (config.showSegmentResetInRecordingPass) {
      if (!recordingPassStarted) return;
      const baseline = baselineSegRef.current;
      if (!baseline) return;
      const boundariesChanged = !regionBoundariesEqual(
        baseline,
        clauseSegString
      );
      if (!boundariesChanged && !hasAnyOutputRecordings) return;
      const text = hasAnyOutputRecordings
        ? (controlStrings.resetConfirmRecordings ??
          'Resetting will delete all recordings and restore segment boundaries. Continue?')
        : (controlStrings.resetConfirmBoundaries ??
          'Resetting will restore segment boundaries. Continue?');
      setResetConfirmText(text);
      return;
    }
    if (recordingPassStarted) return;
    setPhraseSegParams(boldDefaultSegParams);
    setShowRecorder(false);
    const ok = await resetToDefaultSegments();
    await applyResegmentResult(ok);
  }, [
    config.showSegmentResetInRecordingPass,
    recordingPassStarted,
    clauseSegString,
    hasAnyOutputRecordings,
    controlStrings.resetConfirmRecordings,
    controlStrings.resetConfirmBoundaries,
    setPhraseSegParams,
    resetToDefaultSegments,
    applyResegmentResult,
  ]);

  const handleSplitClause = useCallback(async () => {
    if (savingRecordingRef.current) return;
    const region = clauseRegions[currentIndex];
    if (!region) return;
    const splitPoint = playerControlsRef.current?.findClauseSplitPoint?.(
      region,
      phraseSegParams
    );
    if (
      !canSplitClause(currentIndex, clauseRegions, completedIndices, splitPoint)
    ) {
      return;
    }
    const updated = splitClauseAt(clauseRegions, currentIndex, splitPoint!);
    if (!updated) return;
    if (config.multiLevelSegmentUndo) {
      pushSegmentUndo();
    } else {
      setCombineUndo(clauseSegString);
    }
    const json = regionsJsonFromList(updated, phraseSegParams);
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
    phraseSegParams,
    setClauseSegString,
    persistClauseSegments,
    applyColors,
    setCurrentSegment,
    playCurrentClause,
    config.multiLevelSegmentUndo,
    pushSegmentUndo,
  ]);

  const handleCombineWithNext = useCallback(async () => {
    if (savingRecordingRef.current) return;
    if (!canCombineWithNext(currentIndex, clauseRegions, completedIndices)) {
      return;
    }
    const updated = mergeClauseWithNext(clauseRegions, currentIndex);
    if (!updated) return;
    if (config.multiLevelSegmentUndo) {
      pushSegmentUndo();
    } else {
      setCombineUndo(clauseSegString);
    }
    const json = regionsJsonFromList(updated, phraseSegParams);
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
    phraseSegParams,
    setClauseSegString,
    persistClauseSegments,
    applyColors,
    playCurrentClause,
    config.multiLevelSegmentUndo,
    pushSegmentUndo,
  ]);

  const handleUndoCombine = useCallback(async () => {
    if (savingRecordingRef.current) return;
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

  const handleSegmentUndo = useCallback(async () => {
    // Guard before pop() so a blocked undo doesn't consume a stack entry.
    if (savingRecordingRef.current) return;
    const prev = segmentUndoStackRef.current.pop();
    setSegmentUndoCan(segmentUndoStackRef.current.canUndo());
    if (!prev) return;
    setClauseSegString(prev);
    await persistClauseSegments(prev);
    playerControlsRef.current?.loadRegionsJson?.(prev);
    if (!recordingPassStarted) {
      await applyResegmentResult(prev);
    } else {
      applyColors();
      const regions = getSortedRegions(prev);
      const idx = Math.min(currentIndex, Math.max(0, regions.length - 1));
      setCurrentIndex(idx);
      if (regions[idx]) {
        setCurrentSegment(regions[idx], idx);
        void playCurrentClause(idx, regions[idx]);
      }
    }
  }, [
    setClauseSegString,
    persistClauseSegments,
    recordingPassStarted,
    applyResegmentResult,
    applyColors,
    currentIndex,
    setCurrentSegment,
    playCurrentClause,
  ]);

  const handlePrevUnit = useCallback(() => {
    if (savingRecording || recordingActiveRef.current) return;
    if (currentIndex <= 0) return;
    const next = currentIndex - 1;
    setResetMedia(true);
    setCurrentIndex(next);
    setCurrentSegment(clauseRegions[next], next);
    setCurrentClausePlayed(false);
    setPhase(
      completedIndices.has(next)
        ? 'recorded'
        : ('readyToRecord' as CarefulSpeechPhase)
    );
    setShowRecorder(true);
    if (completedIndices.has(next)) {
      void snapToClauseStart(next);
    } else {
      void playCurrentClause(next);
    }
  }, [
    savingRecording,
    currentIndex,
    clauseRegions,
    setCurrentSegment,
    completedIndices,
    snapToClauseStart,
    playCurrentClause,
  ]);

  const handleNextUnitSequential = useCallback(() => {
    if (savingRecording || recordingActiveRef.current) return;
    if (currentIndex >= clauseRegions.length - 1) return;
    const next = currentIndex + 1;
    setResetMedia(true);
    setCurrentIndex(next);
    setCurrentSegment(clauseRegions[next], next);
    setCurrentClausePlayed(false);
    setPhase(
      completedIndices.has(next)
        ? 'recorded'
        : ('readyToRecord' as CarefulSpeechPhase)
    );
    setShowRecorder(true);
    if (completedIndices.has(next)) {
      void snapToClauseStart(next);
    } else {
      void playCurrentClause(next);
    }
  }, [
    savingRecording,
    currentIndex,
    clauseRegions,
    setCurrentSegment,
    completedIndices,
    snapToClauseStart,
    playCurrentClause,
  ]);

  const handleStartRecording = useCallback(() => {
    setRecordingPassStarted(true);
    recordingPassStartedRef.current = true;
    setHeardIndices([]);
    setShowRecorder(true);
    setCombineUndo(null);
    const next = firstIncompleteClauseIndex(clauseRegions, completedIndices);
    if (next >= clauseRegions.length) {
      setCurrentIndex(0);
      setCurrentSegment(clauseRegions[0], 0);
      setCurrentClausePlayed(true);
      setPhase('recorded');
      void snapToClauseStart(0);
      applyColors();
      return;
    }
    setCurrentIndex(next);
    const region = clauseRegions[next];
    setCurrentSegment(region, next);
    setCurrentClausePlayed(false);
    setPhase('readyToRecord');
    setHighlightPlayButton(false);
    void playCurrentClause(next);
  }, [
    clauseRegions,
    completedIndices,
    setCurrentSegment,
    playCurrentClause,
    snapToClauseStart,
    applyColors,
  ]);

  const handleNextClause = useCallback(async () => {
    if (savingRecording) return;
    const effectiveCompleted = new Set(completedIndices);
    effectiveCompleted.add(currentIndex);
    const next = firstIncompleteClauseIndex(clauseRegions, effectiveCompleted);
    if (next >= clauseRegions.length) {
      setCurrentClausePlayed(true);
      setPhase('recorded');
      applyColors();
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
    applyColors,
    savingRecording,
  ]);

  const afterUploadCb = useCallback(
    async (mediaId: string | undefined) => {
      // Color green immediately; rowData/forceRefresh often lag the upload
      // (TT-7552). Only on a real upload though — a terminal failure still calls
      // us, with no mediaId, and painting that green tells the user their take
      // was stored when it was not (TT-7583).
      if (mediaId) {
        optimisticCompletedRef.current.add(currentIndexRef.current);
      } else {
        optimisticCompletedRef.current.delete(currentIndexRef.current);
      }
      // Stays 'recorded' either way: the take still exists, it just is not
      // stored. That keeps Record disabled and the clear button available, so
      // discarding the take is the deliberate way back to recording (TT-7583).
      setPhase('recorded');
      savingRecordingRef.current = false;
      setSavingRecording(false);
      forceRefresh();
      setResetMedia(false);
      applyColors();
    },
    [forceRefresh, applyColors]
  );

  const handleClearRecording = useCallback(async () => {
    // Deleting the take retires the failed save with it, so the message and the
    // latch must both go (TT-7583).
    saveRejectedRef.current = false;
    setSaveRejected(false);
    // A take whose upload failed has no mediafile to remove, but it is still
    // sitting unsaved in the recorder — discarding it is the whole point of the
    // button in that state, so only the removal is conditional (TT-7583).
    const mediaId = recordingRow?.mediafile?.id;
    if (mediaId) {
      await memory.update((t) =>
        t.removeRecord({ type: 'mediafile', id: mediaId })
      );
      forceRefresh();
      if (stepComplete(currentstep)) {
        await setStepComplete(currentstep, false);
      }
    }
    optimisticCompletedRef.current.delete(currentIndexRef.current);
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

  if (config.requireBoldWorkflow && !isBoldWorkflow) {
    return <StepMessage message={workflowGateMessage ?? ''} />;
  }

  if (!config.requireBoldWorkflow && !stepLanguageBcp47) {
    return (
      <StepMessage
        message={
          controlStrings.noStepLanguage ??
          'Configure a language for this Phrase Back Translation step in Step Editor before recording.'
        }
      />
    );
  }

  if (!mediafileId) {
    return <StepMessage message={ts.noAudio} />;
  }

  return (
    <Box
      id={config.containerId}
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
          key={`${config.containerId}-player-${mediafileId}`}
          width={width}
          allowSegment={config.namedRegion}
          hideSegmentControls={!config.showPlayerSegmentControls}
          hideSegmentReset={
            config.showSegmentResetInRecordingPass
              ? !recordingPassStarted
              : true
          }
          suggestedSegments={suggestedSegmentsForPlayer}
          verses={verseSegString}
          forceRegionOnly={true}
          allowAutoSegment={false}
          autoPlayOnSegmentLocate={false}
          playing={playerPlaying}
          setPlayingOverride={setPlayerPlayingBoth}
          defaultSegParams={phraseSegParams}
          onSegment={handleSegment}
          onClearSegments={handleClearSegments}
          resetDisabled={
            config.showSegmentResetInRecordingPass
              ? !recordingPassStarted ||
                (baselineSeg !== null &&
                  regionBoundariesEqual(baselineSeg, clauseSegString) &&
                  !hasAnyOutputRecordings)
              : undefined
          }
          hasSegmentUndo={
            config.multiLevelSegmentUndo ? segmentUndoCan : undefined
          }
          onSegmentUndo={
            config.multiLevelSegmentUndo
              ? () => void handleSegmentUndo()
              : undefined
          }
          controlsRef={playerControlsRef}
          applyRegionColor={applyRegionColor}
          onSegmentPlaybackEnd={onSegmentPlaybackEnd}
          highlightPlay={highlightPlayButton}
          onPlayStatusNotify={handlePlayStatusNotify}
          beforePlay={handleBeforeSourcePlay}
          lockSegmentSelection={phase === 'recording' || savingRecording}
          allowZoom={true}
        />
      )}
      {bootstrapped && (
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
          showUndoCombine={
            combineUndo !== null && !config.multiLevelSegmentUndo
          }
          onStartRecording={handleStartRecording}
          onNextClause={() => void handleNextClause()}
          onClearRecording={() => void handleClearRecording()}
          allClausesHeard={allClausesHeard}
          allClausesComplete={allClausesComplete}
          highlightSpeaker={highlightSpeaker}
          allowRecord={allowRecord && editStep}
          savingRecording={savingRecording}
          onSaving={() => {
            savingRecordingRef.current = true;
            setSavingRecording(true);
          }}
          onSaveSettled={() => {
            savingRecordingRef.current = false;
            setSavingRecording(false);
          }}
          toolId={toolId}
          passageId={related(playerMediafile, 'passage') ?? passage?.id}
          artifactId={artifactTypeId}
          sourceMediaId={mediafileId}
          sourceSegments={JSON.stringify(currentRegion ?? {})}
          languagebcp47={stepLanguageField}
          defaultFilename={defaultFilename}
          recordingMediaId={recordingRow?.mediafile?.id}
          afterUploadCb={afterUploadCb}
          onRecording={(active) => {
            if (active) {
              recordingActiveRef.current = true;
              // A new take supersedes any earlier rejected save (TT-7583).
              saveRejectedRef.current = false;
              setSaveRejected(false);
              // TT-7552: a deliberate take cancels the post-park overshoot swallow
              // so tapping the next segment is treated as real navigation.
              pendingOvershootSwallowRef.current = false;
              setRecording(true);
              setPhase('recording');
              return;
            }
            const wasRecording = recordingActiveRef.current;
            recordingActiveRef.current = false;
            setRecording(false);
            if (!showRecorder) return;
            if (!wasRecording) {
              savingRecordingRef.current = false;
              setSavingRecording(false);
              return;
            }
            setPhase('recorded');
          }}
          resetMedia={resetMedia}
          setResetMedia={setResetMedia}
          setCanSave={setCanSave}
          onSaveRejected={() => {
            saveRejectedRef.current = true;
            setSaveRejected(true);
            savingRecordingRef.current = false;
            setSavingRecording(false);
            // Upload failures route through afterUploadCb('') as well, but
            // MediaRecord's save-requested-with-no-audio branch only lands here,
            // so undo the optimistic green from this path too (TT-7583).
            optimisticCompletedRef.current.delete(currentIndexRef.current);
            applyColors();
          }}
          setStatusText={setStatusText}
          showRecorder={showRecorder}
          strings={controlStrings}
          showBoundaryTools={config.showBoundaryTools && editStep}
          readOnly={!editStep}
          controlIdPrefix={config.containerId}
          sequentialUnitNavAroundRecord={config.sequentialUnitNavAroundRecord}
          onPrevUnit={handlePrevUnit}
          onNextUnitSequential={handleNextUnitSequential}
          canPrevUnit={currentIndex > 0}
          canNextUnit={currentIndex < clauseRegions.length - 1}
        />
      )}
      {saveRejected ? (
        <Alert
          severity="error"
          variant="filled"
          sx={{ alignSelf: 'center', alignItems: 'center', m: 2 }}
          action={
            <Button
              id={`${config.containerId}-retry-save`}
              color="inherit"
              size="small"
              disabled={savingRecording}
              onClick={handleRetrySave}
            >
              {tm.pendingUploadRetryOne}
            </Button>
          }
        >
          {tt.uploadFailed}
        </Alert>
      ) : (
        statusText && (
          <Typography variant="caption" align="center">
            {statusText}
          </Typography>
        )
      )}
      {resetConfirmText && (
        <Confirm
          text={resetConfirmText}
          yesResponse={() => {
            setResetConfirmText(null);
            void performStepBaselineReset();
          }}
          noResponse={() => setResetConfirmText(null)}
        />
      )}
    </Box>
  );
}

export default PassageDetailGuidedPhraseRecord;
