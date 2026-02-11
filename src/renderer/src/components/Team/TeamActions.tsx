import { Box, BoxProps, styled } from '@mui/material';
import { DialogMode } from '../../model';
import TeamDialog from './TeamDialog';
import { AltButton } from '../../control';
import AddIcon from '@mui/icons-material/Add';
import ImportTab from '../ImportTab';
import { BigDialogBp } from '../../hoc/BigDialogBp';
import { useTeamActions } from './useTeamActions';
import { SharedContentCreatorDialog } from './SharedContentCreatorDialog';

const RootBox = styled(Box)<BoxProps>(({ theme }) => ({
  padding: theme.spacing(2),
  minWidth: theme.spacing(20),
  display: 'flex',
  flexDirection: 'column',
  alignContent: 'center',
}));

const TeamActions = () => {
  const {
    t,
    offline,
    isDeveloper,
    userIsSharedContentAdmin,
    isDeleting,
    navigate,
    openAdd,
    importOpen,
    setImportOpen,
    openContent,
    email,
    validEmail,
    contentStatus,
    handleAddClick,
    handleImportClick,
    handleContentClick,
    handleAdded,
    handleContentDone,
    handleAddCommit,
    handleEmailChange,
    handleSharedContentClick,
  } = useTeamActions();

  return (
    <RootBox>
      {(!offline || isDeveloper) && (
        <AltButton id="TeamActAdd" sx={{ mb: 2 }} onClick={handleAddClick}>
          {t.addTeam}
        </AltButton>
      )}
      <AltButton id="teamActImport" sx={{ mb: 2 }} onClick={handleImportClick}>
        {t.import}
      </AltButton>
      {!offline && userIsSharedContentAdmin && (
        <AltButton
          id="contentCreator"
          sx={{ mb: 2 }}
          onClick={handleContentClick}
        >
          <AddIcon fontSize="small" />
        </AltButton>
      )}
      {isDeveloper && (
        <AltButton id="Error" sx={{ mt: 2 }} onClick={() => navigate('/error')}>
          Error
        </AltButton>
      )}
      <TeamDialog
        mode={DialogMode.add}
        isOpen={openAdd}
        onOpen={handleAdded}
        onCommit={handleAddCommit}
        disabled={isDeleting}
      />
      <SharedContentCreatorDialog
        isOpen={openContent}
        onOpen={handleContentDone}
        onSave={validEmail ? handleSharedContentClick : undefined}
        onCancel={handleContentDone}
        title={t.creatorAdd}
        creatorEmail={t.creatorEmail}
        bp={BigDialogBp.sm}
        email={email}
        onEmailChange={handleEmailChange}
        validEmail={validEmail}
        contentStatus={contentStatus}
        textFieldSx={{ width: '600px' }}
      />
      {importOpen && <ImportTab isOpen={importOpen} onOpen={setImportOpen} />}
    </RootBox>
  );
};

export default TeamActions;
