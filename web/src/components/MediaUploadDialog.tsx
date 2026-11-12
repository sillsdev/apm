import { shallowEqual, useSelector } from 'react-redux';
import { IMediaUploadStrings } from '../model';
import { mediaUploadSelector } from '../selector';
import BigDialog from '../hoc/BigDialog';
import { BigDialogBp } from '../hoc/BigDialogBp';
import MediaUploadContent from './MediaUploadContent';
import { useMobile } from '../utils';
import { FaithBridge } from '../assets/brands';
import { UploadType } from './UploadType';

interface IProps {
  isOpen: boolean;
  onClose: () => void;
  uploadType: UploadType;
  uploadMethod?:
    ((files: File[]) => void | boolean | Promise<void | boolean>) | undefined;
  multiple?: boolean | undefined;
  cancelMethod?: (() => void) | undefined;
  speaker?: string | undefined;
  onSpeaker?: ((speaker: string) => void) | undefined;
  audioOnly?: boolean | undefined;
}

function MediaUploadDialog(props: IProps) {
  const {
    isOpen,
    onClose,
    uploadType,
    multiple,
    uploadMethod,
    cancelMethod,
    speaker,
    onSpeaker,
    audioOnly,
  } = props;
  const { isMobile } = useMobile();
  const t: IMediaUploadStrings = useSelector(mediaUploadSelector, shallowEqual);
  const title = [
    t.title,
    t.resourceTitle,
    t.ITFtitle,
    t.PTFtitle,
    'FUTURE TODO',
    t.resourceTitle,
    t.intellectualPropertyTitle,
    t.graphicTitle,
    t.linkTitle,
    t.markdownTitle,
    t.faithbridgeTitle.replace('{0}', FaithBridge),
    '', // Burrito
    t.pdfResourceTitle,
  ];
  const handleCancel = () => {
    if (cancelMethod) {
      cancelMethod();
    }
    onClose();
  };

  return (
    <BigDialog
      isOpen={isOpen}
      onOpen={handleCancel}
      title={title[uploadType] ?? ''}
      bp={isMobile ? BigDialogBp.mobile : BigDialogBp.sm}
    >
      <>
        <MediaUploadContent
          onClose={onClose}
          uploadType={uploadType}
          multiple={multiple}
          uploadMethod={uploadMethod}
          cancelMethod={cancelMethod}
          speaker={speaker}
          onSpeaker={onSpeaker}
          audioOnly={audioOnly}
        />
      </>
    </BigDialog>
  );
}

export default MediaUploadDialog;
