import { useRole } from '../../../crud/useRole';
import { useStepPermissions } from '../../../utils/useStepPermission';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import PassageDetailPromptAdmin from './PassageDetailPromptAdmin';
import PassageDetailPromptMember from './PassageDetailPromptMember';

interface IProps {
  width: number;
}

export default function PassageDetailPrompt(props: IProps) {
  const { userIsAdmin } = useRole();
  const { canDoSectionStep, permissionsOn } = useStepPermissions();
  const { section, currentstep } = usePassageDetailContext();

  const showAdmin =
    userIsAdmin || (permissionsOn && canDoSectionStep(currentstep, section));

  if (showAdmin) {
    return <PassageDetailPromptAdmin width={props.width} />;
  }
  return <PassageDetailPromptMember width={props.width} />;
}
