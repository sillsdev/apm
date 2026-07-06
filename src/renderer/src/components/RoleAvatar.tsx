import { ISharedStrings, RoleD } from '../model';
import { Avatar } from '@mui/material';
import { makeAbbr } from '../utils';
import { useAvatarSource } from '../crud';
import { localizeRole } from '../utils';
import { avatarSize } from '../control';
import { useSelector } from 'react-redux';
import { sharedSelector } from '../selector';

interface IProps {
  roleRec: RoleD;
}

export function RoleAvatar(props: IProps) {
  const { roleRec } = props;
  const ts: ISharedStrings = useSelector(sharedSelector);
  const source = useAvatarSource(roleRec.attributes.roleName, roleRec);

  return source ? (
    <Avatar
      alt={roleRec.attributes.roleName}
      src={source}
      sx={avatarSize()}
    />
  ) : roleRec.attributes && roleRec.attributes.roleName !== '' ? (
    <Avatar sx={avatarSize()}>
      {makeAbbr(localizeRole(roleRec.attributes.roleName, ts))}
    </Avatar>
  ) : (
    <></>
  );
}

export default RoleAvatar;
