import { shallowEqual, useSelector } from 'react-redux';
import { IMediaTitleStrings } from '../model';
import { restoreScroll } from '../utils';
import { UploadType } from './UploadType';
import MediaUploadContent from './MediaUploadContent';
import { mediaTitleSelector } from '../selector';

interface IProps {
  isOpen: boolean;
  onClose: () => void;
  hasRights?: boolean; // required for upload
  cancelled: React.RefObject<boolean>;
  uploadMethod: (files: File[]) => Promise<boolean>;
  onFiles?: (files: File[]) => void;
}

export function TitleUploader(props: IProps) {
  const { isOpen, onClose, cancelled, hasRights, uploadMethod, onFiles } =
    props;
  const t: IMediaTitleStrings = useSelector(mediaTitleSelector, shallowEqual);

  const uploadCancel = () => {
    onClose();
    // eslint-disable-next-line react-hooks/immutability
    if (cancelled) cancelled.current = true;
    restoreScroll();
  };

  return isOpen ? (
    <MediaUploadContent
      onClose={onClose}
      uploadType={UploadType.Media}
      ready={Boolean(hasRights)}
      uploadMethod={uploadMethod}
      cancelMethod={uploadCancel}
      primaryButtonText={t.upload}
      onFiles={onFiles}
    />
  ) : (
    <></>
  );
}
