import { useGlobal } from '../../../context/useGlobal';
import CompleteIcon from '@mui/icons-material/CheckBox';
import NotCompleteIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import { IPassageDetailStepCompleteStrings } from '../../../model';
import { passageDetailStepCompleteSelector } from '../../../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { useStepPermissions } from '../../../utils/useStepPermission';
import { isLinkedNote } from '../../../crud/isLinkedNote';
import { useToggleStepComplete } from '../useToggleStepComplete';
import { Button } from '../../../control/Button';

export default function MobileStepComplete() {
  const {
    currentstep,
    section,
    recording,
    isBoldWorkflow,
    passage,
    sharedResource,
  } = usePassageDetailContext();
  const { canDoSectionStep } = useStepPermissions();
  const { complete, toggleComplete } = useToggleStepComplete();
  const [busy] = useGlobal('remoteBusy');
  const [importexportBusy] = useGlobal('importexportBusy');
  const t: IPassageDetailStepCompleteStrings = useSelector(
    passageDetailStepCompleteSelector,
    shallowEqual
  );

  const hasPermission =
    canDoSectionStep(currentstep, section) &&
    !isLinkedNote(passage, sharedResource);
  if (isBoldWorkflow) return null;

  return (
    <Button
      id="mobile-complete"
      title={t.title}
      variant="outlined"
      startIcon={
        complete ? (
          <CompleteIcon id="step-yes" />
        ) : (
          <NotCompleteIcon id="step-no" />
        )
      }
      disabled={!hasPermission || recording || busy || importexportBusy}
      onClick={toggleComplete}
    >
      {t.title}
    </Button>
  );
}
