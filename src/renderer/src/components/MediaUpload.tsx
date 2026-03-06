import { shallowEqual, useSelector } from 'react-redux';
import { IMediaUploadStrings } from '../model';
import { mediaUploadSelector } from '../selector';
import { API_CONFIG } from '../../api-variable';
import BigDialog from '../hoc/BigDialog';
import { BigDialogBp } from '../hoc/BigDialogBp';
import MediaUploadContent from './MediaUploadContent';
import { FaithBridge } from '../assets/brands';
import { UploadType } from './UploadType';

export const UriLinkType = 'text/uri-list';
export const MarkDownType = 'text/markdown';
export const Mp3Type = 'audio/mpeg';
export const FaithbridgeType = 'audio/mpeg/s3link';

const PROJECTRESOURCE_SIZELIMIT = 50;
const NO_SIZELIMIT = 10000;

export const SIZELIMIT = (uploadType: UploadType) => {
  switch (uploadType) {
    case UploadType.ProjectResource:
      return PROJECTRESOURCE_SIZELIMIT;
    case UploadType.ITF:
    case UploadType.PTF:
    case UploadType.FaithbridgeLink:
      return NO_SIZELIMIT;
    default:
      return parseInt(API_CONFIG.sizeLimit);
  }
};
interface IProps {
  visible: boolean;
  onVisible: (v: boolean) => void;
  uploadType: UploadType;
  uploadMethod?: ((files: File[]) => void) | undefined;
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
}

function MediaUpload(props: IProps) {
  const {
    visible,
    onVisible,
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
  } = props;
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
      bp={BigDialogBp.sm}
    >
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
      />
    </BigDialog>
  );
}

export default MediaUpload;
