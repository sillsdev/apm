import { API_CONFIG } from '../../api-variable';
import { UploadType } from '../components/UploadType';

const PROJECTRESOURCE_SIZELIMIT = 50;
const NO_SIZELIMIT = 10000;

export const typeLimit = (uploadType: UploadType) => {
  switch (uploadType) {
    case UploadType.ProjectResource:
      return PROJECTRESOURCE_SIZELIMIT;
    case UploadType.ITF:
    case UploadType.PTF:
    case UploadType.FaithbridgeLink:
      return NO_SIZELIMIT;
    default:
      return parseInt(API_CONFIG.sizeLimit);
  }
};
