// Describing the shape of the upload's slice of state
export interface IUploadState {
  current: number;
  loaded: boolean;
  files: File[];
  errmsg: string;
  success: boolean[];
}

export const uploadCleanState = {
  current: -1,
  loaded: false,
  files: [] as File[],
  success: [] as boolean[],
  errmsg: '',
} as IUploadState;

// Describing the different ACTION NAMES available
export const UPLOAD_LIST = 'UPLOAD_LIST';
export const UPLOAD_ITEM_PENDING = 'UPLOAD_ITEM_PENDING';
export const UPLOAD_ITEM_CREATED = 'UPLOAD_ITEM_CREATED';
export const UPLOAD_ITEM_SUCCEEDED = 'UPLOAD_ITEM_SUCCEEDED';
export const UPLOAD_ITEM_FAILED = 'UPLOAD_ITEM_FAILED';
export const UPLOAD_COMPLETE = 'UPLOAD_COMPLETE';

interface UploadMsg {
  type: typeof UPLOAD_LIST;
  payload: File[];
}

interface UploadPendingMsg {
  type: typeof UPLOAD_ITEM_PENDING;
  payload: number;
}

interface UploadSucceededMsg {
  type: typeof UPLOAD_ITEM_SUCCEEDED;
  payload: number;
}

interface UploadFailedMsg {
  type: typeof UPLOAD_ITEM_FAILED;
  payload: { current: number; mediaid: number; error: string };
}

interface UploadCompleteMsg {
  type: typeof UPLOAD_COMPLETE;
}

export type UploadMsgs =
  | UploadMsg
  | UploadPendingMsg
  | UploadSucceededMsg
  | UploadFailedMsg
  | UploadCompleteMsg;

export interface MediaUpload {
  data: {
    id?: number;
    type: 'mediafiles';
    attributes: {
      'version-number': number;
      'original-file': string;
      'content-type': string;
      'eaf-url': string | null;
      'date-created': string;
      'source-segments': string;
      'performed-by': string | null;
      topic: string;
      transcription: string | null;
    };
    relationships: {
      'last-modified-by-user': {
        data: {
          type: 'users';
          id: string | null;
        };
      };
      passage?: {
        data: {
          type: 'passages';
          id: string;
        };
      };
      plan?: {
        data: {
          type: 'plans';
          id: string;
        };
      };
      'artifact-type'?: {
        data: {
          type: 'artifacttypes';
          id: string;
        };
      };
      'source-media'?: {
        data: {
          type: 'mediafiles';
          id: string;
        };
      };
      'recordedby-user'?: {
        data: {
          type: 'users';
          id: string;
        };
      };
    };
  };
}
