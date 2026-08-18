import { Badge, Box, BoxProps, styled } from '@mui/material';
import { useEffect, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { DialogMode } from '../../model';
import TeamDialog from './TeamDialog';
import { AltButton } from '../../control';
import AddIcon from '@mui/icons-material/Add';
import ImportTab from '../ImportTab';
import { BigDialogBp } from '../../hoc/BigDialogBp';
import { useTeamActions } from './useTeamActions';
import { SharedContentCreatorDialog } from './SharedContentCreatorDialog';
import { PendingUploadsDialog } from './PendingUploadsDialog';
import { isElectron } from '../../../api-variable';
import { pendingMediaUploadCount } from '../../store/upload/pendingMediaUploads';
import { mediaTabSelector } from '../../selector';

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
    connected,
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

  const mt = useSelector(mediaTabSelector, shallowEqual);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    setPendingCount(pendingMediaUploadCount());
  }, [pendingOpen, importOpen]);

  return (
    <RootBox>
      {!offline && connected && (
        <AltButton id="TeamActAdd" sx={{ mb: 2 }} onClick={handleAddClick}>
          {t.addTeam}
        </AltButton>
      )}
      <AltButton id="teamActImport" sx={{ mb: 2 }} onClick={handleImportClick}>
        {t.import}
      </AltButton>
      {isElectron && !offline && (
        <AltButton
          id="teamActPendingUploads"
          sx={{ mb: 2 }}
          onClick={() => setPendingOpen(true)}
        >
          <Badge
            badgeContent={pendingCount}
            color="warning"
            overlap="rectangular"
          >
            <span>{mt.pendingUploadMenu}</span>
          </Badge>
        </AltButton>
      )}
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
      {importOpen && (
        <ImportTab
          isOpen={importOpen}
          onOpen={setImportOpen}
          offerPtf={!offline}
        />
      )}
      <PendingUploadsDialog
        open={pendingOpen}
        onClose={() => setPendingOpen(false)}
      />
    </RootBox>
  );
};

export default TeamActions;
