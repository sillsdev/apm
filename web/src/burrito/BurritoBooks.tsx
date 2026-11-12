import {
  CircularProgress,
  Grid,
  List,
  ListItem,
  Typography,
} from '@mui/material';
import { useLocation, useParams } from 'react-router-dom';
import React from 'react';
import StickyRedirect from '../components/StickyRedirect';
import {
  IBurritoStrings,
  IState,
  OrganizationD,
  PassageD,
  PlanD,
  ProjectD,
  SectionD,
} from '../model';
import { useOrbitData } from '../hoc/useOrbitData';
import related from '../crud/related';
import CodeNum from '../assets/code-num.json';
import { BurritoOption } from './BurritoOption';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import * as actions from '../store';
import { useOrgDefaults } from '../crud/useOrgDefaults';
import { projDefBook, useProjectDefaults } from '../crud/useProjectDefaults';
import { useNum2BookCode } from '../utils/useNum2BookCode';
import {
  collectBurritoBooks,
  projectDefaultToBurritoBookKey,
} from './akuoBookToUsfm';
import { BurritoHeader } from '../components/BurritoHeader';
import { useLoadProjectData, useOfflnProjRead } from '../crud';
import { useGlobal, useGetGlobal } from '../context/useGlobal';
import { useSnackBar } from '../hoc/SnackBar';
import { audacityManagerSelector, burritoSelector } from '../selector';

export const burritoBooks = 'burritoBooks';
export const burritoProjects = 'burritoProjects';

