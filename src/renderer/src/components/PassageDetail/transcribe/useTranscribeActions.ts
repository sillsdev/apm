import { useCallback, useRef, useState } from 'react';
import {
  ActivityStates,
  MediaFile,
  MediaFileD,
  Passage,
  PassageD,
  Section,
  SectionD,
} from '../../../model';
import { RecordOperation, RecordTransformBuilder } from '@orbit/records';
import Memory from '@orbit/memory';
import {
  AddPassageStateChangeToOps,
  UpdateMediaStateOps,
} from '../../../crud/updatePassageState';
import { findRecord } from '../../../crud/tryFindRecord';
import { nextTranscriptionState } from '../../../crud/nextTranscriptionState';
import { related } from '../../../crud/related';
import { UpdateRecord, UpdateRelatedRecord } from '../../../model/baseModel';
import { currentDateTime } from '../../../utils/currentDateTime';
import { logError, Severity } from '../../../utils/logErrorService';
import { NamedRegions, updateSegments } from '../../../utils/namedSegments';

export interface UseTranscribeActionsProps {
  passage: Passage | PassageD;
  mediafile: MediaFileD | undefined;
  user: string;
  memory: Memory;
  section: Section | SectionD;
  toolId: string;
  hasChecking?: boolean;
  noParatext?: boolean;
  onReject?: (state: string) => void;
  onReopen?: () => void;
  onReloadPlayer?: (media: MediaFile) => void;
  setComplete?: (complete: boolean) => void;
  getTranscriptionText: () => string;
  getSegments?: () => string | undefined;
  getPosition?: () => number;
  setPosition?: (pos: number) => void;
  toolChanged?: (tool: string, changed?: boolean) => void;
  saveCompleted?: (tool: string, error?: string) => void;
  showMessage?: (message: string) => void;
  savingMessage?: string;
  errorReporter?: any;
}

const stateRole: { [key: string]: string } = {
  transcribing: 'transcriber',
  reviewing: 'editor',
  transcribeReady: 'transcriber',
  transcribed: 'editor',
};

const nextOnSave: { [key: string]: string } = {
  incomplete: ActivityStates.Transcribing,
  needsNewTranscription: ActivityStates.Transcribing,
  transcribeReady: ActivityStates.Transcribing,
  transcribed: ActivityStates.Reviewing,
};

const previous: { [key: string]: string } = {
  incomplete: ActivityStates.TranscribeReady,
  transcribed: ActivityStates.TranscribeReady,
  transcribing: ActivityStates.TranscribeReady,
  reviewing: ActivityStates.TranscribeReady,
  approved: ActivityStates.TranscribeReady,
  done: ActivityStates.TranscribeReady,
  synced: ActivityStates.TranscribeReady,
};

