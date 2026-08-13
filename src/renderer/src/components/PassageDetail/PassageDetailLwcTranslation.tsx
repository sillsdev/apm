import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Box, Button } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { useGlobal } from '../../context/useGlobal';
import usePassageDetailContext from '../../context/usePassageDetailContext';
import {
  ArtifactTypeSlug,
  related,
  remoteIdGuid,
  useArtifactType,
  useStepTool,
} from '../../crud';
import { useOrbitData } from '../../hoc/useOrbitData';
import {
  ILwcTranslationStrings,
  IMediaTabStrings,
  IMediaTitleStrings,
  ISharedStrings,
  MediaFileD,
} from '../../model';
import { IRow } from '../../context/PassageDetailContext';
import { passageDefaultFilename } from '../../utils/passageDefaultFilename';
import { RecordKeyMap } from '@orbit/records';
import { useStepPermissions } from '../../utils/useStepPermission';
import {
  lwcTranslationSelector,
  mediaTabSelector,
  mediaTitleSelector,
  sharedSelector,
} from '../../selector';
import { UnsavedContext } from '../../context/UnsavedContext';
import {
  firstIncompleteClauseIndex,
  getCompletedClauseIndices,
  getRecordingForClause,
} from './carefulSpeech/carefulSpeechCompletion';
import { useLwcTranslationClauses } from './lwcTranslation/useLwcTranslationClauses';
import LwcTranslationClauseNav from './lwcTranslation/LwcTranslationClauseNav';
import LwcTranslationReferencePlayer from './lwcTranslation/LwcTranslationReferencePlayer';
import ClauseProgress from './boldClause/ClauseProgress';
import StepMessage from './boldClause/StepMessage';
import LwcTranslationControls, {
  LwcTranslationPhase,
} from './lwcTranslation/LwcTranslationControls';
import { LocalKey } from '../../utils/localUserKey';

const toolId = 'LwcTranslationTool';

interface IProps {
  width: number;
}

function getSpeakerFromRecordings(
  rowData: IRow[],
  artifactTypeId: string
): string {
  const row = rowData.find(
    (r) => related(r.mediafile, 'artifactType') === artifactTypeId
  );
  return row?.mediafile?.attributes?.performedBy ?? '';
}

