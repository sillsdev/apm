import { useState, useSyncExternalStore } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { Badge, Box } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { isElectron } from '../../../api-variable';
import { DialogMode } from '../../model';
import { mediaTabSelector } from '../../selector';
import {
  pendingMediaUploadCount,
  subscribePendingMediaUploads,
} from '../../store/upload/pendingMediaUploads';
import { Button } from '../../control';
import { BigDialogBp } from '../../hoc/BigDialogBp';
import ImportTab from '../ImportTab';
import TeamDialog from './TeamDialog';
import { SharedContentCreatorDialog } from './SharedContentCreatorDialog';
import { PendingUploadsDialog } from './PendingUploadsDialog';
import { useTeamActions } from './useTeamActions';

export default function TeamActions() {
  const {
    t,
    offline,
    connected,
    offlineOnly,
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
  const pendingCount = useSyncExternalStore(
    subscribePendingMediaUploads,
    pendingMediaUploadCount
  );

  return (
    <Box
      sx={(theme) => ({
        display: 'flex',
        flexDirection: 'column',
        gap: theme.layout.gap,
      })}
    >
      {((!offline && connected) || offlineOnly) && (
        <Button id="TeamActAdd" onClick={handleAddClick}>
          {t.addTeam}
        </Button>
      )}
      <Button id="teamActImport" onClick={handleImportClick}>
        {t.import}
      </Button>
      {isElectron && !offline && (
        <Badge
          badgeContent={pendingCount}
          color="warning"
          overlap="rectangular"
        >
          <Button
            id="teamActPendingUploads"
            onClick={() => setPendingOpen(true)}
            sx={{ width: '100%' }}
          >
            {mt.pendingUploadMenu}
          </Button>
        </Badge>
      )}
      {!offline && userIsSharedContentAdmin && (
        <Button
          id="contentCreator"
          onClick={handleContentClick}
          disableTypography
        >
          <AddIcon />
        </Button>
      )}
      {isDeveloper && (
        <Button id="Error" onClick={() => navigate('/error')}>
          Error
        </Button>
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
    </Box>
  );
}
