import { API_CONFIG } from '../../api-variable';
import { UploadType } from './UploadType';

const PROJECTRESOURCE_SIZELIMIT = 50;
const NO_SIZELIMIT = 10000;

export const SIZELIMIT = (uploadType: UploadType) => {
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

/** Split files by client-side size limit (MB). Used by MediaUploadContent.checkSizes. */
export const filterFilesBySizeLimit = (
  files: File[],
  sizeLimitMb: number
): { accepted: File[]; rejected: File[] } => {
  const maxBytes = sizeLimitMb * 1000000;
  const accepted: File[] = [];
  const rejected: File[] = [];
  for (const file of files) {
    if (file.size <= maxBytes) {
      accepted.push(file);
    } else {
      rejected.push(file);
    }
  }
  return { accepted, rejected };
};
