import { useContext, useMemo, useState, useEffect } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import { RecordKeyMap } from '@orbit/records';
import {
  Box,
  Card,
  CardActionArea,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Tooltip,
  Typography,
} from '@mui/material';
import EditNoteIcon from '@mui/icons-material/EditNote';
import EditSquareIcon from '@mui/icons-material/EditSquare';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import ScriptureIcon from '@mui/icons-material/MenuBook';
import OfflineIcon from '@mui/icons-material/OfflinePin';
import ShareIcon from '@mui/icons-material/OfflineShare';
import PublishedWithChangesIcon from '@mui/icons-material/PublishedWithChanges';
import StoryIcon from '@mui/icons-material/RecordVoiceOver';
import {
  DialogMode,
  ICardsStrings,
  IImportStrings,
  IProjButtonsStrings,
  ISharedStrings,
  IState,
  ITranscriptionTabStrings,
  IVProjectStrings,
  ProjectD,
  Section,
  SectionArray,
  SectionD,
  VProjectD,
} from '../../model';
import { UpdateRecord } from '../../model/baseModel';
import * as actions from '../../store';
import { CopyProjectProps } from '../../store';
import {
  cardsSelector,
  importSelector,
  projButtonsSelector,
  sharedSelector,
  transcriptionTabSelector,
  vProjectSelector,
} from '../../selector';
import { TeamContext } from '../../context/TeamContext';
import { TokenContext } from '../../context/TokenProvider';
import { useGetGlobal, useGlobal } from '../../context/useGlobal';
import {
  usePlan,
  useProjectPlans,
  useOrganizedBy,
  useOfflnProjRead,
  useOfflineAvailToggle,
  related,
  useRole,
  remoteIdNum,
  BOLD_WORKFLOW_PROCESS,
  useTeamWorkflowProcess,
} from '../../crud';
import {
  projDefBook,
  projDefSectionMap,
  projDefStory,
  useProjectDefaults,
} from '../../crud/useProjectDefaults';
import BigDialog from '../../hoc/BigDialog';
import { useSnackBar } from '../../hoc/SnackBar';
import { useOrbitData } from '../../hoc/useOrbitData';
import { useDataChanges, useHome, useJsonParams, useMobile } from '../../utils';
import { localizeProjectTag } from '../../utils/localizeProjectTag';
import { useProjectPermissions } from '../../utils/useProjectPermissions';
import Confirm from '../AlertDialog';
import { TeamSelector } from '../ImportTab';
import IntegrationTab from '../Integration';
import ExportTab from '../TranscriptionTab';
import { useAdminTeams } from '../useAdminTeams';
import CategoryTabs from './CategoryTabs';
import ProjectMenu from './ProjectMenu';
import { ProjectDialog } from './ProjectDialog';
import { IProjectDialog } from './ProjectDialog/projectDialogTypes';
import { useCardHeight, useMeasureCardHeight } from './useCardSize';
import { Button } from '../../control/Button';

interface IProps {
  project: VProjectD;
}

