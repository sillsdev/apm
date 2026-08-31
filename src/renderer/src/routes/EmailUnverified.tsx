import { useContext, useEffect, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { useAuth0 } from '@auth0/auth0-react';
import { Alert, Box, CircularProgress, Paper, Typography } from '@mui/material';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import Axios from 'axios';
import { API_CONFIG, isElectron } from '../../api-variable';
import { IEmailUnverifiedStrings } from '../model';
import { TokenContext } from '../context/TokenProvider';
import { Button } from '../control';
import { emailUnverifiedSelector } from '../selector';
import { useMounted, useMyNavigate } from '../utils';
import { doLogout, goOnline } from './accessActions';

const resendCooldownSec = 20;

export const EmailUnverified = () => {
  const isMounted = useMounted('unverfied');
  const navigate = useMyNavigate();
  const { getAccessTokenSilently, user } = useAuth0();
  const { accessToken, setAuthSession } = useContext(TokenContext).state;
  const [view, setView] = useState('');
  const [status, setStatus] = useState<'' | 'sent' | 'error'>('');
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const t: IEmailUnverifiedStrings = useSelector(
    emailUnverifiedSelector,
    shallowEqual
  );

  const handleResend = () => {
    const url = API_CONFIG.host + '/api/auth/resend';
    setStatus(''); // clear any prior result while this attempt is in flight
    setResending(true);
    Axios.get(url, {
      headers: {
        Authorization: 'Bearer ' + accessToken,
      },
    })
      .then(() => {
        if (!isMounted()) return;
        setStatus('sent');
        setCooldown(resendCooldownSec);
      })
      .catch((err) => {
        console.error('resend verification email failed', err);
        if (isMounted()) setStatus('error');
      })
      .finally(() => {
        if (isMounted()) setResending(false);
      });
  };

  const handleLogout = () => {
    doLogout();
    setView('Logout');
  };

  const handleVerified = async () => {
    if (!isElectron) {
      handleLogout();
    } else {
      goOnline();
    }
  };

  // Tick the cooldown down to zero, one second at a time.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (user?.email_verified) {
      (async () => {
        const token = await getAccessTokenSilently();
        if (!isMounted()) return;
        setAuthSession(user, token);
        setView('Loading');
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (/Logout/i.test(view)) navigate('/logout');
  if (/Loading/i.test(view)) navigate('/loading');

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        width: '100%',
        minHeight: '100dvh',
        p: 2,
        bgcolor: 'grey.100',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          boxSizing: 'border-box',
          width: '100%',
          maxWidth: 440,
          p: 4,
          border: 1,
          borderColor: 'divider',
          borderRadius: 3,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'center',
            p: 1.5,
            borderRadius: 2,
            bgcolor: 'grey.100',
          }}
        >
          <EmailOutlinedIcon fontSize="large" />
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {t.emailUnverified}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ pt: 1 }}>
            {t.verify}
          </Typography>
        </Box>
        {user?.email && (
          <Box
            sx={{
              px: 2,
              py: 1.5,
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              textAlign: 'center',
              overflowWrap: 'anywhere',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {user.email}
            </Typography>
          </Box>
        )}
        {status && (
          <Alert severity={status === 'error' ? 'error' : 'success'}>
            {status === 'error' ? t.resendError : t.resendSuccess}
          </Alert>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Button
            id="emailVerified"
            onClick={handleVerified}
            variant="contained"
            color="primary"
            fullWidth
          >
            {t.verified}
          </Button>
          <Button
            id="emailResent"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            startIcon={
              resending ? (
                <CircularProgress size={18} color="inherit" />
              ) : undefined
            }
            variant="outlined"
            color="primary"
            fullWidth
          >
            {cooldown > 0
              ? t.resendWait.replace('{0}', cooldown.toString())
              : t.resend}
          </Button>
        </Box>
        <Button
          id="emailLogout"
          onClick={handleLogout}
          variant="text"
          color="primary"
          fullWidth
        >
          {t.logout}
        </Button>
      </Paper>
    </Box>
  );
};

export default EmailUnverified;
