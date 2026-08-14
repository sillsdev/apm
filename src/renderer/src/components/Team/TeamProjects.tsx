import React from 'react';
import { Box } from '@mui/material';
import { TeamContext } from '../../context/TeamContext';
import { useGlobal } from '../../context/useGlobal';
import { related } from '../../crud';
import { usePlan } from '../../crud/usePlan';
import ImportTab from '../ImportTab';
import { TeamItem } from '.';
import { CardSizeProvider } from './CardSize';
import PersonalItem from './PersonalItem';

export const TeamProjects = () => {
  const [offline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [offlineOnly] = useGlobal('offlineOnly'); //will be constant here
  const ctx = React.useContext(TeamContext);
  const { teams, importOpen, setImportOpen, importProject, personalProjects } =
    ctx.state;
  const { getPlanName } = usePlan();

  return (
    <>
      <CardSizeProvider>
        <Box
          sx={(theme) => ({
            display: 'flex',
            flexDirection: 'column',
            gap: theme.layout.gap,
          })}
        >
          {(personalProjects.length > 0 || !offline || offlineOnly) && (
            <PersonalItem key={1} />
          )}
          {teams.map((i) => {
            return <TeamItem key={i.id} team={i} />;
          })}
        </Box>
      </CardSizeProvider>
      {importOpen && (
        <ImportTab
          isOpen={importOpen}
          onOpen={setImportOpen}
          planName={importProject ? getPlanName(importProject.id) : undefined}
          project={
            importProject ? related(importProject, 'project') : undefined
          } //actual project id...not plan id
          offerPtf={false}
        />
      )}
    </>
  );
};
