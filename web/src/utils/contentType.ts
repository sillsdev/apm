import path from 'path-browserify';
import { MediaFile } from '../model';

// Content-type literals, kept in this import-light leaf so the hook
// (crud/useMediaUpload), the dialog (MediaUploadDialog) and the Internalization
// components can share them without pulling in the dialog's redux/router graph.
export const UriLinkType = 'text/uri-list';
export const MarkDownType = 'text/markdown';
export const Mp3Type = 'audio/mpeg';
export const FaithbridgeType = 'audio/mpeg/s3link';

/**
 * TODO cleanup: a Faithbridge link is not a file — it's a URL plus a
 * transcript smuggled through a synthetic `File`. Instead of abusing File
 * maybe we should switch to using something like
 * type UploadItem =
  | { kind: 'file'; file: File }
  | { kind: 'link'; url: string; transcription: string; contentType: string };
 */

/**
 * A Faithbridge/Aquifer audio resource travels as a single `url||transcript`
 * string (packed in AddResourceWizard). Split it into the S3 link — which
 * becomes the mediafile's originalFile — and the transcript. */
export const splitFaithbridgeValue = (
  value: string
): { url: string; transcription: string } => {
  const [url = '', transcription = ''] = value.split('||');
  return { url, transcription };
};

const extToContentType = (extension: string): string => {
  if (extension.startsWith('.')) extension = extension.substring(1);
  switch (extension) {
    case 'pdf':
      return 'application/pdf';
    case 'wav':
      return 'audio/wav';
    case 'm4a':
      return 'audio/m4a';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'ogg':
      return 'audio/ogg';
    case 'mp3':
      return 'audio/mpeg';
    case 'png':
      return 'image/png';
    default:
      return ''; // Default content type for unknown extensions
  }
};

export const getContentType = (
  contenttype: string | undefined,
  filename: string | undefined
): string => {
  return contenttype || extToContentType(path.extname(filename ?? ''));
};

export const mediaContentType = (mf: MediaFile | undefined): string => {
  if (!mf?.attributes) return '';
  return getContentType(mf.attributes.contentType, mf.attributes.originalFile);
};
