import React, { useCallback, useRef } from 'react';
import path from 'path-browserify';
import { BurritoBuilder, BurritoLocalizedNames } from './data/burritoBuilder';
import { useGlobal } from '../context/useGlobal';
import {
  remoteId,
  useBible,
  pubDataCopyright,
  useOrgDefaults,
  related,
} from '../crud';
import { useOrbitData } from '../hoc/useOrbitData';
import {
  BibleD,
  IBurritoStrings,
  IState,
  OrganizationBibleD,
  OrganizationD,
  PassageD,
  PlanD,
  ProjectD,
  SectionD,
  UserD,
} from '../model';
import { RecordKeyMap } from '@orbit/records';
import { burritoBooks, burritoProjects } from './BurritoBooks';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import * as actions from '../store';
import dataPath, { PathType } from '../utils/dataPath';
import cleanFileName from '../utils/cleanFileName';
import { burritoContents } from './BurritoContents';
import { BurritoType } from './BurritoType';
import { burritoWrapper } from './BurritoWrapper';
import { pad2 } from '../utils/pad2';
import CodeNum from '../assets/code-num.json';
import { useBurritoAudio } from './useBurritoAudio';
import { useBurritoNavigation } from './useBurritoNavigation';
import { useBurritoApmData } from './useBurritoApmData';
import { PassageTypeEnum } from '../model/passageType';
import { ArtifactTypeSlug } from '../crud/artifactTypeSlug';
import packageJson from '../../package.json';
const version = packageJson.version;
const productName = packageJson.build.productName;
import { MainAPI } from '@model/main-api';
import { useBurritoText } from './useBurritoText';
import { burritoSelector } from '../selector';
const ipc = window?.api as MainAPI;

export interface CreateBurritoProgress {
  current: number;
  total: number;
  phase: string;
  currentBook: string;
  partIndex: number;
  bookIndex: number;
  booksInPart: number;
  partProgress: number;
  overallProgress: number;
}