export const ProjectCard = (props: IProps) => {
  const { project } = props;
  const ctx = useContext(TeamContext);
  const {
    loadProject,
    setProjectParams,
    projectSections,
    projectDescription,
    projectLanguage,
    projectUpdate,
    projectDelete,
    personalProjects,
    doImport,
  } = ctx.state;
  const vProjectStrings: IVProjectStrings = useSelector(
    vProjectSelector,
    shallowEqual
  );
  const dispatch = useDispatch();
  const forceDataChanges = useDataChanges();

  const copyProject = (props: CopyProjectProps) =>
    dispatch(actions.copyProject(props) as any);
  const copyStatus = useSelector(
    (state: IState) => state.importexport.importexportStatus
  );
  const copyComplete = () => dispatch(actions.copyComplete() as any);
  const [copying, setCopying] = useState(false);
  const accessToken = useContext(TokenContext)?.state?.accessToken ?? null;
  const [errorReporter] = useGlobal('errorReporter');
  const [memory] = useGlobal('memory');
  const { showMessage } = useSnackBar();
  const [, setBusy] = useGlobal('importexportBusy');
  const { getPlanName } = usePlan();
  const { localizedOrganizedBy } = useOrganizedBy();
  const [, setOrganizedBySing] = useState('');
  const [, setOrganizedByPlural] = useState('');
  const [projectId] = useGlobal('project'); //verified this is not used in a function 2/18/25
  const [user] = useGlobal('user');
  const projectPlans = useProjectPlans();
  const offlineProjectRead = useOfflnProjRead();
  const offlineAvailToggle = useOfflineAvailToggle();
  const [openProject, setOpenProject] = useState(false);
  const [openIntegration, setOpenIntegration] = useState(false);
  const [openExport, setOpenExport] = useState(false);
  // const [openReports, setOpenReports] = useState(false);
  const [openCategory, setOpenCategory] = useState(false);
  const [deleteItem, setDeleteItem] = useState<VProjectD>();
  const [open, setOpen] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [openCopyDialog, setOpenCopyDialog] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const { getProjectDefault } = useProjectDefaults();
  const { isMobileWidth } = useMobile();
  const t: ICardsStrings = useSelector(cardsSelector, shallowEqual);
  const tt: ITranscriptionTabStrings = useSelector(
    transcriptionTabSelector,
    shallowEqual
  );
  const tpb: IProjButtonsStrings = useSelector(
    projButtonsSelector,
    shallowEqual
  );
  const { userIsOrgAdmin } = useRole();
  const { leaveHome } = useHome();
  const { getParam, setParam } = useJsonParams();
  const sections = useOrbitData<Section[]>('section');
  const getGlobal = useGetGlobal();
  const handleSelect = (project: VProjectD) => () => {
    loadProject(project);
    leaveHome();
  };
  const { canPublish, canEditSheet } = useProjectPermissions(
    related(project, 'organization'),
    related(project, 'project')
  );
  const teams = useAdminTeams();
  const cardHeight = useCardHeight();
  const contentRef = useMeasureCardHeight(project.id);
  const tImport: IImportStrings = useSelector(importSelector, shallowEqual);
  const tShared: ISharedStrings = useSelector(sharedSelector, shallowEqual);

  useEffect(() => {
    if (open !== '') doOpen(open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, open]);

  useEffect(() => {
    setOrganizedBySing(
      localizedOrganizedBy(project.attributes.organizedBy, true)
    );
    setOrganizedByPlural(
      localizedOrganizedBy(project.attributes.organizedBy, false)
    );
    setIsAdmin(userIsOrgAdmin(related(project, 'organization')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  useEffect(() => {
    if (copying && copyStatus) {
      if (copyStatus.errStatus || copyStatus.complete) {
        if (copyStatus.complete) {
          showMessage(
            tt.downloading.replace('{0}', copyStatus.statusMsg ?? '')
          );
          forceDataChanges().finally(() => {
            setBusy(false);
            showMessage(
              t.copyComplete.replace('{0}', copyStatus.statusMsg ?? '')
            );
            copyComplete();
            setCopying(false);
          });
        } else {
          showMessage(copyStatus.errMsg ?? copyStatus.statusMsg);
          copyComplete();
          setCopying(false);
        }
      } else showMessage(copyStatus.statusMsg);
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [copyStatus]);

  const LoadAndGo = async (what: string) => {
    loadProject(project, () => {
      switch (what) {
        case 'import':
          doImport(project);
          break;
        case 'export':
          setOpenExport(true);
          break;
        // case 'reports':
        //   setOpenReports(true);
        //   break;
        case 'offlineAvail':
          offlineAvailToggle(related(project, 'project'));
          break;
      }
    });
  };

  const doOpen = (what: string) => {
    switch (what) {
      case 'settings':
        setOpenProject(true);
        break;
      case 'integration':
        if (isMobileWidth) {
          showMessage(tShared.notSupported);
          break;
        }
        setOpenIntegration(true);
        break;
      case 'delete':
        setDeleteItem(project);
        break;
      case 'category':
        if (isMobileWidth) {
          showMessage(tShared.notSupported);
          break;
        }
        setOpenCategory(true);
        break;
      case 'copyproject':
        setOpenCopyDialog(true);
        break;
      case 'import':
      case 'export':
      case 'reports':
      case 'offlineAvail':
        if (isMobileWidth) {
          showMessage(tShared.notSupported);
          break;
        }
        LoadAndGo(what);
    }
    setOpen('');
  };

  const handleCloseCategory = () => {
    setOpenCategory(false);
  };

  const handleProjectAction = (what: string) => {
    const [projectid] = setProjectParams(project);
    //otherwise it will be done in the useEffect for projectId
    if (projectid === getGlobal('project')) doOpen(what);
    else setOpen(what);
  };

  const handleOpen = (open: boolean) => {
    setOpenProject(open);
  };

  const handleCommit = (values: IProjectDialog) => {
    const {
      name,
      description,
      type,
      languageName,
      isPublic,
      spellCheck,
      rtl,
      tags,
      organizedBy,
      book,
      story,
      sheetGroup,
      sheetUser,
      publishGroup,
      publishUser,
    } = values;
    const oldBook = getParam(
      projDefBook,
      project?.attributes?.defaultParams
    ) as string;
    let defaultParams = setParam(
      projDefBook,
      book,
      project?.attributes?.defaultParams
    );
    defaultParams = setParam(projDefStory, story, defaultParams);
    projectUpdate({
      ...project,
      attributes: {
        ...project.attributes,
        name,
        description,
        type,
        language: values?.bcp47 ?? 'und',
        languageName,
        isPublic,
        spellCheck,
        defaultFont: values.font,
        defaultFontSize: values.fontSize,
        rtl,
        tags,
        flat: values.flat,
        organizedBy,
        defaultParams: defaultParams || '',
        sheetUser,
        sheetGroup,
        publishUser,
        publishGroup,
      },
    });
    if (oldBook !== book) UpdatePublishingBookRows(oldBook, book);
  };
  const UpdatePublishingBookRows = (oldbook: string, book: string) => {
    const rows = sections.filter((s) => related(s, 'plan') === project.id);
    const labels = ['BOOK', 'ALTBK'];
    labels.forEach((label) => {
      const books = rows.filter((s) =>
        s.attributes?.state?.startsWith(label)
      ) as SectionD[];
      books.forEach((row) => {
        if (book) {
          row.attributes.state = row.attributes.state = `${label} ${book}`;
          row.attributes.name = row.attributes.name.replace(oldbook, book);
          memory.update((t) => UpdateRecord(t, row, user));
        } else memory.update((t) => t.removeRecord(row));
      });
    });
  };
  const handleDeleteConfirmed = () => {
    if (!deleteItem) return;
    projectDelete(deleteItem);
    setDeleteItem(undefined);
  };

  const handleDeleteRefused = () => {
    setDeleteItem(undefined);
  };

  const handleCopyConfirm = () => {
    setOpenCopyDialog(false);
    setCopying(true);
    setBusy(true);
    const teamName =
      selectedTeamId === 'new'
        ? t.newTeam
        : teams.find((t) => t.id === selectedTeamId)?.attributes.name || '';
    copyProject({
      projectid: remoteIdNum(
        'project',
        getGlobal('project'),
        memory?.keyMap as RecordKeyMap
      ),
      orgid:
        selectedTeamId === 'new'
          ? 0
          : remoteIdNum(
              'organization',
              selectedTeamId,
              memory?.keyMap as RecordKeyMap
            ),
      token: accessToken,
      errorReporter: errorReporter,
      pendingmsg: t.copyStatus.replace('{0}', teamName),
      completemsg: '{0}',
    });
    setSelectedTeamId('');
  };

  const handleCopyCancel = () => {
    setOpenCopyDialog(false);
    setSelectedTeamId('');
  };

  const isStory = useMemo(
    () =>
      (getProjectDefault(
        projDefStory,
        project as any as ProjectD
      ) as boolean) ?? true,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project]
  );

  const projectValues = (project: VProjectD) => {
    const attr = project.attributes;
    const value: IProjectDialog = {
      name: attr.name,
      description: attr.description || '',
      type: attr?.type,
      book:
        (getProjectDefault(
          projDefBook,
          project as any as ProjectD
        ) as string) || '',
      story: isStory,
      bcp47: attr.language,
      languageName: attr.languageName || '',
      isPublic: attr.isPublic,
      spellCheck: attr.spellCheck || false,
      font: attr.defaultFont || '',
      rtl: attr.rtl,
      fontSize: attr.defaultFontSize || '',
      tags: attr.tags || {},
      flat: attr.flat,
      organizedBy: attr.organizedBy || vProjectStrings.sections,
      isPersonal: personalProjects.includes(project),
      vProjectStrings: vProjectStrings,
      sheetUser: related(project, 'editsheetuser'),
      sheetGroup: related(project, 'editsheetgroup'),
      publishUser: related(project, 'publishuser'),
      publishGroup: related(project, 'publishgroup'),
    };
    return value;
  };

  // DateTime locale is set globally, no need to set per component

  const sectionCount = useMemo(
    () => projectSections(project),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project]
  );

  const orgId = related(project, 'organization') as string;
  const teamWorkflow = useTeamWorkflowProcess(orgId);
  const showBoldCardMark = teamWorkflow === BOLD_WORKFLOW_PROCESS;

  const showOffline = Boolean(
    offlineProjectRead(project).attributes?.offlineAvailable
  );
  const showEditSheet = canEditSheet && !isAdmin;
  const showPublish = canPublish && !isAdmin;
  const showStatusRow = showOffline || showEditSheet || showPublish;

  return (
    <>
      <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
        <Card
          id={`card-${project.id}`}
          sx={{
            position: 'relative',
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'center',
            height: '100%',
            minHeight: cardHeight,
            bgcolor: 'primary.light',
            color: 'primary.contrastText',
          }}
        >
          <CardActionArea
            onClick={handleSelect(project)}
            sx={{
              display: 'flex',
              alignItems: 'stretch',
              justifyContent: 'center',
              height: '100%',
              p: 1.5,
            }}
          >
            <Box
              ref={contentRef}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 1,
                width: '100%',
                height: '100%',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  width: '100%',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    minWidth: 0,
                    pr: '40px',
                  }}
                >
                  {showBoldCardMark ? (
                    <FormatBoldIcon />
                  ) : (project?.attributes?.type || '').toLowerCase() ===
                    'scripture' ? (
                    <ScriptureIcon sx={{ p: 0.5 }} />
                  ) : isStory ? (
                    <StoryIcon sx={{ p: 0.5 }} />
                  ) : (
                    <EditSquareIcon sx={{ p: 0.5 }} />
                  )}
                  {project.attributes.isPublic && <ShareIcon />}
                  <Tooltip title={project?.attributes?.name ?? ''}>
                    <Typography noWrap sx={{ fontSize: 'large' }}>
                      {project?.attributes?.name}
                    </Typography>
                  </Tooltip>
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5,
                    px: 0.5,
                  }}
                >
                  <Tooltip title={projectDescription(project)}>
                    <Typography noWrap>
                      {projectDescription(project)}
                    </Typography>
                  </Tooltip>
                  <Typography noWrap sx={{ fontSize: 'small' }}>
                    {t.language.replace('{0}', projectLanguage(project))}
                  </Typography>
                  <Typography noWrap sx={{ fontSize: 'small' }}>
                    {sectionCount !== '<na>' && sectionCount}
                  </Typography>
                </Box>
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 0.5,
                  minWidth: 0,
                  px: 0.5,
                }}
              >
                {Object.keys(project?.attributes?.tags ?? {})
                  .filter((t) => project?.attributes?.tags[t])
                  .map((t) => (
                    <Chip
                      key={t}
                      size="small"
                      sx={{
                        backgroundColor: 'primary.dark',
                        color: 'primary.contrastText',
                      }}
                      label={localizeProjectTag(t, vProjectStrings)}
                    />
                  ))}
              </Box>
              {showStatusRow && (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 0.5,
                    width: '100%',
                    minWidth: 0,
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      minWidth: 0,
                    }}
                  >
                    {showOffline && (
                      <>
                        <OfflineIcon sx={{ p: 0.5 }} />
                        <Typography noWrap>{t.offline}</Typography>
                      </>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5, minWidth: 0 }}>
                    {showEditSheet && <EditNoteIcon sx={{ p: 0.5 }} />}
                    {showPublish && (
                      <PublishedWithChangesIcon sx={{ p: 0.5 }} />
                    )}
                  </Box>
                </Box>
              )}
            </Box>
          </CardActionArea>
          <Box
            sx={(theme) => ({
              position: 'absolute',
              top: theme.spacing(1.5),
              right: theme.spacing(1.5),
            })}
          >
            <ProjectMenu
              action={handleProjectAction}
              project={project}
              inProject={false}
              isAdmin={isAdmin}
              isPersonal={personalProjects.includes(project)}
              canPublish={canPublish}
            />
          </Box>
        </Card>
      </Grid>
      <ProjectDialog
        mode={DialogMode.edit}
        values={projectValues(project)}
        isOpen={openProject}
        onOpen={handleOpen}
        onCommit={handleCommit}
      />
      <BigDialog
        title={tpb.integrationsTitle.replace('{0}', getPlanName(project.id))}
        isOpen={openIntegration}
        onOpen={setOpenIntegration}
      >
        {openIntegration ? (
          <IntegrationTab
            isPermitted={true}
            projectId={related(project, 'project')}
            planId={project.id}
          />
        ) : (
          <></>
        )}
      </BigDialog>
      <BigDialog
        title={tpb.exportTitle.replace('{0}', getPlanName(project.id))}
        isOpen={openExport}
        onOpen={setOpenExport}
      >
        <ExportTab
          {...props}
          projectPlans={projectPlans(projectId)}
          planColumn={true}
          sectionArr={
            (getProjectDefault(projDefSectionMap) as SectionArray) ?? []
          }
        />
      </BigDialog>
      {/* <BigDialog
        title={tpb.reportsTitle.replace('{0}', getPlanName(project.id))}
        isOpen={openReports}
        onOpen={setOpenReports}
      >
        <Visualize selectedPlan={project.id} />
      </BigDialog> */}
      <BigDialog
        title={
          !personalProjects.includes(project)
            ? t.editCategory
            : t.editPersonalCategory
        }
        isOpen={openCategory}
        onOpen={setOpenCategory}
      >
        <CategoryTabs
          teamId={related(project, 'organization') as string}
          flat={project.attributes.flat ?? false}
          onClose={handleCloseCategory}
        />
      </BigDialog>
      {deleteItem && (
        <Confirm
          text={''}
          yesResponse={handleDeleteConfirmed}
          noResponse={handleDeleteRefused}
        />
      )}
      <Dialog open={openCopyDialog} onClose={handleCopyCancel}>
        <DialogTitle>{t.copyProject}</DialogTitle>
        <DialogContent>
          <TeamSelector
            selectedTeamId={selectedTeamId}
            onTeamChange={setSelectedTeamId}
            teams={teams}
            includeNewTeam={true}
            selectLabel={tImport?.selectTeam}
            createNewLabel={tImport?.createNewTeam}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCopyCancel}>{t.cancel}</Button>
          <Button
            onClick={handleCopyConfirm}
            variant="contained"
            disabled={copying || selectedTeamId === ''}
          >
            {t.copyProject}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
