import React, { useState, useEffect, useMemo, useContext, useRef } from 'react';
import { useGetGlobal, useGlobal } from '../context/useGlobal';
import * as actions from '../store';
import {
  IState,
  Passage,
  PassageD,
  Section,
  User,
  ITranscriptionTabStrings,
  IActivityStateStrings,
  Plan,
  MediaFileD,
  BookName,
  ISharedStrings,
  ExportType,
  OrgWorkflowStepD,
  SectionArray,
  SectionD,
  ProjectD,
  UserD,
  RoleD,
} from '../model';
import { IAxiosStatus } from '../store/AxiosStatus';
import {
  GrowingSpacer,
  PaddedBox,
  TabActions,
  TabAppBar,
  PriButton,
  AltButton,
} from '../control';
import { useSnackBar } from '../hoc/SnackBar';
import TranscriptionShow from './TranscriptionShow';
import { TokenContext } from '../context/TokenProvider';
import {
  related,
  sectionCompare,
  passageCompare,
  passageRefText,
  getVernacularMediaRec,
  getMediaEaf,
  getMediaName,
  getMediaInPlans,
  useOrganizedBy,
  useArtifactType,
  ArtifactTypeSlug,
  useTranscription,
  usePassageState,
  VernacularTag,
  usePlanType,
  PassageReference,
  afterStep,
  getStepComplete,
  useSharedResRead,
} from '../crud';
import { useOfflnProjRead } from '../crud/useOfflnProjRead';
import IndexedDBSource from '@orbit/indexeddb';
import { dateOrTime } from '../utils';
import { SelectExportType } from '../control';
import AudioExportMenu from './AudioExportMenu';
import { DateTime } from 'luxon';
import { isPublishingTitle } from '../control/passageTypeFromRef';
import { useOrbitData } from '../hoc/useOrbitData';
import { useSelector } from 'react-redux';
import {
  activitySelector,
  sharedSelector,
  transcriptionTabSelector,
} from '../selector';
import { useDispatch } from 'react-redux';
import { getSection } from './AudioTab/getSection';
import { WhichExportDlg } from './WhichExportDlg';
import { useParams } from 'react-router-dom';
import {
  GridRowId,
  type GridColDef,
  type GridColumnVisibilityModel,
  type GridSortModel,
} from '@mui/x-data-grid';
import { ExportActionCell } from './ExportActionCell';
import { TranscriptionViewCell } from './TranscriptionViewCell';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import { TreeDataGrid } from './TreeDataGrid';
import { debounce } from '@mui/material';

interface IRow {
  id: number;
  recId: string;
  name: React.ReactNode;
  state: string;
  planName: string;
  passages: string;
  updated: string;
  action: string;
  parentId: string;
  sort: string;
}
// const getChildRows = (row: any, rootRows: any[]) => {
//   const childRows = rootRows.filter((r) => r.parentId === (row ? row.id : ''));
//   return childRows.length ? childRows : null;
// };

interface IProps {
  projectPlans: Plan[];
  planColumn?: boolean;
  floatTop?: boolean;
  step?: string;
  orgSteps?: OrgWorkflowStepD[];
  sectionArr: SectionArray;
}