export const useCreateBurrito = (teamId: string) => {
  const cancelRef = useRef(false);
  const [progress, setProgress] = React.useState<CreateBurritoProgress | null>(
    null
  );
  const [isCreating, setIsCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<'success' | 'cancelled' | null>(
    null
  );
  const [memory] = useGlobal('memory');
  const [userId] = useGlobal('user');
  const users = useOrbitData<UserD[]>('user');
  const teams = useOrbitData<OrganizationD[]>('organization');
  const teamBibles = useOrbitData<OrganizationBibleD[]>('organizationbible');
  const bibles = useOrbitData<BibleD[]>('bible');
  const projects = useOrbitData<ProjectD[]>('project');
  const plans = useOrbitData<PlanD[]>('plan');
  const sections = useOrbitData<SectionD[]>('section');
  const passages = useOrbitData<PassageD[]>('passage');
  const { getOrgDefault } = useOrgDefaults();
  const lang = useSelector((state: IState) => state.strings.lang);
  const allBookData = useSelector((state: IState) => state.books.bookData);
  const booksLoaded = useSelector((state: IState) => state.books.loaded);
  const dispatch = useDispatch();
  const fetchBooks = (lang: string) =>
    dispatch(actions.fetchBooks(lang) as any);
  const { getPublishingData } = useBible();
  const burritoAudio = useBurritoAudio(teamId);
  const burritoText = useBurritoText(teamId);
  const burritoNavigation = useBurritoNavigation(teamId);
  const burritoApmData = useBurritoApmData(memory);
  const t: IBurritoStrings = useSelector(burritoSelector, shallowEqual);

  const bookData = (book: string) => allBookData.find((b) => b.code === book);

  React.useEffect(() => {
    if (!booksLoaded) {
      fetchBooks(lang);
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [lang, booksLoaded]);

  const bible = React.useMemo(() => {
    const teamBibleRec = teamBibles.find(
      (t) => related(t, 'organization') === teamId
    );
    const bibleId = related(teamBibleRec, 'bible');
    return bibles.find((b) => b.id === bibleId);
  }, [teamBibles, bibles, teamId]);

  const books: string[] = React.useMemo(
    () => (getOrgDefault(burritoBooks, teamId) || []) as string[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teamId]
  );

  const cleanName = (name: string) => {
    const m = name.match(/^[^A-Za-z]*([A-Za-z0-9 ]+)[^A-Za-z0-9]*$/);
    return m ? m[1] : name;
  };

  const getMetadata = (languages: string[]) => {
    const userRec = users.find((user) => user.id === userId);
    const teamRec = teams.find((team) => team.id === teamId);
    const teamRemId =
      remoteId('organization', teamId, memory.keyMap as RecordKeyMap) || teamId;
    const revision = getOrgDefault('burritoRevision', teamId) || '1';
    const localizedNames = {} as BurritoLocalizedNames;
    books.forEach((book) => {
      const bookInfo = bookData(book);
      localizedNames[`book-${book}`.toLowerCase()] = {
        abbr: { [lang]: bookInfo?.abbr || book },
        short: { [lang]: bookInfo?.short || book },
        long: { [lang]: bookInfo?.long || book },
      };
    });
    const copyright = getPublishingData(pubDataCopyright, bible) as string;
    const metaData = new BurritoBuilder()
      .withMeta({
        generator: {
          softwareName: productName,
          softwareVersion: version,
          userName: userRec?.attributes.name || 'Unknown User',
        },
        comments: [
          `Generated by Audio Project Manager from ${
            teamRec?.attributes.name || 'Unknown Team'
          }`,
        ],
      })
      .withIdAuthority(
        'apm',
        'https://www.audioprojectmanager.org',
        productName
      )
      .withIdentification({
        primary: {
          apm: {
            [teamRemId]: {
              revision,
              timestamp: new Date().toISOString(),
            },
          } as Record<string, { revision: string; timestamp: string }>,
        },
        name: {
          en:
            cleanName(bible?.attributes.bibleName || '') ||
            cleanName(teamRec?.attributes.name || '') ||
            'Unknown Bible',
        },
        description: { en: bible?.attributes.description || '' },
        abbreviation: {
          en: bible?.attributes.bibleId || `${bible?.attributes.iso}New`,
        },
      })
      .withAgency({
        id: `apm::${teamRemId}`,
        roles: ['rightsHolder'],
        name: {
          en: cleanName(teamRec?.attributes.name || '') || 'Unknown Team',
        },
      })
      .withTargetArea('US', 'United States')
      .withLocalizedNames(localizedNames)
      .withCopyright({
        shortStatements: [
          {
            statement: `<p>${copyright}</p>`,
            mimetype: 'text/html',
            lang: 'en',
          },
        ],
      })
      .build();
    metaData.languages = languages.map((l) => {
      const [lang, name] = l.split('|');
      return { tag: lang, name: { en: name } };
    });
    return metaData;
  };

  const getSections = useCallback(() => {
    const projIds: string[] = (getOrgDefault(burritoProjects, teamId) ||
      []) as string[];
    const langs: Set<string> = new Set();
    const sectIds: Map<string, string[]> = new Map();
    projects
      .filter((p) => projIds.includes(p.id))
      .forEach((proj) => {
        langs.add(
          `${proj.attributes.language}|${proj.attributes.languageName}`
        );
        const planRec = plans.find((p) => related(p, 'project') === proj.id);
        const sectionRecs = sections.filter(
          (s) => related(s, 'plan') === planRec?.id
        );
        sectionRecs.forEach((section) => {
          const sectBook =
            passages.find(
              (p) =>
                related(p, 'section') === section.id &&
                Boolean(p.attributes.book)
            )?.attributes?.book || '';
          if (sectBook) {
            const curIds = sectIds.get(sectBook) || [];
            sectIds.set(sectBook, [...curIds, section.id]);
          }
        });
      });
    return {
      languages: Array.from(langs).sort(),
      bkSecIds: Array.from(sectIds),
    };
  }, [getOrgDefault, teamId, projects, plans, sections, passages]);

  const myName = (name: string, part?: string) =>
    part
      ? path.join(
          PathType.BURRITO,
          bible?.attributes?.bibleId || teamId || '',
          part.toLowerCase(),
          name
        )
      : path.join(
          PathType.BURRITO,
          bible?.attributes?.bibleId || teamId || '',
          name
        );

  const sectionSort = (a: SectionD, b: SectionD) =>
    a.attributes.sequencenum - b.attributes.sequencenum;

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const resultReset = useCallback(() => {
    setResult(null);
  }, []);

  const createPart = async (
    part: string,
    partIndex: number,
    totalParts: number,
    languages: string[],
    bkSecIds: [string, string[]][],
    onBookComplete: (
      partIndex: number,
      bookIndex: number,
      book: string,
      booksInPart: number
    ) => void
  ) => {
    const metaName = await dataPath(
      myName('metadata.json', part),
      PathType.BURRITO
    );
    const preLen = metaName.indexOf('metadata.json');
    await ipc?.createFolder(path.dirname(metaName));
    let metaData = getMetadata(languages);

    await ipc?.write(metaName, JSON.stringify(metaData, null, 2));
    const codeNum = new Map(CodeNum as [string, number][]);
    const projIds: string[] = (getOrgDefault(burritoProjects, teamId) ||
      []) as string[];
    const apmDataProjects = projects.filter((p) => projIds.includes(p.id));

    if (part === BurritoType.ApmData) {
      let projectIndex = 0;
      for (const proj of apmDataProjects) {
        if (cancelRef.current) return;
        const projectFolder = cleanFileName(proj.attributes.name || proj.id);
        const projectPath = await dataPath(
          myName(projectFolder, part),
          PathType.BURRITO
        );
        await ipc?.createFolder(projectPath);
        metaData = await burritoApmData({
          metadata: metaData,
          project: proj,
          projectPath,
          preLen,
        });
        if (cancelRef.current) return;
        projectIndex++;
        onBookComplete(
          partIndex,
          projectIndex,
          proj.attributes.name,
          apmDataProjects.length
        );
      }
    } else {
      let bookIndex = 0;
      for (const book of books) {
        if (cancelRef.current) return;
        // create the book folder
        const bookFolder = pad2(codeNum.get(book) ?? 99) + book;
        const bookPath = await dataPath(
          myName(bookFolder, part),
          PathType.BURRITO
        );
        await ipc?.createFolder(bookPath);
        const bookSectIds = bkSecIds.find((b) => b[0] === book)?.[1] || [];
        const bookSecs = sections
          .filter((s) => bookSectIds.includes(s.id))
          .sort(sectionSort);
        if (part === BurritoType.Audio) {
          metaData = await burritoAudio({
            metadata: metaData,
            bible: bible as BibleD,
            book,
            bookPath,
            preLen,
            sections: bookSecs,
          });
        }
        if (part === BurritoType.Notes) {
          metaData = await burritoAudio({
            metadata: metaData,
            bible: bible as BibleD,
            book,
            bookPath,
            preLen,
            sections: bookSecs,
            passageTypeFilter: PassageTypeEnum.NOTE,
            flavorTypeName: 'x-notes',
          });
        }
        if (part === BurritoType.Resources) {
          metaData = await burritoAudio({
            metadata: metaData,
            bible: bible as BibleD,
            book,
            bookPath,
            preLen,
            sections: bookSecs,
            passageTypeFilter: null,
            flavorTypeName: 'x-resources',
            artifactTypeFilter: [
              ArtifactTypeSlug.Resource,
              ArtifactTypeSlug.SharedResource,
              ArtifactTypeSlug.ProjectResource,
            ],
          });
        }
        if (part === BurritoType.Text) {
          metaData = await burritoText({
            metadata: metaData,
            book,
            bookPath,
            preLen,
            sections: bookSecs,
          });
        }
        if (part === BurritoType.Navigation) {
          metaData = await burritoNavigation({
            metadata: metaData,
            bible: bible as BibleD,
            book,
            bookPath,
            preLen,
            sections: bookSecs,
          });
        }
        if (cancelRef.current) return;
        bookIndex++;
        onBookComplete(partIndex, bookIndex, book, books.length);
      }
    }
    await ipc?.write(metaName, JSON.stringify(metaData, null, 2));
  };

  const getWrapperPath = async () => {
    return await dataPath(myName('metadata.json'), PathType.BURRITO);
  };

  const getResultPath = async () => {
    return path.dirname(await getWrapperPath());
  };

  const createBurrito = async () => {
    cancelRef.current = false;
    setIsCreating(true);
    setError(null);
    setProgress(null);
    setResult(null);

    try {
      const wrapper = getOrgDefault(burritoWrapper, teamId);
      if (wrapper) {
        if (cancelRef.current) throw new Error('Cancelled');
        const wrapperPath = await getWrapperPath();
        await ipc?.deleteFolder(path.dirname(wrapperPath));
        await ipc?.createFolder(path.dirname(wrapperPath));
        await ipc?.write(wrapperPath, JSON.stringify(wrapper, null, 2));
      }
      const content = (getOrgDefault(burritoContents, teamId) ??
        []) as string[];
      const { languages, bkSecIds } = getSections();
      const projIds: string[] = (getOrgDefault(burritoProjects, teamId) ||
        []) as string[];
      const apmDataProjects = projects.filter((p) => projIds.includes(p.id));
      const totalUnits = content.reduce(
        (sum, part) =>
          sum +
          (part === BurritoType.ApmData
            ? apmDataProjects.length
            : books.length),
        0
      );
      let completedUnits = 0;

      for (let partIndex = 0; partIndex < content.length; partIndex++) {
        if (cancelRef.current) throw new Error('Cancelled');
        const part = content[partIndex];
        const phase =
          part === BurritoType.Audio
            ? t.createAudio
            : part === BurritoType.Text
              ? t.createText
              : part === BurritoType.Notes
                ? t.createNotes
                : part === BurritoType.Resources
                  ? t.createResources
                  : part === BurritoType.Navigation
                    ? t.createNavigation
                    : part === BurritoType.ApmData
                      ? t.createData
                      : t.createOther.replace('{0}', part.toLowerCase());

        await createPart(
          part,
          partIndex,
          content.length,
          languages,
          bkSecIds,
          (pIndex, bookIndex, currentBook, booksInPart) => {
            completedUnits++;
            const partProgress =
              booksInPart > 0 ? (bookIndex / booksInPart) * 100 : 100;
            const overallProgress =
              totalUnits > 0 ? (completedUnits / totalUnits) * 100 : 100;
            setProgress({
              current: completedUnits,
              total: totalUnits,
              phase,
              currentBook,
              partIndex: pIndex,
              bookIndex,
              booksInPart,
              partProgress,
              overallProgress,
            });
          }
        );
      }
      setResult('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : t.failed;
      setError(message);
      setResult(message === 'Cancelled' ? 'cancelled' : null);
    } finally {
      setIsCreating(false);
      setProgress(null);
    }
  };

  return {
    createBurrito,
    progress,
    isCreating,
    error,
    result,
    resultReset,
    cancel,
    getResultPath,
  };
};
