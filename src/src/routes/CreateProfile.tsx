import { ProfileDialog } from '../components/ProfileDialog';
import { useMyNavigate } from '../utils';

export function CreateProfile() {
  const navigate = useMyNavigate();
  return (
    <ProfileDialog
      mode="create"
      open={true}
      finishAdd={() => navigate('/team')}
      onCancel={() => navigate('/logout')}
      onSaveCompleted={() => navigate('/team')}
    />
  );
}
export default CreateProfile;
