import { useRef, useState } from 'react';
import { GraphicD } from '../model';
import {
  ApmDim,
  CompressedImages,
  IGraphicInfo,
  Rights,
} from '../utils/useCompression';
import { useSnackBar } from '../hoc/SnackBar';
import { useGraphicCreate } from '../crud/useGraphicCreate';
import { useGraphicUpdate } from '../crud/useGraphicUpdate';

export const GRAPHIC_DIMENSIONS = [1024, 512, ApmDim];

export async function saveGraphicRecord({
  images,
  rights,
  graphicRec,
  resourceType,
  resourceId,
  graphicCreate,
  graphicUpdate,
  showMessage,
  saving,
  uploadSuccess,
}: {
  images: CompressedImages[];
  rights: string;
  graphicRec?: GraphicD;
  resourceType: string;
  resourceId: number;
  graphicCreate: ReturnType<typeof useGraphicCreate>;
  graphicUpdate: ReturnType<typeof useGraphicUpdate>;
  showMessage: (msg: string) => void;
  saving: string;
  uploadSuccess: string;
}): Promise<GraphicD | undefined> {
  const curData = JSON.parse(
    graphicRec?.attributes?.info || '{}'
  ) as IGraphicInfo;
  let rec = graphicRec;
  if (curData[Rights] !== rights || images.length > 0) {
    showMessage(saving);
    const infoData: IGraphicInfo = { ...curData, [Rights]: rights };
    images.forEach((image) => {
      infoData[image.dimension.toString()] = image;
    });
    const info = JSON.stringify(infoData);
    if (graphicRec) {
      rec = (await graphicUpdate({
        ...graphicRec,
        attributes: { ...graphicRec.attributes, info },
      })) as GraphicD;
    } else if (images.length > 0) {
      rec = await graphicCreate({ resourceType, resourceId, info });
    }
    if (images.length > 0) showMessage(uploadSuccess);
    return rec;
  }
  return undefined;
}

export function useGraphicPicker(
  save: (images: CompressedImages[], rights: string) => Promise<unknown>
) {
  const { showMessage } = useSnackBar();
  const saveRef = useRef(save);
  saveRef.current = save;
  const [isOpen, setIsOpen] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [currentRights, setCurrentRightsx] = useState('');
  const currentRightsRef = useRef('');
  const setCurrentRights = (value: string) => {
    setCurrentRightsx(value);
    currentRightsRef.current = value;
  };
  const cancelled = useRef(false);
  const uploadCompleted = useRef(false);

  const open = (seed?: { url?: string; rights?: string }) => {
    cancelled.current = false;
    uploadCompleted.current = false;
    setCurrentUrl(seed?.url ?? '');
    setCurrentRights(seed?.rights ?? '');
    setIsOpen(true);
  };

  const onSelectedRights = (rights?: string | null) => {
    setCurrentRights(rights ?? '');
  };

  const finish = (images: CompressedImages[]) => {
    if (images.length > 0) uploadCompleted.current = true;
    return saveRef.current(images, currentRightsRef.current);
  };

  const onOpen = (visible: boolean) => {
    if (!visible) {
      if (uploadCompleted.current || cancelled.current) {
        setIsOpen(false);
      } else {
        saveRef
          .current([], currentRightsRef.current)
          .catch(() => undefined)
          .finally(() => setIsOpen(false));
      }
    } else {
      setIsOpen(true);
    }
  };

  return {
    showMessage,
    dimension: GRAPHIC_DIMENSIONS,
    isOpen,
    currentUrl,
    currentRights,
    setCurrentUrl,
    setCurrentRights,
    cancelled,
    open,
    onSelectedRights,
    finish,
    onOpen,
  };
}
