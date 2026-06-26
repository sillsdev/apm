import { useContext } from 'react';
import {
  GlobalContext,
  GlobalCtxType,
  GlobalKey,
  GlobalState,
  GetGlobalType,
} from './GlobalContext';
import { debounce } from 'lodash';

const changes = {} as GlobalState;

export const useGlobal = <K extends GlobalKey>(
  prop?: K
): [GlobalState[K], (val: GlobalState[K]) => void] => {
  const { globalState, setGlobalState } = useContext(
    GlobalContext
  ) as GlobalCtxType;

  if (globalState === undefined || prop === undefined)
    return [undefined, undefined] as any;

  // if (prop === undefined) return [globalState, setGlobalState] as any;

  const handleChange = debounce(() => {
    setGlobalState((state) => ({ ...state, ...changes }));
  }, 100);

  const setter = (val: GlobalState[K]) => {
    if (val === (changes[prop] ?? globalState[prop])) return; // ignore set to same value
    changes[prop] = val; // keep track of all changes
    handleChange(); // post them as react can handle them
  };
  return [changes[prop] ?? globalState[prop], setter];
};

export const useGetGlobal = (): GetGlobalType => {
  const { globalState } = useContext(GlobalContext) as GlobalCtxType;
  return (prop) => {
    // console.log(`useGetGlobal ${prop} is ${changes[prop]}`);
    return changes[prop] ?? globalState[prop];
  };
};
