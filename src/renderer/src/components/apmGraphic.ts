import { GraphicD } from '../model';
import {
  ApmDim,
  CompressedImages,
  IGraphicInfo,
  Rights,
} from '../utils/useCompression';
import { isUsableGraphicUrl } from './isUsableGraphicUrl';

const FullSize = 1024;

export const apmGraphic = (graphicRec: GraphicD) => {
  const apmDimStr = `${ApmDim}`;
  const fullSizeStr = `${FullSize}`;
  const info: IGraphicInfo = JSON.parse(graphicRec.attributes.info);
  let url = '';
  if (Object.hasOwn(info, fullSizeStr)) {
    url = (info[fullSizeStr] as CompressedImages).content;
  }
  if (Object.hasOwn(info, apmDimStr)) {
    const graphicUri = (info[apmDimStr] as CompressedImages).content;
    return {
      graphicUri: isUsableGraphicUrl(graphicUri) ? graphicUri : undefined,
      graphicRights: info[Rights] as string | undefined,
      url: isUsableGraphicUrl(url) ? url : '',
    };
  }
  return undefined;
};
