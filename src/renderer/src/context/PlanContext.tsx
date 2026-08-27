/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGlobal } from '../context/useGlobal';
import { ProjectD, DiscussionD, MediaFileD, GroupMembershipD } from '../model';
import { findRecord, usePlanType } from '../crud';
import {
  projDefSectionMap,
  useProjectDefaults,
} from '../crud/useProjectDefaults';
import { useOrbitData } from '../hoc/useOrbitData';
import { LocalKey, localUserKey } from '../utils';
import { useProjectPermissions } from '../utils/useProjectPermissions';
import { SectionArray } from '../model/SectionArray';
export interface IRowData {}

const initState = {
  connected: false,
  mediafiles: [] as MediaFileD[],
  discussions: [] as DiscussionD[],
  groupmemberships: [] as GroupMembershipD[],
  scripture: false,
  flat: false,
  shared: false,
  publishingOn: true,
  hidePublishing: true,
  canEditSheet: false,
  canEditAudio: false,
  canPublish: false,
  sectionArr: [] as SectionArray,
  setSectionArr: (_sectionArr: SectionArray) => {},
  togglePublishing: () => {},
  setCanAddPublishing: (_canAddPublishing: boolean) => {},
  tab: 0,
  setTab: (_tab: number) => {},
};

export type ICtxState = typeof initState;

interface IContext {
  state: ICtxState;
  setState: React.Dispatch<React.SetStateAction<ICtxState>>;
}

const PlanContext = React.createContext({
  state: initState as ICtxState,
  setState: () => {},
} as IContext);

interface IProps {
  children: React.ReactElement;
}

const EMPTY_SECTION_ARR: SectionArray = [];

const PlanProvider = (props: IProps) => {
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const discussions = useOrbitData<DiscussionD[]>('discussion');
  const groupmemberships = useOrbitData<GroupMembershipD[]>('groupmembership');
  const projects = useOrbitData<ProjectD[]>('project');
  const [memory] = useGlobal('memory');
  const [plan] = useGlobal('plan'); //will be constant here
  const [project] = useGlobal('project'); //will be constant here
  const [connected] = useGlobal('connected'); //verified this is not used in a function 2/18/25
  const [isOffline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [offlineOnly] = useGlobal('offlineOnly');
  const [isDeveloper] = useGlobal('developer');
  const getPlanType = usePlanType();
  const { setProjectDefault, getProjectDefault } = useProjectDefaults();
  const {
    canEditSheet: canEditSheetPerm,
    canEditSheetBase,
    canPublish,
  } = useProjectPermissions();
  const [addStoryOrPassage] = useGlobal('addStoryOrPassage');
  // Bold-workflow members can add sections/passages when the session-only
  // "Add {Story} or Passage" flag is set (see UserMenu). The flag can only be
  // set in a bold context, so no extra workflow guard is needed here.
  // Structural sheet edits (adding/moving sections & passages) still require
  // connectivity to the server, same as admins/sheet-editors -- see TT-7521.
  // Audio upload/delete is safe to allow offline (it queues for later sync),
  // so canEditAudio intentionally does not apply that restriction.
  const structuralOffline = isOffline && !offlineOnly;
  const canEditSheet =
    canEditSheetPerm || (addStoryOrPassage && !structuralOffline);
  const canEditAudio = canEditSheetBase || addStoryOrPassage;
  const [state, setState] = useState({
    ...initState,
    mediafiles,
    discussions,
    groupmemberships,
  });
  // Keep sectionArr in React state so consumers see a stable reference between
  // real updates (getProjectDefault JSON-parses a new array every call).
  const [sectionArr, setSectionArrState] =
    useState<SectionArray>(EMPTY_SECTION_ARR);

  const setTab = (tab: number) => {
    setState((state) => ({ ...state, tab }));
  };

  const defaultParams = projects.find((p) => p.id === project)?.attributes
    ?.defaultParams;

  useEffect(() => {
    const map = getProjectDefault(projDefSectionMap) as
      | SectionArray
      | undefined;
    const next = map?.length ? map : EMPTY_SECTION_ARR;
    setSectionArrState((prev) =>
      JSON.stringify(prev) === JSON.stringify(next) ? prev : next
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, defaultParams]);

  const setSectionArr = useCallback(
    (newArr: SectionArray) => {
      const next = newArr.length ? newArr : EMPTY_SECTION_ARR;
      setSectionArrState((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
        return next;
      });
      // Persist outside the updater. Empty map stays [] (do not delete the key).
      const prev = getProjectDefault(projDefSectionMap) as
        | SectionArray
        | undefined;
      const prevNorm = prev?.length ? prev : EMPTY_SECTION_ARR;
      if (JSON.stringify(prevNorm) === JSON.stringify(next)) return;
      setProjectDefault(projDefSectionMap, next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    const { scripture, flat } = getPlanType(plan);
    if (flat !== state.flat || scripture !== state.scripture)
      setState((state) => ({ ...state, flat, scripture }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  useEffect(() => {
    const projRec = findRecord(memory, 'project', project) as ProjectD;
    if (projRec) {
      const shared = projRec?.attributes?.isPublic || false;
      const hideId = LocalKey.hidePublishing + project;
      const hidePublish =
        localStorage.getItem(localUserKey(hideId as LocalKey)) || 'true';
      const hidePublishing = Boolean(
        hidePublish === 'true' || (isOffline && !isDeveloper)
      );

      if (
        shared !== state.shared ||
        hidePublishing !== state[LocalKey.hidePublishing]
      ) {
        setState((state) => ({
          ...state,
          shared,
          hidePublishing,
        }));
        localStorage.setItem(
          localUserKey(hideId as LocalKey),
          hidePublishing.toString()
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  const setCanAddPublishing = (publishingOn: boolean) => {
    setState((state) => ({ ...state, publishingOn }));
  };

  const togglePublishing = () => {
    const { hidePublishing } = state;
    const hideId = LocalKey.hidePublishing + project;
    localStorage.setItem(
      localUserKey(hideId as LocalKey),
      (!hidePublishing).toString()
    );
    setState((state) => ({ ...state, hidePublishing: !hidePublishing }));
  };

  const ctxState = useMemo(
    () => ({
      ...state,
      sectionArr,
      setSectionArr,
      connected,
      canEditSheet,
      canEditAudio,
      canPublish,
      togglePublishing,
      setCanAddPublishing,
      setTab,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      state,
      sectionArr,
      setSectionArr,
      connected,
      canEditSheet,
      canEditAudio,
      canPublish,
    ]
  );

  return (
    <PlanContext.Provider
      value={{
        state: ctxState,
        setState,
      }}
    >
      {props.children}
    </PlanContext.Provider>
  );
};

export { PlanContext, PlanProvider };
