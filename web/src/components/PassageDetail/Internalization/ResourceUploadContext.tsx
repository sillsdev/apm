import { createContext, useContext, type RefObject } from 'react';
import type { MediaUploadControlsRef } from '../../MediaUploadContent';
import type { UploadType } from '../../UploadType';
import type { PendingRestoreInput } from '../../../store/upload/pendingMediaUploads';

export interface IDeferredUpload {
  onNext: () => void;
  // for the wizard to trigger the real upload later
  controlsRef: RefObject<MediaUploadControlsRef>;
}

/**
 * What the add-resource wizard's Upload step (ResourceUploadStep and its
 * ResourceRecordPanel) needs from the wizard.
 */
export interface IResourceUploadContext {
  // step state
  active: boolean; // the Upload step is the visible step
  isAddingAudioResource: boolean; // shows a Record option as well as upload
  onStartRecording?: (() => void) | undefined;
  // upload identity
  uploadType: UploadType;
  artifactId: string | null; // null = VernacularTag
  defaultFilename: string;
  eafUrl?: string | undefined;
  inValue?: string | undefined;
  // speaker
  speaker?: string | undefined;
  onSpeaker?: ((speaker: string) => void) | undefined;
  // form gating
  ready?: boolean | undefined; // false disables the save/upload button
  validationMessage?: string | undefined;
  onFiles?: ((files: File[]) => void) | undefined;
  metaData?: React.JSX.Element | undefined;
  // upload lifecycle
  finish?: ((mediaRemoteIds?: string[]) => void | Promise<void>) | undefined;
  beforeUpload?: (() => Promise<void>) | undefined;
  cancelled: RefObject<boolean>;
  pendingRestore?: PendingRestoreInput | undefined;
  // for the general-resource flow, which defers uploading the media until the next step
  deferred?: IDeferredUpload | undefined;
}

export const ResourceUploadContext =
  createContext<IResourceUploadContext | null>(null);

export function useResourceUploadContext(): IResourceUploadContext {
  const ctx = useContext(ResourceUploadContext);
  if (!ctx) {
    throw new Error(
      'useResourceUploadContext must be used inside a ResourceUploadContext provider'
    );
  }
  return ctx;
}
