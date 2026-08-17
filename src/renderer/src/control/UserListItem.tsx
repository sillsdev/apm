import { UserD } from '../model';
import {
  Button,
  ListItem,
  ListItemIcon,
  ListItemText,
  ButtonProps,
  styled,
  ListItemButton,
} from '@mui/material';
import UserAvatar from '../components/UserAvatar';
import { ListEnum, useOfflineList } from '../crud';

const StyledButton = styled(Button)<ButtonProps>(() => ({
  '& .MuiTypography-root': {
    textTransform: 'none',
  },
}));

interface IProps {
  u: UserD;
  onSelect?: (user: string) => void;
  show?: ListEnum;
}

const ItemContent = (props: IProps) => {
  const { u, show } = props;
  const list = useOfflineList();

  return (
    <StyledButton variant="outlined">
      <ListItemIcon>
        <UserAvatar {...props} userRec={u} />
      </ListItemIcon>
      <ListItemText
        primary={u?.attributes?.name || ''}
        secondary={show ? list(u, show) : ''}
      />
    </StyledButton>
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
