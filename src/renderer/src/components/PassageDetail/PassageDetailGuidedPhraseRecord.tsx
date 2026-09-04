import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Box, Typography } from '@mui/material';
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
import { Button } from '../../control/Button';

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

/**
 * Slack added to the span a clause is expected to take, so Record is not offered
 * a frame before the audio actually runs out.
 */
const CLAUSE_PLAYBACK_MARGIN_MS = 150;

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
    /** Change token for the selected segment; see the nav effects below. */
    currentSegmentSeq,
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
  /** Last clause-play start time, used by SPURIOUS_STOP_WINDOW_MS filtering. */
  const clausePlaybackStartedAtRef = useRef(0);
  const skipBeforePlayRef = useRef(false);
  const entryPauseDoneRef = useRef(false);
  const [highlightPlayButton, setHighlightPlayButton] = useState(false);
  const [allowSourcePlayer, setAllowSourcePlayer] = useState(false);
  const [entryPositioned, setEntryPositioned] = useState(false);
  const [playerPlaying, setPlayerPlaying] = useState(false);
  /**
   * When the clause being played is expected to run out, and whether we are
   * still before it. See recordBlocked.
   */
  const [recordBlockedUntil, setRecordBlockedUntil] = useState(0);
  const [recordBlocked, setRecordBlocked] = useState(false);

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
  // Sync mirror for callbacks so boundary guards see save-start immediately,
  // even before React commits the render update (TT-7427).
  const savingRecordingRef = useRef(false);
  const [recordingPassStarted, setRecordingPassStarted] = useState(false);
  // Sync mirror for region-out callbacks so pass-branching does not read stale
  // state during render lag (TT-7360).
  const recordingPassStartedRef = useRef(false);
  /** Mirrors context recording for segment-lock checks once capture is active. */
  const recordingActiveRef = useRef(false);
  // Armed after auto-play park to ignore one spurious +1 clause jump
  // (overshoot/region-in) while still allowing real navigation (TT-7360).
  const pendingOvershootSwallowRef = useRef(false);
  /** Session-local saved indices before rowData catches up (TT-7552, TT-7666). */
  const optimisticCompletedRef = useRef<Set<number>>(new Set());
  // Render tick only: optimisticCompletedRef mutates outside React state, so
  // bump this to force recalculation of predicates/memos that consume it.
  const [optimisticVersion, setOptimisticVersion] = useState(0);
  const bumpOptimistic = useCallback(
    () => setOptimisticVersion((v) => v + 1),
    []
  );
  const addOptimistic = useCallback(
    (index: number) => {
      optimisticCompletedRef.current.add(index);
      bumpOptimistic();
    },
    [bumpOptimistic]
  );
  const removeOptimistic = useCallback(
    (index: number) => {
      if (optimisticCompletedRef.current.delete(index)) bumpOptimistic();
    },
    [bumpOptimistic]
  );
  const clearOptimistic = useCallback(() => {
    if (optimisticCompletedRef.current.size === 0) return;
    optimisticCompletedRef.current.clear();
    bumpOptimistic();
  }, [bumpOptimistic]);
  const currentIndexRef = useRef(0);
  /** Latched clause/region for the active take until save or discard (TT-7437). */
  const [recordingTarget, setRecordingTarget] = useState<
    { index: number; region: IRegion } | undefined
  >(undefined);
  // Mirror for the upload callbacks, which fire outside a render.
  const recordingTargetRef = useRef<
    { index: number; region: IRegion } | undefined
  >(undefined);
  const latchRecordingTarget = useCallback(
    (target: { index: number; region: IRegion } | undefined) => {
      recordingTargetRef.current = target;
      setRecordingTarget(target);
    },
    []
  );
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

  // TT-7437: a live mirror of clauseSegString. The waveform holds a single,
  // stale onSegment closure (see ADR 0006 / handleRegionPlayEndRef), and one
  // boundary add fires it more than once before React commits. Reading the
  // committed segmentation from that stale closure made pushSegmentUndo
  // photograph an out-of-date state, so a single Undo reverted every edit at
  // once. The undo push and the "did the boundaries change" guard read this ref
  // instead of the closure; setClauseSeg keeps it current synchronously so a
  // second fire within one gesture (and the next add) see the real value.
  const clauseSegStringRef = useRef(clauseSegString);
  clauseSegStringRef.current = clauseSegString;
  const setClauseSeg = useCallback(
    (json: string) => {
      clauseSegStringRef.current = json;
      setClauseSegString(json);
    },
    [setClauseSegString]
  );

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

  // A segment is treated as recorded (boundary locked, TT-7666) when it has a
  // saved take, or a newly saved take that rowData has not shown yet.
  // This only applies during the recording pass.
  const isSegmentRecorded = useCallback(
    (index: number) =>
      recordingPassStarted &&
      (completedIndices.has(index) ||
        optimisticCompletedRef.current.has(index)),
    // optimisticVersion makes optimistic-set changes reactive so every guard
    // that reads this predicate (drag, +/-, Split/Combine) recomputes together.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recordingPassStarted, completedIndices, optimisticVersion]
  );

  /** completedIndices plus the optimistic just-saved set — the single recorded
   *  view every boundary-editing guard uses, so they agree in the window before
   *  rowData catches up (TT-7666). */
  const recordedClauseIndicesForTools = useMemo(
    () => new Set([...completedIndices, ...optimisticCompletedRef.current]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [completedIndices, optimisticVersion]
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

  /** The clause a pending take is filed under: latched at Record if there is
   *  one, otherwise wherever the user is now. */
  const takeIndex = recordingTarget?.index ?? currentIndex;
  const takeRegion = recordingTarget?.region ?? currentRegion;

  const defaultFilename = useMemo(() => {
    const postfix = config.buildFilenamePostfix(takeIndex, currentVersion);
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
    takeIndex,
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
    if (changed) {
      bumpOptimistic();
      applyColors();
    }
  }, [completedIndices, applyColors, bumpOptimistic]);

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
    // The latch keeps a take tied to its original clause (TT-7437).
    // If upload failed and the user navigates away, that take is abandoned,
    // so clear the latch here.
    if (saveRejectedRef.current) latchRecordingTarget(undefined);
    saveRejectedRef.current = false;
    setSaveRejected(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // Compute expected playback span so Record stays disabled for the full
        // clause duration. Use rate for future speed-enabled flows.
        const rate = ctrl.getPlaybackRate?.() || 1;
        setRecordBlockedUntil(
          Date.now() +
            (Math.max(0, region.end - seek) * 1000) / rate +
            CLAUSE_PLAYBACK_MARGIN_MS
        );
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
    // Read the live segmentation, not a (possibly stale) render closure — see
    // clauseSegStringRef above (TT-7437).
    const snapshot = clauseSegStringRef.current;
    if (!hasPhraseRegions(snapshot)) return;
    // Dedupe: a single boundary add fires onSegment more than once, and each
    // fire would otherwise push the same "before" snapshot, so one Undo would
    // step past the whole gesture. Skip when the top already holds these
    // boundaries.
    const top = segmentUndoStackRef.current.peek();
    if (top !== undefined && regionBoundariesEqual(top, snapshot)) return;
    segmentUndoStackRef.current.push(snapshot);
    setSegmentUndoCan(segmentUndoStackRef.current.canUndo());
  }, [config.multiLevelSegmentUndo]);

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
        // Reset stop-filter timing at every playback start.
        clausePlaybackStartedAtRef.current = Date.now();
        // Also gate Record for user-triggered replays from current playhead.
        // Set here (not beforePlay) so playback start is not interrupted.
        const region = clauseRegions[currentIndex];
        const ctrl = playerControlsRef.current;
        if (region && ctrl) {
          const from = ctrl.getProgress?.() ?? region.start;
          const rate = ctrl.getPlaybackRate?.() || 1;
          const remainingMs = (Math.max(0, region.end - from) * 1000) / rate;
          if (remainingMs > 0) {
            setRecordBlockedUntil(
              Date.now() + remainingMs + CLAUSE_PLAYBACK_MARGIN_MS
            );
          }
        }
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
      // Ignore synthetic stop from start seek if it lands inside the spurious
      // stop window.
      if (
        Date.now() - clausePlaybackStartedAtRef.current <
        SPURIOUS_STOP_WINDOW_MS
      ) {
        return;
      }
      // Real user pause: release Record block and mark clause as heard.
      // Very-early pauses are treated like start-seek noise by design.
      setRecordBlockedUntil(0);
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
    clauseRegions,
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
    // StrictMode mount re-run can reset pass state mid-entry. Guard so reset
    // runs once per real mediafile change (TT-7360).
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
    // The latch is mediafile-specific. Clear it when source media changes,
    // so the next take cannot reuse a clause from the old waveform (TT-7437).
    latchRecordingTarget(undefined);
    clearOptimistic();
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
    // Depend only on stable mediafileId. resetForMediafile identity changes
    // during media updates and would incorrectly reset pass state (TT-7360).
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
        // All clauses recorded: enter review mode on first clause.
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
        setClauseSeg(seg);
        return;
      }
      if (recordingActiveRef.current || savingRecording) return;
      const regions = getSortedRegions(seg);
      if (regions.length === 0) return;
      // Defense-in-depth only: if an update still changes recorded boundaries,
      // reload the previous regions. Main blocking now happens earlier in
      // useWavesurferRegions (drag, split/merge, and +/- controls; TT-7666).
      if (
        recordingPassStarted &&
        !preservesRecordedBoundaries(clauseRegions, regions, completedIndices)
      ) {
        playerControlsRef.current?.loadRegionsJson?.(
          clauseSegStringRef.current
        );
        return;
      }
      const json = regionsJsonFromList(regions, phraseSegParams);
      // Compare against the live segmentation (TT-7437): a stale closure would
      // otherwise let a second fire of the same gesture through as a fresh edit.
      if (regionBoundariesEqual(json, clauseSegStringRef.current)) return;
      pushSegmentUndo();
      setClauseSeg(json);
      await persistClauseSegments(json);
      applyColors();
    },
    [
      setClauseSeg,
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
      // After auto-play park, ignore one spurious +1 region change caused by
      // overshoot or recorder mount (TT-7360).
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

  // region-out listener is registered once; route through ref to avoid stale
  // closure when recording pass changes without audio reload (ADR 0006).
  const handleRegionPlayEndRef = useRef(handleRegionPlayEnd);
  handleRegionPlayEndRef.current = handleRegionPlayEnd;
  const onSegmentPlaybackEnd = useCallback((region: IRegion) => {
    handleRegionPlayEndRef.current(region);
  }, []);

  /** User click is intentional navigation, so never treat it as overshoot. */
  const handleSegmentClick = useCallback(() => {
    pendingOvershootSwallowRef.current = false;
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

    if (pendingOvershootSwallowRef.current && idx === currentIndex + 1) {
      // Swallow one adjacent +1 change right after auto-play park. It is
      // usually overshoot/region-in noise, not user navigation (TT-7621).
      pendingOvershootSwallowRef.current = false;
      if (playerControlsRef.current?.isPlaying?.()) {
        playerControlsRef.current.setPlay(false);
      }
      setCurrentSegment(clauseRegions[currentIndex], currentIndex);
      void snapToClauseStart(currentIndex);
      return;
    }

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
    // Both deps are change signals for getCurrentSegment(). Keep
    // currentSegmentSeq for reliable move detection across index conventions,
    // and keep currentSegmentIndex for row-change resets that skip seq bumps.
  }, [
    currentSegmentIndex,
    currentSegmentSeq,
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
    // See the recording-pass effect above for why currentSegmentSeq is a dep.
  }, [
    currentSegmentIndex,
    currentSegmentSeq,
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
    setClauseSeg(baseline);
    await persistClauseSegments(baseline);
    playerControlsRef.current?.loadRegionsJson?.(baseline);
    setRecordingPassStarted(false);
    recordingPassStartedRef.current = false;
    clearOptimistic();
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
    setClauseSeg,
    persistClauseSegments,
    bumpSuppressClauseAutoPlay,
    setCurrentSegment,
    snapToClauseStart,
    stepComplete,
    currentstep,
    setStepComplete,
    forceRefresh,
    applyColors,
    clearOptimistic,
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
      !canSplitClause(
        currentIndex,
        clauseRegions,
        recordedClauseIndicesForTools,
        splitPoint
      )
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
    setClauseSeg(json);
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
    recordedClauseIndicesForTools,
    clauseSegString,
    phraseSegParams,
    setClauseSeg,
    persistClauseSegments,
    applyColors,
    setCurrentSegment,
    playCurrentClause,
    config.multiLevelSegmentUndo,
    pushSegmentUndo,
  ]);

  const handleCombineWithNext = useCallback(async () => {
    if (savingRecordingRef.current) return;
    if (
      !canCombineWithNext(
        currentIndex,
        clauseRegions,
        recordedClauseIndicesForTools
      )
    ) {
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
    setClauseSeg(json);
    await persistClauseSegments(json);
    playerControlsRef.current?.loadRegionsJson?.(json);
    applyColors();
    void playCurrentClause(currentIndex, updated[currentIndex]);
  }, [
    currentIndex,
    clauseRegions,
    recordedClauseIndicesForTools,
    clauseSegString,
    phraseSegParams,
    setClauseSeg,
    persistClauseSegments,
    applyColors,
    playCurrentClause,
    config.multiLevelSegmentUndo,
    pushSegmentUndo,
  ]);

  const handleUndoCombine = useCallback(async () => {
    if (savingRecordingRef.current) return;
    if (!combineUndo) return;
    setClauseSeg(combineUndo);
    await persistClauseSegments(combineUndo);
    playerControlsRef.current?.loadRegionsJson?.(combineUndo);
    setCombineUndo(null);
    applyColors();
    void playCurrentClause(currentIndex);
  }, [
    combineUndo,
    setClauseSeg,
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
    setClauseSeg(prev);
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
    setClauseSeg,
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
    // Play next once; region-end handler parks on it and arms overshoot swallow
    // so next+1 region-in does not auto-advance (TT-7360).
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
      // Mark optimistic completion immediately after real upload (TT-7552),
      // and always apply it to the latched recording-start clause (TT-7437).
      // No mediaId means upload failed; do not show optimistic success (TT-7583).
      const takenIndex =
        recordingTargetRef.current?.index ?? currentIndexRef.current;
      if (mediaId) {
        addOptimistic(takenIndex);
        // Stored: the take is no longer pending, so release the clause.
        latchRecordingTarget(undefined);
      } else {
        removeOptimistic(takenIndex);
        // Keep the latch on failed upload so Retry files to the same clause
        // even if selection moved (TT-7583).
      }
      // Keep 'recorded' on success or failure so user can clear/retry this take
      // instead of starting a new one accidentally (TT-7583).
      setPhase('recorded');
      savingRecordingRef.current = false;
      setSavingRecording(false);
      forceRefresh();
      setResetMedia(false);
      applyColors();
    },
    [
      forceRefresh,
      applyColors,
      latchRecordingTarget,
      addOptimistic,
      removeOptimistic,
    ]
  );

  const handleClearRecording = useCallback(async () => {
    // Clearing the take also clears failed-save state and latch (TT-7583).
    saveRejectedRef.current = false;
    setSaveRejected(false);
    // Failed uploads may have no mediafile record, but Clear still discards the
    // local take (TT-7583).
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
    removeOptimistic(
      recordingTargetRef.current?.index ?? currentIndexRef.current
    );
    // The take is gone, so the clause it was held against is released too.
    latchRecordingTarget(undefined);
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

  /**
   * Disable only the Record button until expected clause playback time expires.
   *
   * We use time-based gating because early region-out events from start seeks
   * can look like real playback end and re-enable Record too soon (ADR 0011).
   *
   * This is intentionally separate from allowRecord so recorder capability and
   * mic lifecycle state are not toggled by this temporary UI gate.
   */
  useEffect(() => {
    const remaining = recordBlockedUntil - Date.now();
    if (remaining <= 0) {
      setRecordBlocked(false);
      return;
    }
    setRecordBlocked(true);
    const timer = setTimeout(() => setRecordBlocked(false), remaining);
    return () => clearTimeout(timer);
  }, [recordBlockedUntil]);
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

  // Single source of truth for the segment-selection lock. While it is up,
  // useWavesurferRegions.handleRegionClick drops waveform clicks silently, so
  // it is mirrored onto the container: a test that clicks a segment has no
  // other way to know whether the click could be received (TT-7360 follow-up).
  const segmentSelectionLocked = phase === 'recording' || savingRecording;

  return (
    <Box
      id={config.containerId}
      data-segment-selection-locked={String(segmentSelectionLocked)}
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
          onSegmentClick={handleSegmentClick}
          highlightPlay={highlightPlayButton}
          onPlayStatusNotify={handlePlayStatusNotify}
          beforePlay={handleBeforeSourcePlay}
          lockSegmentSelection={segmentSelectionLocked}
          isSegmentRecorded={isSegmentRecorded}
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
            recordedClauseIndicesForTools,
            currentClauseSplitPoint
          )}
          canCombineWithNext={canCombineWithNext(
            currentIndex,
            clauseRegions,
            recordedClauseIndicesForTools
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
          recordBlocked={recordBlocked && phase !== 'recording'}
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
          sourceSegments={JSON.stringify(takeRegion ?? {})}
          languagebcp47={stepLanguageField}
          defaultFilename={defaultFilename}
          recordingMediaId={recordingRow?.mediafile?.id}
          afterUploadCb={afterUploadCb}
          onRecording={(active) => {
            if (active) {
              recordingActiveRef.current = true;
              // Latch the take target at record start so later selection
              // changes do not move where this take is filed (TT-7437).
              if (currentRegion) {
                latchRecordingTarget({
                  index: currentIndex,
                  region: currentRegion,
                });
              }
              // A new take supersedes any earlier rejected save (TT-7583).
              saveRejectedRef.current = false;
              setSaveRejected(false);
              // TT-7552: a deliberate take cancels the post-park overshoot swallow
              // so tapping the next segment is treated as real navigation.
              pendingOvershootSwallowRef.current = false;
              // Recording a take fixes the boundaries around it, so drop the
              // segment-edit undo history — undoing a prior split/combine after a
              // take would restore boundaries the take no longer matches (TT-7666).
              clearSegmentUndo();
              setCombineUndo(null);
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
            // Also clear optimistic green on this failure path (TT-7583).
            // Keep the latch so Retry still files to the same clause.
            removeOptimistic(
              recordingTargetRef.current?.index ?? currentIndexRef.current
            );
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
