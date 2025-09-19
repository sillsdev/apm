import { useGlobal } from '../context/useGlobal';
import { User } from '../model';
import { useOrbitData } from '../hoc/useOrbitData';

export const useUiLang = (): (() => string) => {
  const users = useOrbitData<User[]>('user');
  const [user] = useGlobal('user');

  return (): string => {
    const userRec = users.filter((u) => u.id === user) as User[];
    return userRec[0]?.attributes?.locale || 'en';
  };
};
