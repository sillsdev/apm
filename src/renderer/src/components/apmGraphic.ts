import { GraphicD } from '../model';
import {
  ApmDim,
  CompressedImages,
  IGraphicInfo,
  Rights,
} from './GraphicUploader';

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
    return {
      graphicUri: (info[apmDimStr] as CompressedImages).content,
      graphicRights: info[Rights] as string | undefined,
      url: url,
    };
  }
  return undefined;
};
