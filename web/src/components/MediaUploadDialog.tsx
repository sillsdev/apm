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
  visible: boolean;
  onVisible: (v: boolean) => void;
  bp?: BigDialogBp;
  uploadType: UploadType;
  uploadMethod?:
    ((files: File[]) => void | boolean | Promise<void | boolean>) | undefined;
  multiple?: boolean | undefined;
  cancelMethod?: (() => void) | undefined;
  metaData?: React.JSX.Element | undefined;
  ready?: (() => boolean) | undefined;
  speaker?: string | undefined;
  onSpeaker?: ((speaker: string) => void) | undefined;
  team?: string | undefined; // used to check for speakers when adding a card
  onFiles?: ((files: File[]) => void) | undefined;
  inValue?: string | undefined;
  audioOnly?: boolean | undefined;
  validationMessage?: string | undefined;
  /** Hide the bottom "Cancel" button (cancel is reached via the dialog's X). */
  // I think we are moving towards using the dialog's X as the standard way to cancel instead of an explicit Cancel button.
  // hopefully in the future we can remove the explicit Cancel button entirely.
  hideCancel?: boolean | undefined;
}

function MediaUploadDialog(props: IProps) {
  const {
    visible,
    onVisible,
    bp,
    uploadType,
    multiple,
    uploadMethod,
    cancelMethod,
    metaData,
    ready,
    speaker,
    onSpeaker,
    team,
    onFiles,
    inValue,
    audioOnly,
    validationMessage,
    hideCancel,
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
          metaData={metaData}
          ready={ready}
          speaker={speaker}
          onSpeaker={onSpeaker}
          team={team}
          onFiles={onFiles}
          inValue={inValue}
          audioOnly={audioOnly}
          validationMessage={validationMessage}
          hideCancel={hideCancel}
        />
      </>
    </BigDialog>
  );
}

export default MediaUploadDialog;
