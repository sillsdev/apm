import { useEffect } from 'react';
import { IconButton } from '@mui/material';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdateAlt';
import { shallowEqual, useSelector } from 'react-redux';
import { IMainStrings, IState } from '../../model';
import { useGlobal } from '../../context/useGlobal';
import { isElectron } from '../../../api-variable';
import { LocalKey } from '../../utils/localUserKey';
import { mainSelector } from '../../selector';
import { AlertSeverity, useSnackBar } from '../../hoc/SnackBar';
import { axiosPost } from '../../utils/axios';
import logError, { Severity } from '../../utils/logErrorService';
import { infoMsg } from '../../utils/infoMsg';
import {
  formatReleaseDate,
  isNewerVersion,
  parseLatestVersion,
} from '../../utils/appUpdate';
import packageJson from '../../../package.json';
import { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;

export const appVersion = packageJson.version;

const DOWNLOAD_URL = 'https://software.sil.org/audioprojectmanager/download/';

export const openUpdateDownload = () => {
  if (isElectron) void ipc?.openExternal(DOWNLOAD_URL); // fire-and-forget: opening the browser has no result to handle
};

// AppHead is mounted by several layouts (and remounts across routes), so the
// in-flight guard is module-level: one request per app session, not per mount.
let requestInFlight = false;

/**
 * Asks the server (userversions → currentversion row) for the latest desktop
 * version once per session and, on desktop, announces a newer one with a
 * snackbar. Lives in AppHead rather than HeadStatus because HeadStatus is not
 * rendered at mobile width, and deep links can start on any screen.
 */
export function useUpdateCheck() {
  const [connected] = useGlobal('connected');
  const [latestVersion, setLatestVersion] = useGlobal('latestVersion');
  const [, setReleaseDate] = useGlobal('releaseDate');
  const [errorReporter] = useGlobal('errorReporter');
  const lang = useSelector((state: IState) => state.strings.lang);
  const t: IMainStrings = useSelector(mainSelector, shallowEqual);
  const { showMessage } = useSnackBar();

  useEffect(() => {
    // `connected` (kept current by useCheckOnline) gates the request, not
    // localStorage.connected: that key is the error-reporting flag and can be
    // stale 'false' for a whole session (it was why this check never ran).
    // When a request fails we clear the guard so the next false→true change
    // of `connected` retries it.
    if (requestInFlight || latestVersion !== '' || !connected) return;
    if (localStorage.getItem(LocalKey.updates) === 'false') return;
    requestInFlight = true;

    const check = async () => {
      try {
        const bodyFormData = new FormData();
        bodyFormData.append('env', navigator.userAgent);
        const result = (await axiosPost(
          'userversions/2/' + appVersion,
          bodyFormData
        )) as { data?: unknown }; // axiosPost returns the Axios response typed as unknown
        const info = parseLatestVersion(result?.data);
        if (!info) {
          logError(
            Severity.info,
            errorReporter,
            'userversions returned no desktopVersion'
          );
          return;
        }
        setLatestVersion(info.desktopVersion);
        setReleaseDate(info.dateUpdated);
        if (isElectron && isNewerVersion(info.desktopVersion, appVersion)) {
          showMessage(
            <span>
              {t.updateAvailable
                .replace('{0}', info.desktopVersion)
                .replace('{1}', formatReleaseDate(info.dateUpdated, lang))}
              <IconButton
                id="systemUpdateSnack"
                onClick={openUpdateDownload}
                component="span"
              >
                <SystemUpdateIcon color="primary" />
              </IconButton>
            </span>,
            AlertSeverity.Warning
          );
        }
      } catch (err) {
        // Usually just no network yet; retried when `connected` changes.
        logError(
          Severity.info,
          errorReporter,
          infoMsg(err as Error, 'userversions failed ' + navigator.userAgent)
        );
      } finally {
        requestInFlight = false;
      }
    };
    void check(); // errors are handled inside check()
    // Only `connected` and `latestVersion` drive (re)tries; strings, lang and
    // the setters are read at the moment the response arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, latestVersion]);
}
