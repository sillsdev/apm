import { useRole } from '../../../crud/useRole';
import { useStepPermissions } from '../../../utils/useStepPermission';
import { useGlobal } from '../../../context/useGlobal';
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
  // Bold-workflow members can record the prompt when the session-only
  // "Add {Story} or Passage" flag is set (see UserMenu).
  const [addStoryOrPassage] = useGlobal('addStoryOrPassage');

  const showAdmin =
    userIsAdmin ||
    addStoryOrPassage ||
    (permissionsOn && canDoSectionStep(currentstep, section));

  if (showAdmin) {
    return <PassageDetailPromptAdmin width={props.width} />;
  }
  return <PassageDetailPromptMember width={props.width} />;
}
