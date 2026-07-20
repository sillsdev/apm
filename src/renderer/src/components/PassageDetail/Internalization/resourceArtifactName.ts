import { UploadType } from '../../UploadType';
import { removeExtension } from '../../../utils/removeExtension';

// Keep content-type literals local so unit tests avoid MediaUpload's heavy import graph.
const UriLinkType = 'text/uri-list';
const MarkDownType = 'text/markdown';
const FaithbridgeType = 'audio/mpeg/s3link';

/** Faith Bridge, Audio Scripture (uri-list), and UriLink need a user-visible description. */
export function descriptionRequiredForResource(
  contentType?: string,
  uploadType?: UploadType
): boolean {
  if (
    uploadType === UploadType.Link ||
    uploadType === UploadType.FaithbridgeLink
  ) {
    return true;
  }
  return contentType === UriLinkType || contentType === FaithbridgeType;
}

/**
 * Display label for a section resource. For link-like media, never fall back to the
 * raw URL (it overlays other UI when description is cleared).
 */
export function resourceArtifactName(
  description: string | undefined | null,
  originalFile: string | undefined,
  contentType: string
): string {
  const desc = (description ?? '').trim();
  if (desc) return desc;
  if (descriptionRequiredForResource(contentType)) return '';
  return removeExtension(originalFile || '').name;
}

/** Whether Save is allowed while editing a resource (description + link/markdown text). */
export function canSaveResourceEdit(opts: {
  contentType: string;
  description: string;
  text?: string;
  isUrl: (value: string) => boolean;
}): boolean {
  const { contentType, description, text = '', isUrl } = opts;
  if (
    descriptionRequiredForResource(contentType) &&
    !(description ?? '').trim()
  ) {
    return false;
  }
  if (contentType === MarkDownType) {
    return text.trim() !== '';
  }
  if (contentType === UriLinkType) {
    return isUrl(text);
  }
  return true;
}
