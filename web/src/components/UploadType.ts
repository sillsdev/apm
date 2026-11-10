export enum UploadType {
  Media = 0,
  Resource = 1,
  ITF = 2,
  PTF = 3,
  LOGO = 4 /* do we need separate ones for org and avatar? */,
  ProjectResource = 5,
  IntellectualProperty = 6,
  Graphic = 7,
  Link = 8,
  MarkDown = 9,
  FaithbridgeLink = 10,
  Burrito = 11,
  PdfResource = 12,
}

/**
 * Upload types that are pure links/text, not an uploaded file: they skip the
 * file drop target, UPLOAD_LIST, and versioning. Shared so the hook and the
 * upload/resource UIs stay in agreement.
 */
export const NO_LIST_TYPES = [
  UploadType.Link,
  UploadType.MarkDown,
  UploadType.FaithbridgeLink,
];
