import { useCallback, useContext, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import Memory from '@orbit/memory';
import { MediaFileD } from '../../../model';
import { UnsavedContext } from '../../../context/UnsavedContext';
import { saveMediaTranscription } from '../../../crud/saveMediaTranscription';

interface Options {
  toolId: string;
  mediafile: MediaFileD | undefined;
  text: string;
  memory: Memory;
  user: string;
  enabled?: boolean;
  debounceMs?: number;
  onSaved?: (transcription: string) => void;
  /** Set true only when the user edits the textarea (not programmatic loads). */
  userEditedRef?: MutableRefObject<boolean>;
}

export function useTranscriptionAutosave({
  toolId,
  mediafile,
  text,
  memory,
  user,
  enabled = true,
  debounceMs = 500,
  onSaved,
  userEditedRef,
}: Options) {
  const { toolChanged, saveCompleted, startSave } =
    useContext(UnsavedContext).state;
  const savedTextRef = useRef('');
  const mediaIdRef = useRef<string | undefined>(undefined);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const savingRef = useRef(false);

  const clearDebounce = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    if (mediafile?.id !== mediaIdRef.current) {
      clearDebounce();
      mediaIdRef.current = mediafile?.id;
      savedTextRef.current = mediafile?.attributes?.transcription ?? '';
      if (userEditedRef) userEditedRef.current = false;
    }
  }, [mediafile, clearDebounce, userEditedRef]);

  const flushSave = useCallback(async () => {
    if (!enabled || !mediafile || savingRef.current) return;
    if (text === savedTextRef.current) return;
    if (
      text === '' &&
      savedTextRef.current !== '' &&
      userEditedRef &&
      !userEditedRef.current
    ) {
      return;
    }
    savingRef.current = true;
    startSave(toolId);
    try {
      await saveMediaTranscription(memory, mediafile, text, user);
      savedTextRef.current = text;
      saveCompleted(toolId);
      if (userEditedRef) userEditedRef.current = false;
      onSaved?.(text);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      saveCompleted(toolId, message);
    } finally {
      savingRef.current = false;
    }
  }, [
    enabled,
    mediafile,
    text,
    memory,
    user,
    toolId,
    startSave,
    saveCompleted,
    onSaved,
    userEditedRef,
  ]);

  useEffect(() => {
    if (!enabled) return;
    if (
      text === '' &&
      savedTextRef.current !== '' &&
      userEditedRef &&
      !userEditedRef.current
    ) {
      toolChanged(toolId, false);
      return;
    }
    toolChanged(toolId, text !== savedTextRef.current);
    clearDebounce();
    debounceRef.current = setTimeout(() => {
      void flushSave();
    }, debounceMs);
    return clearDebounce;
  }, [
    text,
    enabled,
    toolId,
    toolChanged,
    debounceMs,
    flushSave,
    clearDebounce,
    userEditedRef,
  ]);

  return { flushSave, savedTextRef };
}
