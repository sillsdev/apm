import { UploadType } from '../../UploadType';
import { removeExtension } from '../../../utils/removeExtension';

// Keep content-type literals local so unit tests avoid MediaUpload's heavy import graph.
const UriLinkType = 'text/uri-list';
const MarkDownType = 'text/markdown';
const FaithbridgeType = 'audio/mpeg/s3link';

function isHttpUrl(value?: string): boolean {
  return /^https?:\/\//i.test((value ?? '').trim());
}

/** Faith Bridge, Audio Scripture (uri-list), UriLink, and URL originalFiles need a description. */
export function descriptionRequiredForResource(
  contentType?: string,
  uploadType?: UploadType,
  originalFile?: string
): boolean {
  // Markdown resources keep their body text in originalFile, so a body that opens
  // with a link must not be mistaken for a link-style resource (TT-6658).
  const isMarkDown =
    contentType === MarkDownType || uploadType === UploadType.MarkDown;
  if (!isMarkDown && isHttpUrl(originalFile)) {
    return true;
  }
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
  if (descriptionRequiredForResource(contentType, undefined, originalFile))
    return '';
  return removeExtension(originalFile || '').name;
}

/** Whether Save is allowed while editing a resource (description + link/markdown text). */
export function canSaveResourceEdit(opts: {
  contentType: string;
  description: string;
  text?: string;
  originalFile?: string;
  isUrl: (value: string) => boolean;
}): boolean {
  const { contentType, description, text = '', originalFile, isUrl } = opts;
  if (
    descriptionRequiredForResource(contentType, undefined, originalFile) &&
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
