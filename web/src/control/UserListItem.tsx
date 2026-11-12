import { UserD } from '../model';
import { ListItem, ListItemText, ListItemButton } from '@mui/material';
import UserAvatar from '../components/UserAvatar';
import { ListEnum, useOfflineList } from '../crud';
import { Button } from './Button';

interface IProps {
  u: UserD;
  onSelect?: (user: string) => void;
  show?: ListEnum;
}

const ItemContent = (props: IProps) => {
  const { u, show } = props;
  const list = useOfflineList();

  return (
    <Button
      variant="outlined"
      startIcon={<UserAvatar {...props} userRec={u} />}
    >
      <ListItemText
        primary={u?.attributes?.name || ''}
        secondary={show ? list(u, show) : ''}
      />
    </Button>
  );
};

export const UserListItem = (props: IProps) => {
  const { u, onSelect } = props;

  const handleSelect = (user: string) => () => {
    onSelect && onSelect(user);
  };

  return onSelect ? (
    <ListItemButton id={`user-${u.id}`} key={u.id} onClick={handleSelect(u.id)}>
      <ItemContent {...props} />
    </ListItemButton>
  ) : (
    <ListItem id={`user-${u.id}`} key={u.id}>
      <ItemContent {...props} />
    </ListItem>
  );
};