export function TranscriptionTab(props: IProps) {
  const { projectPlans, planColumn, floatTop, step, orgSteps, sectionArr } =
    props;

  const { pasId } = useParams();
  const t: ITranscriptionTabStrings = useSelector(transcriptionTabSelector);
  const ts: ISharedStrings = useSelector(sharedSelector);
  const activityState = useSelector(activitySelector);
  const exportFile = useSelector(
    (state: IState) => state.importexport.exportFile
  );
  const exportStatus = useSelector(
    (state: IState) => state.importexport.importexportStatus
  );
  const allBookData = useSelector((state: IState) => state.books.bookData);
  const dispatch = useDispatch();
  const exportProject = (props: actions.ExPrjProps) =>
    dispatch(actions.exportProject(props) as any);
  const exportComplete = () => dispatch(actions.exportComplete() as any);
  const projects = useOrbitData<ProjectD[]>('project');
  const passages = useOrbitData<PassageD[]>('passage');
  const sections = useOrbitData<SectionD[]>('section');
  const users = useOrbitData<UserD[]>('user');
  const roles = useOrbitData<RoleD[]>('role');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [busy, setBusy] = useGlobal('importexportBusy'); //verified this is not used in a function 2/18/25
  const [plan, setPlan] = useGlobal('plan'); //will be constant here
  const getPlanType = usePlanType();
  const [isScripture, setScripture] = useState(false);
  const [coordinator] = useGlobal('coordinator');
  const [memory] = useGlobal('memory');
  const backup = coordinator?.getSource('backup') as IndexedDBSource;
  const [offline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [errorReporter] = useGlobal('errorReporter');
  const [lang] = useGlobal('lang');
  const token = useContext(TokenContext).state.accessToken;
  const { showMessage, showTitledMessage } = useSnackBar();
  const [openExport, setOpenExport] = useState(false);
  const [data, setData] = useState(Array<IRow>());
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [alertOpen, setAlertOpen] = useState(false);
  const [passageId, setPassageId] = useState('');
  const eafAnchor = React.useRef<HTMLAnchorElement>(null);
  const [dataUrl, setDataUrl] = useState<string | undefined>();
  const [dataName, setDataName] = useState('');
  const exportAnchor = React.useRef<HTMLAnchorElement>(null);
  const [exportUrl, setExportUrl] = useState<string | undefined>();
  const [exportName, setExportName] = useState('');
  const [columnVisibilityModel, setColumnVisibilityModel] =
    useState<GridColumnVisibilityModel>({});
  const sectionMap = new Map<number, string>(sectionArr);
  const [project] = useGlobal('project'); //will be constant here
  const [user] = useGlobal('user');
  const { getOrganizedBy } = useOrganizedBy();
  const getOfflineProject = useOfflnProjRead();
  const [enableOffsite, setEnableOffsite] = useGlobal('enableOffsite');
  const boxRef = useRef<HTMLDivElement>(null);
  const [addWidth, setAddWidth] = useState(0);

  const { getTypeId, localizedArtifactType } = useArtifactType();
  const { getSharedResource } = useSharedResRead();
  const [artifactTypes] = useState<ArtifactTypeSlug[]>([
    ArtifactTypeSlug.Vernacular,
    ArtifactTypeSlug.Retell,
    ArtifactTypeSlug.QandA,
    ArtifactTypeSlug.WholeBackTranslation,
    ArtifactTypeSlug.PhraseBackTranslation,
  ]);
  const [artifactType, setArtifactType] = useState<ArtifactTypeSlug>(
    artifactTypes[0] as ArtifactTypeSlug
  );
  const getTranscription = useTranscription(true);
  const getGlobal = useGetGlobal();

  const getPassageState = usePassageState();

  const localizedArtifact = useMemo(
    () =>
      artifactType === ArtifactTypeSlug.Vernacular
        ? ''
        : localizedArtifactType(artifactType),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [artifactType]
  );
  const projectPlan = useMemo(
    () => projectPlans?.[0] as Plan | undefined,
    [projectPlans]
  );
  const flat = useMemo(
    () => Boolean(projectPlan?.attributes.flat),
    [projectPlan]
  );

  useEffect(() => {
    setColumnVisibilityModel({
      planName: Boolean(planColumn),
      passages: !flat,
    });
  }, [flat, planColumn]);

  const translateError = (err: IAxiosStatus): string => {
    if (err.errStatus === 401) return ts.expiredToken;
    if (err.errMsg.includes('RangeError')) return t.exportTooLarge;
    return err.errMsg;
  };
  const doProjectExport = (exportType: ExportType, importedDate?: DateTime) => {
    setBusy(true);

    const mediaFiles = memory?.cache.query((q) =>
      q.findRecords('mediafile')
    ) as MediaFileD[];
    const plans = memory?.cache.query((q) => q.findRecords('plan')) as Plan[];

    const projectplans = plans.filter(
      (pl) => related(pl, 'project') === project
    );
    /* get correct count */
    const onlyTypeId = [ExportType.DBL, ExportType.BURRITO].includes(exportType)
      ? VernacularTag
      : [ExportType.AUDIO, ExportType.ELAN].includes(exportType)
        ? getTypeId(artifactType)
        : undefined;
    const onlyLatest = onlyTypeId !== undefined;
    const media = getMediaInPlans(
      projectplans.map((p) => p.id) as string[],
      mediaFiles,
      onlyTypeId,
      onlyLatest
    );
    exportProject({
      exportType,
      artifactType: onlyTypeId,
      memory,
      backup,
      projectid: project,
      userid: user,
      numberOfMedia: media.length,
      token,
      errorReporter,
      pendingmsg: t.creatingDownloadFile,
      nodatamsg: t.noData.replace(
        '{0}',
        onlyTypeId !== undefined
          ? localizedArtifactType(artifactType)
          : t.changed
      ),
      writingmsg: t.writingDownloadFile,
      localizedArtifact,
      getOfflineProject,
      importedDate,
      target: step,
      orgWorkflowSteps: orgSteps,
    });
  };
  const handleProjectExport = () => {
    setAlertOpen(false);
    const offline = getGlobal('offline');

    if (offline) {
      setOpenExport(true);
    } else {
      doProjectExport(ExportType.PTF);
    }
  };

  const exportId = useMemo(
    () => (artifactType ? getTypeId(artifactType) : VernacularTag),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [artifactType]
  );

  const getCopy = (
    projectPlans: Plan[],
    passages: Array<Passage>,
    sections: Array<Section>,
    bookData: BookName[]
  ) => {
    const copyData: string[] = [];
    projectPlans.forEach((planRec) => {
      let planName = planColumn ? planRec?.attributes?.name : '';
      sections
        .filter((s) => related(s, 'plan') === planRec.id && s.attributes)
        .sort(sectionCompare)
        .forEach((section) => {
          const sectionpassages = passages
            .filter((ps) => related(ps, 'section') === section.id)
            .sort(passageCompare) as PassageD[];
          let sectionHead =
            '-----\n' + getSection([section], sectionMap) + '\n';
          sectionpassages.forEach((passage) => {
            // const state = passage?.attributes?.state ||'';
            const ref = passageRefText(passage, bookData);
            const transcription = getTranscription(passage.id, exportId);
            if (transcription !== '') {
              if (planName && planName !== '') {
                copyData.push(`*****\n${planName}\n`);
                planName = '';
              }
              if (sectionHead !== '') {
                copyData.push(sectionHead);
                sectionHead = '';
              }
              if (ref && ref !== '') copyData.push(ref);
              copyData.push(transcription + '\n');
            }
          });
        });
    });

    return copyData;
  };

  const handleCopyPlan = () => {
    const trans = getCopy(projectPlans, passages, sections, allBookData).join(
      '\n'
    );
    if (trans.length > 0)
      navigator.clipboard
        .writeText(trans)
        .then(() => {
          showMessage(t.availableOnClipboard);
        })
        .catch(() => {
          showMessage(ts.cantCopy);
        });
    else
      showMessage(t.noData.replace('{0}', localizedArtifactType(artifactType)));
  };

  const handleAudioExportMenu = (what: string | ExportType) => {
    setBusy(true);
    switch (what) {
      case ExportType.AUDIO:
      case ExportType.ELAN:
      case ExportType.BURRITO:
        //case ExportType.DBL:
        doProjectExport(what);
        break;
      default:
        setBusy(false);
        break;
    }
  };

  const handleBackup = () => {
    doProjectExport(ExportType.FULLBACKUP);
  };

  const handleSelect = (passageId: string) => () => {
    setPassageId(passageId);
  };

  const handleCloseTranscription = () => {
    setPassageId('');
  };

  const handleEaf = (passageId: string) => () => {
    const mediaRec = getVernacularMediaRec(passageId, memory);
    if (!mediaRec) return;
    const eafXml = getMediaEaf(mediaRec, memory);
    // Convert Unicode string to base64 safely
    const encoder = new TextEncoder();
    const data = encoder.encode(eafXml);
    const base64 = btoa(String.fromCharCode(...Array.from(data)));
    const name = getMediaName(mediaRec, memory);
    setDataUrl('data:text/xml;base64,' + base64);
    setDataName(name + '.eaf');
  };

  const ready = useMemo(() => {
    const passRec = passages.find(
      (p) => p.keys?.remoteId === pasId || p.id === pasId
    );
    return Boolean(
      step
        ? orgSteps &&
            passRec &&
            afterStep({
              psgCompleted: getStepComplete(passRec),
              target: step,
              orgWorkflowSteps: orgSteps,
            })
        : true
    );
  }, [passages, step, orgSteps, pasId]);

  useEffect(() => {
    if (dataUrl && dataName !== '') {
      if (eafAnchor && eafAnchor.current) {
        eafAnchor.current.click();
        setDataUrl(undefined);
        setDataName('');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUrl, dataName, eafAnchor]);

  useEffect(() => {
    if (exportUrl && exportName !== '') {
      if (exportAnchor && exportAnchor.current) {
        if (import.meta.env.VITE_DEBUG !== 'true') exportAnchor.current.click();
        else console.log(exportUrl);
        URL.revokeObjectURL(exportUrl);
        setExportUrl(undefined);
        showTitledMessage(
          t.exportProject,
          t.downloading.replace('{0}', exportName)
        );
        setExportName('');
        exportComplete();
        setBusy(false);
      }
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [exportUrl, exportName, exportAnchor]);

  useEffect(() => {
    if (exportStatus) {
      if (exportStatus.errStatus) {
        showTitledMessage(t.error, translateError(exportStatus));
        exportComplete();
        setBusy(false);
      } else {
        if (!enableOffsite) setEnableOffsite(true);
        if (exportStatus.statusMsg) {
          showMessage(exportStatus.statusMsg);
        }
        if (exportStatus.complete) {
          setBusy(false);
          if (exportFile && exportName === '') {
            setAlertOpen(exportStatus.errMsg !== '');
            setExportName(exportFile.message);
            setExportUrl(exportFile.fileURL);
          }
        }
      }
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [exportStatus]);

  useEffect(() => {
    if (projectPlan) {
      if (plan === '') {
        const planId = projectPlan?.id as string;
        setPlan(planId); //set the global plan
        setScripture(getPlanType(planId).scripture);
      } else {
        setScripture(getPlanType(plan).scripture);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPlan, plan]);

  const getAssignments = (
    projectPlans: Plan[],
    passages: Array<PassageD>,
    sections: Array<SectionD>,
    users: Array<User>,
    activityState: IActivityStateStrings,
    bookData: BookName[],
    openSections: GridRowId[]
  ) => {
    const rowData: IRow[] = [];
    let id = 1;
    projectPlans.forEach((planRec) => {
      sections
        .filter((s) => related(s, 'plan') === planRec.id && s.attributes)
        .sort(sectionCompare)
        .forEach((section) => {
          let sectionIndex = 0;
          let psgCount = 0;
          const sectionpassages = passages
            .filter((ps) => related(ps, 'section') === section.id)
            .sort(passageCompare);
          if (sectionpassages.length > 0) {
            sectionIndex =
              rowData.push({
                id,
                recId: section.id,
                name: getSection([section], sectionMap),
                state: '',
                planName: planRec.attributes.name,
                passages: sectionpassages.length.toString(),
                updated: dateOrTime(section?.attributes?.dateUpdated, lang),
                action: '',
                parentId: '',
                sort: (section.attributes.sequencenum || 0)
                  .toFixed(2)
                  .toString(),
              }) - 1;
            id += 1;
            if (openSections.includes(section.id)) {
              sectionpassages.forEach((passage: Passage) => {
                const state = activityState.getString(getPassageState(passage));
                if (!isPublishingTitle(passage?.attributes?.reference, flat)) {
                  psgCount++;
                  const sr = getSharedResource(passage as PassageD);
                  rowData.push({
                    id,
                    recId: passage.id,
                    name: (
                      <PassageReference
                        passage={passage}
                        bookData={bookData}
                        flat={flat}
                        sharedResource={sr}
                        fontSize={'0.8rem'}
                      />
                    ),
                    state: state,
                    planName: planRec.attributes.name,
                    passages: '',
                    updated: dateOrTime(passage.attributes.dateUpdated, lang),
                    action: passage.id,
                    parentId: section.id,
                  } as IRow);
                  id += 1;
                }
              });
            } else {
              psgCount = sectionpassages.length;
            }
            (rowData[sectionIndex] as IRow).passages = psgCount.toString();
          }
        });
    });

    return rowData as Array<IRow>;
  };

  useEffect(() => {
    const newData = getAssignments(
      projectPlans,
      passages,
      sections,
      users,
      activityState,
      allBookData,
      openSections
    );
    setData(newData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    plan,
    projectPlans,
    passages,
    sections,
    users,
    roles,
    activityState,
    allBookData,
    openSections,
  ]);

  const MinNameWidth = 300;

  const columns: GridColDef<IRow>[] = useMemo(
    () => [
      {
        field: 'name',
        headerName: getOrganizedBy(true),
        width: MinNameWidth + addWidth,
        cellClassName: 'word-wrap',
        renderCell: (params) => (
          <TranscriptionViewCell {...params} handleSelect={handleSelect} />
        ),
      },
      { field: 'state', headerName: t.sectionstate, width: 150 },
      { field: 'planName', headerName: t.plan, width: 150 },
      {
        field: 'passages',
        headerName: ts.passages,
        width: 100,
        align: 'right',
      },
      { field: 'updated', headerName: t.updated, align: 'right', width: 100 },
      {
        field: 'action',
        headerName: '\u00A0',
        width: 150,
        renderCell: (params) => (
          <ExportActionCell {...params} handleEaf={handleEaf} />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getOrganizedBy, addWidth]
  );

  const totalWidth = useMemo(
    () =>
      columns.reduce((sum, col) => {
        return col.field === 'name'
          ? sum + MinNameWidth
          : columnVisibilityModel[`${col.field}`] === false
            ? sum
            : sum + (col.width ?? 0);
      }, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns]
  );

  const ExtraWidth = 150;

  // keep track of screen width
  const setDimensions = () => {
    const boxWidth = boxRef.current?.clientWidth ?? 0;
    setAddWidth(boxWidth > totalWidth ? boxWidth - totalWidth - ExtraWidth : 0);
  };

  useEffect(() => {
    setDimensions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalWidth]);

  useEffect(() => {
    setDimensions();
    const handleResize = debounce(() => {
      setDimensions();
    }, 100);

    window.addEventListener('resize', handleResize);
    return () => {
      handleResize.clear();
      window.removeEventListener('resize', handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); //do this once to get the default;

  const sortModel: GridSortModel = [
    { field: 'planName', sort: 'asc' },
    { field: 'sort', sort: 'asc' },
  ];

  return (
    <Box ref={boxRef} id="TranscriptionTab" sx={{ display: 'flex' }}>
      <div>
        <TabAppBar
          position="fixed"
          highBar={planColumn || floatTop}
          color="default"
        >
          <TabActions>
            {(planColumn || floatTop) && (
              <AltButton
                id="transExp"
                key="export"
                aria-label={t.exportProject}
                onClick={handleProjectExport}
                title={t.exportProject}
                disabled={busy}
              >
                {t.exportProject}
              </AltButton>
            )}
            <AltButton
              id="transCopy"
              key="copy"
              aria-label={t.copyTranscriptions}
              onClick={handleCopyPlan}
              title={t.copyTip}
            >
              {t.copyTranscriptions +
                (localizedArtifact ? ' (' + localizedArtifact + ')' : '')}
            </AltButton>
            {step && (
              <AudioExportMenu
                key="audioexport"
                action={handleAudioExportMenu}
                localizedArtifact={localizedArtifact}
                isScripture={isScripture}
                disabled={!ready}
              />
            )}
            {planColumn && offline && projects.length > 1 && (
              <PriButton
                id="transBackup"
                key="backup"
                aria-label={t.electronBackup}
                onClick={handleBackup}
                title={t.electronBackup}
                sx={{
                  m: 1,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  justifyContent: 'flex-start',
                }}
              >
                {t.electronBackup}
              </PriButton>
            )}
            <GrowingSpacer />
            <SelectExportType
              exportType={artifactType}
              exportTypes={artifactTypes}
              setExportType={setArtifactType}
            />
          </TabActions>
        </TabAppBar>
        {alertOpen && (
          <Alert
            severity="warning"
            onClose={() => {
              setAlertOpen(false);
            }}
          >
            {t.offlineData}
          </Alert>
        )}
        <PaddedBox sx={{ pl: 2 }}>
          <TreeDataGrid
            columns={columns}
            rows={data}
            recIdName="recId"
            expanded={setOpenSections}
            columnVisibilityModel={columnVisibilityModel}
            onColumnVisibilityModelChange={setColumnVisibilityModel}
            disableColumnSorting
            initialState={{
              sorting: { sortModel },
            }}
            sx={{ '& .word-wrap': { wordWrap: 'break-spaces' } }}
          />
        </PaddedBox>
      </div>

      {passageId !== '' && (
        <TranscriptionShow
          id={passageId}
          visible={passageId !== ''}
          closeMethod={handleCloseTranscription}
          exportId={exportId}
        />
      )}
      {openExport && (
        <WhichExportDlg
          {...{ project, openExport, setOpenExport, doProjectExport }}
        />
      )}
      <a ref={exportAnchor} href={exportUrl} download={exportName} />
      <a ref={eafAnchor} href={dataUrl} download={dataName} />
    </Box>
  );
}

export default TranscriptionTab;
