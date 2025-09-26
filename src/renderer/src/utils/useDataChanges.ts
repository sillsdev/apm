import { useContext } from 'react';
import { TokenContext } from '../context/TokenProvider';
import { useDispatch } from 'react-redux';
import { useOfflnProjRead } from '../crud';
import * as actions from '../store';
import { useGetGlobal, useGlobal } from '../context/useGlobal';
import { ThunkDispatch } from 'redux-thunk';
import { IState, LocalizationMsgs } from '../model';
import { doDataChanges } from '../hoc/doDataChanges';

export const useDataChanges = () => {
  const { accessToken } = useContext(TokenContext).state;
  const [errorReporter] = useGlobal('errorReporter');
  const [fingerprint] = useGlobal('fingerprint');
  const [coordinator] = useGlobal('coordinator');
  const getOfflineProject = useOfflnProjRead();
  const [user] = useGlobal('user');
  const dispatch = useDispatch() as ThunkDispatch<
    IState,
    void,
    LocalizationMsgs
  >;
  const setLanguage = (lang: string): LocalizationMsgs =>
    dispatch(actions.setLanguage(lang));
  const [, setDataChangeCount] = useGlobal('dataChangeCount');
  const getGlobal = useGetGlobal();

  return async (notPastTime?: string) => {
    await doDataChanges(
      accessToken || '',
      coordinator,
      fingerprint,
      getGlobal('projectsLoaded'),
      getOfflineProject,
      errorReporter,
      user,
      setLanguage,
      setDataChangeCount,
      undefined, //isElectron ? fetchUrl : undefined,
      notPastTime
    );
  };
};
