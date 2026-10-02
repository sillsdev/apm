import { shallowEqual, useSelector } from 'react-redux';
import { IMediaUploadStrings } from '../model';
import { mediaUploadSelector } from '../selector';
import BigDialog from '../hoc/BigDialog';
import { BigDialogBp } from '../hoc/BigDialogBp';
import MediaUploadContent from './MediaUploadContent';
import { useMobile } from '../utils';
import { FaithBridge } from '../assets/brands';
import { UploadType } from './UploadType';

export const UriLinkType = 'text/uri-list';
export const MarkDownType = 'text/markdown';
export const Mp3Type = 'audio/mpeg';
export const FaithbridgeType = 'audio/mpeg/s3link';

interface IProps {
  visible: boolean;
  onVisible: (v: boolean) => void;
  bp?: BigDialogBp;
  uploadType: UploadType;
  uploadMethod?:
    ((files: File[]) => void | boolean | Promise<void | boolean>) | undefined;
  multiple?: boolean | undefined;
  cancelMethod?: (() => void) | undefined;
  cancelLabel?: string | undefined;
  metaData?: React.JSX.Element | undefined;
  ready?: (() => boolean) | undefined;
  speaker?: string | undefined;
  onSpeaker?: ((speaker: string) => void) | undefined;
  team?: string | undefined; // used to check for speakers when adding a card
  onFiles?: ((files: File[]) => void) | undefined;
  inValue?: string | undefined;
  onValue?: ((value: string) => void) | undefined;
  onNonAudio?: ((nonAudio: boolean) => void) | undefined;
  audioOnly?: boolean | undefined;
  validationMessage?: string | undefined;
  /** Hide the bottom "Cancel" button (cancel is reached via the dialog's X). */
  // I think we are moving towards using the dialog's X as the standard way to cancel instead of an explicit Cancel button.
  // hopefully in the future we can remove the explicit Cancel button entirely.
  hideCancel?: boolean | undefined;
  /** Pre-select these files when the dialog opens (see MediaUploadContent). */
  initialFiles?: File[] | undefined;
  /** Keep the selection after submit instead of clearing it (see MediaUploadContent). */
  keepFilesAfterSubmit?: boolean | undefined;
}

function MediaUpload(props: IProps) {
  const {
    visible,
    onVisible,
    bp,
    uploadType,
    multiple,
    uploadMethod,
    cancelMethod,
    cancelLabel,
    metaData,
    ready,
    speaker,
    onSpeaker,
    team,
    onFiles,
    inValue,
    onValue,
    onNonAudio,
    audioOnly,
    validationMessage,
    hideCancel,
    initialFiles,
    keepFilesAfterSubmit,
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
    onVisible(false);
  };

  return (
    <BigDialog
      isOpen={visible}
      onOpen={handleCancel}
      title={title[uploadType] ?? ''}
      bp={isMobile ? BigDialogBp.mobile : (bp ?? BigDialogBp.sm)}
    >
      <>
        <MediaUploadContent
          onVisible={onVisible}
          uploadType={uploadType}
          multiple={multiple}
          uploadMethod={uploadMethod}
          cancelMethod={cancelMethod}
          cancelLabel={cancelLabel}
          metaData={metaData}
          ready={ready}
          speaker={speaker}
          onSpeaker={onSpeaker}
          team={team}
          onFiles={onFiles}
          inValue={inValue}
          onValue={onValue}
          onNonAudio={onNonAudio}
          audioOnly={audioOnly}
          validationMessage={validationMessage}
          hideCancel={hideCancel}
          initialFiles={initialFiles}
          keepFilesAfterSubmit={keepFilesAfterSubmit}
        />
      </>
    </BigDialog>
  );
}

export default MediaUpload;
