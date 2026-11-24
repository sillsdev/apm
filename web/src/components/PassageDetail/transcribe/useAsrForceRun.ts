import { useCallback, useRef, useState } from 'react';
import { asrStatesEqual, type IAsrState } from '../../../business/asr/asrState';

/**
 * Force a new ASR task when the language/settings dialog changes the choice.
 * Snapshot settings when that dialog opens; compare on close. Clear when the
 * progress dialog closes or a non-forced run starts.
 *
 * `replaceAsr` outlives `forceAsr` (TT-7856): closing the progress dialog
 * leaves the forced task running, and reopening it resumes that task without
 * forcing, but its result must still replace the earlier transcription. The
 * caller clears it when a run starts with no task to resume.
 */
export function useAsrForceRun(asrSettings: IAsrState | undefined) {
  const asrAtOpenRef = useRef<IAsrState | undefined>(undefined);
  const [forceAsr, setForceAsr] = useState(false);
  const [replaceAsr, setReplaceAsr] = useState(false);

  const snapshotAsrAtOpen = useCallback(() => {
    asrAtOpenRef.current = asrSettings;
  }, [asrSettings]);

  const applyForceFromClosedAsr = useCallback((asr: IAsrState | undefined) => {
    const changed = !asrStatesEqual(asr, asrAtOpenRef.current);
    setForceAsr(changed);
    // Unchanged settings resume a forced task still pending, which replaces.
    setReplaceAsr((pending) => changed || pending);
  }, []);

  const clearForceAsr = useCallback(() => setForceAsr(false), []);
  const clearReplaceAsr = useCallback(() => setReplaceAsr(false), []);

  return {
    forceAsr,
    setForceAsr,
    clearForceAsr,
    replaceAsr,
    clearReplaceAsr,
    snapshotAsrAtOpen,
    applyForceFromClosedAsr,
  };
}
