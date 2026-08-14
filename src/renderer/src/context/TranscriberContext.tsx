/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useRef, useMemo, useContext } from 'react';
// see: https://upmostly.com/tutorials/how-to-use-the-usecontext-hook-in-react
import { useGlobal } from '../context/useGlobal';
import { useParams } from 'react-router-dom';
import * as actions from '../store';
import {
  IState,
  Passage,
  PassageD,
  Plan,
  PlanTypeD,
  Section,
  SectionD,
  MediaFile,
  MediaFileD,
  BookName,
  ActivityStates,
} from '../model';
import {
  related,
  sectionNumber,
  taskPassageNumber,
  remoteIdGuid,
  usePlan,
  useArtifactType,
  getMediaInPlans,
  findRecord,
  VernacularTag,
  mediaPassageIdForTranscribe,
  filterMediaForPassage,
} from '../crud';
import { mediaFileName } from '../crud/media';
import { mediaMatchesStepLanguage } from '../utils/mediaLanguage';
import StickyRedirect from '../components/StickyRedirect';
import { useSelector } from 'react-redux';
import { useDispatch } from 'react-redux';
import { InitializedRecord, RecordKeyMap } from '@orbit/records';
import { useOrbitData } from '../hoc/useOrbitData';
import { PassageDetailContext } from './PassageDetailContext';

export interface IRowData {
  planName: string;
  planType: string;
  section: SectionD;
  passage: PassageD;
  mediafile: MediaFileD;
  state: string;
  sectPass: string;
  playItem: string;
  duration: number;
  role: string;
  assigned: string;
  transcriber: string;
  editor: string;
}

function sourceSegmentStart(mediafile: MediaFileD): number {
  const seg = mediafile.attributes?.sourceSegments;
  if (!seg) return Number.NaN;
  try {
    return parseFloat(JSON.parse(seg as string).start);
  } catch {
    return Number.NaN;
  }
}

function compareTranscribeRowsByPhrase(a: IRowData, b: IRowData): number {
  const aStart = sourceSegmentStart(a.mediafile);
  const bStart = sourceSegmentStart(b.mediafile);
  if (!Number.isNaN(aStart) && !Number.isNaN(bStart)) return aStart - bStart;
  if (!Number.isNaN(aStart)) return -1;
  if (!Number.isNaN(bStart)) return 1;
  return mediaFileName(a.mediafile) <= mediaFileName(b.mediafile) ? -1 : 1;
}

/** First passage-detail transcriber task in phrase order (PBT segments). */
function firstPassageTranscriberTaskId(
  rowList: IRowData[],
  passageOrbitId: string
): string | undefined {
  const candidates = rowList.filter(
    (r) =>
      r.passage?.id === passageOrbitId &&
      r.mediafile?.id &&
      r.role === 'transcriber'
  );
  if (candidates.length === 0) return undefined;
  candidates.sort(compareTranscribeRowsByPhrase);
  return candidates[0].mediafile.id as string;
}

function firstRealTaskMediaId(rowList: IRowData[]): string | undefined {
  const row = rowList.find((r) => r.passage?.id && r.mediafile?.id);
  return row?.mediafile.id as string | undefined;
}

const initState = {
  transSelected: undefined as string | undefined, //mediafileid
  setTransSelected: (
    _selected: string | undefined,
    _rowData?: IRowData[]
  ) => {},
  index: -1,
  rowData: Array<IRowData>(),
  expandedGroups: Array<string>(),
  playItem: '',
  allDone: false,
  setAllDone: (_val: boolean) => {},
  refresh: () => {},
  allBookData: Array<BookName>(),
  flat: false,
  artifactId: null as string | null,
  isDetail: false,
};

export type ICtxState = typeof initState;

interface IContext {
  state: ICtxState;
  setState: React.Dispatch<React.SetStateAction<ICtxState>>;
}

const TranscriberContext = React.createContext({
  state: initState as ICtxState,
  setState: () => {},
} as IContext);