export function PassageDetailLwcTranslation({ width }: IProps) {
  const t: ILwcTranslationStrings = useSelector(
    lwcTranslationSelector,
    shallowEqual
  );
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const tm: IMediaTabStrings = useSelector(mediaTabSelector, shallowEqual);
  const tt: IMediaTitleStrings = useSelector(mediaTitleSelector, shallowEqual);
  const [memory] = useGlobal('memory');
  const [plan] = useGlobal('plan');
  const [offline] = useGlobal('offline');
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const { getTypeId } = useArtifactType();
  const {
    passage,
    mediafileId,
    rowData,
    currentstep,
    section,
    forceRefresh,
    isBoldWorkflow,
    setStepComplete,
    stepComplete,
    setRecording,
  } = usePassageDetailContext();
  const { settings } = useStepTool(currentstep);
  const { canDoSectionStep } = useStepPermissions();
  const { startSave, waitForSave } = useContext(UnsavedContext).state;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<LwcTranslationPhase>('bootstrapping');
  const [speaker, setSpeaker] = useState(() => {
    const stored = localStorage.getItem(LocalKey.lwcSpeaker);
    return stored ?? '';
  });
  const [showRecorder, setShowRecorder] = useState(false);
  const [resetMedia, setResetMedia] = useState(false);
  const [canSave, setCanSave] = useState(false);
  const [savingRecording, setSavingRecording] = useState(false);
  // Mirrors saveRejectedRef for render: shows the failure message + Retry.
  const [saveRejected, setSaveRejected] = useState(false);
  const [currentClausePlayed, setCurrentClausePlayed] = useState(false);
  const [referencePlayKey, setReferencePlayKey] = useState(0);
  const [entryPositioned, setEntryPositioned] = useState(false);
  const entryPositionDoneRef = useRef(false);
  const recordingActiveRef = useRef(false);
  const [sessionCompletedIndices, setSessionCompletedIndices] = useState(
    () => new Set<number>()
  );

  const mediafile = useMemo(
    () => mediafiles.find((m) => m.id === mediafileId),
    [mediafiles, mediafileId]
  );

  const { clauseRegions, bootstrapped, hasClauses } =
    useLwcTranslationClauses(mediafile);

  const carefulSpeechTypeId = useMemo(
    () => getTypeId(ArtifactTypeSlug.CarefulSpeech) ?? '',
    [getTypeId]
  );

  const lwcArtifactTypeId = useMemo((): string => {
    const id = (settings as { artifactTypeId?: string })?.artifactTypeId;
    if (id) {
      return (
        remoteIdGuid('artifacttype', id, memory?.keyMap as RecordKeyMap) ?? id
      );
    }
    return getTypeId(ArtifactTypeSlug.PhraseBackTranslation) ?? '';
  }, [settings, memory?.keyMap, getTypeId]);

  const currentVersion = mediafile?.attributes?.versionNumber ?? 0;
  const currentRegion = clauseRegions[currentIndex];

  const carefulSpeechCompleted = useMemo(
    () =>
      getCompletedClauseIndices(
        clauseRegions,
        rowData,
        carefulSpeechTypeId,
        currentVersion
      ),
    [clauseRegions, rowData, carefulSpeechTypeId, currentVersion]
  );

  const allCarefulSpeechComplete = useMemo(
    () =>
      clauseRegions.length > 0 &&
      carefulSpeechCompleted.size >= clauseRegions.length,
    [carefulSpeechCompleted, clauseRegions]
  );

  const lwcCompletedIndices = useMemo(
    () =>
      getCompletedClauseIndices(
        clauseRegions,
        rowData,
        lwcArtifactTypeId,
        currentVersion,
        mediafileId
      ),
    [clauseRegions, rowData, lwcArtifactTypeId, currentVersion, mediafileId]
  );

  const effectiveLwcCompleted = useMemo(() => {
    const merged = new Set(lwcCompletedIndices);
    sessionCompletedIndices.forEach((index) => merged.add(index));
    return merged;
  }, [lwcCompletedIndices, sessionCompletedIndices]);

  const allClausesComplete = useMemo(
    () =>
      clauseRegions.length > 0 &&
      effectiveLwcCompleted.size >= clauseRegions.length,
    [effectiveLwcCompleted, clauseRegions]
  );

  const carefulSpeechRow = useMemo(
    () =>
      currentRegion
        ? getRecordingForClause(
            rowData,
            carefulSpeechTypeId,
            currentVersion,
            currentRegion
          )
        : undefined,
    [rowData, carefulSpeechTypeId, currentVersion, currentRegion]
  );

  const lwcRecordingRow = useMemo(
    () =>
      currentRegion
        ? getRecordingForClause(
            rowData,
            lwcArtifactTypeId,
            currentVersion,
            currentRegion,
            mediafileId
          )
        : undefined,
    [rowData, lwcArtifactTypeId, currentVersion, currentRegion, mediafileId]
  );

  const referenceMediaId = carefulSpeechRow?.mediafile?.id;
  const currentClauseRecorded =
    effectiveLwcCompleted.has(currentIndex) || phase === 'recorded';

  const editStep = useMemo(
    () => canDoSectionStep(currentstep, section),
    [canDoSectionStep, currentstep, section]
  );

  const defaultFilename = useMemo(() => {
    const postfix = `lwctranslation${currentIndex + 1}_v${currentVersion}`;
    return passageDefaultFilename(
      passage,
      plan,
      memory,
      lwcArtifactTypeId,
      offline,
      postfix
    );
  }, [
    passage,
    plan,
    memory,
    lwcArtifactTypeId,
    offline,
    currentIndex,
    currentVersion,
  ]);

  // TT-7583: this step auto-saves on every rising edge of canSave. A failed
  // upload leaves the take dirty, so canSave goes false→true again and we used
  // to retry the same doomed take forever. MediaRecord tells us the attempt was
  // rejected; hold off until the user records again. Mirrors the guard in
  // PassageDetailGuidedPhraseRecord.
  const saveRejectedRef = useRef(false);

  useEffect(() => {
    if (canSave && !saveRejectedRef.current) {
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
    setSavingRecording(true);
    startSave(toolId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    entryPositionDoneRef.current = false;
    setEntryPositioned(false);
    setCurrentIndex(0);
    setPhase('bootstrapping');
    setShowRecorder(false);
    setReferencePlayKey(0);
    setSessionCompletedIndices(new Set());
    recordingActiveRef.current = false;
    setSavingRecording(false);
    saveRejectedRef.current = false;
    setSaveRejected(false);
    setCanSave(false);
  }, [mediafileId]);

  useEffect(() => {
    const fromRecordings = getSpeakerFromRecordings(rowData, lwcArtifactTypeId);
    if (fromRecordings) {
      setSpeaker(fromRecordings);
    }
  }, [rowData, lwcArtifactTypeId]);

  useEffect(() => {
    if (speaker) {
      localStorage.setItem(LocalKey.lwcSpeaker, speaker);
    }
  }, [speaker]);

  useEffect(() => {
    if (!bootstrapped || !allCarefulSpeechComplete || !hasClauses) return;

    const syncStepComplete = async () => {
      const isComplete = stepComplete(currentstep);
      if (allClausesComplete) {
        // handleRecording counts the clause the moment recording stops, so this
        // can be true before the upload lands. Marking the step complete now
        // would race the rejection rollback that undoes it (TT-7583) — wait for
        // the save to settle and let the effect re-run.
        if (savingRecording) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    allClausesComplete,
    bootstrapped,
    allCarefulSpeechComplete,
    hasClauses,
    currentstep,
    // so the deferred check above re-runs once the save settles
    savingRecording,
  ]);

  const positionOnClause = useCallback(
    (
      index: number,
      options?: { autoPlay?: boolean; hasRecording?: boolean }
    ) => {
      const region = clauseRegions[index];
      if (!region) return;
      setCurrentIndex(index);
      const recorded =
        options?.hasRecording ?? effectiveLwcCompleted.has(index);
      if (recorded) {
        setShowRecorder(true);
        setCurrentClausePlayed(true);
        setPhase('recorded');
        setReferencePlayKey(0);
        return;
      }
      setShowRecorder(false);
      setCurrentClausePlayed(false);
      if (options?.autoPlay) {
        setPhase('playing');
        setReferencePlayKey((k) => k + 1);
      } else {
        setPhase('recordReady');
        setReferencePlayKey(0);
      }
    },
    [clauseRegions, effectiveLwcCompleted]
  );

  useEffect(() => {
    if (
      !bootstrapped ||
      !allCarefulSpeechComplete ||
      !hasClauses ||
      entryPositionDoneRef.current
    ) {
      return;
    }
    entryPositionDoneRef.current = true;

    const firstIdx = firstIncompleteClauseIndex(
      clauseRegions,
      effectiveLwcCompleted
    );
    if (firstIdx >= clauseRegions.length) {
      positionOnClause(0, { hasRecording: true });
    } else {
      positionOnClause(firstIdx, { autoPlay: true });
    }
    setEntryPositioned(true);
  }, [
    bootstrapped,
    allCarefulSpeechComplete,
    hasClauses,
    clauseRegions,
    effectiveLwcCompleted,
    positionOnClause,
  ]);

  const handleReferencePlaybackComplete = useCallback(() => {
    if (currentClauseRecorded) return;
    setReferencePlayKey(0);
    setShowRecorder(true);
    setCurrentClausePlayed(true);
    setPhase('recordReady');
  }, [currentClauseRecorded]);

  const handlePrevClause = useCallback(() => {
    if (phase === 'recording' || savingRecording) return;
    const prev = Math.max(0, currentIndex - 1);
    const recorded = effectiveLwcCompleted.has(prev);
    positionOnClause(prev, { autoPlay: !recorded, hasRecording: recorded });
  }, [
    currentIndex,
    effectiveLwcCompleted,
    phase,
    savingRecording,
    positionOnClause,
  ]);

  const handleNextClauseArrow = useCallback(() => {
    if (phase === 'recording' || savingRecording) return;
    const next = Math.min(clauseRegions.length - 1, currentIndex + 1);
    const recorded = effectiveLwcCompleted.has(next);
    positionOnClause(next, { autoPlay: !recorded, hasRecording: recorded });
  }, [
    currentIndex,
    clauseRegions.length,
    effectiveLwcCompleted,
    phase,
    savingRecording,
    positionOnClause,
  ]);

  const handleNextClause = useCallback(async () => {
    if (savingRecording) return;
    const effectiveCompleted = new Set(effectiveLwcCompleted);
    effectiveCompleted.add(currentIndex);
    const next = firstIncompleteClauseIndex(clauseRegions, effectiveCompleted);
    if (next >= clauseRegions.length) {
      setCurrentClausePlayed(true);
      setPhase('recorded');
      return;
    }
    setResetMedia(true);
    positionOnClause(next, { autoPlay: true });
  }, [
    savingRecording,
    effectiveLwcCompleted,
    currentIndex,
    clauseRegions,
    positionOnClause,
  ]);

  const afterUploadCb = useCallback(
    async (mediaId: string | undefined) => {
      setSavingRecording(false);
      // A terminal failure still calls us, with no mediaId. Counting the clause
      // as done there would show it complete — and mark the whole step complete
      // — for audio that was never stored (TT-7583).
      setSessionCompletedIndices((prev) => {
        const next = new Set(prev);
        if (mediaId) next.add(currentIndex);
        else next.delete(currentIndex);
        return next;
      });
      forceRefresh();
      // Stays 'recorded' either way: the take still exists, it just is not
      // stored. That keeps Record disabled and the clear button available, so
      // discarding the take is the deliberate way back to recording (TT-7583).
      setPhase('recorded');
      setResetMedia(false);
    },
    [forceRefresh, currentIndex]
  );

  const handleClearRecording = useCallback(async () => {
    // Deleting the take retires the failed save with it, so the message and the
    // latch must both go (TT-7583).
    saveRejectedRef.current = false;
    setSaveRejected(false);
    const mediaId = lwcRecordingRow?.mediafile?.id;
    if (mediaId) {
      await memory.update((t) =>
        t.removeRecord({ type: 'mediafile', id: mediaId })
      );
      forceRefresh();
    }
    setSessionCompletedIndices((prev) => {
      const next = new Set(prev);
      next.delete(currentIndex);
      return next;
    });
    if (stepComplete(currentstep)) {
      await setStepComplete(currentstep, false);
    }
    setPhase('recordReady');
    setCurrentClausePlayed(true);
    setResetMedia(true);
  }, [
    lwcRecordingRow,
    memory,
    forceRefresh,
    stepComplete,
    currentstep,
    setStepComplete,
    currentIndex,
  ]);

  const handleRecording = useCallback(
    (active: boolean) => {
      if (active) {
        recordingActiveRef.current = true;
        // A new take supersedes any earlier rejected save (TT-7583).
        saveRejectedRef.current = false;
        setSaveRejected(false);
        setRecording(true);
        setPhase('recording');
        return;
      }
      const wasRecording = recordingActiveRef.current;
      recordingActiveRef.current = false;
      setRecording(false);
      if (!showRecorder) return;
      if (!wasRecording) {
        setSavingRecording(false);
        return;
      }
      setSessionCompletedIndices((prev) => {
        const next = new Set(prev);
        next.add(currentIndex);
        return next;
      });
      setPhase('recorded');
    },
    [setRecording, showRecorder, currentIndex]
  );

  const allowRecord =
    showRecorder &&
    currentClausePlayed &&
    (phase === 'recordReady' || phase === 'recording') &&
    !currentClauseRecorded;

  const highlightSpeaker = showRecorder && !speaker.trim();
  const navigationDisabled = phase === 'recording' || savingRecording;

  if (!isBoldWorkflow) {
    return <StepMessage message={t.boldOnly} />;
  }

  if (!mediafileId) {
    return <StepMessage message={ts.noAudio} />;
  }

  if (!bootstrapped || !hasClauses) {
    return <StepMessage message={t.noClauses} />;
  }

  if (!allCarefulSpeechComplete) {
    return <StepMessage message={t.prerequisite} />;
  }

  return (
    <Box
      id="lwc-translation"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        width: '100%',
      }}
    >
      <Box sx={{ position: 'relative', width: '100%' }}>
        <LwcTranslationReferencePlayer
          referenceMediaId={referenceMediaId}
          playKey={referencePlayKey}
          onPlaybackComplete={handleReferencePlaybackComplete}
        />
        {entryPositioned && (
          <ClauseProgress
            completedCount={effectiveLwcCompleted.size}
            totalClauses={clauseRegions.length}
            progressLabel={t.progress}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 1,
              pointerEvents: 'none',
            }}
          />
        )}
      </Box>
      {entryPositioned && (
        <LwcTranslationClauseNav
          currentIndex={currentIndex}
          totalClauses={clauseRegions.length}
          currentClauseRecorded={currentClauseRecorded}
          navigationDisabled={navigationDisabled}
          onPrev={handlePrevClause}
          onNext={handleNextClauseArrow}
        />
      )}
      {editStep && entryPositioned && (
        <LwcTranslationControls
          width={width}
          phase={phase}
          speaker={speaker}
          onSpeakerChange={setSpeaker}
          onNextClause={() => void handleNextClause()}
          onClearRecording={() => void handleClearRecording()}
          allClausesComplete={allClausesComplete}
          highlightSpeaker={highlightSpeaker}
          allowRecord={allowRecord}
          savingRecording={savingRecording}
          onSaving={() => setSavingRecording(true)}
          onSaveSettled={() => setSavingRecording(false)}
          toolId={toolId}
          passageId={related(mediafile, 'passage') ?? passage?.id}
          artifactId={lwcArtifactTypeId}
          sourceMediaId={mediafileId}
          sourceSegments={JSON.stringify(currentRegion ?? {})}
          defaultFilename={defaultFilename}
          recordingMediaId={lwcRecordingRow?.mediafile?.id}
          afterUploadCb={afterUploadCb}
          onRecording={handleRecording}
          resetMedia={resetMedia}
          setResetMedia={setResetMedia}
          setCanSave={setCanSave}
          onSaveRejected={() => {
            saveRejectedRef.current = true;
            setSaveRejected(true);
            setSavingRecording(false);
            // handleRecording already counted this clause as done when recording
            // stopped. Upload failures route through afterUploadCb('') as well,
            // but MediaRecord's save-requested-with-no-audio branch only lands
            // here, so undo it from this path too (TT-7583).
            setSessionCompletedIndices((prev) => {
              const next = new Set(prev);
              next.delete(currentIndex);
              return next;
            });
          }}
          setStatusText={() => {}}
          showRecorder={showRecorder}
        />
      )}
      {saveRejected && (
        <Alert
          severity="error"
          variant="filled"
          sx={{ alignSelf: 'center', alignItems: 'center', m: 2 }}
          action={
            <Button
              id="lwc-translation-retry-save"
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
      )}
    </Box>
  );
}

export default PassageDetailLwcTranslation;
