import { Alert, Link, Stack, Typography } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import BigDialog from '../../../hoc/BigDialog';
import { BigDialogBp } from '../../../hoc/BigDialogBp';
import {
  canonicalLanguage,
  ReferenceText,
} from '../../../business/referenceText/referenceText';
import { ReferenceTextRole } from '../../../business/referenceText/useReferenceTextPassage';
import {
  IPassageDetailArtifactsStrings,
  ISharedStrings,
  IVProjectStrings,
  PassageD,
} from '../../../model';
import {
  passageDetailArtifactsSelector,
  sharedSelector,
  vProjectSelector,
} from '../../../selector';
import { usePassageRef } from './usePassageRef';
import { useReferenceTextLabels } from './useReferenceTextLabels';

interface IProps {
  role: ReferenceTextRole;
  referenceText: ReferenceText;
  text: string;
  passage: PassageD;
  mobile?: boolean;
  /** Why the text is shown instead of spoken, when Play opened it. */
  notice?: 'noVoice' | 'speakFailed';
  onClose: () => void;
}

/** A Reference Text's passage to read, with its license for attribution. */
export function ReferenceTextDialog({
  role,
  referenceText,
  text,
  passage,
  mobile,
  notice,
  onClose,
}: Readonly<IProps>) {
  const t: IVProjectStrings = useSelector(vProjectSelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const ta: IPassageDetailArtifactsStrings = useSelector(
    passageDetailArtifactsSelector,
    shallowEqual
  );
  const labels = useReferenceTextLabels(referenceText, role);
  const { passageRef } = usePassageRef();
  const license = referenceText.license || t.licenseNotStated;

  return (
    <BigDialog
      title={`${labels.bible} — ${passageRef(passage) ?? ''}`}
      isOpen
      onOpen={onClose}
      {...(mobile
        ? {
            bp: BigDialogBp.mobile,
            titleVariant: 'h6',
            showTopCloseButton: false,
            showBottomCloseButton: true,
            bottomCloseLabel: ts.close,
            mobileThickScrollbar: true,
            mobileNoHorizontalScroll: true,
          }
        : { bp: BigDialogBp.sm })}
    >
      <Stack spacing={2}>
        {notice && (
          <Alert severity="info">
            {notice === 'noVoice'
              ? ta.referenceTextNoVoice.replace('{0}', labels.language)
              : ta.referenceTextSpeakFailed}
          </Alert>
        )}
        <Typography
          dir={referenceText.textDirection}
          lang={canonicalLanguage(referenceText.language)}
          sx={{ whiteSpace: 'pre-wrap' }}
        >
          {text}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {referenceText.licenseUrl ? (
            <Link
              href={referenceText.licenseUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {license}
            </Link>
          ) : (
            license
          )}
        </Typography>
      </Stack>
    </BigDialog>
  );
}

export default ReferenceTextDialog;
