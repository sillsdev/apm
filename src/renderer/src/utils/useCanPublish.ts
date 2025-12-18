import { useContext, useEffect, useRef, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useGlobal } from '../context/useGlobal';
import { IProfileStrings, IState, User, UserD } from '../model';
import * as action from '../store';
import { TokenContext } from '../context/TokenProvider';
import { profileSelector } from '../selector';
import { useOrbitData } from '../hoc/useOrbitData';
import { UpdateRecord } from '../model/baseModel';
import { addPt } from './addPt';
import { useProjectPermissions } from './useProjectPermissions';
import bugsnagClient from '../auth/bugsnagClient';
import { ThunkDispatch } from 'redux-thunk';

interface UserCanPublishResult {
  canUserPublish: boolean | undefined;
}

export const useUserCanPublish = (): UserCanPublishResult => {
  const [canUserPublish, setCanUserPublish] = useState<boolean | undefined>();

  const askingRef = useRef(false);
  const [isOffline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [memory] = useGlobal('memory');
  const accessToken = useContext(TokenContext)?.state?.accessToken ?? null;
  const [errorReporter] = useGlobal('errorReporter');
  const [user] = useGlobal('user');

  const users = useOrbitData<User[]>('user');
  const paratext_canPublish = useSelector(
    (state: IState) => state.paratext.canPublish
  );
  const paratext_canPublishStatus = useSelector(
    (state: IState) => state.paratext.canPublishStatus
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dispatch = useDispatch() as ThunkDispatch<IState, any, any>;
  const getCanPublish = (
    token: string,
    errorReporter: typeof bugsnagClient,
    message: string
  ): Promise<void> =>
    dispatch(action.getCanPublish(token, errorReporter, message));
  const resetCanPublish = (): void => dispatch(action.resetCanPublish());
  const t: IProfileStrings = useSelector(profileSelector, shallowEqual);

  useEffect(() => {
    if (user && users) {
      const u = users.find((u) => u.id === user);
      setCanUserPublish(u?.attributes?.canPublish ?? false);
    }
  }, [user, users]);

  useEffect(() => {
    if (!isOffline) {
      if (
        canUserPublish === false && //if it's still undefined...wait for it to be set from user...requery if it's false
        !askingRef.current &&
        accessToken &&
        !paratext_canPublishStatus
      ) {
        askingRef.current = true; //so we only call it once
        getCanPublish(
          accessToken || '',
          errorReporter,
          addPt(t.checkingParatext)
        );
      }
      if (paratext_canPublishStatus) {
        if (paratext_canPublishStatus.errStatus) {
          //showMessage(translateParatextError(paratext_canPublishStatus, ts));
          console.error(paratext_canPublishStatus.errMsg);
        } else if (paratext_canPublishStatus.complete) {
          const u = users.find((u) => u.id === user);
          if (
            u !== undefined &&
            u.attributes.canPublish !== (paratext_canPublish as boolean)
          ) {
            u.attributes.canPublish = paratext_canPublish as boolean;
            memory.update((t) => UpdateRecord(t, u as UserD, user));
          }
          resetCanPublish();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { canUserPublish };
};

export const useCanPublish = (): { canAddPublishing: boolean | undefined } => {
  const { canUserPublish } = useUserCanPublish();
  const [canAddPublishing, setCanAddPublishing] = useState<
    boolean | undefined
  >(); //allowed to turn it on (paratext)

  const { canEditSheet, canPublish } = useProjectPermissions();

  useEffect(() => {
    setCanAddPublishing(canUserPublish && (canEditSheet || canPublish));
  }, [canUserPublish, canEditSheet, canPublish]);

  return { canAddPublishing };
};
