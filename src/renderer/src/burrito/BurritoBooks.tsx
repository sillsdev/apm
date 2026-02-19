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
  const [teamProjs, setTeamProjs] = React.useState<ProjectD[]>([]);
  const teams = useOrbitData<OrganizationD[]>('organization');
  const projects = useOrbitData<ProjectD[]>('project');
  const plans = useOrbitData<PlanD[]>('plan');
  const sections = useOrbitData<SectionD[]>('section');
  const passages = useOrbitData<PassageD[]>('passage');
  const [codeNum, setCodeNum] = React.useState<Map<string, number>>(new Map());
  const [books, setBooks] = React.useState<string[]>([]);
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

  const bookSort = (a: string, b: string) => {
    const aNum = codeNum.get(a);
    const bNum = codeNum.get(b);
    if (aNum && bNum) return aNum - bNum;
    if (aNum) return -1;
    if (bNum) return 1;
    return a.localeCompare(b);
  };

  const bookName = (book: string) =>
    allBookData.find((b) => b.code === book)?.short || book;

  React.useEffect(() => {
    setCodeNum(new Map(CodeNum as [string, number][]));
  }, []);

  React.useEffect(() => {
    if (teamId && teams) {
      const team = teams.find((t) => t.id === teamId);
      if (team) {
        setTeamProjs(
          projects.filter((p) => related(p, 'organization') === teamId)
        );
        const curProjects = getOrgDefault(burritoProjects, teamId) as string[];
        if (curProjects) {
          setChecked(curProjects);
        }
        const curBooks = getOrgDefault(burritoBooks, teamId) as string[];
        if (curBooks) {
          setBooks(curBooks);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, teams, projects]);

  React.useEffect(() => {
    const newBooks: Set<string> = new Set();
    teamProjs
      .filter((p) => checked.includes(p.id))
      .forEach((proj) => {
        const planRec = plans.find((p) => related(p, 'project') === proj.id);
        const sectionRecs = sections.filter(
          (s) => related(s, 'plan') === planRec?.id
        );
        const passageRecs = sectionRecs.map((s) =>
          passages.find((p) => related(p, 'section') === s.id)
        );
        let book: string | undefined = undefined;
        passageRecs.forEach((p) => {
          if (p?.attributes?.book) {
            if (book && book !== p.attributes.book) {
              console.warn('multiple books in one project');
            }
            book = p.attributes.book;
            newBooks.add(book);
          }
        });
      });
    setBooks(Array.from(newBooks).sort(bookSort));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, plans, sections, passages, teamProjs]);

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
