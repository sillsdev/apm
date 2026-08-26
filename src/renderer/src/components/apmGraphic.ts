import { GraphicD } from '../model';
import {
  ApmDim,
  CompressedImages,
  IGraphicInfo,
  Rights,
} from '../utils/useCompression';
import { graphicImageUrl } from './isUsableGraphicUrl';

const FullSize = 1024;

export const apmGraphic = (graphicRec: GraphicD) => {
  const apmDimStr = `${ApmDim}`;
  const fullSizeStr = `${FullSize}`;
  const info: IGraphicInfo = JSON.parse(graphicRec.attributes.info);
  const hasThumb = Object.hasOwn(info, apmDimStr);
  const hasFull = Object.hasOwn(info, fullSizeStr);
  if (!hasThumb && !hasFull) return undefined;
  return {
    graphicUri: graphicImageUrl(
      info[apmDimStr] as CompressedImages | string | undefined
    ),
    graphicRights: info[Rights] as string | undefined,
    url: graphicImageUrl(
      info[fullSizeStr] as CompressedImages | string | undefined
    ),
  };
};
