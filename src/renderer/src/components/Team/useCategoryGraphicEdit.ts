import { useCallback, useRef, useState } from 'react';
import { GraphicD } from '../../model';
import { CompressedImages } from '../../utils/useCompression';
import { useGraphicCreate } from '../../crud/useGraphicCreate';
import { useGraphicUpdate } from '../../crud/useGraphicUpdate';
import { saveGraphicRecord } from '../useGraphicPicker';

export type PendingCategoryGraphic = {
  images: CompressedImages[];
  rights: string;
};

type GraphicSaveDeps = {
  graphicRec?: GraphicD;
  resourceType: string;
  resourceId: number;
  graphicCreate: ReturnType<typeof useGraphicCreate>;
  graphicUpdate: ReturnType<typeof useGraphicUpdate>;
  showMessage: (msg: string) => void;
  saving: string;
  uploadSuccess: string;
};

/**
 * Stages category graphic changes until Apply. Cancel discards without
 * writing to Orbit (TT-7627 / Copilot: cancel must not keep picker saves).
 */
export function useCategoryGraphicEdit(deps: GraphicSaveDeps) {
  const [pending, setPending] = useState<PendingCategoryGraphic | null>(null);
  const pendingRef = useRef<PendingCategoryGraphic | null>(null);
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const stage = useCallback((images: CompressedImages[], rights: string) => {
    const next = { images, rights };
    pendingRef.current = next;
    setPending(next);
  }, []);

  const discard = useCallback(() => {
    pendingRef.current = null;
    setPending(null);
  }, []);

  const flush = useCallback(async () => {
    const staged = pendingRef.current;
    if (!staged) return undefined;
    pendingRef.current = null;
    setPending(null);
    const d = depsRef.current;
    return saveGraphicRecord({
      images: staged.images,
      rights: staged.rights,
      graphicRec: d.graphicRec,
      resourceType: d.resourceType,
      resourceId: d.resourceId,
      graphicCreate: d.graphicCreate,
      graphicUpdate: d.graphicUpdate,
      showMessage: d.showMessage,
      saving: d.saving,
      uploadSuccess: d.uploadSuccess,
    });
  }, []);

  return { pending, stage, flush, discard };
}
