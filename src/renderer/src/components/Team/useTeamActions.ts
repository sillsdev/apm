import { useContext, useState, ChangeEvent } from 'react';
import { useGlobal } from '../../context/useGlobal';
import { TeamContext } from '../../context/TeamContext';
import { TokenContext } from '../../context/TokenProvider';
import { useRole } from '../../crud';
import { useSnackBar } from '../../hoc/SnackBar';
import { useMyNavigate } from '../../utils';
import { axiosPost } from '../../utils/axios';
import { validateEmail } from '../../utils/validateEmail';
import { errStatus } from '../../store/AxiosStatus';
import type { ITeamDialog } from './TeamDialog';

export function useTeamActions() {
  const ctx = useContext(TeamContext);
  const { teamCreate, cardStrings, isDeleting, sharedStrings } = ctx.state;
  const [, setBusy] = useGlobal('remoteBusy');
  const [offline] = useGlobal('offline');
  const [isDeveloper] = useGlobal('developer');
  const { userIsSharedContentAdmin } = useRole();
  const tokenctx = useContext(TokenContext).state;
  const { showMessage } = useSnackBar();
  const navigate = useMyNavigate();

  const [openAdd, setOpenAdd] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [openContent, setOpenContent] = useState(false);
  const [email, setEmail] = useState('');
  const [validEmail, setValidEmail] = useState(false);
  const [contentStatus, setContentStatus] = useState('');

  const t = cardStrings;
  const ts = sharedStrings;

  const handleAddClick = () => setOpenAdd(true);
  const handleImportClick = () => setImportOpen(true);
  const handleContentClick = () => setOpenContent(true);
  const handleAdded = () => setOpenAdd(false);
  const handleContentDone = () => {
    setContentStatus('');
    setEmail('');
    setOpenContent(false);
  };

  const handleAddCommit = (
    value: ITeamDialog,
    cb?: (id: string) => Promise<void>
  ) => {
    setBusy(true);
    teamCreate(value.team, value.process ?? '', async (id: string) => {
      cb && (await cb(id));
      setOpenAdd(false);
    });
  };

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase();
    setEmail(value);
    setValidEmail(validateEmail(value));
  };

  const handleSharedContentClick = () => {
    if (!validEmail) return;
    setValidEmail(false);
    setContentStatus(ts.saving);
    axiosPost(
      `users/sharedcreator/${encodeURIComponent(email)}/true`,
      null,
      tokenctx.accessToken || undefined
    )
      .then(() => {
        showMessage(t.creatorOK);
        handleContentDone();
      })
      .catch((err) => {
        setContentStatus(errStatus(err).errMsg);
      });
  };

  return {
    t,
    ts,
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
  };
}
