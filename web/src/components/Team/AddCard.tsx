import React, { useContext, useEffect, useRef, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { Card, CardActionArea, Grid } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { VProject, DialogMode, ICardsStrings } from '../../model';
import { cardsSelector } from '../../selector';
import { TeamContext, TeamIdType } from '../../context/TeamContext';
import { useGlobal } from '../../context/useGlobal';
import { ILanguage } from '../../control';
import { initLang } from '../../control/initLang';
import Progress from '../../control/UploadProgress';
import { usePlan, useOrgDefaults, orgDefaultLangProps } from '../../crud';
import { projDefBook, projDefStory } from '../../crud/useProjectDefaults';
import { useSetTeamLanguageForNewProject } from '../../crud/useSetTeamLanguage';
import { useHome, useJsonParams } from '../../utils';
import StickyRedirect from '../StickyRedirect';
import { ProjectDialog } from './ProjectDialog';
import {
  initProjectState,
  IProjectDialog,
} from './ProjectDialog/projectDialogTypes';
import { useCardHeight } from '../CardSize/useCardSize';

interface IProps {
  team: TeamIdType;
}

export const AddCard = (props: IProps) => {
  const { team } = props;

  const ctx = useContext(TeamContext);
  const {
    projectCreate,
    teamProjects,
    personalProjects,
    personalTeam,
    loadProject,
    generalBook,
  } = ctx.state;
  // Personal projects belong to the user's personal team. Without a team id,
  // org defaults and the dialog's member lists fall back to the global
  // organization: the team of the last project opened, some other team.
  // (generalBook keeps team?.id: with none it reads every personal project.)
  const teamId = team?.id ?? personalTeam;
  const t: ICardsStrings = useSelector(cardsSelector, shallowEqual);
  const cardHeight = useCardHeight();

  const { leaveHome } = useHome();
  const { getOrgDefault } = useOrgDefaults();
  const setTeamLanguageForNewProject = useSetTeamLanguageForNewProject();
  const [open, setOpen] = useState(false);
  const [inProgress] = useState(false);

  const [, setLanguagex] = useState<ILanguage>(initLang);
  const [projDef, setProjDef] = useState({
    ...initProjectState,
    isPersonal: !team,
  });
  const languageRef = useRef<ILanguage>(initLang);
  const [complete] = useGlobal('progress'); //verified this is not used in a function 2/18/25S
  const [, setBusy] = useGlobal('importexportBusy');
  const [steps] = useState([
    t.projectCreated,
    t.mediaUploaded,
    t.passagesCreated,
  ]);

  const stepRef = useRef(0);
  const cancelled = useRef(false);
  const [isDeveloper] = useGlobal('developer');
  const preventBoth = useRef(false);
  const [view] = useState('');
  const { getPlan } = usePlan();
  const { setParam } = useJsonParams();

  useEffect(() => {
    // The personal team id loads after mount; read its language once it does.
    if (!teamId) return;
    const language = getOrgDefault(
      orgDefaultLangProps,
      teamId
    ) as typeof initLang;
    setLanguage(language ?? initLang, true);
    // getOrgDefault and setLanguage are recreated every render; only a new
    // team id should re-read the team language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const setLanguage = (language: ILanguage, init?: boolean) => {
    languageRef.current = language;
    setLanguagex(language);
    setProjDef({ ...projDef, ...language });
    if (!init && teamId) {
      setTeamLanguageForNewProject(language, teamId);
    }
  };

  const handleSolutionShow = (e: React.MouseEvent) => {
    if (team && !isDeveloper && !open) {
      handleClickOpen(e);
      return;
    }
    if (!preventBoth.current) setOpen(true);
    preventBoth.current = false;
  };

  const handleProject = () => {
    setOpen(false);
    preventBoth.current = true;
  };

  const handleClickOpen = (e: React.MouseEvent) => {
    setOpen(true);
    preventBoth.current = true;
    e.stopPropagation();
  };

  const nameInUse = (newName: string) => {
    const projects = team ? teamProjects(team.id) : personalProjects;
    const trimmed = newName.trim();
    const sameNameRec = projects.filter(
      (p) => (p?.attributes?.name ?? '').trim() === trimmed
    );
    return sameNameRec.length > 0;
  };

  const handleCommit = (values: IProjectDialog) => {
    setBusy(true);
    const {
      name,
      description,
      type,
      bcp47,
      languageName,
      font,
      isPublic,
      spellCheck,
      rtl,
      tags,
      organizedBy,
      book,
      story,
      sheetUser,
      sheetGroup,
      publishUser,
      publishGroup,
    } = values;
    let defaultParams = setParam(
      projDefBook,
      book || generalBook(team?.id),
      '{}'
    );
    defaultParams = setParam(projDefStory, story, defaultParams);
    setLanguage({ bcp47, languageName, font, rtl, spellCheck });
    projectCreate(
      {
        attributes: {
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
          defaultParams,
          sheetUser,
          sheetGroup,
          publishUser,
          publishGroup,
        },
      } as VProject,
      team
    )
      .then((planId) => {
        const planRec = getPlan(planId);
        if (planRec) {
          loadProject(planRec);
          leaveHome();
        }
      })
      .finally(() => setBusy(false));
  };

  const cancelUpload = () => {
    cancelled.current = true;
  };

  if (view !== '') return <StickyRedirect to={view} />;

  return (
    <>
      <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
        <Card
          id={`teamAdd-${team}`}
          sx={{
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'center',
            height: '100%',
            minHeight: cardHeight,
            bgcolor: 'primary.light',
            color: 'primary.contrastText',
          }}
        >
          <CardActionArea onClick={handleSolutionShow} sx={{ display: 'flex' }}>
            <AddIcon fontSize="large" />
          </CardActionArea>
        </Card>
      </Grid>
      <ProjectDialog
        mode={DialogMode.add}
        isOpen={open}
        onOpen={handleProject}
        onCommit={handleCommit}
        nameInUse={nameInUse}
        values={projDef}
        team={teamId || undefined}
      />
      <Progress
        title={t.uploadProgress}
        open={inProgress && !cancelled.current}
        progress={complete}
        steps={steps}
        currentStep={stepRef.current}
        action={cancelUpload}
        allowCancel={true}
      />
    </>
  );
};