export function BurritoBooks() {
  const { pathname } = useLocation();
  const { teamId } = useParams();
  const [view, setView] = React.useState('');
  const teams = useOrbitData<OrganizationD[]>('organization');
  const projects = useOrbitData<ProjectD[]>('project');
  const plans = useOrbitData<PlanD[]>('plan');
  const sections = useOrbitData<SectionD[]>('section');
  const passages = useOrbitData<PassageD[]>('passage');
  const [codeNum, setCodeNum] = React.useState<Map<string, number>>(new Map());
  const [checked, setChecked] = React.useState<string[]>([]);
  const [loadingProjects, setLoadingProjects] = React.useState(false);
  const loadTimeoutRef = React.useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);
  const lang = useSelector((state: IState) => state.strings.lang);
  const allBookData = useSelector((state: IState) => state.books.bookData);
  const booksLoaded = useSelector((state: IState) => state.books.loaded);
  const dispatch = useDispatch();
  const fetchBooks = (lang: string) =>
    dispatch(actions.fetchBooks(lang) as any);
  const { getOrgDefault, setOrgDefault } = useOrgDefaults();
  const loadProjectData = useLoadProjectData();
  const offlineProjectRead = useOfflnProjRead();
  const [isOffline] = useGlobal('offline');
  const getGlobal = useGetGlobal();
  const { showMessage } = useSnackBar();
  const tAudacity = useSelector(audacityManagerSelector, shallowEqual);
  const t: IBurritoStrings = useSelector(burritoSelector, shallowEqual);
  const { getProjectDefault } = useProjectDefaults();
  const num2BookCode = useNum2BookCode();
  const teamIsKnown = Boolean(teamId && teams.some((org) => org.id === teamId));
  const teamProjs = teamIsKnown
    ? projects.filter((p) => related(p, 'organization') === teamId)
    : [];
  const teamProjIdKey = teamProjs.map((p) => p.id).join('\0');
  const hydratedTeamRef = React.useRef<string | undefined>(undefined);

  const bookSort = (a: string, b: string) => {
    const aNum = codeNum.get(a);
    const bNum = codeNum.get(b);
    if (aNum && bNum) return aNum - bNum;
    if (aNum) return -1;
    if (bNum) return 1;
    return a.localeCompare(b);
  };

  const books = collectBurritoBooks({
    projects: teamProjs.filter((p) => checked.includes(p.id)),
    plans,
    sections,
    passages,
    getProjectDefault,
    num2BookCode,
  }).sort(bookSort);

  const handleSave = () => {
    if (checked.length === 0) return;

    const projectsToLoad = checked.filter((projectId) => {
      if (isOffline) {
        const offlineProj = offlineProjectRead(projectId);
        return !offlineProj?.attributes?.offlineAvailable;
      }
      return !getGlobal('projectsLoaded').includes(projectId);
    });

    if (isOffline && projectsToLoad.length > 0) {
      showMessage(tAudacity.checkDownload);
      return;
    }

    const doSave = () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = undefined;
      }
      setLoadingProjects(false);
      setOrgDefault(burritoBooks, books, teamId);
      setOrgDefault(burritoProjects, checked, teamId);
      setView(`/burrito/${teamId}`);
    };

    if (projectsToLoad.length === 0) {
      doSave();
      return;
    }

    setLoadingProjects(true);
    loadTimeoutRef.current = setTimeout(() => {
      loadTimeoutRef.current = undefined;
      setLoadingProjects(false);
    }, 120000);
    const loadNext = (index: number) => {
      if (index >= projectsToLoad.length) {
        doSave();
        return;
      }
      loadProjectData(projectsToLoad[index], () => loadNext(index + 1));
    };
    loadNext(0);
  };

  const bookName = (book: string) => {
    const catalog = allBookData.find((b) => b.code === book)?.short;
    if (catalog) return catalog;
    const proj = teamProjs.find((p) => {
      if (!checked.includes(p.id)) return false;
      const projectBook = getProjectDefault(projDefBook, p);
      return (
        projectDefaultToBurritoBookKey(
          typeof projectBook === 'string' ? projectBook : undefined,
          num2BookCode
        ) === book
      );
    });
    if (proj?.attributes?.name) return proj.attributes.name;
    return book;
  };

  React.useEffect(() => {
    setCodeNum(new Map(CodeNum as [string, number][]));
  }, []);

  React.useEffect(() => {
    if (!teamId || !teamIsKnown || !teamProjIdKey) return;
    if (hydratedTeamRef.current === teamId) return;
    hydratedTeamRef.current = teamId;
    const teamProjIds = new Set(teamProjIdKey.split('\0'));
    const curProjects = getOrgDefault(burritoProjects, teamId);
    if (Array.isArray(curProjects)) {
      setChecked(
        curProjects.filter(
          (id): id is string => typeof id === 'string' && teamProjIds.has(id)
        )
      );
    }
    // getOrgDefault is read for this team only. Listing it would re-apply the
    // saved selection over in-progress checkbox edits. teamProjIdKey waits
    // until this team's projects are loaded; hydratedTeamRef applies them once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, teamIsKnown, teamProjIdKey]);

  React.useEffect(() => {
    if (!booksLoaded) {
      fetchBooks(lang);
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [lang, booksLoaded]);

  if (view !== '' && view !== pathname) {
    return <StickyRedirect to={view} />;
  }

  return (
    <BurritoHeader
      burritoType={t.books}
      teamId={teamId}
      setView={setView}
      onSave={handleSave}
      saveDisabled={checked.length === 0 || loadingProjects}
      action={
        loadingProjects ? (
          <CircularProgress size={24} sx={{ mr: 1 }} />
        ) : undefined
      }
    >
      <Grid container spacing={5} justifyContent="center" sx={{ pt: 3 }}>
        <Grid>
          <Typography variant="h5">{t.projects}</Typography>
          <BurritoOption
            options={teamProjs.map((p) => ({
              label: p.attributes.name,
              value: p.id,
            }))}
            value={checked}
            onChange={(value) => setChecked(value)}
          />
        </Grid>
        <Grid>
          <Typography variant="h5">{t.selectedBooks}</Typography>
          <List dense>
            {books.map((b) => (
              <ListItem key={b}>{bookName(b)}</ListItem>
            ))}
          </List>
        </Grid>
      </Grid>
    </BurritoHeader>
  );
}