interface IProps {
  children: React.ReactElement;
  artifactTypeId?: string | null | undefined;
  curRole?: string;
  /** Step language. When set (and not `und`), only media tagged with it become tasks. */
  stepLanguageBcp47?: string;
}
const TranscriberProvider = (props: IProps) => {
  const { artifactTypeId, curRole, stepLanguageBcp47 } = props;
  const [isDetail] = useState(artifactTypeId !== undefined);
  const passages = useOrbitData<Passage[]>('passage');
  const sections = useOrbitData<Section[]>('section');
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const allBookData = useSelector((state: IState) => state.books.bookData);
  const lang = useSelector((state: IState) => state.strings.lang);
  const booksLoaded = useSelector((state: IState) => state.books.loaded);
  const dispatch = useDispatch();
  const fetchBooks = (lang: string) =>
    dispatch(actions.fetchBooks(lang) as any);
  const { pasId, slug, medId } = useParams();
  const [memory] = useGlobal('memory');
  const [user] = useGlobal('user');
  const [devPlan] = useGlobal('plan'); //will be constant here
  const { getPlan, getPlanRecName } = usePlan();
  const view = React.useRef('');
  const [refreshed, setRefreshed] = useState(0);
  const [planMedia, setPlanMedia] = useState<MediaFile[]>([]);
  const planMediaRef = useRef<MediaFile[]>([]);
  const passageMediaRef = useRef<MediaFile[]>([]);
  const [planRec, setPlanRec] = useState<Plan>({} as Plan);
  const { sectionArr } = useContext(PassageDetailContext).state;
  const sectionMap = new Map<number, string>(sectionArr);
  const [state, setState] = useState({
    ...initState,
    allBookData,
    isDetail,
  });
  const { getTypeId } = useArtifactType();

  const artifactId = useMemo(
    () => (slug ? getTypeId(slug) : (artifactTypeId ?? VernacularTag)),
    [slug, artifactTypeId, getTypeId]
  );

  useEffect(() => {
    if (devPlan && mediafiles.length > 0) {
      const m = getMediaInPlans([devPlan], mediafiles, artifactId, true).filter(
        (mf) => mediaMatchesStepLanguage(mf, stepLanguageBcp47)
      );
      setPlanMedia(m);
      planMediaRef.current = m;
    }
  }, [mediafiles, devPlan, artifactId, stepLanguageBcp47]);

  const setRows = (rowData: IRowData[]) => {
    setState((state: ICtxState) => {
      return { ...state, rowData };
    });
  };

  const setExpandedGroups = (expandedGroups: string[]) => {
    setState((state: ICtxState) => {
      return { ...state, expandedGroups };
    });
  };

  const setAllDone = (val: boolean) => {
    setState((state: ICtxState) => {
      return { ...state, allDone: val };
    });
  };

  const setTransSelected = (
    transSelected: string | undefined,
    rowData: IRowData[] = state.rowData
  ) => {
    let i = -1;
    if (transSelected) {
      if (isDetail && curRole === 'transcriber') {
        i = rowData.findIndex(
          (r) => r.mediafile.id === transSelected && r.role === 'transcriber'
        );
      }
      if (i < 0) {
        i = rowData.findIndex((r) => r.mediafile.id === transSelected);
      }
    }
    if (i < 0) return;
    const r = rowData[i] as IRowData;

    if (state.index !== i || state.transSelected !== transSelected) {
      setState((state: ICtxState) => {
        return {
          ...state,
          index: i,
          transSelected,
          playItem: r.mediafile.id,
        };
      });
    }
  };

  const refresh = () => {
    setRefreshed((refreshed) => {
      return refreshed + 1;
    });
  };

  const getPlanType = (planRec: Plan) => {
    const planType = findRecord(
      memory,
      'plantype',
      related(planRec, 'plantype')
    ) as PlanTypeD;
    return planType?.attributes.name || '';
  };

  const addTasks = (
    state: string,
    role: string,
    rowList: IRowData[],
    onlyAvailable: boolean,
    playItem: string
  ) => {
    if (curRole && curRole !== role && role !== 'view') return;
    const planName = getPlanRecName(planRec);
    const planType = getPlanType(planRec);

    const mediaRecs = passageMediaRef.current.filter(
      (m) =>
        role === 'view' ||
        (m.attributes?.transcriptionstate || ActivityStates.TranscribeReady) ===
          state
    );
    const passIds = mediaRecs.map((m) => related(m, 'passage') as string);
    const readyRecs = passages
      .filter((p) => passIds.findIndex((pid) => pid === p.id) >= 0)
      .sort((a, b) =>
        related(a, 'section') <= related(b, 'section') ? -1 : 1
      );
    const addRows = Array<IRowData>();
    let assigned = '';
    let allowed = false;
    let secNum = '';
    let secRec = {} as Section;
    let transcriber = '';
    let editor = '';
    let curSec = '';
    readyRecs.forEach((p) => {
      const passageMediaRecs = mediaRecs
        .filter((m) => related(m, 'passage') === p.id)
        .sort((i: MediaFile, j: MediaFile) =>
          // Sort ascending--vernacular will only have the latest.  All others sort by date created (possible upgrade would be segment start if available)
          j.attributes.dateCreated <= i.attributes.dateCreated ? -1 : 1
        );

      if (related(p, 'section') !== curSec) {
        curSec = related(p, 'section');
        secRec = findRecord(
          memory,
          'section',
          related(p, 'section')
        ) as Section;
        if (secRec) {
          secNum = sectionNumber(secRec, sectionMap);
          assigned = ''; // previously controlled: related(secRec, role);
          transcriber = related(secRec, 'transcriber');
          editor = related(secRec, 'editor');
          allowed = onlyAvailable
            ? assigned === user || !assigned || assigned === ''
            : role === 'view';

          if (allowed && !rowList.find((r) => r.sectPass === secNum + '.'))
            addRows.push({
              planName,
              planType,
              section: { ...secRec } as SectionD,
              passage: {} as PassageD,
              state: '',
              sectPass: secNum + '.',
              mediafile: {} as MediaFileD,
              playItem: '',
              duration: 0,
              role,
              assigned,
              transcriber,
              editor,
            });
        }
      }
      if (allowed)
        passageMediaRecs.forEach((mediaRec) => {
          let already: IRowData[] = [];
          if (role === 'view') {
            already = rowList.filter((r) => r.mediafile.id === mediaRec.id);
          }
          if (role !== 'view' || already.length === 0) {
            const curState: ActivityStates | string =
              role === 'view'
                ? mediaRec.attributes?.transcriptionstate || state
                : state;
            addRows.push({
              planName,
              planType,
              section: { ...secRec } as SectionD,
              passage: { ...p } as PassageD,
              state: curState,
              sectPass: secNum + '.' + taskPassageNumber(p).trim(),
              mediafile: mediaRec as MediaFileD,
              playItem,
              duration: mediaRec.attributes.duration,
              role,
              assigned,
              transcriber,
              editor,
            });
          }
        });
    });
    addRows
      .sort((i, j) =>
        i.planName < j.planName
          ? -1
          : i.planName > j.planName
            ? 1
            : i.sectPass <= j.sectPass
              ? -1
              : 1
      )
      .forEach((r) => {
        rowList.push(r);
      });
  };

  const selectTasks = (
    onlyAvailable: boolean,
    rowList: IRowData[],
    item: string
  ) => {
    // IN PROGRESS TASKS
    addTasks(ActivityStates.Reviewing, 'editor', rowList, onlyAvailable, item);

    addTasks(
      ActivityStates.Transcribing,
      'transcriber',
      rowList,
      onlyAvailable,
      item
    );

    // IN PROGRESS BUT ERROR REPORTED
    addTasks(
      ActivityStates.Incomplete,
      'transcriber',
      rowList,
      onlyAvailable,
      item
    );

    addTasks(
      ActivityStates.NeedsNewTranscription,
      'transcriber',
      rowList,
      onlyAvailable,
      item
    );

    // READY TO BEGIN TASKS
    addTasks(
      ActivityStates.Transcribed,
      'editor',
      rowList,
      onlyAvailable,
      item
    );

    addTasks(
      ActivityStates.TranscribeReady,
      'transcriber',
      rowList,
      onlyAvailable,
      item
    );
  };

  useEffect(() => {
    const playItem = state.playItem;
    const rowList: IRowData[] = [];
    if (pasId) {
      const psg =
        remoteIdGuid('passage', pasId, memory?.keyMap as RecordKeyMap) || pasId;
      const passRec = findRecord(memory, 'passage', psg) as PassageD | undefined;
      const mediaPsg = mediaPassageIdForTranscribe(passRec, memory) || psg;
      passageMediaRef.current = filterMediaForPassage(
        planMediaRef.current,
        mediaPsg
      );
    } else passageMediaRef.current = planMediaRef.current;

    selectTasks(true, rowList, playItem); // assigned
    selectTasks(false, rowList, playItem); // unassigned
    const newAllDone = rowList.length === 0 && !isDetail;
    if (newAllDone !== state.allDone) setAllDone(newAllDone);
    // ALL OTHERS
    addTasks('', 'view', rowList, false, playItem);

    setRows(rowList.map((r) => r));
    const exGrp: string[] = [];
    rowList.forEach((r) => {
      if (!exGrp.includes(r.planName)) exGrp.push(r.planName);
    });
    setExpandedGroups(exGrp);
    if (rowList.length > 0) {
      let transSelected = state.transSelected;
      if (!transSelected) {
        let mediaId = medId;
        if (!mediaId) {
          //vernacular so should just be one
          const psg =
            remoteIdGuid(
              'passage',
              pasId ?? '',
              memory?.keyMap as RecordKeyMap
            ) || pasId;
          const passRec = findRecord(memory, 'passage', psg) as
            | PassageD
            | undefined;
          const mediaPsg = mediaPassageIdForTranscribe(passRec, memory) || psg;
          const p = rowList.filter((r) => r.passage.id === mediaPsg);
          if (p.length > 0) mediaId = (p[0] as IRowData).mediafile.id;
        }
        transSelected =
          remoteIdGuid(
            'mediafile',
            mediaId || '',
            memory?.keyMap as RecordKeyMap
          ) ||
          mediaId ||
          '';
      }

      if (transSelected !== '') {
        const rowsForId = rowList.filter(
          (r) => r.mediafile.id === transSelected
        );
        if (rowsForId.length === 0) {
          transSelected = '';
        } else if (
          isDetail &&
          curRole === 'transcriber' &&
          !rowsForId.some((r) => r.role === 'transcriber')
        ) {
          transSelected = '';
        } else {
          setTransSelected(transSelected, rowList);
        }
      }
      if (transSelected === '') {
        const psg =
          remoteIdGuid(
            'passage',
            pasId ?? '',
            memory?.keyMap as RecordKeyMap
          ) || pasId;
        const passRec = findRecord(memory, 'passage', psg) as
          | PassageD
          | undefined;
        const mediaPsg = mediaPassageIdForTranscribe(passRec, memory) || psg;
        let pick: string | undefined;
        if (isDetail && curRole === 'transcriber' && mediaPsg) {
          pick = firstPassageTranscriberTaskId(rowList, mediaPsg);
        }
        if (!pick) {
          pick = firstRealTaskMediaId(rowList);
        }
        if (pick) {
          setTransSelected(pick, rowList);
        }
      }
    } else {
      setState((state: ICtxState) => {
        return {
          ...state,
          index: -1,
          transSelected: '',
          playItem: '',
        };
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planMedia, refreshed, pasId, medId, planRec]);

  const actor: { [key: string]: string } = {
    [ActivityStates.TranscribeReady]: 'transcriber',
    [ActivityStates.Reviewing]: 'editor',
    [ActivityStates.Transcribing]: 'transcriber',
    [ActivityStates.Transcribed]: 'editor',
    [ActivityStates.Incomplete]: 'transcriber',
    [ActivityStates.NeedsNewTranscription]: 'transcriber',
    '': 'view',
  };

  useEffect(() => {
    let changed = false;
    const rowData: IRowData[] = [];
    state.rowData.forEach((r) => {
      const secRecs = sections.filter((s) => s.id === r.section.id);
      if (secRecs.length > 0) {
        const section = { ...secRecs[0] } as SectionD;
        const transcriber = related(section, 'transcriber');
        if (transcriber !== r.transcriber) changed = true;
        const editor = related(section, 'editor');
        if (editor !== r.editor) changed = true;
        const state =
          r.mediafile.attributes?.transcriptionstate ||
          ActivityStates.TranscribeReady;
        const rowRole = actor[state] || 'view';
        const assigned = related(section, rowRole);
        rowData.push({
          ...r,
          section,
          role: rowRole,
          assigned,
          transcriber,
          editor,
        });
      }
    });
    if (changed) setState({ ...state, rowData });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [sections]);

  const noNewSelection: string[] = [
    ActivityStates.TranscribeReady,
    ActivityStates.Transcribing,
    ActivityStates.Reviewing,
  ];

  useEffect(() => {
    let changed = false;
    const rowData: IRowData[] = [];
    let forcerefresh = false;
    state.rowData.forEach((r) => {
      //section
      if (!r.passage.id) rowData.push({ ...r });
      else {
        const mediaRecs = mediafiles.filter((m) => m.id === r.mediafile.id);
        if (mediaRecs.length > 0) {
          const mediafile = { ...mediaRecs[0] } as MediaFile &
            InitializedRecord;
          let role = r.role;
          const newState = mediafile?.attributes?.transcriptionstate;
          if (newState !== r.mediafile?.attributes?.transcriptionstate) {
            changed = true;
            role = actor[newState] || 'view';
            forcerefresh =
              forcerefresh ||
              noNewSelection.indexOf(newState) === -1 ||
              role !== r.role;
          }
          rowData.push({ ...r, mediafile, role });
        }
      }
    });
    if (changed) {
      setState({ ...state, rowData }); //eh...what to do about: playing:false
      if (forcerefresh) {
        refresh(); //force the transcriber pane to refresh also
      } else if (
        isDetail &&
        curRole === 'transcriber' &&
        state.transSelected &&
        !rowData.some(
          (r) =>
            r.mediafile.id === state.transSelected && r.role === 'transcriber'
        )
      ) {
        refresh();
      }
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [mediafiles, pasId]);

  useEffect(() => {
    if (!booksLoaded) {
      fetchBooks(lang);
    } else {
      setState((state: ICtxState) => {
        return { ...state, allBookData };
      });
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [lang, booksLoaded, allBookData]);

  const isFlat = (planRec: Plan) => {
    if (planRec !== null) return planRec.attributes?.flat;
    return false;
  };

  React.useEffect(() => {
    if (devPlan !== '') {
      const planRec = getPlan(devPlan);
      if (planRec) {
        setPlanRec(planRec);
        const newFlat = isFlat(planRec);
        if (state.flat !== newFlat)
          setState((state) => ({
            ...state,
            flat: newFlat,
          }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devPlan]);

  if (view.current !== '') {
    const target = view.current;
    view.current = '';
    return <StickyRedirect to={target} />;
  }

  return (
    <TranscriberContext.Provider
      value={{
        state: {
          ...state,
          artifactId,
          setAllDone,
          setTransSelected,
          refresh,
        },
        setState,
      }}
    >
      {props.children}
    </TranscriberContext.Provider>
  );
};

export { TranscriberContext, TranscriberProvider };
