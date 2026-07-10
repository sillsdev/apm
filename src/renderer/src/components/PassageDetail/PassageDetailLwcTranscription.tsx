import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Box } from '@mui/material';
import { RecordKeyMap } from '@orbit/records';
import { shallowEqual, useSelector } from 'react-redux';
import { useGlobal } from '../../context/useGlobal';
import usePassageDetailContext from '../../context/usePassageDetailContext';
import { remoteIdGuid, useArtifactType, useStepTool } from '../../crud';
import { useOrbitData } from '../../hoc/useOrbitData';
import {
  ICarefulTranscriptionStrings,
  ILwcTranscriptionStrings,
  MediaFileD,
} from '../../model';
import {
  carefulTranscriptionSelector,
  lwcTranscriptionSelector,
} from '../../selector';
import { UnsavedContext } from '../../context/UnsavedContext';
import {
  firstIncompleteClauseIndex,
  getCompletedClauseIndices,
} from './carefulSpeech/carefulSpeechCompletion';
import { useLwcTranslationClauses } from './lwcTranslation/useLwcTranslationClauses';
import ClauseAudioPlayer from './boldClause/ClauseAudioPlayer';
import BoldClauseNav from './boldClause/BoldClauseNav';
import ClauseProgress from './boldClause/ClauseProgress';
import StepMessage from './boldClause/StepMessage';
import BoldClauseTranscriptionEditor from './lwcTranscription/BoldClauseTranscriptionEditor';
import {
  getLwcRecordingRowForClause,
  getTranscribedClauseIndices,
} from './lwcTranscription/lwcTranscriptionCompletion';
import {
  configForRecordingArtifact,
  type BoldClauseTranscriptionConfig,
} from './boldClauseTranscription';

