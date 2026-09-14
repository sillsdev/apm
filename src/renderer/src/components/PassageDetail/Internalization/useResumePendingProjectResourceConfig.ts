import { useEffect, MutableRefObject } from 'react';
import Memory from '@orbit/memory';
import { findRecord } from '../../../crud/tryFindRecord';
import { MediaFileD } from '../../../model';
import {
  loadPendingProjectResourceConfigs,
  removePendingProjectResourceConfigs,
} from '../../../store/upload/pendingProjectResourceConfig';

/**
 * After Home Retry restores a general resource, reopen the configure flow the
 * same way afterUpload does via setProjResSetup (desktop + mobile).
 */
export function useResumePendingProjectResourceConfig({
  memory,
  mediafiles,
  setProjResSetup,
  isAddingAudioResourceRef,
}: {
  memory: Memory;
  mediafiles: MediaFileD[];
  setProjResSetup: (medias: MediaFileD[]) => void;
  isAddingAudioResourceRef: MutableRefObject<boolean>;
}): void {
  useEffect(() => {
    const pendingIds = loadPendingProjectResourceConfigs();
    if (!pendingIds.length) return;

    const ready = pendingIds
      .map(
        (id) => findRecord(memory, 'mediafile', id) as MediaFileD | undefined
      )
      .filter((m): m is MediaFileD => Boolean(m));

    if (!ready.length) return;

    removePendingProjectResourceConfigs(ready.map((m) => m.id));
    isAddingAudioResourceRef.current = true;
    setProjResSetup(ready);
    // mediafiles: re-run after Orbit pull from pending retry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediafiles]);
}