export function useTranscribeActions({
  passage,
  mediafile,
  user,
  memory,
  section,
  toolId,
  hasChecking = false,
  noParatext = false,
  onReject,
  onReopen,
  onReloadPlayer,
  setComplete,
  getTranscriptionText,
  getSegments,
  getPosition,
  setPosition,
  saveCompleted,
  showMessage,
  savingMessage = 'Saving...',
  errorReporter,
}: UseTranscribeActionsProps) {
  const [lastSaved, setLastSaved] = useState('');
  const [rejectVisible, setRejectVisible] = useState(false);
  const savingRef = useRef(false);
  const transcriptionInRef = useRef<string | undefined>(undefined);

  const state =
    mediafile?.attributes?.transcriptionstate ?? ActivityStates.TranscribeReady;
  const transcribing =
    state === ActivityStates.Transcribing ||
    state === ActivityStates.TranscribeReady;
  const reviewing =
    state === ActivityStates.Reviewing || state === ActivityStates.Transcribed;
  const canReopen = Object.prototype.hasOwnProperty.call(previous, state);

  const handleAssign = useCallback(
    async (curState: string) => {
      if (!section?.id) return;
      const secRec = findRecord(memory, 'section', section.id as string);
      const role = stateRole[curState];
      if (secRec && role) {
        const assigned = related(secRec, role);
        if (!assigned || assigned === '') {
          await memory.update(
            UpdateRelatedRecord(
              new RecordTransformBuilder(),
              section as SectionD,
              role,
              'user',
              user,
              user
            )
          );
        }
      }
    },
    [section, user, memory]
  );

  const save = useCallback(
    async (
      nextState: string,
      newPosition: number,
      segments: string | undefined,
      thiscomment: string | undefined
    ) => {
      if (!mediafile) return;
      savingRef.current = true;
      const transcription = getTranscriptionText();
      const curState = state;
      const tb = new RecordTransformBuilder();
      const ops: RecordOperation[] = [];

      if (state !== nextState || thiscomment) {
        if (typeof passage?.id === 'string') {
          AddPassageStateChangeToOps(
            tb,
            ops,
            passage.id,
            state !== nextState ? nextState : '',
            thiscomment || '',
            user,
            memory
          );
        }
      }

      ops.push(
        ...UpdateRecord(
          tb,
          {
            type: 'mediafile',
            id: mediafile.id,
            attributes: {
              ...mediafile.attributes,
              transcription,
              position: newPosition,
              segments: updateSegments(
                NamedRegions.Transcription,
                mediafile.attributes?.segments,
                segments || '{}'
              ),
              transcriptionstate: nextState,
            },
          } as MediaFileD,
          user
        )
      );

      const prevtran = transcriptionInRef.current;
      transcriptionInRef.current = transcription;
      try {
        await memory.update(ops);
        saveCompleted?.(toolId);
        setLastSaved(currentDateTime());
        savingRef.current = false;
        await handleAssign(curState);
      } catch (err: any) {
        transcriptionInRef.current = prevtran;
        saveCompleted?.(toolId, err?.message);
        savingRef.current = false;
        throw err;
      }
    },
    [
      mediafile,
      state,
      passage,
      user,
      memory,
      getTranscriptionText,
      toolId,
      saveCompleted,
      handleAssign,
    ]
  );

  const handleSave = useCallback(
    async (overrideState?: string) => {
      if (savingRef.current) {
        if (showMessage) showMessage(savingMessage);
        return;
      }
      const nextState = overrideState ?? nextOnSave[state] ?? state;
      const pos = getPosition?.() ?? 0;
      const segs = getSegments?.();
      try {
        await save(nextState, pos, segs, undefined);
      } catch {
        // save failure reported via saveCompleted
      }
    },
    [state, getPosition, getSegments, save, showMessage, savingMessage]
  );

  const handleSubmit = useCallback(async () => {
    if (savingRef.current) {
      if (showMessage) showMessage(savingMessage);
      return;
    }
    const nextState = nextTranscriptionState({
      state,
      hasChecking: Boolean(hasChecking),
      noParatext: Boolean(noParatext),
    });
    if (nextState) {
      const segs = getSegments?.();
      try {
        await save(nextState || ActivityStates.TranscribeReady, 0, segs, '');
        if (mediafile && onReloadPlayer) onReloadPlayer(mediafile);
        if (setPosition) setPosition(0);
        if (setComplete) setComplete(true);
      } catch {
        // save failure reported via saveCompleted; do not reload, reset position, or complete
      }
    } else if (errorReporter) {
      logError(Severity.error, errorReporter, `Unhandled state: ${state}`);
    }
  }, [
    state,
    hasChecking,
    noParatext,
    getSegments,
    save,
    mediafile,
    onReloadPlayer,
    setPosition,
    setComplete,
    errorReporter,
    showMessage,
    savingMessage,
  ]);

  const handleReject = useCallback(() => {
    if (savingRef.current) {
      if (showMessage) showMessage(savingMessage);
      return;
    }
    setRejectVisible(true);
  }, [showMessage, savingMessage]);

  const handleRejected = useCallback(
    async (media: MediaFile, comment: string) => {
      setRejectVisible(false);
      await memory.update(
        UpdateMediaStateOps(
          media.id as string,
          passage.id as string,
          media.attributes.transcriptionstate,
          user,
          new RecordTransformBuilder(),
          [],
          memory,
          comment
        )
      );
      setLastSaved(currentDateTime());
      if (onReject) onReject(media.attributes.transcriptionstate);
    },
    [passage.id, user, memory, onReject]
  );

  const handleRejectCancel = useCallback(() => {
    setRejectVisible(false);
  }, []);

  const doReopen = useCallback(async () => {
    if (!mediafile || !passage) return;
    if (Object.prototype.hasOwnProperty.call(previous, state)) {
      await memory.update(
        UpdateMediaStateOps(
          mediafile.id,
          passage.id as string,
          previous[state] || ActivityStates.TranscribeReady,
          user,
          new RecordTransformBuilder(),
          [],
          memory,
          ''
        )
      );
      setLastSaved(currentDateTime());
      if (setComplete) setComplete(false);
    }
  }, [mediafile, passage, state, user, memory, setComplete]);

  const handleReopen = useCallback(async () => {
    await doReopen();
    if (onReopen) onReopen();
  }, [doReopen, onReopen]);

  return {
    state,
    transcribing,
    reviewing,
    canReopen,
    lastSaved,
    setLastSaved,
    savingRef,
    rejectVisible,
    setRejectVisible,
    handleReject,
    handleRejected,
    handleRejectCancel,
    handleSave,
    handleSubmit,
    handleReopen,
    doReopen,
    save,
  };
}
