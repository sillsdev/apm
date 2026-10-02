import { BigDialog } from '../hoc/BigDialog';
import { BigDialogBp } from '../hoc/BigDialogBp';
import { HTMLPage } from './HTMLPage';
import { termsContent } from '../routes/TermsContent';
import { privacyContent } from '../routes/privacyContent';
import { useMobile } from '../utils';

interface PolicyDialogProps {
  isOpen: boolean;
  content: string;
  onClose: () => void;
}

export const PolicyDialog = (props: PolicyDialogProps) => {
  const { isOpen, content, onClose } = props;
  const { isMobile } = useMobile();

  return (
    <BigDialog
      title=""
      isOpen={isOpen}
      onOpen={onClose}
      bp={isMobile ? BigDialogBp.mobile : BigDialogBp.sm}
      mobileNoHorizontalScroll
    >
      <HTMLPage text={/terms/i.test(content) ? termsContent : privacyContent} />
    </BigDialog>
  );
};

export default PolicyDialog;
