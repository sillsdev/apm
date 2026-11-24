import { useCallback, useRef, useState } from 'react';
import { asrStatesEqual, type IAsrState } from '../../../business/asr/asrState';

/**
 * Force a new ASR task when the language/settings dialog changes the choice.
 * Snapshot settings when that dialog opens; compare on close. Clear when the
 * progress dialog closes or a non-forced run starts.
 */
export function useAsrForceRun(asrSettings: IAsrState | undefined) {
  const asrAtOpenRef = useRef<IAsrState | undefined>(undefined);
  const [forceAsr, setForceAsr] = useState(false);

  const snapshotAsrAtOpen = useCallback(() => {
    asrAtOpenRef.current = asrSettings;
  }, [asrSettings]);

  const applyForceFromClosedAsr = useCallback((asr: IAsrState | undefined) => {
    setForceAsr(!asrStatesEqual(asr, asrAtOpenRef.current));
  }, []);

  const clearForceAsr = useCallback(() => setForceAsr(false), []);

  return {
    forceAsr,
    setForceAsr,
    clearForceAsr,
    snapshotAsrAtOpen,
    applyForceFromClosedAsr,
  };
}
