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
 *
 * Replace is kept per recording: the transcriber stays mounted while the
 * selected recording changes, and one recording's forced run must not
 * replace (or stop replacing) another's result.
 */
export function useAsrForceRun(
  asrSettings: IAsrState | undefined,
  mediaId = ''
) {
  const asrAtOpenRef = useRef<IAsrState | undefined>(undefined);
  const [forceAsr, setForceAsr] = useState(false);
  const [replaceIds, setReplaceIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const replaceAsr = replaceIds.has(mediaId);

  const snapshotAsrAtOpen = useCallback(() => {
    asrAtOpenRef.current = asrSettings;
  }, [asrSettings]);

  const applyForceFromClosedAsr = useCallback(
    (asr: IAsrState | undefined) => {
      const changed = !asrStatesEqual(asr, asrAtOpenRef.current);
      setForceAsr(changed);
      // Unchanged settings resume a forced task still pending, which replaces.
      if (changed)
        setReplaceIds((ids) =>
          ids.has(mediaId) ? ids : new Set(ids).add(mediaId)
        );
    },
    [mediaId]
  );

  const clearForceAsr = useCallback(() => setForceAsr(false), []);
  const clearReplaceAsr = useCallback(
    () =>
      setReplaceIds((ids) => {
        if (!ids.has(mediaId)) return ids;
        const next = new Set(ids);
        next.delete(mediaId);
        return next;
      }),
    [mediaId]
  );

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
