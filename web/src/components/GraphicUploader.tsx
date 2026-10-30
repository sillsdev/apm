import { shallowEqual, useSelector } from 'react-redux';
import { restoreScroll } from '../utils';
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
    if (cancelled) cancelled.current = true;
    restoreScroll();
  };

  return (
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
