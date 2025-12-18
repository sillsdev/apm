import { useContext } from 'react';
import { useGlobal } from '../context/useGlobal';
import { useLocation } from 'react-router-dom';
import { TokenContext } from '../context/TokenProvider';
import { LocalKey, localUserKey, useMyNavigate } from '../utils';

interface IProps {
  el: React.JSX.Element;
}

export function PrivateRoute({ el }: IProps) {
  const [offline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const { pathname } = useLocation();
  const navigate = useMyNavigate();
  const authenticated = useContext(TokenContext)?.state?.authenticated ?? undefined;

  if (!pathname?.endsWith('null') && pathname !== '/loading')
    localStorage.setItem(localUserKey(LocalKey.url), pathname);
  if (!offline && authenticated && !authenticated())
    navigate('/', { state: { from: pathname } });

  return el;
}
export default PrivateRoute;
