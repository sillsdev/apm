import { ProfileDialog } from '../components/ProfileDialog';
import { useMyNavigate } from '../utils';
import { homeRoute } from '../utils/routePaths';

export function CreateProfile() {
  const navigate = useMyNavigate();
  return (
    <ProfileDialog
      mode="create"
      open={true}
      finishAdd={() => navigate(homeRoute())}
      onCancel={() => navigate('/logout')}
      onSaveCompleted={() => navigate(homeRoute())}
    />
  );
}
export default CreateProfile;
