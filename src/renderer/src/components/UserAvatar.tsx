import { useGlobal } from '../context/useGlobal';
import { UserD } from '../model';
import { Avatar } from '@mui/material';
import { makeAbbr } from '../utils';
import { useAvatarSource } from '../crud';
import { avatarSize } from '../control';
import { useOrbitData } from '../hoc/useOrbitData';

interface IProps {
  userRec?: UserD;
  small?: boolean;
}

export function UserAvatar(props: IProps) {
  const { userRec, small } = props;
  const users = useOrbitData<UserD[]>('user');
  const [user] = useGlobal('user');

  const curUserRec = userRec
    ? []
    : users.filter((u) => u.id === user && u.attributes);
  const firstUser = curUserRec[0] as UserD;
  const curUser = userRec
    ? userRec
    : firstUser
      ? firstUser
      : {
          id: '',
          type: 'user',
          attributes: { avatarUrl: null, name: '', familyName: '' },
        };

  const source = useAvatarSource(curUser.attributes?.familyName || '', curUser);

  return source ? (
    <Avatar id="srcuser" alt={curUser.attributes?.name || ''} src={source} />
  ) : curUser.attributes && curUser.attributes.name !== '' ? (
    <Avatar id="abbruser" sx={avatarSize(small)}>
      {makeAbbr(curUser.attributes.name)}
    </Avatar>
  ) : (
    <></>
  );
}

export default UserAvatar;
