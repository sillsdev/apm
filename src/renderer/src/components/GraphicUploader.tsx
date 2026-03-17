import { shallowEqual, useSelector } from 'react-redux';
import { restoreScroll } from '../utils';
import MediaUpload from './MediaUpload';
import { UploadType } from './UploadType';
import { sharedSelector } from '../selector';
import { ISharedStrings } from '../model';
import MediaUploadContent, {
  MediaUploadControlsRef,
} from './MediaUploadContent';
import { CompressedImages, useCompression } from '../utils/useCompression';

// Converting to/from Blob: https://stackoverflow.com/questions/68276368/javascript-convert-a-blob-object-to-a-string-and-back
// https://stackoverflow.com/questions/18650168/convert-blob-to-base64

interface IProps {
  defaultFilename?: string;
  dimension: number[];
  isOpen?: boolean;
  onOpen: (visible: boolean) => void;
  showMessage: (msg: string | React.JSX.Element) => void;
  hasRights?: boolean; // required for upload
  finish?: (images: CompressedImages[]) => void; // when conversion complete
  cancelled: React.RefObject<boolean>;
  uploadType?: UploadType;
  metadata?: React.JSX.Element;
  onFiles?: (files: File[]) => void;
  mediaUploadControlsRef?: React.RefObject<MediaUploadControlsRef>;
  onSaveDisabled?: ((disabled: boolean) => void) | undefined;
}

export function GraphicUploader(props: IProps) {
  const {
    defaultFilename,
    dimension,
    isOpen,
    onOpen,
    showMessage,
    cancelled,
    uploadType,
    hasRights,
    finish,
    metadata,
    onFiles,
    onSaveDisabled,
  } = props;
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const { showFile, uploadMedia } = useCompression({
    onFiles,
    showMessage,
    dimension,
    defaultFilename,
    finish,
    onOpen,
  });

  const uploadCancel = () => {
    onOpen?.(false);
    // eslint-disable-next-line react-hooks/immutability
    if (cancelled) cancelled.current = true;
    restoreScroll();
  };

  return isOpen ? (
    <MediaUpload
      visible={isOpen}
      onVisible={onOpen}
      uploadType={uploadType || UploadType.Media}
      ready={() => Boolean(hasRights)}
      uploadMethod={uploadMedia}
      cancelMethod={uploadCancel}
      cancelLabel={ts.close}
      metaData={metadata}
      onFiles={showFile}
    />
  ) : (
    <MediaUploadContent
      onVisible={onOpen}
      uploadType={uploadType || UploadType.Media}
      uploadMethod={uploadMedia}
      cancelMethod={uploadCancel}
      cancelLabel={ts.close}
      metaData={metadata}
      ready={() => Boolean(hasRights)}
      onFiles={showFile}
      controlsRef={props.mediaUploadControlsRef}
      onSaveDisabled={onSaveDisabled}
    />
  );
}