function parseStepSettings(settings: unknown): Record<string, unknown> | null {
  if (!settings) return null;
  if (typeof settings === 'string') {
    try {
      return JSON.parse(settings) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof settings === 'object') return settings as Record<string, unknown>;
  return null;
}

interface IProps {
  width: number;
}

type TranscriptionStrings =
  | ILwcTranscriptionStrings
  | ICarefulTranscriptionStrings;

function useTranscriptionStrings(
  layout: BoldClauseTranscriptionConfig['stringsLayout'] | undefined
): TranscriptionStrings | undefined {
  const lwc = useSelector(lwcTranscriptionSelector, shallowEqual);
  const careful = useSelector(carefulTranscriptionSelector, shallowEqual);
  if (!layout) return undefined;
  return layout === 'carefulTranscription' ? careful : lwc;
}

export function PassageDetailBoldClauseTranscription({ width }: IProps) {
  const [memory] = useGlobal('memory');
  const [user] = useGlobal('user');
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const { slugFromId, getTypeId } = useArtifactType();
  const {
    mediafileId,
    rowData,
    currentstep,
    setStepComplete,
    stepComplete,
    setRecording,
    forceRefresh,
  } = usePassageDetailContext();
  const { settings } = useStepTool(currentstep);
  const { waitForSave } = useContext(UnsavedContext).state;

  const stepSettingsParsed = useMemo(
    () => parseStepSettings(settings),
    [settings]
  );

  const artifactSlug = useMemo(() => {
    const id = stepSettingsParsed?.artifactTypeId as string | undefined;
    if (!id) return null;
    const resolved =
      remoteIdGuid('artifacttype', id, memory?.keyMap as RecordKeyMap) ?? id;
    return slugFromId(resolved);
  }, [stepSettingsParsed, memory?.keyMap, slugFromId]);

  const transcriptionConfig = useMemo(
    () => configForRecordingArtifact(artifactSlug),
    [artifactSlug]
  );

  const t = useTranscriptionStrings(transcriptionConfig?.stringsLayout);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [text, setText] = useState('');
  const [referencePlayKey, setReferencePlayKey] = useState(0);
  const [entryPositioned, setEntryPositioned] = useState(false);
  const [asrActive, setAsrActive] = useState(false);
  const [sessionTranscribedIndices, setSessionTranscribedIndices] = useState(
    () => new Set<number>()
  );
  const entryPositionDoneRef = useRef(false);
  const flushSaveRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const textLoadedForMediaRef = useRef<string | undefined>(undefined);
  const loadedTranscriptionRef = useRef<string>('');

  const mediafile = useMemo(
    () => mediafiles.find((m) => m.id === mediafileId),
    [mediafiles, mediafileId]
  );

  const { clauseRegions, bootstrapped, hasClauses } =
    useLwcTranslationClauses(mediafile);

  const recordingArtifactTypeId = useMemo((): string => {
    const id = stepSettingsParsed?.artifactTypeId as string | undefined;
    if (id) {
      return (
        remoteIdGuid('artifacttype', id, memory?.keyMap as RecordKeyMap) ?? id
      );
    }
    return transcriptionConfig?.defaultArtifactSlug
      ? (getTypeId(transcriptionConfig.defaultArtifactSlug) ?? '')
      : '';
  }, [stepSettingsParsed, memory?.keyMap, transcriptionConfig, getTypeId]);

  const currentVersion = mediafile?.attributes?.versionNumber ?? 0;
  const currentRegion = clauseRegions[currentIndex];

  const recordingsCompleted = useMemo(
    () =>
      getCompletedClauseIndices(
        clauseRegions,
        rowData,
        recordingArtifactTypeId,
        currentVersion,
        mediafileId
      ),
    [
      clauseRegions,
      rowData,
      recordingArtifactTypeId,
      currentVersion,
      mediafileId,
    ]
  );

  const allRecordingsComplete = useMemo(
    () =>
      clauseRegions.length > 0 &&
      recordingsCompleted.size >= clauseRegions.length,
    [recordingsCompleted, clauseRegions]
  );

  const transcribedIndices = useMemo(
    () =>
      getTranscribedClauseIndices(
        clauseRegions,
        rowData,
        recordingArtifactTypeId,
        currentVersion,
        mediafileId
      ),
    [
      clauseRegions,
      rowData,
      recordingArtifactTypeId,
      currentVersion,
      mediafileId,
    ]
  );

  const effectiveTranscribed = useMemo(() => {
    const merged = new Set(transcribedIndices);
    sessionTranscribedIndices.forEach((index) => merged.add(index));
    return merged;
  }, [transcribedIndices, sessionTranscribedIndices]);

  const allClausesTranscribed = useMemo(
    () =>
      clauseRegions.length > 0 &&
      effectiveTranscribed.size >= clauseRegions.length,
    [effectiveTranscribed, clauseRegions]
  );

  const recordingRow = useMemo(
    () =>
      currentRegion
        ? getLwcRecordingRowForClause(
            rowData,
            recordingArtifactTypeId,
            currentVersion,
            currentRegion,
            mediafileId
          )
        : undefined,
    [
      rowData,
      recordingArtifactTypeId,
      currentVersion,
      currentRegion,
      mediafileId,
    ]
  );

  const referenceMediaId = recordingRow?.mediafile?.id;
  const currentClauseTranscribed = effectiveTranscribed.has(currentIndex);
  const navigationDisabled = asrActive;
  const idPrefix = transcriptionConfig?.idPrefix ?? 'bold-clause-transcription';

  useEffect(() => {
    let cancelled = false;
    const runReset = async () => {
      await flushSaveRef.current?.();
      if (cancelled) return;
      entryPositionDoneRef.current = false;
      setEntryPositioned(false);
      setCurrentIndex(0);
      setReferencePlayKey(0);
      setText('');
      setSessionTranscribedIndices(new Set());
      setAsrActive(false);
      setRecording(false);
      textLoadedForMediaRef.current = undefined;
    };
    void runReset();
    return () => {
      cancelled = true;
    };
    // setRecording is stable in practice but omitted to avoid context churn loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediafileId, recordingArtifactTypeId, currentstep]);

  useEffect(() => {
    if (!bootstrapped || !allRecordingsComplete || !hasClauses) return;

    const syncStepComplete = async () => {
      const isComplete = stepComplete(currentstep);
      if (allClausesTranscribed) {
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
    allClausesTranscribed,
    bootstrapped,
    allRecordingsComplete,
    hasClauses,
    currentstep,
  ]);

  const loadTextForCurrentClause = useCallback(() => {
    const transcription = recordingRow?.mediafile?.attributes?.transcription;
    const value = typeof transcription === 'string' ? transcription : '';
    setText(value);
    textLoadedForMediaRef.current = referenceMediaId;
    loadedTranscriptionRef.current = value;
  }, [recordingRow, referenceMediaId]);

  useEffect(() => {
    if (!referenceMediaId) {
      setText('');
      textLoadedForMediaRef.current = undefined;
      loadedTranscriptionRef.current = '';
      return;
    }
    if (textLoadedForMediaRef.current !== referenceMediaId) {
      loadTextForCurrentClause();
      return;
    }
    // Same clause, but the saved transcription may have become available (or
    // changed) only after our initial read — e.g. when returning to the step
    // before rowData finished (re)loading, the first clause reads empty and
    // then the real value arrives. Refresh from the saved value, but only when
    // the user has no unsaved edits, so in-progress typing is never clobbered.
    const saved = recordingRow?.mediafile?.attributes?.transcription;
    const savedValue = typeof saved === 'string' ? saved : '';
    if (
      savedValue !== loadedTranscriptionRef.current &&
      text === loadedTranscriptionRef.current
    ) {
      loadTextForCurrentClause();
    }
  }, [referenceMediaId, recordingRow, text, loadTextForCurrentClause]);

  const positionOnClause = useCallback(
    async (
      index: number,
      options?: { autoPlay?: boolean; hasTranscription?: boolean }
    ) => {
      await flushSaveRef.current?.();
      const region = clauseRegions[index];
      if (!region) return;
      setCurrentIndex(index);
      const transcribed =
        options?.hasTranscription ?? effectiveTranscribed.has(index);
      textLoadedForMediaRef.current = undefined;
      if (transcribed) {
        setReferencePlayKey(0);
      } else if (options?.autoPlay) {
        setReferencePlayKey((k) => k + 1);
      } else {
        setReferencePlayKey(0);
      }
    },
    [clauseRegions, effectiveTranscribed]
  );

  useEffect(() => {
    if (
      !bootstrapped ||
      !allRecordingsComplete ||
      !hasClauses ||
      entryPositionDoneRef.current
    ) {
      return;
    }
    entryPositionDoneRef.current = true;

    const firstIdx = firstIncompleteClauseIndex(
      clauseRegions,
      effectiveTranscribed
    );
    const allDone = firstIdx >= clauseRegions.length;

    void (async () => {
      if (allDone) {
        await positionOnClause(0, { hasTranscription: true });
      } else {
        await positionOnClause(firstIdx, { autoPlay: true });
      }
      setEntryPositioned(true);
    })();
  }, [
    bootstrapped,
    allRecordingsComplete,
    hasClauses,
    clauseRegions,
    effectiveTranscribed,
    positionOnClause,
  ]);

  const handleTranscriptionSaved = useCallback(
    (transcription: string) => {
      const trimmed = transcription.trim();
      setSessionTranscribedIndices((prev) => {
        const next = new Set(prev);
        if (trimmed) next.add(currentIndex);
        else next.delete(currentIndex);
        return next;
      });
      if (!trimmed && stepComplete(currentstep)) {
        void setStepComplete(currentstep, false);
      }
      forceRefresh();
    },
    [currentIndex, currentstep, forceRefresh, setStepComplete, stepComplete]
  );

  const handleAsrActiveChange = useCallback(
    (active: boolean) => {
      setAsrActive(active);
      setRecording(active);
    },
    [setRecording]
  );

  const handlePrevClause = useCallback(() => {
    if (navigationDisabled) return;
    const prev = Math.max(0, currentIndex - 1);
    const transcribed = effectiveTranscribed.has(prev);
    void positionOnClause(prev, {
      autoPlay: !transcribed,
      hasTranscription: transcribed,
    });
  }, [
    currentIndex,
    effectiveTranscribed,
    navigationDisabled,
    positionOnClause,
  ]);

  const handleNextClauseArrow = useCallback(() => {
    if (navigationDisabled) return;
    const next = Math.min(clauseRegions.length - 1, currentIndex + 1);
    const transcribed = effectiveTranscribed.has(next);
    void positionOnClause(next, {
      autoPlay: !transcribed,
      hasTranscription: transcribed,
    });
  }, [
    currentIndex,
    clauseRegions.length,
    effectiveTranscribed,
    navigationDisabled,
    positionOnClause,
  ]);

  const handleNextClause = useCallback(async () => {
    if (navigationDisabled) return;
    await flushSaveRef.current?.();
    const effectiveCompleted = new Set(effectiveTranscribed);
    if (text.trim()) effectiveCompleted.add(currentIndex);
    const next = firstIncompleteClauseIndex(clauseRegions, effectiveCompleted);
    if (next >= clauseRegions.length) return;
    void positionOnClause(next, { autoPlay: true });
  }, [
    navigationDisabled,
    effectiveTranscribed,
    text,
    currentIndex,
    clauseRegions,
    positionOnClause,
  ]);

  if (!transcriptionConfig) {
    return null;
  }

  if (!t) {
    return null;
  }

  if (!hasClauses) {
    return <StepMessage message={t.noClauses} />;
  }

  if (!allRecordingsComplete) {
    return <StepMessage message={t.prerequisite} />;
  }

  return (
    <Box
      id={idPrefix}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        maxWidth: '100%',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ position: 'relative', width: '100%' }}>
        <ClauseAudioPlayer
          width={width}
          mediaId={referenceMediaId}
          playKey={referencePlayKey}
          onPlaybackComplete={() => undefined}
          playerId={`${idPrefix}-player`}
          dataCy={`${idPrefix}-player`}
          waitLabel={`${idPrefix} media url`}
        />
        {entryPositioned && (
          <ClauseProgress
            completedCount={effectiveTranscribed.size}
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
        <>
          <BoldClauseNav
            currentIndex={currentIndex}
            totalClauses={clauseRegions.length}
            currentClauseComplete={currentClauseTranscribed}
            navigationDisabled={navigationDisabled}
            onPrev={handlePrevClause}
            onNext={handleNextClauseArrow}
            strings={{ clauseIndex: t.clauseIndex }}
            dataCy={`${idPrefix}-clause-nav`}
            prevId={`${idPrefix}-clause-prev`}
            nextId={`${idPrefix}-clause-next`}
          />
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              width: '100%',
              minWidth: 0,
              maxWidth: '100%',
              overflowY: 'auto',
              overflowX: 'hidden',
              overflowWrap: 'break-word',
            }}
            data-cy={`${idPrefix}-scroll`}
          >
            <BoldClauseTranscriptionEditor
              width={width}
              mediafile={recordingRow?.mediafile}
              text={text}
              onTextChange={setText}
              memory={memory}
              user={user}
              onNextClause={handleNextClause}
              allClausesComplete={allClausesTranscribed}
              currentClauseTranscribed={currentClauseTranscribed}
              navigationDisabled={navigationDisabled}
              onAsrActiveChange={handleAsrActiveChange}
              onTranscriptionSaved={handleTranscriptionSaved}
              flushSaveRef={flushSaveRef}
              artifactTypeId={recordingArtifactTypeId}
              transcriptionConfig={transcriptionConfig}
            />
          </Box>
        </>
      )}
    </Box>
  );
}

export const PassageDetailLwcTranscription =
  PassageDetailBoldClauseTranscription;

export default PassageDetailBoldClauseTranscription;
