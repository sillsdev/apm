import { Tab, Tabs } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { IUserListModeStrings } from '../model';
import { userListModeSelector } from '../selector';
import { ListMode } from './ListMode';

interface IProps {
  mode: ListMode;
  onMode: (mode: ListMode) => void;
  loggedIn: boolean;
  allowOffline: boolean;
}

export function UserListMode(props: IProps) {
  const { mode, onMode, loggedIn, allowOffline } = props;
  const t: IUserListModeStrings = useSelector(
    userListModeSelector,
    shallowEqual
  );

  if (!allowOffline && !loggedIn) return null;

  return (
    <Tabs
      value={mode}
      onChange={(_event, value: ListMode) => onMode(value)}
      indicatorColor="primary"
      textColor="primary"
    >
      <Tab
        id="switchUserMode"
        value={ListMode.SwitchUser}
        label={t.switchUser}
      />
      {allowOffline && (
        <Tab
          id="workOfflineMode"
          value={ListMode.WorkOffline}
          label={t.workOffline}
        />
      )}
      {loggedIn && (
        <Tab id="logOutMode" value={ListMode.LogOut} label={t.logOut} />
      )}
    </Tabs>
  );
}

export default UserListMode;
