import { useEffect, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { IMediaUploadStrings, IPassageDetailArtifactsStrings } from '../model';
import { mediaUploadSelector, resourceSelector } from '../selector';
import BigDialog from '../hoc/BigDialog';
import { BigDialogBp } from '../hoc/BigDialogBp';
import MediaUploadContent from './MediaUploadContent';
import { useMobile } from '../utils';
import { FaithBridge } from '../assets/brands';
import { UploadType } from './UploadType';
import Confirm from './AlertDialog';

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
  /** When set, always prompt to confirm before discarding on close (X/backdrop). */
  confirmOnClose?: boolean | undefined;
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
    confirmOnClose,
  } = props;
  const { isMobile } = useMobile();
  const t: IMediaUploadStrings = useSelector(mediaUploadSelector, shallowEqual);
  const rt: IPassageDetailArtifactsStrings = useSelector(
    resourceSelector,
    shallowEqual
  );
  const [showConfirm, setShowConfirm] = useState(false);
  // The dialog stays mounted across open/close, so a discard prompt left showing
  // when `visible` flips off externally would reappear over the next upload.
  // Clear it whenever the dialog is hidden.
  useEffect(() => {
    if (!visible) setShowConfirm(false);
  }, [visible]);
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
  const doCancel = () => {
    if (cancelMethod) {
      cancelMethod();
    }
    onVisible(false);
  };
  // The BigDialog X routes here; always confirm before discarding this step.
  const handleCancel = () => {
    if (confirmOnClose) {
      setShowConfirm(true);
      return;
    }
    doCancel();
  };

  return (
    <BigDialog
      isOpen={visible}
      onClose={handleCancel}
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
        />
        {showConfirm && (
          <Confirm
            title={rt.confirmCloseTitle}
            text={rt.confirmClose}
            no={rt.keepOpen}
            primaryButton="no"
            yes={rt.discardAndClose}
            noResponse={() => setShowConfirm(false)}
            yesResponse={() => {
              setShowConfirm(false);
              doCancel();
            }}
          />
        )}
      </>
    </BigDialog>
  );
}

export default MediaUpload;
